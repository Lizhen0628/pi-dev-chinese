# 扩展

扩展是向 Pi 添加可执行行为的 TypeScript 模块。当工作流需要工具、命令、事件处理器、模型提供商、会话状态或终端界面，而不仅仅是指令时，请使用扩展。

扩展在 Pi 进程内运行，具有相同的操作系统权限。它可以检查提示词、工具调用、文件、凭据和会话历史，因此请仅从可信来源加载扩展。

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

## 将其添加到 Pi 中

将扩展放置在用户或项目扩展目录中。Pi 会直接加载 TypeScript 或 JavaScript 文件，以及包含 `index.ts` 或 `index.js` 入口点的子目录。

小型扩展使用单个文件，多文件实现则使用目录。将 npm 依赖项放在附近的 `package.json` 中。有关常规位置，请参阅 [配置](/docs/configuration/)；有关其他路径，请参阅 [设置](settings.md#resources)。

重新加载会替换扩展运行时，因此 `await ctx.reload()` 之后的代码不得复用旧运行时的状态。只有个人和显式命令行扩展才能参与在项目扩展加载之前运行的 `project_trust` 事件。

<a id="understand-the-lifecycle"></a>

## 尊重运行时生命周期

工厂函数可以是同步或异步的。Pi 会等待异步工厂完成后再继续启动，以便在启动期间获取配置或注册所需的提供商。

不要在工厂中启动进程、套接字、监视器或定时器，因为某些调用会加载扩展而不启动会话。
从 `session_start` 或需要这些资源的命令或工具中启动长期存在的资源。
从幂等的 `session_shutdown` 处理器中关闭会话范围的资源。

运行过程从输入和 `before_agent_start` 开始，经过模型、消息和工具事件，直至 `agent_end`。
自动重试、恢复、压缩或排队的工作随后可能继续进行。
<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` 是最后一个可操作的边界：它可以追加条目并请求一次继续执行。
`agent_settled` 是最终阶段，仅用于通知；当集成需要知道 Pi 不会自动继续时，使用此事件。

<a id="extensionapi-methods"></a>

## 选择集成点

| 功能 | 主API |
|---|---|
| 观察或修改生命周期行为 | `pi.on()` |
| 添加模型可调用的操作 | `pi.registerTool()` |
| 添加 `/` 命令 | `pi.registerCommand()` |
| 添加快捷键或命令行标志 | `pi.registerShortcut()` 或 `pi.registerFlag()` |
| 发送用户或自定义消息 | `pi.sendUserMessage()` 或 `pi.sendMessage()` |
| 持久化非上下文会话数据 | `pi.appendEntry()` |
| 更改活动工具、模型或思考级别 | `pi` 上的会话控制方法 |
| 添加模型提供商 | `pi.registerProvider()` |
| 添加 MCP 服务器 | `pi.registerMcpServer()` |
| 将每个请求路由到模型 | [`pi.registerVirtualModel()`](/docs/virtual-models/) |
| 添加终端渲染 | 渲染器注册和 `ctx.ui` |
| 与其他扩展通信 | `pi.events` |

使用 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 中导出的声明来获取精确的事件、上下文、工具和结果类型。

## 遵循扩展契约

<a id="events"></a>
<a id="work-with-events"></a>

### 事件与并发

处理器按扩展加载和注册顺序执行。`pi.on()` 返回一个函数，用于取消该注册；更改不会影响已在进行中的分发。
某些事件仅通知；其他事件则转换数据、替换结果或取消操作。
请使用每个事件声明的结果类型，而非假设每个返回值都有影响。

事件涵盖资源发现、会话、代理与消息生命周期、提供商、工具及原始输入。

`before_agent_start` 同时暴露当前提示词及其结构化的 `systemPromptOptions`。建议修改提示词部分、所选工具或指南，以便 Pi 追加对话增量。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换该次运行的整个提示词，而对话记录仍会继续记录结构化部分。提供商将强制文本作为其主导系统提示词接收。

`message_end` 可以替换已定稿的消息，同时保留其角色。`tool_call` 可以修改输入或阻止执行。`tool_result` 处理器可组合，每个处理器都能看到之前的更改。

<a id="provider_stream_event"></a>

`provider_stream_event` 在 Pi 规范化每个解析的提供商流事件之前触发。该事件标识提供商、API 和模型；`event.data` 是 Pi 可用的最早结构化值，不一定是原始 HTTP 字节或 SSE 帧。请将其视为只读，因为修改可能影响规范化。该事件仅通知，不持久化。

处理器按流顺序等待，因此慢处理器会延迟流消费。处理器错误会被报告，但不会改变提供商响应。参见 [`debug-provider.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/debug-provider.ts) 了解一个可选查看器，它按助手消息分组原始事件。

