> pi 可以帮助你使用 SDK。请让它为你的用例构建集成。

# SDK

SDK 提供对 pi 的代理能力的编程访问。使用它可以在其他应用程序中嵌入 pi、构建自定义界面或与自动化工作流集成。

**示例用例：**
- 构建自定义 UI（网页、桌面、移动端）
- 将代理能力集成到现有应用程序中
- 使用代理推理创建自动化管道
- 构建生成子代理的自定义工具
- 以编程方式测试代理行为

参见 [examples/sdk/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk/) 获取从最小到完全控制的可用示例。

## 快速开始

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("What files are in the current directory?");
```

## 安装

```bash
npm install @earendil-works/pi-coding-agent
```

SDK 已包含在主软件包中，无需单独安装。

## 核心概念

### createAgentSession()

单个 `AgentSession` 的主要工厂函数。

`createAgentSession()` 使用 `ResourceLoader` 来提供扩展、技能、提示词模板、主题和上下文文件。如果未提供，则使用带有标准发现的 `DefaultResourceLoader`。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// 最小化：使用默认的 DefaultResourceLoader
const { session } = await createAgentSession();

// 自定义：覆盖特定选项
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});
```

### AgentSession

会话管理代理生命周期、消息历史、模型状态、压缩以及事件流。

```typescript
interface AgentSession {
  // 发送提示并等待完成
  prompt(text: string, options?: PromptOptions): Promise<void>;

  // 在流式输出期间排队消息
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;

  // 订阅事件（返回取消订阅函数）
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;

  // 会话信息
  sessionFile: string | undefined;
  sessionId: string;

  // 模型控制
  setModel(model: Model): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  cycleModel(): Promise<ModelCycleResult | undefined>;
  cycleThinkingLevel(): ThinkingLevel | undefined;

  // 状态访问
  agent: Agent;
  sessionManager: SessionManager;
  refreshContext(): void;
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;

  // 在当前会话文件内进行原地树导航
  navigateTree(targetId: string, options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string }): Promise<{ editorText?: string; cancelled: boolean }>;

  // 压缩
  compact(customInstructions?: string): Promise<CompactionResult>;
  abortCompaction(): void;

  // 中止当前操作
  abort(): Promise<void>;

  // 清理
  dispose(): void;
}
```

`session.navigateTree()` 在代理响应、手动或自动压缩、或另一个树导航处于活动状态时会拒绝，即使 `summarize: false` 也是如此。它不会排队导航，也不会为这些冲突返回 `{ cancelled: true }`。等待活动操作完成（例如使用 `await session.waitForIdle()`）后重试。拒绝不会改变当前活动分支。

会话替换 API（如新建会话、恢复、分支、导入）位于 `AgentSessionRuntime` 上，而非 `AgentSession` 上。

### createAgentSessionRuntime() 与 AgentSessionRuntime

当您需要替换活动会话并重建绑定到当前工作目录（cwd）的运行时状态时，请使用运行时 API。
这与内置的交互式、打印和 RPC 模式所使用的层相同。

`createAgentSessionRuntime()` 接受一个运行时工厂以及初始的 cwd/会话目标。该工厂封装了进程全局的固定输入，为有效的 cwd 重建绑定到 cwd 的服务，根据这些服务解析会话选项，并返回完整的运行时结果。

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});
```

`AgentSessionRuntime` 负责在以下操作中替换活动运行时：

- `newSession()`
- `switchSession()`
- `fork()`
- 通过 `fork(entryId, { position: "at" })` 进行的克隆流程
- `importFromJsonl()`

重要行为：

- 这些操作后，`runtime.session` 会发生变化
- 事件订阅绑定到特定的 `AgentSession`，因此替换后需要重新订阅
- 如果您使用扩展，请为新会话再次调用 `runtime.session.bindExtensions(...)`
- 创建过程会在 `runtime.diagnostics` 上返回诊断信息
- 如果运行时创建或替换失败，该方法会抛出异常，由调用方决定如何处理

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(() => {});

await runtime.newSession();

unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(() => {});
```

