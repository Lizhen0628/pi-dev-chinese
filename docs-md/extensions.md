# 扩展

扩展是向 Pi 添加可执行行为的 TypeScript 模块。当工作流需要工具、命令、事件处理器、模型提供商、会话状态或终端界面，而不仅仅是指令时，请使用扩展。

扩展在 Pi 进程内运行，并具有相同的操作系统权限。它可以检查提示词、工具调用、文件、凭据和会话历史，因此请仅从您信任的来源加载扩展。

典型的扩展会添加代理工具、保护路径、确认危险命令、响应会话事件、修改上下文、公开命令或显示持久状态。

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

将扩展放置在用户或项目扩展目录中。Pi 会加载直接的 TypeScript 或 JavaScript 文件，以及包含 `index.ts` 或 `index.js` 入口点的子目录。

小型扩展使用单个文件，多文件实现则使用目录。将 npm 依赖项放在附近的 `package.json` 中。有关常规位置，请参阅 [配置](/docs/configuration/)；有关其他路径，请参阅 [设置](settings.md#resources)。

重新加载会替换扩展运行时，因此 `await ctx.reload()` 之后的代码不得复用旧运行时的状态。只有个人和显式命令行扩展才能参与在项目扩展加载之前运行的 `project_trust` 事件。

<a id="understand-the-lifecycle"></a>

## 尊重运行时生命周期

工厂函数可以是同步的，也可以是异步的。Pi 会等待异步工厂完成后才继续启动流程，以便在启动期间获取配置或注册所需的提供商。

不要在工厂函数中启动进程、套接字、监视器或定时器，因为某些调用会加载扩展而不启动会话。
应从 `session_start` 或需要这些资源的命令或工具中启动长期存在的资源。
应从幂等的 `session_shutdown` 处理器中关闭会话范围内的资源。

一次运行从输入和 `before_agent_start` 开始，经过模型、消息和工具事件，直至 `agent_end`。
自动重试、恢复、压缩或排队的工作可在之后继续进行。
<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` 是最后一个可操作的边界：它可以追加条目并请求一次延续。
`agent_settled` 是最终且仅通知的边界；当集成需要知道 Pi 不会自动继续时使用它。

<a id="extensionapi-methods"></a>

## 选择集成点

| 能力 | 主API |
|---|---|
| 观察或修改生命周期行为 | `pi.on()`（钩子） |
| 添加模型可调用的操作 | `pi.registerTool()` |
| 添加 `/` 命令 | `pi.registerCommand()` |
| 添加快捷键或CLI标志 | `pi.registerShortcut()` 或 `pi.registerFlag()` |
| 发送用户或自定义消息 | `pi.sendUserMessage()` 或 `pi.sendMessage()` |
| 持久化非上下文会话数据 | `pi.appendEntry()` |
| 更改活动工具、模型或思考级别 | `pi` 上的会话控制方法 |
| 添加模型提供商 | `pi.registerProvider()` |
| 将每个请求路由到模型 | [`pi.registerVirtualModel()`](/docs/virtual-models/) |
| 添加终端渲染 | 渲染器注册和 `ctx.ui` |
| 与另一个扩展通信 | `pi.events` |

使用 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 中导出的声明来获取精确的事件、上下文、工具和结果类型。

## 遵循扩展契约

<a id="events"></a>
<a id="work-with-events"></a>

### 事件与并发

处理器按扩展加载和注册顺序执行。`pi.on()` 返回一个函数，用于取消该注册；更改不会影响已在进行中的分发。
部分事件仅通知；其他事件则转换数据、替换结果或取消操作。
请使用每个事件声明的结果类型，而非假设每个返回值都有实际效果。

事件涵盖资源发现、会话、代理与消息生命周期、提供商、工具及原始输入。

`before_agent_start` 同时暴露当前提示词及其结构化的 `systemPromptOptions`。建议修改提示词部分、所选工具或指南，以便 Pi 追加对话增量。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换该次运行的整个提示词，而对话记录仍会继续记录结构化部分。提供商将强制文本作为其主导系统提示词接收。

`message_end` 可以替换已定稿的消息，同时保留其角色。`tool_call` 可以修改输入或阻止执行。`tool_result` 处理器可组合使用，每个处理器都能看到之前的更改。

<a id="provider_stream_event"></a>

`provider_stream_event` 在 Pi 规范化每个解析的提供商流事件之前触发。该事件标识提供商、API 和模型；`event.data` 是 Pi 可用的最早结构化值，不一定是原始 HTTP 字节或 SSE 帧。请将其视为只读，因为修改可能影响规范化。该事件仅通知，且不会持久化。

处理器按流顺序等待，因此慢速处理器会延迟流消费。处理器错误会被报告，但不会改变提供商响应。参见 [`debug-provider.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/debug-provider.ts) 了解一个可选查看器，它按助手消息分组原始事件。

<a id="context_with_system"></a>

`context` 转换对话消息，但不包括提示词和工具系统消息；Pi 随后会恢复该状态。仅在请求本地转换必须拥有完整对话记录时使用 `context_with_system`，并在索引零处保留系统消息。

`turn_end` 和 `agent_before_settle` 是可操作边界。其处理器可以链式添加 `custom`、`custom_message`、`context_edit` 或 `compaction` 条目，并返回 `continue: true` 以进行下一次模型请求。请保护继续条件，因为无条件继续可能导致循环。使用导出的事件声明获取完整的验证和排序契约。

<a id="cache_warming_decision"></a>