<a id="context_with_system"></a>

`context` 转换对话消息，但不包括提示词和工具系统消息；Pi 随后恢复该状态。仅在请求本地转换必须拥有完整对话记录时使用 `context_with_system`，并在索引零处保留系统消息。

`turn_end` 和 `agent_before_settle` 是可操作的边界。它们的处理器可以链式添加 `custom`、`custom_message`、`context_edit` 或 `compaction` 条目，并返回 `continue: true` 以进行下一次模型请求。请保护继续条件，因为无条件继续可能导致循环。使用导出的事件声明获取完整的验证和排序契约。

<a id="cache_warming_decision"></a>

`cache_warming_decision` 可以用 `{ action: "warm" }` 或 `{ action: "stop" }` 覆盖空闲提示词缓存刷新。最后一个返回操作的处理器生效。

来自同一条助手消息的工具调用可以并行运行。
当另一个工具事件运行时，不要假设同级调用或结果存在。
使用 `ctx.signal` 管理活动回合拥有的嵌套工作；命令和空闲会话事件通常没有操作信号。

返回 `undefined` 的 `user_bash` 处理器会将命令传递给下一个处理器，如果没有处理器处理，则传递给本地执行。返回 `operations` 或 `result` 会停止传播。处理器失败会阻止命令，而不是回退到本地执行。

<a id="custom-tools"></a>
<a id="register-tools"></a>

### 工具

自定义工具定义了名称、面向模型的描述、TypeBox 参数模式以及 `execute()` 函数。其结果需要面向模型的 `content` 字段和用于渲染或状态重建的 `details` 字段。当没有结构化细节时，使用 `details: undefined`。如果工具进行了嵌套模型调用，请在结果中包含它们的 `usage`，以确保会话总量保持准确。

从 `execute()` 中抛出异常以生成失败的工具结果。返回对象并不表示其为错误。仅当代理应跳过自动追问，且该批次中所有已完成的工具都同意终止时，才返回 `terminate: true`。

当工具共享可变的内存状态时，使用顺序执行。修改文件的工具应使用 `withFileMutationQueue()` 包装完整的读-修改-写操作。截断大型的面向模型的结果，并告知模型在哪里读取完整输出。

当结果是数据时，声明 `outputSchema` 并返回匹配的 `structuredContent`。模型仍会收到 `content`；程序化调用者（如 codemode 脚本）会收到 `structuredContent` 而不是文本。没有 `outputSchema` 的工具会作为文本内容传递给脚本。若要报告仍携带数据的失败，请返回带有 `isError: true` 的结果，而不是抛出异常：模型会看到错误，而脚本仍会收到 `structuredContent`。

工具可以使用 `ctx.executeTool(name, args, { signal, onUpdate })` 运行其他工具。嵌套调用会像模型发出的调用一样，经过参数验证以及 `tool_call` 和 `tool_result` 处理器，并发出 `tool_execution_start`、`tool_execution_update` 和 `tool_execution_end` 事件；所有这些事件都携带 `parentToolCallId`，其 `toolCallId` 由 pi 分配为 `<parent id>/<n>`。这些 ID 不会作为工具调用或工具结果出现在记录中。嵌套调用不会添加记录条目：其结果仅到达调用工具，由该工具自行报告，例如通过 `onUpdate` 和 `details`。会话会保留关于它们的有限记录（名称、参数、状态、持续时间、错误；绝不包含结果），作为调用工具结果消息上的 `nestedCalls`。该记录用于压缩文件列表，并显示在 HTML 导出中。每次调用超过 8 KiB 或每个工具结果超过 32 KiB 的参数会被省略，最多保留 256 次调用，并且 `complete: false` 标记丢失了任何内容的记录。嵌套结果（无论深度如何）的 `usage` 都会添加到调用工具的结果 `usage` 中，因此工具只报告自身的 `usage`，而不报告其调用的工具的 `usage`。`ctx.tools` 列出了 `ctx.executeTool()` 可以调用的工具。编辑 `content` 的 `tool_result` 处理器也应替换 `structuredContent`；仅替换 `content` 会将其丢弃。