### 提示与消息排队

`PromptOptions` 控制提示词扩展、流式传输时的排队行为以及提示词预检通知：

```typescript
interface PromptOptions {
  expandPromptTemplates?: boolean;
  images?: ImageContent[];
  streamingBehavior?: "steer" | "followUp";
  source?: InputSource;
  preflightResult?: (success: boolean) => void;
}
```

`preflightResult` 在每次调用 `prompt()` 时触发一次：

- 当提示词被接受、排队或立即处理时，返回 `true`
- 当提示词在预检阶段被拒绝时，返回 `false`

它在 `prompt()` 解析之前触发。`prompt()` 仍然只在完整的接受运行完成后才解析，包括重试。接受后的失败通过正常的事件和消息流报告，而不是通过 `preflightResult(false)`。

`prompt()` 方法处理提示词模板、扩展命令和消息发送：

```typescript
// 基本提示（非流式传输时）
await session.prompt("What files are here?");

// 带图片
await session.prompt("What's in this image?", {
  images: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }]
});

// 流式传输期间：必须指定如何排队消息
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**行为：**
- **扩展命令**（例如 `/mycommand`）：立即执行，即使在流式传输期间也是如此。它们通过 `pi.sendMessage()` 管理自己的 LLM 交互。
- **基于文件的提示词模板**（来自 `.md` 文件）：在发送或排队之前扩展为其内容。
- **流式传输期间未指定 `streamingBehavior`**：抛出错误。请直接使用 `steer()` 或 `followUp()`，或指定该选项。
- **`preflightResult(true)`**：表示提示词已被接受、排队或立即处理。
- **`preflightResult(false)`**：表示预检在接受之前已拒绝。

对于流式传输期间的显式排队：

```typescript
// 排队一条引导消息，在当前助手回合完成工具调用后传递
await session.steer("New instruction");

// 等待代理完成（仅在代理停止时传递）
await session.followUp("After you're done, also do this");
```

`steer()` 和 `followUp()` 都会扩展基于文件的提示词模板，但会在扩展命令上报错（扩展命令无法排队）。

### Agent 与 AgentState

`Agent` 类（来自 `@earendil-works/pi-agent-core`）负责核心的 LLM 交互。可通过 `session.agent` 访问。

```typescript
// 访问当前状态
const state = session.agent.state;

// state.messages: AgentMessage[] - 对话历史
// state.model: Model - 当前模型
// state.thinkingLevel: ThinkingLevel - 当前思考级别
// state.systemPrompt: string - 只读，从转录的系统消息中重放
// state.tools: AgentTool[] - 可执行工具；更改会在下一次请求前声明给模型
// state.streamingMessage?: AgentMessage - 当前部分助手消息
// state.errorMessage?: string - 最新的助手错误

// 模型可见的消息从 session.sessionManager 投影而来。
// agent.state.messages 是刷新后的检查缓存；不要为恢复而赋值。

// 替换工具
session.agent.state.tools = tools; // 复制顶层数组

