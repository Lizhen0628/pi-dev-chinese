# 扩展

扩展是向 Pi 添加可执行行为的 TypeScript 模块。当工作流需要工具、命令、事件处理器、模型提供商、会话状态或终端界面，而不仅仅是指令时，请使用扩展。

扩展在 Pi 进程内运行，拥有相同的操作系统权限。它可以检查提示词、工具调用、文件、凭据和会话历史，因此请仅从您信任的来源加载扩展。

典型的扩展会添加代理工具、保护路径、确认危险命令、响应会话事件、修改上下文、暴露命令或显示持久状态。

<a id="quick-start"></a>
<a id="writing-an-extension"></a>
<a id="create-an-extension"></a>

## 创建并加载扩展

扩展导出一个默认工厂函数，该函数接收 `ExtensionAPI`。工厂为当前扩展运行时注册能力。

创建 `~/.pi/agent/extensions/hello.ts`：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "显示问候语",
    handler: async (name, ctx) => {
      ctx.ui.notify(`你好，${name || "世界"}！`, "info");
    },
  });
}
```

启动 Pi 并运行 `/hello`。在开发过程中，可直接加载文件：

```bash
pi --extension ./hello.ts
```

Pi 使用 `jiti`，因此本地 TypeScript 扩展无需单独的编译步骤。对于分发的扩展和依赖，请使用 [Pi 软件包](/docs/packages/)。

<a id="extension-locations"></a>
<a id="available-imports"></a>
<a id="choose-where-it-loads"></a>

## 将其添加到 Pi

将扩展放置在您的用户或项目扩展目录中。Pi 会直接加载 TypeScript 或 JavaScript 文件，以及包含 `index.ts` 或 `index.js` 入口点的子目录。

对于小型扩展，使用单个文件；对于多文件实现，使用目录。将 npm 依赖项放在附近的 `package.json` 中。有关常规位置，请参阅 [配置](/docs/configuration/)；有关其他路径，请参阅 [设置](settings.md#resources)。

重新加载会替换扩展运行时，因此 `await ctx.reload()` 之后的代码不得重用旧运行时的状态。只有个人和显式命令行扩展才能参与在项目扩展加载之前运行的 `project_trust` 事件。

<a id="understand-the-lifecycle"></a>

## 尊重运行时生命周期

工厂函数可以是同步或异步的。Pi 会等待异步工厂完成后再继续启动，以便其获取配置或在启动期间注册提供商。

不要在工厂中启动进程、套接字、监视器或定时器，因为某些调用会加载扩展而不启动会话。
从 `session_start` 或需要这些资源的命令或工具中启动长期存在的资源。
从幂等的 `session_shutdown` 处理器中关闭会话范围内的资源。

一次运行从输入和 `before_agent_start` 开始，经过模型、消息和工具事件，直到 `agent_end`。
自动重试、恢复、压缩或排队的工作可在此之后继续。
<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` 是最终的可操作边界：它可以追加条目并请求一次延续。
`agent_settled` 是最终的、仅通知性质的；当集成需要知道 Pi 不会自动继续时使用它。

<a id="extensionapi-methods"></a>

## 选择集成点

| 能力 | 主要 API |
|---|---|
| 观察或修改生命周期行为 | `pi.on()` |
| 添加模型可调用的操作 | `pi.registerTool()` |
| 添加 `/` 命令 | `pi.registerCommand()` |
| 添加快捷键或 CLI 标志 | `pi.registerShortcut()` 或 `pi.registerFlag()` |
| 发送用户或自定义消息 | `pi.sendUserMessage()` 或 `pi.sendMessage()` |
| 持久化非上下文会话数据 | `pi.appendEntry()` |
| 更改活动工具、模型或思考级别 | `pi` 上的会话控制方法 |
| 添加模型提供商 | `pi.registerProvider()` |
| 添加终端渲染 | 渲染器注册和 `ctx.ui` |
| 与另一个扩展通信 | `pi.events` |

使用 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 中导出的声明来获取精确的事件、上下文、工具和结果类型。

## 遵循扩展契约

<a id="events"></a>
<a id="work-with-events"></a>

### 事件与并发

处理器按扩展加载和注册顺序执行。`pi.on()` 返回一个函数，用于取消该注册；更改不会影响已在进行中的分发。
有些事件用于通知；其他事件则用于转换数据、替换结果或取消操作。
请使用每个事件声明的结果类型，而不是假设每个返回值都有作用。

事件涵盖资源发现、会话、代理与消息生命周期、提供商、工具以及原始输入。

`before_agent_start` 同时暴露当前提示词及其结构化的 `systemPromptOptions`。建议修改提示词部分、所选工具或指南，以便 Pi 能够追加对话增量。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换该次运行的整个提示词，而对话记录仍会继续记录结构化部分。提供商将强制文本作为其首要系统提示词接收。

`message_end` 可以替换已最终确定的消息，同时保留其角色。`tool_call` 可以修改输入或阻止执行。`tool_result` 处理器会组合运行，每个处理器都能看到之前的更改。

<a id="context_with_system"></a>

`context` 转换对话消息，但不包括提示词和工具系统消息；Pi 之后会恢复该状态。仅当请求级转换必须拥有完整对话记录时，才使用 `context_with_system`，并在索引零处保留一条系统消息。

`turn_end` 和 `agent_before_settle` 是可操作边界。它们的处理器可以链式提出 `custom`、`custom_message`、`context_edit` 或 `compaction` 条目，并返回 `continue: true` 以进行下一次模型请求。请保护继续条件，因为无条件继续可能导致循环。请使用导出的事件声明来获取完整的验证和排序契约。