参见 [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)、[`todo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts)、[`dynamic-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts) 和 [`truncated-tool.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 工具暴露

`exposure` 控制模型如何触达工具。“可调用”意味着可通过 `ctx.executeTool()`（`ctx.tools`）从其他工具调用，正如 `codemode` 工具的脚本所做的那样：

- `direct`（默认）：在激活期间向模型声明，并在激活期间可调用。
- `model-only`：在激活期间向模型声明，但永远不可调用。用于编排其他工具或询问用户的工具。
- `codemode`：注册后即可调用，并由 `codemode` 工具列出。除非显式激活，否则不向模型声明。
- `deferred`：类似于 `codemode`，但 codemode 工具不会列出它；`tool_search` 可以找到并激活它。
- `hidden`：已注册但不可达。使用 `exposure: "hidden"` 重新注册工具以将其撤回，因为工具无法注销。

`namespace: { name, description }` 将相关工具分组，如同 MCP 服务器所做的那样。Codemode 工具会在一个标题下列出命名空间。

注册 `direct` 或 `model-only` 工具即激活它；其他暴露类型在注册时不会激活。活动集（`pi.getActiveTools()`、`pi.setActiveTools()`）是向模型声明的工具集合。`pi.getAllTools()` 报告每个工具的 `exposure`、`namespace` 和 `annotations`。

`annotations` 是关于工具功能的提示，含义与 MCP 工具注解一致：`readOnlyHint`、`destructiveHint`、`idempotentHint` 和 `openWorldHint`。MCP 工具携带其服务器声明的提示。缺失的提示采用 MCP 默认值：工具不是只读的，可能具有破坏性并触达开放世界。这些提示不会被验证，但权限扩展可以利用它们来决定确认哪些调用。以下代码确认了 Codex 请求批准的调用：

```typescript
pi.on("tool_call", async (event, ctx) => {
  const hints = pi.getAllTools().find((tool) => tool.name === event.toolName)?.annotations;
  const needsApproval =
    hints?.destructiveHint === true ||
    (!hints?.readOnlyHint && ((hints?.destructiveHint ?? true) || (hints?.openWorldHint ?? true)));
  if (needsApproval && !(await ctx.ui.confirm("Allow tool call?", event.toolName))) {
    return { block: true, reason: `${event.toolName} was not approved` };
  }
});
```

编排其他工具的工具可以在激活期间通过 `prepareLoadout(loadout)` 调整模型所见内容。每当活动工具发生变化时，它都会运行，并接收已声明的工具、可调用的工具以及每个已注册工具及其暴露类型和命名空间。它返回已声明工具（包括其自身）的替换 `descriptions` 和 `hiddenDeclarations`：在保持活动和可调用状态的同时，其声明请求被省略的活动工具。`codemode` 和 `tool_search` 仅使用此钩子、`exposure` 和 `ctx.executeTool()`，因此另一个工具可以在不同名称下实现相同的行为。

### 动态激活工具

首先注册所有工具，保持可选工具不激活，并使用加载器工具中的 `pi.setActiveTools()` 选择所需的激活工具。名称必须已注册；未知名称将被忽略。

Pi 将初始提示词和工具集记录在会话记录的第一条系统消息中，然后在下一个模型请求前追加工具和提示词更改。无法表示此过渡的提供商将收到完整的会话检查点，这可能会使缓存的先前部分失效。

### MCP 服务器

`pi.registerMcpServer(name, config)` 为当前会话添加一个 MCP 服务器。`config` 的形状与 [`mcp.json`](/docs/mcp/) 中的 `mcpServers` 条目一致：stdio 服务器包含 `command`、`args`、`env` 和 `cwd`，HTTP 服务器包含 `url`、`headers` 和 `oauth`，此外还有 `exposure`、`toolExposure`、`enabled` 和 `timeout`。

```typescript
pi.registerMcpServer("jira", { url: "https://mcp.example.com/jira", exposure: "codemode" });
pi.unregisterMcpServer("jira");
```

扩展加载期间注册的服务器会在会话启动时与 `mcp.json` 中的服务器一起连接；之后注册的服务器会立即连接，而 `pi.unregisterMcpServer()` 会关闭连接并使该服务器的工具不可访问。注册不会被保存：每次加载时需重新注册，例如基于扩展自身的设置。`mcp.json` 中同名的服务器具有优先权，`/mcp` 会显示覆盖情况。重复注册同名服务器会替换扩展之前的注册；其他扩展注册的名称、无效名称和无效配置会抛出错误。

内置的 MCP 支持会连接已注册的服务器。当没有连接时（因为其他扩展替换了它，参见 [MCP](mcp.md#other-mcp-extensions)），每次注册都会报告为扩展错误。其他 MCP 扩展也可以连接已注册的服务器：在 `session_start` 时使用 `pi.getMcpServers()` 读取它们，并处理 `mcp_servers_change` 事件以获取后续更改。

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### 上下文与会话变更

`ExtensionContext` 提供工作目录、模式、UI、会话管理器、模型运行时、中止信号、上下文使用情况，以及压缩与关闭的控制。
使用 `ctx.modelRegistry.streamSimple()` 进行与提供商无关的嵌套模型调用。

命令处理器接收 `ExtensionCommandContext`，它增加了等待空闲、重新加载、树导航和会话替换等操作。
这些操作仅限命令使用，因为从生命周期处理器调用它们可能导致运行时死锁。

会话替换会使旧上下文失效。在切换前仅捕获纯数据，然后使用提供给 `withSession` 的新上下文进行会话绑定工作。

<a id="state-management"></a>
<a id="persist-state"></a>

### 状态

根据状态在对话中的参与方式选择存储方案：

| 状态 | 存储方式 |
|---|---|
| 跟随活动分支的工具状态 | 工具结果 `details` |
| 从模型上下文中排除的持久数据 | `pi.appendEntry()` |
| 存储并发送给模型的自定义内容 | `pi.sendMessage()` |
| 单个会话之外的数据 | 外部存储 |

在 `session_start` 期间，从 `ctx.sessionManager.getBranch()` 重建分支敏感状态。
不要从每个文件条目重建它，因为被放弃的分支代表替代历史。
当自定义存储的内容应出现在记录中时，注册条目或消息渲染器。

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>

### 界面与模式

`ctx.ui` 提供对话框、通知、状态文本、小部件、标题、编辑器访问以及自定义组件。
仅当交互需要自身渲染和输入时，才使用 `ctx.ui.custom()`。
有关组件、焦点、覆盖层、主题和性能指南，请参阅 [终端界面](/docs/tui/)。

扩展在交互、RPC、JSON 和打印模式下加载。
交互模式提供完整的终端界面。
RPC 可以通过 [RPC 扩展界面协议](/docs/rpc-extension-ui/) 转发支持的对话框和通知，但不支持自定义终端组件；JSON 和打印模式没有界面。
使用 `ctx.mode === "tui"` 保护仅限终端的行为，并使用 `ctx.hasUI` 支持交互和 RPC 客户端支持的交互。

保持工具和事件行为独立于渲染，以便非交互模式保持可用。

<a id="error-handling"></a>
<a id="handle-errors-and-shutdown"></a>

### 错误与清理

Pi 会报告处理器错误，并在可能的情况下继续执行。`tool_call` 处理器失败会作为故障安全机制阻止该工具；工具执行失败则会成为模型的错误结果。

即使在正常操作尝试清理时，也要在 `session_shutdown` 中释放资源。
保持清理操作的幂等性，因为取消、重载、会话替换和进程退出可能汇聚到同一路径。
使用 `ctx.shutdown()` 请求有序的进程关闭。

<a id="examples-reference"></a>
<a id="use-examples-as-the-implementation-reference"></a>

## 示例与参考

已检查的[扩展示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)涵盖了工具、生命周期事件、命令、标志、快捷键、状态、渲染、提供商、OAuth、远程执行和终端组件。
从与你的集成点匹配的最小示例开始。

使用[自定义提供商](/docs/custom-provider/)进行模型服务集成，使用[终端界面](/docs/tui/)进行自定义组件，以及使用[Pi 软件包](/docs/packages/)安装或分发包含其他资源的扩展。