// 等待代理完成处理
await session.agent.waitForIdle();
```

提供商请求使用 `session.sessionManager` 作为规范的最终上下文。赋值 `session.agent.state.messages` 不会替换持久化上下文，并可能在下一个请求边界被覆盖。应在构建会话时恢复外部存储的历史记录：

```typescript
const restoredManager = SessionManager.inMemory(process.cwd(), { id: sessionId }, entries);
const { session } = await createAgentSession({ sessionManager: restoredManager });
```

对于现有会话，使用 `session.navigateTree(entryId)` 移动其活动分支。仅在有意追加外部管理的条目时，使用 `session.sessionManager.appendMessage(...)` 加上 `session.refreshContext()`。

### 事件

订阅事件以接收流式输出和生命周期通知。

```typescript
session.subscribe((event) => {
  switch (event.type) {
    // 来自助手的流式文本
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      if (event.assistantMessageEvent.type === "thinking_delta") {
        // 思考输出（如果启用了思考功能）
      }
      break;
    
    // 工具执行
    case "tool_execution_start":
      console.log(`工具: ${event.toolName}`);
      break;
    case "tool_execution_update":
      // 流式工具输出
      break;
    case "tool_execution_end":
      console.log(`结果: ${event.isError ? "错误" : "成功"}`);
      break;
    
    // 消息生命周期
    case "message_start":
      // 新消息开始
      break;
    case "message_end":
      // 消息完成
      break;
    
    // 代理生命周期
    case "agent_start":
      // 代理开始处理提示词
      break;
    case "agent_end":
      // 代理完成（event.messages 包含新消息）
      break;
    
    // 回合生命周期（一次 LLM 响应 + 工具调用）
    case "turn_start":
      break;
    case "turn_end":
      // event.message: 助手响应
      // event.toolResults: 本回合的工具结果
      break;
    
    // 会话事件（队列、压缩、重试）
    case "queue_update":
      console.log(event.steering, event.followUp);
      break;
    case "compaction_start":
    case "compaction_end":
    case "auto_retry_start":
    case "auto_retry_end":
    case "summarization_retry_scheduled":
    case "summarization_retry_attempt_start":
    case "summarization_retry_finished":
      break;
  }
});
```

## 选项参考

### 目录

```typescript
const { session } = await createAgentSession({
  // DefaultResourceLoader 发现文件时使用的工作目录
  cwd: process.cwd(), // 默认值
  
  // 全局配置目录
  agentDir: "~/.pi/agent", // 默认值（展开 ~）
});
```

`cwd` 被 `DefaultResourceLoader` 用于：
- 项目扩展（`.pi/extensions/`）
- 项目技能：
  - `.pi/skills/`
  - `cwd` 及其祖先目录（直到 git 仓库根目录，若不在仓库中则到文件系统根目录）中的 `.agents/skills/`
- 项目提示词（`.pi/prompts/`）
- 上下文文件（从 `cwd` 向上查找的 `AGENTS.md`）
- 会话目录命名

`agentDir` 被 `DefaultResourceLoader` 用于：
- 全局扩展（`extensions/`）
- 全局技能：
  - `agentDir` 下的 `skills/`（例如 `~/.pi/agent/skills/`）
  - `~/.agents/skills/`
- 全局提示词（`prompts/`）
- 全局上下文文件（`AGENTS.md`）
- 设置（`settings.json`）
- 自定义模型（`models.json`）
- 凭证（`auth.json`）
- 会话（`sessions/`）

当你传入自定义的 `ResourceLoader` 时，`cwd` 和 `agentDir` 不再控制资源发现。它们仍会影响会话命名和工具路径解析。

### 模型

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// create() 会恢复缓存的目录，但默认不会从 pi.dev 刷新它们。
// 可选择在创建时进行网络刷新，并限制其耗时：
const refreshedRuntime = await ModelRuntime.create({
  allowModelNetwork: true,
  modelRefreshTimeoutMs: 15_000,
});

// 查找特定的内置模型（不检查 API 密钥是否存在）
const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// 按提供商/ID 查找任意模型，包括来自 models.json 的自定义模型
// （不检查 API 密钥是否存在）
const customModel = modelRuntime.getModel("my-provider", "my-model");

// 仅获取已配置有效认证的模型
const available = await modelRuntime.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off, minimal, low, medium, high, xhigh, max
  
  // 用于循环切换的模型（交互模式下使用 Ctrl+P）
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
  
  modelRuntime,
});
```

如果未提供模型：
1. 尝试从会话中恢复（若为继续会话）
2. 使用设置中的默认值
3. 回退到第一个可用模型

远程目录会持久化存储在本地，以便后续运行时无需网络请求即可恢复。默认文件为 `~/.pi/agent/models-store.json`；可通过设置 `modelsStorePath` 指定其他位置，或注入 `modelsStore` 来控制持久化方式。网络刷新默认每提供商每四小时限流一次，除非强制刷新。如需强制立即刷新，调用 `await modelRuntime.refresh({ allowNetwork: true, force: true, signal })`。设置 `PI_OFFLINE` 可禁用模型的网络访问。

