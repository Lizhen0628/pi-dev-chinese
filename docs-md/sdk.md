# SDK

`@earendil-works/pi-coding-agent` 将 Pi 嵌入到 Node.js 或 Bun 进程中。它提供对命令行应用程序所使用的代理、会话、工具、模型和资源的直接 TypeScript 访问。

使用 SDK 进行进程内 TypeScript 集成。如需语言无关或隔离的子进程，请参阅 [CLI 集成](/docs/cli-integration/)。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

try {
  await session.prompt("当前目录中有哪些文件？");
  console.log(session.getLastAssistantText());
} finally {
  session.dispose();
}
```

此示例使用工作目录、发现的资源、存储的设置和配置的凭据。`prompt()` 在运行完成时解析。

[完整的最小示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/01-minimal.ts) 还流式传输文本事件。所有 [SDK 示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk/) 均通过仓库进行类型检查。

<a id="session-management"></a>

## 会话生命周期

`createAgentSession()` 创建一个 `AgentSession`。该会话拥有一个对话、其模型与工具、排队中的消息、压缩状态以及扩展运行时。

通过 `session.messages`、`session.model`、`session.thinkingLevel`、`session.systemPrompt` 和 `session.getActiveToolNames()` 读取当前状态。

`session.systemPrompt` 是只读的，返回当前生效的系统提示词，包括尚未发送给模型的更改。工具更改会在下一次请求前声明给模型。

<a id="sessionmanager-api"></a>

### 会话存储

会话默认是持久化的。`SessionManager` 拥有持久化或内存中的条目树，并跟踪其活动叶子节点。分支操作会更改该叶子节点，但不会删除被遗弃的分支。当 Pi 重建模型上下文时，管理器会选择活动分支并应用压缩。

`SessionManager` 对于最终确定的模型上下文具有权威性。要通过包含这些条目的管理器构建会话来恢复外部历史。分配 `session.agent.state.messages` 不会替换持久化的上下文。

当宿主不希望有会话文件时，请使用内存管理器：

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});
```

请参阅已检查的[会话示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts)以了解创建、打开、继续、列出和分叉会话的用法。[会话文件格式](/docs/session-format/)定义了持久化的 JSONL 契约，[消息类型](/docs/message-types/)定义了记录值。有关确切的方法和签名，请使用导出的 TypeScript 声明或[`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)。

`cwd` 选择用于项目资源发现、上下文文件、会话分组和内置工具路径的工作区。当目标不同于 `process.cwd()` 时，请显式传递它。

`session.dispose()` 会中止活动工作，使扩展上下文失效，断开与代理的连接，并移除事件监听器。当不再需要会话时调用它。

`AgentSessionRuntime` 增加了 `newSession()`、`switchSession()`、`fork()` 和 `importFromJsonl()`。每个操作都会替换活动的 `AgentSession`，并为目标工作目录重新创建服务。

在运行时替换之后，订阅属于旧的 `AgentSession`，必须重新绑定。请参阅[会话运行时示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts)。

## 提示（Prompting）

`prompt()` 处理扩展命令，并在普通用户消息进入代理之前展开基于文件的提示词模板。对于被接受的代理运行，它会在运行结束后（包括自动重试）解析完成。

当会话已经在流式传输时发送的提示词，必须指定它是引导当前运行还是跟随当前运行。调用 `prompt()` 时不进行选择会被拒绝，而不是猜测。

引导消息在当前助手回合及其工具调用之后进入。追问则在当前运行完成其待处理工作后进入。`steer()` 和 `followUp()` 直接暴露这些行为，如果输入被排队（包括在扩展转换之后），则返回 `"queued"`；如果扩展消费了该输入，则返回 `"handled"`。

`abort()` 停止当前操作并等待会话变为空闲。`waitForIdle()` 在不中止的情况下等待。

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

在没有覆盖设置的情况下，工厂会创建一个 `ModelRuntime`、基于文件的 `SettingsManager`、持久化的 `SessionManager`、`DefaultResourceLoader` 以及配置好的默认工具。

每个边界都可以显式提供：

- `modelRuntime`、`model`、`thinkingLevel` 和 `scopedModels` 控制模型的访问与选择。
- `settingsManager` 提供合并后的设置或内存中的配置。
- `sessionManager` 提供持久化或内存中的对话历史。
- `resourceLoader` 提供扩展、技能、提示词模板、主题和上下文文件。
- `tools`、`noTools`、`excludeTools` 和 `customTools` 控制激活的工具集。

当您希望使用标准发现机制并带有选定的覆盖时，请使用 `DefaultResourceLoader`。当宿主完全拥有资源存储和发现时，请提供自定义的 `ResourceLoader`。

<a id="inlineextension"></a>

内联扩展工厂可以通过 `DefaultResourceLoader` 提供。仅当需要在诊断和启动输出中具有稳定名称时，才为其指定 `InlineExtension` 名称。

请参阅针对 [模型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts)、[工具](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)、[扩展](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) 和 [完全控制](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts) 的聚焦示例。

## 示例

| 示例 | 用途 |
|---|---|
| [最小示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/01-minimal.ts) | 创建、提示、观察并销毁一个会话 |
| [自定义模型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts) | 选择模型与思考级别 |
| [系统提示](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/03-custom-prompt.ts) | 替换或追加系统提示 |
| [技能](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts) | 发现、筛选并添加技能 |
| [工具](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts) | 选择内置工具及其工作目录 |
| [扩展](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) | 加载文件型与内联扩展 |
| [上下文文件](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/07-context-files.ts) | 添加或替换项目说明 |
| [提示词模板](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts) | 添加文件式提示词模板 |
| [凭据](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts) | 配置凭据与模型存储 |
| [设置](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/10-settings.ts) | 提供文件支持或内存中的设置 |
| [会话](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts) | 控制会话持久化与恢复 |
| [完全控制](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/12-full-control.ts) | 替换默认发现与状态服务 |
| [会话运行时](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/13-session-runtime.ts) | 安全替换活动会话 |

<a id="exports"></a>

## 资源

- [选择模型](/docs/models/) 涵盖模型选择及兼容端点；[提供商认证](/docs/providers/) 涵盖凭据及云提供商设置。
- [配置](/docs/configuration/) 解释常规发现与设置；[设置](/docs/settings/) 列出所有设置项。
- [会话与上下文](/docs/sessions/) 解释会话行为；[会话格式](/docs/session-format/) 定义持久化条目；[消息类型](/docs/message-types/) 定义共享转录值。
- [扩展](/docs/extensions/)、[技能](/docs/skills/) 和 [提示词模板](/docs/prompt-templates/) 记录通过 `ResourceLoader` 提供的资源。
- [CLI 集成](/docs/cli-integration/) 涵盖进程内 SDK 集成之外的打印、JSON 和 RPC 替代方案。
