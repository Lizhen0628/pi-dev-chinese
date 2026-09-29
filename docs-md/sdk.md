# SDK

`@earendil-works/pi-coding-agent` 将 Pi 嵌入 Node.js 或 Bun 进程。它提供对命令行应用程序使用的代理、会话、工具、模型和资源的直接 TypeScript 访问。

使用 SDK 进行进程内 TypeScript 集成。如需语言无关或隔离的子进程，请参见[命令行集成](/docs/cli-integration/)。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

try {
  await session.prompt("What files are in the current directory?");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

这会使用工作目录、发现的资源、存储的设置和配置的凭据。`prompt()` 在运行结束时会解析。

[完整的最小示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/01-minimal.ts) 还会流式传输文本事件。所有 [SDK 示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk/) 均与代码仓库一起进行类型检查。

<a id="session-management"></a>

## 会话生命周期

`createAgentSession()` 创建一个 `AgentSession`。该会话拥有一个对话、其模型与工具、排队中的消息、压缩状态以及扩展运行时。

通过 `session.messages`、`session.model`、`session.thinkingLevel`、`session.systemPrompt` 和 `session.getActiveToolNames()` 读取当前状态。

`session.systemPrompt` 是只读的，返回当前生效的系统提示词，包括尚未发送给模型的更改。工具更改会在下一次请求前声明给模型。

<a id="sessionmanager-api"></a>

### 会话存储

默认情况下，会话是持久的。`SessionManager` 拥有持久化或内存中的条目树，并跟踪其活动叶子。分支更改会改变该叶子，但不会删除被放弃的分支。当 Pi 重建模型上下文时，管理器会选择活动分支并应用压缩。

`SessionManager` 对最终确定的模型上下文具有权威性。通过使用包含这些条目的管理器构造会话，可以恢复外部历史。赋值 `session.agent.state.messages` 不会替换持久化的上下文。

当宿主不想要会话文件时，使用内存管理器：

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});
```

查看[会话示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts)以了解如何创建、打开、继续、列出和派生会话。[会话文件格式](/docs/session-format/)定义了持久化的 JSONL 契约，[消息类型](/docs/message-types/)定义了记录值。有关确切方法和签名，请使用导出的 TypeScript 声明或 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)。

`cwd` 选择用于项目资源发现、上下文文件、会话分组和内置工具路径的工作区。当目标与 `process.cwd()` 不同时，请显式传递它。

`session.dispose()` 会中止活动工作、使扩展上下文失效、断开与代理的连接，并移除事件监听器。当不再需要会话时调用它。

`AgentSessionRuntime` 添加了 `newSession()`、`switchSession()`、`fork()` 和 `importFromJsonl()`。每个操作都会替换活动 `AgentSession`，并为目标工作目录重新创建服务。

运行时替换后，订阅属于旧 `AgentSession`，必须重新绑定。参见[会话运行时示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts)。

## 提示词

`prompt()` 负责处理扩展命令，并在普通用户消息进入代理之前展开基于文件的提示词模板。对于已接受的代理运行，它会在运行结束后（包括自动重试）完成解析。

如果会话已经在流式输出时发送提示词，必须指明是应引导当前运行还是紧随其后。调用 `prompt()` 而未做此选择将被拒绝，而非猜测处理。

引导消息会在当前助手回合及其工具调用之后进入。追问消息则会在当前运行完成其待处理工作后进入。`steer()` 和 `followUp()` 直接暴露这些行为，并在输入已入队（包括经扩展转换后）时返回 `"queued"`，或由扩展消费时返回 `"handled"`。

`abort()` 会停止当前操作并等待会话变为空闲。`waitForIdle()` 则仅等待而不中止操作。

## 订阅事件

当宿主需要流式输出时，应在提示之前进行订阅：

```typescript
const unsubscribe = session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