为匹配 CLI 的模型解析逻辑，可使用导出的解析辅助函数：

```typescript
import {
  resolveCliModel,
  resolveModelScopeWithDiagnostics,
} from "@earendil-works/pi-coding-agent";

const cliModel = resolveCliModel({
  cliModel: "anthropic/claude-opus-4-5:high",
  modelRuntime,
});
if (cliModel.error) throw new Error(cliModel.error);
if (cliModel.warning) console.warn(cliModel.warning);

const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(
  ["anthropic/*:high", "gpt-5"],
  modelRuntime,
);
for (const diagnostic of diagnostics) {
  console.warn(diagnostic.message);
}
```

`resolveCliModel()` 使用所有已注册的模型，因此首次使用 `--api-key` 方式设置时，可在存储认证信息之前解析出模型。`resolveModelScopeWithDiagnostics()` 与 `--models` 和 `enabledModels` 的语义保持一致，同时以返回警告而非打印的方式输出诊断信息。

> 参见 [examples/sdk/02-custom-model.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts)

### API 密钥与 OAuth

认证解析优先级（由 `ModelRuntime` 处理）：
1. 运行时覆盖（通过 `setRuntimeApiKey`，不持久化）
2. `auth.json` 中存储的凭据（API 密钥或 OAuth 令牌）
3. 环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等）
4. 回退解析器（用于 `models.json` 中的自定义提供商密钥）

```typescript
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";

// 默认：使用 ~/.pi/agent/auth.json 和 ~/.pi/agent/models.json
const modelRuntime = await ModelRuntime.create();

// 提供商拥有的认证方法及当前状态
for (const provider of modelRuntime.getProviders()) {
  const status = await modelRuntime.checkAuth(provider.id);
  console.log(provider.name, provider.auth, status);
}

// 运行时 API 密钥覆盖（不持久化到磁盘）
await modelRuntime.setRuntimeApiKey("anthropic", "sk-my-temp-key");

// 自定义凭据和模型位置
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});

// 或注入任何 pi-ai CredentialStore
const credentials = new InMemoryCredentialStore();
const inMemoryRuntime = await ModelRuntime.create({ credentials });

const { session } = await createAgentSession({
  modelRuntime: customRuntime,
});
```

`login()`、`logout()`、`setRuntimeApiKey()` 和 `removeRuntimeApiKey()` 在受影响的提供商的缓存/内置目录、组合和可用性快照本地一致后解析。它们不等待远程目录的新鲜度。如果凭据已提交但本地同步失败，它们会以导出的 `CredentialSynchronizationError` 拒绝；检查其 `providerId`、`operation`、`credential` 和 `cause` 字段，而不是盲目重试凭据变更。

公共模型/认证操作和 `ModelRuntime.create({ signal })` 接受可选的中止信号，省略时无界。SDK 应用程序拥有远程目录新鲜度的截止时间策略：

```typescript
const signal = AbortSignal.timeout(15_000);
const result = await modelRuntime.refresh({
  providers: ["anthropic"],
  signal,
});
if (result.aborted) console.warn("目录刷新超时；使用缓存的模型");
for (const [providerId, error] of result.errors) {
  console.warn(`无法刷新 ${providerId}:`, error);
}
```

失败或超时的网络刷新不会撤销成功的凭据操作。`refresh()` 启动新的提供商代次，因此不会等待较旧的停滞刷新，过时的代次之后也无法发布。

> 参见 [examples/sdk/09-api-keys-and-oauth.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts)

### 系统提示

使用 `ResourceLoader` 覆盖系统提示：

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "You are a helpful assistant.",
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/03-custom-prompt.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/03-custom-prompt.ts)

### 工具

指定启用哪些内置工具：

