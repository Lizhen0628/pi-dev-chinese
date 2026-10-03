# 扩展

扩展是向 Pi 添加可执行行为的 TypeScript 模块。当工作流需要工具、命令、事件处理器、模型提供商、会话状态或终端界面，而非仅靠指令时，可使用扩展。

扩展在 Pi 进程内运行，拥有相同的操作系统权限。它可以检查提示词、工具调用、文件、凭据及会话历史，因此请仅从可信来源加载扩展。

典型的扩展可添加代理工具、保护路径、确认危险命令、响应会话事件、修改上下文、暴露命令或显示持久状态。

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

启动 Pi 并运行 `/hello`。开发期间，可直接加载文件：

```bash
pi --extension ./hello.ts
```

Pi 使用 `jiti`，因此本地 TypeScript 扩展无需单独的编译步骤。对于分发的扩展和依赖，请使用 [Pi 软件包](/docs/packages/)。

<a id="extension-locations"></a>
<a id="available-imports"></a>
<a id="choose-where-it-loads"></a>

## 将其添加到 Pi

将扩展放置在您的用户或项目扩展目录中。Pi 会直接加载 TypeScript 或 JavaScript 文件，以及包含 `index.ts` 或 `index.js` 入口点的子目录。

小型扩展使用单个文件，多文件实现则使用目录。将 npm 依赖项放在附近的 `package.json` 中。有关常规位置，请参阅 [配置](/docs/configuration/)；有关其他路径，请参阅 [设置](settings.md#resources)。

重新加载会替换扩展运行时，因此 `await ctx.reload()` 之后的代码不得复用旧运行时的状态。只有个人和显式命令行扩展才能参与在项目扩展加载之前运行的 `project_trust` 事件。

<a id="understand-the-lifecycle"></a>

## 尊重运行时生命周期

工厂函数可以是同步的，也可以是异步的。Pi 会等待异步工厂完成后再继续启动流程，以便其获取配置或注册启动期间所需的提供商。

不要在工厂函数中启动进程、套接字、监视器或定时器，因为某些调用会加载扩展而不启动会话。
从 `session_start` 或需要它们的命令或工具中启动长期存在的资源。
从幂等的 `session_shutdown` 处理器中关闭会话范围的资源。

一次运行从输入和 `before_agent_start` 开始，经过模型、消息和工具事件，直至 `agent_end`。
自动重试、恢复、压缩或排队的工作随后仍可继续。
<a id="agent_start--agent_end--agent_before_settle--agent_settled"></a>

`agent_before_settle` 是最后一个可操作的边界：它可以追加条目并请求一次延续。
`agent_settled` 是最终且仅通知的；当集成需要知道 Pi 不会自动继续时使用它。

<a id="extensionapi-methods"></a>

## 选择集成点

| 能力 | 主API |
|---|---|
| 观察或修改生命周期行为 | `pi.on()` |
| 添加模型可调用的操作 | `pi.registerTool()` |
| 添加 `/` 命令 | `pi.registerCommand()` |
| 添加快捷键或命令行标志 | `pi.registerShortcut()` 或 `pi.registerFlag()` |
| 发送用户或自定义消息 | `pi.sendUserMessage()` 或 `pi.sendMessage()` |
| 持久化非上下文会话数据 | `pi.appendEntry()` |
| 更改活动工具、模型或思考级别 | `pi` 上的会话控制方法 |
| 添加模型提供商 | `pi.registerProvider()` |
| 添加MCP服务器 | `pi.registerMcpServer()` |
| 将每个请求路由到模型 | [`pi.registerVirtualModel()`](/docs/virtual-models/) |
| 添加终端渲染 | 渲染器注册和 `ctx.ui` |
| 与其他扩展通信 | `pi.events` |

使用 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 中导出的声明来获取精确的事件、上下文、工具和结果类型。

## 遵循扩展契约

<a id="events"></a>
<a id="work-with-events"></a>

### 事件与并发

处理器（Handler）按扩展的加载和注册顺序执行。`pi.on()` 返回一个用于取消该注册的函数；已进行的更改不会影响正在派发中的事件。
有些事件仅用于通知；另一些则用于转换数据、替换结果或取消操作。
请依据每个事件声明的结果类型进行使用，而非假设每个返回值都会产生某种效果。

事件涵盖资源发现、会话（Session）、代理（Agent）与消息生命周期、提供商（Provider）、工具（Tool）以及原始输入。

`before_agent_start` 事件同时暴露当前的提示词及其结构化的 `systemPromptOptions`。建议修改提示词部分、所选工具或准则，以便 Pi 能够追加对话增量。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换该次运行的整个提示词，而对话记录仍会继续记录结构化部分。提供商会将强制文本作为其主要的系统提示词接收。

`message_end` 事件可在保留消息角色的前提下替换已最终确定的消息。`tool_call` 事件可修改输入或阻止执行。`tool_result` 处理器可组合使用，每个处理器都能看到之前的修改。

<a id="provider_stream_event"></a>

`provider_stream_event` 事件在 Pi 规范化每个已解析的提供商流事件之前触发。该事件标识提供商、API 和模型；`event.data` 是 Pi 可用的最早的结构化值，不一定是原始的 HTTP 字节或 SSE 帧。请将其视为只读，因为修改它可能会影响规范化过程。此事件仅为通知，不会被持久化。

处理器按流顺序等待执行，因此缓慢的处理器会延迟流的消费。处理器错误会被报告，但不会改变提供商的响应。参见 [`debug-provider.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/debug-provider.ts)，这是一个可选加入的查看器，可按助手消息对原始事件进行分组。

<a id="context_with_system"></a>

`context` 事件转换会话消息，但不包括提示词和工具的系统消息；Pi 事后会恢复该状态。仅当请求本地的转换必须拥有完整的对话记录时，才使用 `context_with_system`，并确保在索引零处保留一条系统消息。

`turn_end` 和 `agent_before_settle` 是可操作的事件边界。其处理器可以链接提议的 `custom`、`custom_message`、`context_edit` 或 `compaction` 条目，并返回 `continue: true` 以进行下一次模型请求。请谨慎设置继续条件，因为无条件的继续可能导致无限循环。请使用已导出的事件声明，以获取完整的验证和排序规则。

<a id="cache_warming_decision"></a>

`cache_warming_decision` 事件可使用 `{ action: "warm" }` 或 `{ action: "stop" }` 覆盖空闲时的提示词缓存刷新。最后一个返回操作（action）的处理器将胜出。

来自同一条助手消息的工具调用可以并行运行。
当另一个工具事件运行时，请勿假设其同级调用或结果已存在。
对于活跃轮次所拥有的嵌套工作，请使用 `ctx.signal`；命令和空闲会话事件通常没有操作信号。

一个 `user_bash` 处理器若返回 `undefined`，则会将命令传递给下一个处理器；如果没有处理器处理该命令，则会传递给本地执行。返回 `operations` 或 `result` 则会停止传播。处理器失败会阻止命令执行，而不会回退到本地执行。

<a id="custom-tools"></a>
<a id="register-tools"></a>

### 工具

自定义工具定义了一个名称、面向模型的描述、TypeBox 参数模式以及 `execute()` 函数。
其结果需要面向模型的 `content` 字段和用于渲染或状态重建的 `details` 字段。
当没有结构化详情时，请使用 `details: undefined`。如果工具进行了嵌套模型调用，请将其 `usage` 包含在结果中，以便会话总数保持准确。

从 `execute()` 中抛出异常会生成失败的工具结果。
返回对象并不表示其为错误。
仅当该批次中每个已完成的工具都同意终止，且代理应跳过其自动追问时，才返回 `terminate: true`。

当工具共享可变的内存状态时，请使用顺序执行。
修改文件的工具应使用 `withFileMutationQueue()` 包装完整的读-改-写操作。
截断大型的面向模型的结果，并告知模型在哪里读取完整输出。

当结果是数据时，请声明 `outputSchema` 并返回匹配的 `structuredContent`。模型仍然接收 `content`；而编程调用者（如 codemode 脚本）接收 `structuredContent` 而非文本。没有 `outputSchema` 的工具将作为其文本内容传递给脚本。要报告仍然携带数据的失败，请返回带有 `isError: true` 的结果，而不是抛出异常：模型会看到错误，而脚本仍然接收 `structuredContent`。

工具可以使用 `ctx.executeTool(name, args, { signal, onUpdate })` 运行其他工具。嵌套调用会像模型发出的调用一样，通过参数验证以及 `tool_call` 和 `tool_result` 处理器，并发出 `tool_execution_start`、`tool_execution_update` 和 `tool_execution_end` 事件；所有这些事件都携带 `parentToolCallId`，其 `toolCallId` 由 pi 分配为 `<父ID>/<n>`。这些 ID 不会作为工具调用或工具结果出现在记录中。嵌套调用不会添加记录条目：其结果只到达调用工具，由调用工具自行报告，例如通过 `onUpdate` 和 `details`。会话会以有界记录（名称、参数、状态、持续时间、错误；绝不包括结果）形式将其保存在调用工具的结果消息的 `nestedCalls` 中。该记录用于压缩文件列表，并在 HTML 导出中显示。每次调用超过 8 KiB 或每个工具结果超过 32 KiB 的参数将被省略，最多保留 256 次调用，`complete: false` 表示丢失了任何内容的记录。嵌套结果在任何深度下的 `usage` 都会添加到调用工具的结果 `usage` 中，因此工具只报告自己的使用情况，而不是其调用的工具的使用情况。`ctx.tools` 列出了 `ctx.executeTool()` 可以调用的工具。如果 `tool_result` 处理器需要编辑 `content`，也应替换 `structuredContent`；仅替换 `content` 会使其丢失。

> 完整示例代码请参阅英文原文中的 [`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)、[`todo.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/todo.ts)、[`dynamic-tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts) 和 [`truncated-tool.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 工具暴露

`exposure` 控制模型如何访问工具。“可调用”意味着可以通过其他工具的 `ctx.executeTool()`（`ctx.tools`）调用，就像 `codemode` 工具的脚本那样：

- `direct`（默认）：在活动时向模型声明，并且在活动时可调用。
- `model-only`：在活动时向模型声明，但永不调用。用于协调其他工具或询问用户的工具。
- `codemode`：无论何时注册都可调用，并由 `codemode` 工具列出。除非显式激活，否则不向模型声明。
- `deferred`：像 `codemode`，但 `codemode` 工具不列出它；`tool_search` 可找到并激活它。
- `hidden`：已注册但不可访问。重新注册工具时使用 `exposure: "hidden"` 来撤销它，因为工具无法注销。

`namespace: { name, description, instructions }` 将相关工具分组，就像 MCP 服务器那样。Codemode 工具在标题下列出 namespace 及其 `description`。`instructions` 包含更长的使用指南；它不列出，codemode 脚本通过 `describeNamespace(name)` 读取。

注册 `direct` 或 `model-only` 工具会激活它；其他暴露方式在注册时不会激活。活动集（`pi.getActiveTools()`、`pi.setActiveTools()`）是向模型声明的工具集。`pi.getAllTools()` 报告每个工具的 `exposure`、`namespace` 和 `annotations`。

`annotations` 是关于工具功能的提示，其含义与 MCP 工具注释相同：`readOnlyHint`、`destructiveHint`、`idempotentHint` 和 `openWorldHint`。MCP 工具携带其服务器声明的提示。缺失的提示采用 MCP 默认值：工具不是只读的，可能具有破坏性并访问开放世界。这些提示不验证，但权限扩展可使用它们决定确认哪些调用。这确认了 Codex 要求批准的调用：

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

一个协调其他工具的工具，可在活动时通过 `prepareLoadout(loadout)` 调整模型看到的内容。它在活动工具变化时运行，并接收声明的工具、可调用的工具以及每个注册工具及其暴露和命名空间。它返回到声明工具的替换 `descriptions`（包括其自身）以及 `hiddenDeclarations`：活动工具，其声明请求在保持活动和可调用时被省略。`codemode` 仅使用此钩子、`exposure` 和 `ctx.executeTool()`，因此另一个工具可在不同名称下实现相同行为。

### 动态激活工具

先注册所有工具，将非活动工具保持为可选状态，然后通过加载器中的 `pi.setActiveTools()` 选择所需的活动工具。名称必须已注册；未知名称将被忽略。

Pi 将初始提示词和工具集记录在对话记录的第一条系统消息中，然后在下次模型请求之前追加工具和提示词的变更。无法表示这种转变的提供商将收到完整的对话记录检查点，这可能会使缓存的提示前缀失效。

### 工具渲染

工具的 `renderCall` 和 `renderResult` 方法负责在交互式转录和 HTML 导出中绘制其调用。`pi.registerToolRenderer((toolName, next) => renderers)` 为任何工具的调用选择渲染器，包括尚未注册的工具，例如在恢复会话中服务器连接之前的 MCP 工具。`next()` 返回剩余解析器（按扩展加载顺序）以及已注册工具将使用的内容，因此 `next() ?? mine` 仅用于填充缺失部分。

### MCP 服务器

`pi.registerMcpServer(name, config)` 为当前会话注册一个 MCP 服务器。`config` 的格式与 [`mcp.json`](/docs/mcp/) 中的 `mcpServers` 条目一致：stdio 服务器包含 `command`、`args`、`env` 和 `cwd` 字段，HTTP 服务器包含 `url`、`headers` 和 `oauth` 字段，此外还有 `exposure`、`toolExposure`、`description`、`enabled` 和 `timeout` 字段。

```typescript
pi.registerMcpServer("jira", { url: "https://mcp.example.com/jira", exposure: "codemode" });
pi.unregisterMcpServer("jira");
```

扩展加载期间注册的服务器会在会话启动时与 `mcp.json` 中的服务器一起连接；之后注册的服务器会立即连接，`pi.unregisterMcpServer()` 会关闭连接并使该服务器的工具不可访问。注册不会被保存：每次加载时需要重新注册，例如根据扩展自身的设置进行注册。`mcp.json` 中同名的服务器优先，`/mcp` 会显示覆盖情况。重复注册同名服务器会替换该扩展之前的注册；其他扩展已注册的名称、无效名称和无效配置会抛出异常。

内置的 MCP 支持会连接已注册的服务器。当连接失败时（例如被其他扩展替换，参见 [MCP](mcp.md#other-mcp-extensions)），每次注册都会被报告为扩展错误。其他 MCP 扩展也可以连接已注册的服务器：在 `session_start` 时通过 `pi.getMcpServers()` 读取它们，并通过 `mcp_servers_change` 事件处理后续变更。

<a id="extensioncontext"></a>
<a id="extensioncommandcontext"></a>
<a id="use-extension-context"></a>

### 上下文与会话变更

`ExtensionContext` 提供工作目录、模式、UI、会话管理器、模型运行时、中止信号、上下文使用情况，以及用于压缩和关闭的控制。
使用 `ctx.modelRegistry.streamSimple()` 进行提供商无关的嵌套模型调用。

命令处理器接收 `ExtensionCommandContext`，它增加了等待空闲、重新加载、树导航和会话替换的操作。
这些操作仅限命令使用，因为从生命周期处理器调用它们可能导致运行时死锁。

会话替换会使旧上下文失效。在切换前仅捕获纯数据，然后使用 `withSession` 提供的新上下文进行会话绑定工作。

<a id="state-management"></a>
<a id="persist-state"></a>

### 状态

根据状态在会话中的参与方式来选择存储方式：

| 状态 | 存储方式 |
|---|---|
| 跟随活动分支的工具状态 | 工具结果 `details` |
| 从模型上下文中排除的持久数据 | `pi.appendEntry()` |
| 存储并发送给模型的自定义内容 | `pi.sendMessage()` |
| 单个会话之外的数据 | 外部存储 |

在 `session_start` 期间，根据 `ctx.sessionManager.getBranch()` 重建分支敏感状态。
不要从每条文件条目重建，因为废弃的分支代表替代历史。
当自定义存储内容应出现在转录内容中时，注册条目或消息渲染器。

<a id="custom-ui"></a>
<a id="mode-behavior"></a>
<a id="interact-with-the-user"></a>
<a id="account-for-each-mode"></a>

### UI和模式

`ctx.ui` 提供对话框、通知、状态文本、标题、编辑器访问和自定义组件。
仅在交互需要自身渲染和输入时使用 `ctx.ui.custom()`。
关于组件、焦点、覆盖、主题和性能的指导，请参阅[终端UI](/docs/tui/)。

扩展在交互式、RPC、JSON和打印模式下加载。
交互式模式提供完整的终端UI。
RPC可以通过[RPC扩展UI协议](/docs/rpc-extension-ui/)转发受支持的对话框和通知，但不能转发自定义终端组件；JSON和打印模式没有UI。
使用 `ctx.mode === "tui"` 保护仅限终端的行为，并使用 `ctx.hasUI` 判断交互式和RPC客户端支持的交互。

保持工具和事件行为与渲染无关，以便非交互模式保持可用。

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
从与您的集成点匹配的最小示例开始。

使用[自定义提供商](/docs/custom-provider/)进行模型服务集成，使用[终端界面](/docs/tui/)实现自定义组件，以及使用[Pi 软件包](/docs/packages/)安装或分发包含其他资源的扩展。