`cache_warming_decision` 可以用 `{ action: "warm" }` 或 `{ action: "stop" }` 覆盖空闲提示词缓存刷新。最后一个返回操作的处理器生效。

来自同一条助手消息的工具调用可以并行执行。
当另一个工具事件运行时，不要假设兄弟调用或结果存在。
使用 `ctx.signal` 管理活动回合拥有的嵌套工作；命令和空闲会话事件通常没有操作信号。

返回 `undefined` 的 `user_bash` 处理器会将命令传递给下一个处理器，如果无处理器处理，则最终传递给本地执行。返回 `operations` 或 `result` 会停止传播。处理器失败会阻止命令执行，而不是回退到本地执行。

<a id="custom-tools"></a>
<a id="register-tools"></a>

### 工具

自定义工具定义了名称、面向模型的描述、TypeBox 参数模式以及 `execute()` 函数。
其结果需要面向模型的 `content` 和用于渲染或状态重建的 `details` 字段。
当没有结构化细节时，使用 `details: undefined`。如果工具进行了嵌套模型调用，请在结果中包含其 `usage`，以确保会话总数保持准确。

从 `execute()` 中抛出异常以产生失败的工具结果。
返回对象并不表示其为错误。
仅当代理在该批次中每个完成的工具都同意终止后，才返回 `terminate: true`，以跳过其自动追问。

当工具共享可变的内存状态时，使用顺序执行。
修改文件的工具应使用 `withFileMutationQueue()` 包装完整的读-修改-写操作。
截断大型的面向模型的结果，并告知模型在哪里读取完整输出。

参见 [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)、[`todo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts)、[`dynamic-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts) 和 [`truncated-tool.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 动态激活工具

首先注册所有工具，保持可选工具处于非激活状态，并使用加载器工具中的 `pi.setActiveTools()` 来选择所需的激活工具。名称必须已注册；未知名称将被忽略。

Pi 在转录的第一条系统消息中记录初始提示和工具集，然后在下一个模型请求之前追加工具和提示的更改。无法表示此转换的提供商将收到完整的转录检查点，这可能会使缓存前缀失效。

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### 上下文和会话变更

`ExtensionContext` 提供工作目录、模式、UI、会话管理器、模型运行时、中止信号、上下文用量以及压缩与关闭的控制。
使用 `ctx.modelRegistry.streamSimple()` 进行提供商无关的嵌套模型调用。

命令处理器接收 `ExtensionCommandContext`，它增加了等待空闲、重新加载、树导航和会话替换的操作。
这些操作仅供命令使用，因为从生命周期处理器调用它们可能导致运行时死锁。

会话替换会使旧上下文失效。在切换前仅捕获纯数据，然后使用提供给 `withSession` 的新上下文进行会话绑定的工作。

<a id="state-management"></a>
<a id="persist-state"></a>

### 状态

根据状态在对话中的参与方式选择存储：

| 状态 | 存储 |
|---|---|
| 跟随活动分支的工具状态 | 工具结果 `details` |
| 从模型上下文中排除的持久数据 | `pi.appendEntry()` |
| 自定义内容存储并发送给模型 | `pi.sendMessage()` |
| 单个会话之外的数据 | 外部存储 |

在 `session_start` 期间，从 `ctx.sessionManager.getBranch()` 重建分支敏感状态。
不要从每个文件条目重建它，因为废弃的分支代表替代历史。
当自定义存储的内容应出现在转录中时，注册条目或消息渲染器。

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>

### 用户界面与模式

`ctx.ui` 提供对话框、通知、状态文本、控件、标题、编辑器访问以及自定义组件。
仅在交互需要自有渲染和输入时，才使用 `ctx.ui.custom()`。
关于组件、焦点、覆盖层、主题和性能指南，请参阅[终端用户界面](/docs/tui/)。

扩展可在交互、RPC、JSON 和打印模式下加载。
交互模式提供完整的终端用户界面。
RPC 可通过 [RPC 扩展用户界面协议](/docs/rpc-extension-ui/) 转发受支持的对话框和通知，但不包含自定义终端组件；JSON 和打印模式无用户界面。
使用 `ctx.mode === "tui"` 将仅限终端的行为隔离，并使用 `ctx.hasUI` 判断交互和 RPC 客户端是否支持交互操作。

保持工具和事件行为与渲染无关，以确保非交互模式依然可用。

<a id="error-handling"></a>
<a id="handle-errors-and-shutdown"></a>

### 错误与清理

Pi 会报告处理器错误，并在可能的情况下继续运行。`tool_call` 处理器失败会作为故障安全机制阻止该工具；工具执行失败则会成为模型收到的错误结果。

即使在正常操作已尝试清理的情况下，也应在 `session_shutdown` 中释放资源。
保持清理操作的幂等性，因为取消、重载、会话替换和进程退出可能汇聚到同一条路径上。
使用 `ctx.shutdown()` 请求有序的进程关闭。

<a id="examples-reference"></a>
<a id="use-examples-as-the-implementation-reference"></a>

## 示例与参考

已检查的[扩展示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)涵盖了工具、生命周期事件、命令、标志、快捷键、状态、渲染、提供商、OAuth、远程执行及终端组件。
从与您的集成点匹配的最小示例开始。

使用[自定义提供商](/docs/custom-provider/)进行模型服务集成，使用[终端界面](/docs/tui/)定制组件，以及通过[Pi 软件包](/docs/packages/)安装或分发包含其他资源的扩展。