- 内置工具名称：`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`
- 默认内置工具：`read`、`bash`、`edit`、`write`
- `noTools: "all"` 禁用所有工具
- `noTools: "builtin"` 禁用默认内置工具，同时保持扩展和自定义工具启用
- 在任何 `tools` 允许列表应用之后，`excludeTools` 会禁用特定的内置、扩展或自定义工具名称

`edit` 工具返回 `details.diff` 供 Pi 的 TUI 显示，并返回 `details.patch` 作为标准统一补丁供 SDK 消费者使用。

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

// 只读模式
const { session } = await createAgentSession({
  tools: ["read", "grep", "find", "ls"],
});

// 选择特定工具
const { session } = await createAgentSession({
  tools: ["read", "bash", "grep"],
});

// 在 Windows 上使用 PowerShell 代替 Bash
const { session } = await createAgentSession({
  tools: ["read", "powershell", "edit", "write"],
});

// 禁用某个工具，同时保持其他工具可用
const { session } = await createAgentSession({
  excludeTools: ["ask_question"],
});
```

#### 自定义 cwd 下的工具

当你传入自定义 `cwd` 时，`createAgentSession()` 会为该 cwd 构建所选工具。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = "/path/to/project";

// 为自定义 cwd 使用默认工具
const { session } = await createAgentSession({
  cwd,
  sessionManager: SessionManager.inMemory(cwd),
});

// 或为自定义 cwd 选择特定工具
const { session } = await createAgentSession({
  cwd,
  tools: ["read", "bash", "grep"],
  sessionManager: SessionManager.inMemory(cwd),
});
```

> 参见 [examples/sdk/05-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)

### 自定义工具

```typescript
import { Type } from "typebox";
import { createAgentSession, defineTool } from "@earendil-works/pi-coding-agent";

// 内联自定义工具
const myTool = defineTool({
  name: "my_tool",
  label: "我的工具",
  description: "执行某些有用的操作",
  parameters: Type.Object({
    input: Type.String({ description: "输入值" }),
  }),
  execute: async (_toolCallId, params) => ({
    content: [{ type: "text", text: `结果: ${params.input}` }],
    details: {},
  }),
});

// 直接传入自定义工具
const { session } = await createAgentSession({
  customTools: [myTool],
});
```

使用 `defineTool()` 定义独立工具，并通过数组如 `customTools: [myTool]` 传入。内联的 `pi.registerTool({ ... })` 已能正确推断参数类型。

通过 `customTools` 传入的自定义工具将与扩展注册的工具合并。由 ResourceLoader 加载的扩展也可以通过 `pi.registerTool()` 注册工具。

如果传入 `tools` 参数，需列出每个要启用的自定义或扩展工具名称，例如 `tools: ["read", "bash", "my_tool"]`。

> 参见 [examples/sdk/05-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)

### 扩展

扩展由 `ResourceLoader` 加载。`DefaultResourceLoader` 会从 `~/.pi/agent/extensions/`、`.pi/extensions/` 目录以及 settings.json 中的扩展源中发现扩展。

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[Inline Extension] Agent starting");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

扩展可以注册工具、订阅事件、添加命令等。完整 API 请参阅 [extensions.md](/docs/extensions/)。

**命名内联扩展：** 默认情况下，内联工厂在启动时的扩展列表中显示为 `<inline:1>`、`<inline:2>` 等。若要显示描述性名称，请用包装器包裹工厂函数：

```typescript
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

const myProvider: InlineExtension = {
  name: "my-provider",
  factory: (pi) => {
    pi.on("agent_start", () => {
      console.log("[my-provider] Agent starting");
    });
  },
};

const loader = new DefaultResourceLoader({
  extensionFactories: [myProvider],
});
```

这样在显示时会显示为 `<inline:my-provider>` 而不是 `<inline:1>`。为保持向后兼容，仍接受裸工厂函数。

**事件总线：** 扩展可通过 `pi.events` 进行通信。如果需要在外部发送或监听事件，请将共享的 `eventBus` 传给 `DefaultResourceLoader`：

```typescript
import { createEventBus, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));
```

> 请参阅 [examples/sdk/06-extensions.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) 和 [docs/extensions.md](/docs/extensions/)