try {
  await session.prompt("Explain this repository");
} finally {
  unsubscribe();
}
```

会话事件报告消息更新、工具执行、队列、压缩、重试以及运行生命周期变更。

`message_end` 包含权威的已完成消息。`agent_end` 标记一次底层代理运行的结束，但自动恢复或排队的工作仍可能随后进行。

当宿主需要知道 Pi 不会自动继续时，请使用 `agent_settled`。

## 配置会话

在无覆盖设置的情况下，工厂会创建一个 `ModelRuntime`、基于文件的 `SettingsManager`、持久化的 `SessionManager`、`DefaultResourceLoader` 以及配置好的默认工具。

每个边界都可以显式提供：

- `modelRuntime`、`model`、`thinkingLevel` 和 `scopedModels` 控制模型的访问与选择。
- `settingsManager` 提供合并后的设置或内存中的配置。
- `sessionManager` 提供持久化或内存中的对话历史。
- `resourceLoader` 提供扩展、技能、提示词模板、主题和上下文文件。
- `tools`、`noTools`、`excludeTools` 和 `customTools` 控制启用的工具集。

当需要标准发现机制并附带特定覆盖时，使用 `DefaultResourceLoader`。当宿主完全拥有资源存储与发现机制时，提供自定义的 `ResourceLoader`。

<a id="inlineextension"></a>

内联扩展工厂可以通过 `DefaultResourceLoader` 提供。仅当内联扩展需要在诊断和启动输出中具有稳定名称时，才为其指定 `InlineExtension` 名称。当另一个扩展注册了与某个可替换内联扩展（`replaceable: true`）在加载期间注册的同名工具、命令或标志时，该可替换内联扩展将被排除，而不是两者冲突加载。CLI 内置的 codemode、工具搜索和 MCP 扩展都是可替换的。带有 `builtin: true` 的命名条目不是内联扩展：它提供 `builtin:<name>` 扩展的代码，该扩展像配置的扩展文件一样加载。它默认加载，列在 `pi config` 中，并可通过 `extensions` 设置中的 `-builtin:<name>` 或 `noExtensions` 禁用；`additionalExtensionPaths: ["builtin:<name>"]` 可显式加载它。它在项目信任解析后加载，因此无法处理 `project_trust`。CLI 的内置扩展使用此机制。

<a id="codemode-mcp"></a>

CLI 将 `codemode`、`tool_search` 和 MCP 作为内置扩展加载。SDK 会话不会；需将 `createCodemodeExtension()`、`createToolSearchExtension()` 和 `createMcpExtension()` 添加到 `DefaultResourceLoader` 的 `extensionFactories` 中。`codemode` 和 `tool_search` 注册为非活动状态：通过 `defaultTools` 设置启用它们（`["+codemode", "+tool_search"]` 保留其他默认工具），或让 MCP 扩展激活它们：对于具有 `codemode` 或 `codemode-deferred` 暴露的服务器使用 `codemode`，对于具有 `deferred` 暴露的服务器使用 `tool_search`。MCP 扩展在 `session_start` 时连接其服务器，因此需调用 `session.bindExtensions()`。参见 [Codemode 和 MCP](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/14-codemode-mcp.ts)。

参见关于 [模型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts)、[工具](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)、[扩展](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) 和 [完全控制](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts) 的专项示例。

## 示例

| 示例 | 用途 |
|---|---|
| [最小化](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/01-minimal.ts) | 创建、提示、观察并销毁一个会话 |
| [自定义模型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts) | 选择模型和思考级别 |
| [系统提示词](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/03-custom-prompt.ts) | 替换或追加系统提示词 |
| [技能](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts) | 发现、筛选并添加技能 |
| [工具](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts) | 选择内置工具及其工作目录 |
| [扩展](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) | 加载基于文件的扩展和内联扩展 |
| [上下文文件](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/07-context-files.ts) | 添加或替换项目指令 |
| [提示词模板](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts) | 添加文件式提示词模板 |
| [凭据](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts) | 配置凭据和模型存储 |
| [设置](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/10-settings.ts) | 提供文件支持或内存中的设置 |
| [会话](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts) | 控制会话持久化和恢复 |
| [完全控制](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts) | 替换默认发现和状态服务 |
| [会话运行时](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts) | 安全地替换活动会话 |
| [代码模式与 MCP](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/14-codemode-mcp.ts) | 添加 `codemode`、`tool_search` 和 MCP 扩展 |

<a id="exports"></a>

## 资源

- [选择模型](/docs/models/) 涵盖模型选择及兼容端点；[提供商认证](/docs/providers/) 涵盖凭证及云提供商设置。
- [配置](/docs/configuration/) 解释常规发现与设置；[设置](/docs/settings/) 列出所有设置项。
- [会话与上下文](/docs/sessions/) 解释会话行为；[会话格式](/docs/session-format/) 定义持久化条目；[消息类型](/docs/message-types/) 定义共享转录值。
- [扩展](/docs/extensions/)、[技能](/docs/skills/) 和 [提示词模板](/docs/prompt-templates/) 记录通过 `ResourceLoader` 提供的资源。
- [CLI 集成](/docs/cli-integration/) 涵盖打印、JSON 及 RPC 替代方案，以替代进程内 SDK 集成。