<a id="cache_warming_decision"></a>

`cache_warming_decision` 可以通过 `{ action: "warm" }` 或 `{ action: "stop" }` 覆盖空闲提示词缓存刷新。最后一个返回操作的处理器生效。

来自同一条助手消息的工具调用可以并行运行。
当另一个工具事件运行时，不要假设存在同级调用或结果。
对于活动轮次拥有的嵌套工作，请使用 `ctx.signal`；命令和空闲会话事件通常没有操作信号。

返回 `undefined` 的 `user_bash` 处理器会将命令传递给下一个处理器，如果没有任何处理器处理，则最终传递给本地执行。返回 `operations` 或 `result` 会停止传播。处理器失败会阻止命令执行，而不是回退到本地执行。

<a id="custom-tools"></a>
<a id="register-tools"></a>

### 工具

自定义工具定义了名称、面向模型的描述、TypeBox 参数模式以及 `execute()` 函数。
其结果需要面向模型的 `content` 以及用于渲染或状态重建的 `details` 字段。
当没有结构化细节时，使用 `details: undefined`。如果工具进行了嵌套模型调用，请将其 `usage` 包含在结果中，以确保会话总数保持准确。

从 `execute()` 中抛出异常以产生失败的工具结果。
返回对象并不将其标记为错误。
仅当该批次中所有完成的工具都同意终止时，才返回 `terminate: true`，此时代理应跳过其自动追问。

当工具共享可变的内存状态时，使用顺序执行。
修改文件的工具应使用 `withFileMutationQueue()` 包装完整的读-修改-写操作。
截断大型的面向模型的结果，并告知模型在哪里读取完整输出。

参见 [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)、[`todo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts)、[`dynamic-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts) 和 [`truncated-tool.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 动态激活工具

首先注册所有工具，保持可选工具为非激活状态，并通过加载器工具使用 `pi.setActiveTools()` 来选择所需的激活工具。名称必须已注册；未知名称将被忽略。

Pi 在转录的第一条系统消息中记录初始提示和工具集，然后在下一个模型请求前追加工具和提示的更改。无法表示此转换的提供商将收到完整的转录检查点，这可能会使缓存的提示前缀失效。

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### 上下文与会话变更

`ExtensionContext` 提供工作目录、模式、UI、会话管理器、模型运行时、中止信号、上下文使用情况，以及压缩与关闭的控制。
使用 `ctx.modelRegistry.streamSimple()` 进行与提供商无关的嵌套模型调用。

命令处理器接收 `ExtensionCommandContext`，它增加了等待空闲、重新加载、树导航和会话替换等操作。
这些操作仅限命令使用，因为从生命周期处理器调用它们可能导致运行时死锁。

会话替换会使旧上下文失效。在切换前仅捕获纯数据，然后使用 `withSession` 提供的新上下文进行会话绑定工作。

<a id="state-management"></a>
<a id="persist-state"></a>

### 状态

根据状态在对话中的参与方式选择存储方式：

| 状态 | 存储方式 |
|---|---|
| 跟随活动分支的工具状态 | 工具结果 `details` |
| 从模型上下文中排除的持久数据 | `pi.appendEntry()` |
| 存储并发送给模型的自定义内容 | `pi.sendMessage()` |
| 单个会话之外的数据 | 外部存储 |

在 `session_start` 期间，从 `ctx.sessionManager.getBranch()` 重建分支敏感状态。
不要从每个文件条目重建它，因为被放弃的分支代表替代历史。
当自定义存储内容应出现在记录中时，注册条目或消息渲染器。

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>

### UI 与模式

`ctx.ui` 提供对话框、通知、状态文本、控件、标题、编辑器访问以及自定义组件。
仅当交互需要自定义渲染和输入时，才使用 `ctx.ui.custom()`。
有关组件、焦点、覆盖层、主题和性能指南，请参阅[终端 UI](/docs/tui/)。

扩展可在交互、RPC、JSON 和打印模式下加载。
交互模式提供完整的终端 UI。
RPC 可通过 [RPC 扩展 UI 协议](/docs/rpc-extension-ui/)转发受支持的对话框和通知，但无法转发自定义终端组件；JSON 和打印模式无 UI。
使用 `ctx.mode === "tui"` 保护仅终端行为，并使用 `ctx.hasUI` 判断交互和 RPC 客户端支持的交互方式。

保持工具和事件行为与渲染无关，以确保非交互模式保持可用。

<a id="error-handling"></a>
<a id="handle-errors-and-shutdown"></a>

当正常操作尝试清理时，即使失败，也应在`session_shutdown`中释放资源。
由于取消、重载、会话替换和进程退出可能汇聚到同一路径，请保持清理操作的幂等性。
使用`ctx.shutdown()`请求有序关闭进程。

<a id="examples-reference"></a>
<a id="use-examples-as-the-implementation-reference"></a>

## 示例和参考

已检查的[扩展示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)涵盖了工具、生命周期事件、命令、标志、快捷键、状态、渲染、提供商、OAuth、远程执行和终端组件。
从与你的集成点最匹配的最小示例开始。

使用[自定义提供商](/docs/custom-provider/)进行模型服务集成，使用[终端 UI](/docs/tui/)处理自定义组件，以及使用[Pi 软件包](/docs/packages/)安装或分发带有其他资源的扩展。