### 技能

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const customSkill: Skill = {
  name: "my-skill",
  description: "自定义指令",
  filePath: "/path/to/SKILL.md",
  baseDir: "/path/to",
  source: "custom",
};

const loader = new DefaultResourceLoader({
  skillsOverride: (current) => ({
    skills: [...current.skills, customSkill],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/04-skills.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/04-skills.ts)

### 上下文文件

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  agentsFilesOverride: (current) => ({
    agentsFiles: [
      ...current.agentsFiles,
      { path: "/virtual/AGENTS.md", content: "# 指南\n\n- 保持简洁" },
    ],
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/07-context-files.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/07-context-files.ts)

### 斜杠命令

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type PromptTemplate,
} from "@earendil-works/pi-coding-agent";

const customCommand: PromptTemplate = {
  name: "deploy",
  description: "Deploy the application",
  source: "(custom)",
  content: "# Deploy\n\n1. Build\n2. Test\n3. Deploy",
};

const loader = new DefaultResourceLoader({
  promptsOverride: (current) => ({
    prompts: [...current.prompts, customCommand],
    diagnostics: current.diagnostics,
  }),
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

> 参见 [examples/sdk/08-prompt-templates.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/08-prompt-templates.ts)

# 会话管理

## 会话管理

会话是“pi”中所有交互的核心，由包含用户、工具与模型消息流的 JSONL 文件实现。每次运行都会在 `.pi/sessions` 下创建一个会话文件。你可以使用 `/new`（新建会话）、`/resume`（恢复会话）、`/fork`（分叉会话）、`/clone`（克隆会话）以及导入等命令来操作会话，也可以在此 SDK 中使用 `SessionManager` 以程序化方式进行操作。

### 会话管理器、日志树与分支

会话文件是一种专门的 JSONL 格式。每个条目都有一个唯一的 ID 和父 ID，构成一个树状结构，而当前状态由叶节点表示。树的边代表因果链路：例如，一个节点可能代表根据前一个节点给出的指令启动的工具调用；该工具调用节点又有其自身的后续节点。树的根是会话头条目。利用这种数据结构，我们可以在同一会话文件的不同叶节点之间进行切换（类似 Git 分支，但以树而非链的形式存在），从而支持**分支会话**，即新的分支会写入不同的文件。

头部包含有关该会话的元数据，且仅作为元数据存储。头部不是树的一部分，因此会话树中的第一个条目始终是首个用户条目。

会话具有**标签**（有时也沿用旧名称“标记”），用于标记重要节点，便于使用 `fork` 时快速定位。标签以特殊元条目存储，因此它不增加树的深度。

`SessionManager` 将树作为**日志**状态进行跟踪。它支持对树进行遍历与编辑，并提供对条目与标签进行有效访问的索引结构。你仍然可以使用 `getEntries()` 方法作为迭代器来消费原始日志。

**内部实现**：日志树实际上是一个不可变索引树。所有编辑都通过可选的元条目和补丁条目实现，因此对文件的写入总是追加操作。若某次编辑的父子关系与先前已知的日志或补丁冲突，相关节点将成为孤儿，由 GC 清理。

### 核心 API

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSession,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

// 内存模式（不持久化）
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// 新建持久化会话
const { session: persisted } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd()),
});

// 继续最近一次会话
const { session: continued, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) {
  console.log("注意:", modelFallbackMessage);
}

// 打开指定文件
const { session: opened } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

// 恢复保存在文件系统之外的会话，例如数据库
const { session: restored } = await createAgentSession({
  sessionManager: SessionManager.inMemory(process.cwd(), { id: sessionId }, entries),
});

// 列出会话
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// 面向 /new、/resume、/fork、/clone 和导入流程的会话替换 API
const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({
      services,
      sessionManager,
      sessionStartEvent,
    })),
    services,
    diagnostics: services.diagnostics,
  };
};

const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

// 将会话替换为全新会话
await runtime.newSession();

// 将会话替换为另一个已保存的会话
await runtime.switchSession("/path/to/session.jsonl");

// 从特定用户条目处分支，替换当前会话
await runtime.fork("entry-id");

// 克隆当前路径至特定条目处
await runtime.fork("entry-id", { position: "at" });
```

**SessionManager 树 API：**

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

// 会话列表
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// 树遍历
const entries = sm.getEntries();        // 全部条目（不含头部）
const tree = sm.getTree();              // 完整树结构
const path = sm.getPath();              // 从根到当前叶节点的路径
const leaf = sm.getLeafEntry();         // 当前叶条目
const entry = sm.getEntry(id);          // 按 ID 获取条目
const children = sm.getChildren(id);    // 获取条目的直接子节点

// 标签
const label = sm.getLabel(id);          // 获取条目标签
sm.appendLabelChange(id, "checkpoint"); // 设置标签

// 分支操作
sm.branch(entryId);                     // 将叶节点移动到更早的条目
sm.branchWithSummary(id, "摘要...");  // 附带上下文摘要进行分支
sm.createBranchedSession(leafId);       // 将路径提取到新文件
```

> 参见 [examples/sdk/11-sessions.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/11-sessions.ts) 和 [会话格式](/docs/session-format/)

### 设置管理

```typescript
import { createAgentSession, SettingsManager, SessionManager } from "@earendil-works/pi-coding-agent";

// 默认：从文件加载（全局 + 项目合并）
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create(),
});

// 带覆盖
const settingsManager = SettingsManager.create();
settingsManager.applyOverrides({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 5 },
});
const { session } = await createAgentSession({ settingsManager });

// 内存模式（无文件 I/O，用于测试）
const { session } = await createAgentSession({
  settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
  sessionManager: SessionManager.inMemory(),
});

// 自定义目录
const { session } = await createAgentSession({
  settingsManager: SettingsManager.create("/custom/cwd", "/custom/agent"),
});
```

**静态工厂方法：**
- `SettingsManager.create(cwd?, agentDir?)` - 从文件加载
- `SettingsManager.inMemory(settings?)` - 无文件 I/O

**项目特定设置：**

设置从两个位置加载并合并：
1. 全局：`~/.pi/agent/settings.json`
2. 项目：`<cwd>/.pi/settings.json`

项目设置覆盖全局设置。嵌套对象合并键。设置器默认修改全局设置。

**持久化与错误处理语义：**

- 设置获取器/设置器对内存状态是同步的。
- 设置器异步排队持久化写入。
- 当需要持久性边界时（例如，在进程退出前或测试中断言文件内容前），调用 `await settingsManager.flush()`。
- `SettingsManager` 不打印设置 I/O 错误。使用 `settingsManager.drainErrors()` 并在应用层报告它们。

> 参见 [examples/sdk/10-settings.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/10-settings.ts)

## ResourceLoader

使用 `DefaultResourceLoader` 来发现扩展、技能、提示词模板、主题和上下文文件。

```typescript
import {
  DefaultResourceLoader,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  cwd,
  agentDir: getAgentDir(),
});
await loader.reload();

const extensions = loader.getExtensions();
const skills = loader.getSkills();
const prompts = loader.getPrompts();
const themes = loader.getThemes();
const contextFiles = loader.getAgentsFiles().agentsFiles;
```

## 返回值

`createAgentSession()` 返回：

```typescript
interface CreateAgentSessionResult {
  // 会话
  session: AgentSession;
  
  // 扩展结果（用于运行器设置）
  extensionsResult: LoadExtensionsResult;
  
  // 如果会话模型无法恢复时的警告
  modelFallbackMessage?: string;
}

interface LoadExtensionsResult {
  extensions: Extension[];
  errors: Array<{ path: string; error: string }>;
  runtime: ExtensionRuntime;
}
```

## 完整示例

```typescript
import { getModel } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create({
  authPath: "/custom/agent/auth.json",
  modelsPath: "/custom/agent/models.json",
});
if (process.env.MY_KEY) {
  await modelRuntime.setRuntimeApiKey("anthropic", process.env.MY_KEY);
}

// 内联工具
const statusTool = defineTool({
  name: "status",
  label: "状态",
  description: "获取系统状态",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `运行时间: ${process.uptime()}s` }],
    details: {},
  }),
});

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("未找到模型");

// 带覆盖的内存设置
const settingsManager = SettingsManager.inMemory({
  compaction: { enabled: false },
  retry: { enabled: true, maxRetries: 2 },
});

const loader = new DefaultResourceLoader({
  cwd: process.cwd(),
  agentDir: "/custom/agent",
  settingsManager,
  systemPromptOverride: () => "你是一个极简助手。请保持简洁。",
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: process.cwd(),
  agentDir: "/custom/agent",

  model,
  thinkingLevel: "off",
  modelRuntime,

  tools: ["read", "bash", "status"],
  customTools: [statusTool],
  resourceLoader: loader,

  sessionManager: SessionManager.inMemory(),
  settingsManager,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await session.prompt("获取状态并列出文件。");
```

## 运行模式

SDK 导出了运行模式工具，用于在 `createAgentSession()` 之上构建自定义交互界面：

### 交互模式

完整的 TUI 交互模式，包含编辑器、聊天历史以及所有内置命令：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  InteractiveMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

const mode = new InteractiveMode(runtime, {
  migratedProviders: [],
  modelFallbackMessage: undefined,
  initialMessage: "Hello",
  initialImages: [],
  initialMessages: [],
});

await mode.run();
```

### runPrintMode

单次运行模式：发送提示词，输出结果，然后退出：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runPrintMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "Hello",
  initialImages: [],
  messages: ["Follow up"],
});
```

### runRpcMode

子进程集成的 JSON-RPC 模式：

```typescript
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  runRpcMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
  const services = await createAgentSessionServices({ cwd });
  return {
    ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
    services,
    diagnostics: services.diagnostics,
  };
};
const runtime = await createAgentSessionRuntime(createRuntime, {
  cwd: process.cwd(),
  agentDir: getAgentDir(),
  sessionManager: SessionManager.create(process.cwd()),
});

await runRpcMode(runtime);
```

有关 JSON 协议，请参阅 [RPC 文档](/docs/rpc/)。

## RPC 模式替代方案

对于不使用 SDK 构建、基于子进程的集成方式，可以直接使用 CLI：

```bash
pi --mode rpc --no-session
```

JSON 协议请参阅 [RPC 文档](/docs/rpc/)。

以下情况优先选择 SDK：
- 需要类型安全
- 处于同一 Node.js 进程中
- 需要直接访问代理状态
- 希望以编程方式自定义工具/扩展

以下情况优先选择 RPC 模式：
- 从其他语言进行集成
- 需要进程隔离
- 构建跨语言的客户端

## 导出项

主入口导出以下内容：

```typescript
// 工厂函数
createAgentSession
createAgentSessionRuntime
AgentSessionRuntime

// 认证与模型
ModelRuntime // 实现 pi-ai 模型并管理凭据存储
ModelRegistry // 同步扩展兼容性外观
CredentialSynchronizationError
resolveCliModel
resolveModelScopeWithDiagnostics

// 资源加载
DefaultResourceLoader
type ResourceLoader
createEventBus

// 常量与辅助函数
CONFIG_DIR_NAME
defineTool
getAgentDir
getPackageDir
getReadmePath
getDocsPath
getExamplesPath

// 会话管理
SessionManager
SettingsManager

// 工具工厂
createCodingTools
createReadOnlyTools
createReadTool, createBashTool, createPowerShellTool, createEditTool, createWriteTool
createGrepTool, createFindTool, createLsTool

// 类型
type CreateAgentSessionOptions
type CreateAgentSessionResult
type ExtensionFactory
type InlineExtension
type ExtensionAPI
type ToolDefinition
type Skill
type PromptTemplate
type Tool
```

关于扩展类型的完整 API，请参阅 [extensions.md](/docs/extensions/)。
