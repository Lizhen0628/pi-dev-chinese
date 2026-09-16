> pi 可以帮助你使用 SDK。请让它为你的使用场景构建集成。

# SDK

SDK 提供了对 pi 智能体能力的编程接口。你可以利用它在其他应用中嵌入 pi、构建自定义界面，或与自动化工作流集成。

**典型用例：**
- 构建自定义用户界面（Web、桌面、移动端）
- 将智能体能力集成到现有应用程序中
- 使用智能体推理创建自动化流水线
- 构建可派生子智能体的自定义工具
- 以编程方式测试智能体行为

参见 [examples/sdk/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk/) 获取从最小化到完全控制的工作示例。

## 快速入门

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

await session.prompt("当前目录下有哪些文件？");
```

## 安装

```bash
npm install @earendil-works/pi-coding-agent
```

SDK 已包含在主软件包中，无需单独安装。

## 核心概念

### 创建代理会话()

`createAgentSession()` 是创建单个 `AgentSession` 实例的主要工厂函数。

`createAgentSession()` 使用 `ResourceLoader` 提供扩展、技能、提示词模板、主题和上下文文件。如果你未提供自定义加载器，它将使用带有标准发现机制的 `DefaultResourceLoader`。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// 最小示例：使用默认的 DefaultResourceLoader
const { session } = await createAgentSession();

// 自定义：覆盖特定选项
const { session } = await createAgentSession({
  model: myModel,
  tools: ["read", "bash"],
  sessionManager: SessionManager.inMemory(),
});
```

### AgentSession

会话管理代理生命周期、消息历史、模型状态、压缩及事件流。

```typescript
interface AgentSession {
  // 发送提示并等待完成
  prompt(text: string, options?: PromptOptions): Promise<void>;

  // 在流式处理期间将消息加入队列
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
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;

  // 在当前会话文件中进行就地树导航
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

当代理响应、手动或自动压缩或另一个树导航处于活动状态时，即使使用 `summarize: false`，`session.navigateTree()` 也会被拒绝。它不会排队导航，也不会因这些冲突返回 `{ cancelled: true }`。请等待活动操作完成（例如，使用 `await session.waitForIdle()`）后重试。拒绝不会改变活动分支的状态。

会话替换 API（如新建会话、恢复、分叉和导入）位于 `AgentSessionRuntime` 上，而非 `AgentSession` 上。

### createAgentSessionRuntime() 与 AgentSessionRuntime

当您需要替换当前会话并重建绑定到工作目录（cwd）的运行时状态时，请使用运行时 API。这也是内置交互模式、打印模式和远程过程调用（RPC）模式所使用的同一层。

`createAgentSessionRuntime()` 接收一个运行时工厂函数以及初始的 cwd/会话目标。该工厂函数封装了进程级全局固定输入，为有效的 cwd 重建绑定到 cwd 的服务，针对这些服务解析会话选项，并返回完整的运行时结果。

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

- `newSession()`（新建会话）
- `switchSession()`（切换会话）
- `fork()`（分叉会话）
- 通过 `fork(entryId, { position: "at" })` 实现的克隆流程
- `importFromJsonl()`（从 JSONL 导入）

重要行为：

- 上述操作后，`runtime.session` 会发生变更
- 事件订阅绑定到特定的 `AgentSession`，因此替换后需要重新订阅
- 如果您使用了扩展，请为新的会话再次调用 `runtime.session.bindExtensions(...)`
- 创建过程会将诊断信息返回在 `runtime.diagnostics` 上
- 如果运行时创建或替换失败，相关方法会抛出异常，由调用方决定如何处理

```typescript
let session = runtime.session;
let unsubscribe = session.subscribe(() => {});

await runtime.newSession();

unsubscribe();
session = runtime.session;
unsubscribe = session.subscribe(() => {});
```

### 提示与消息排队

`PromptOptions` 控制提示词展开、流式处理时的排队行为以及提示词预检通知：

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
- 当提示词在接受前被预检拒绝时，返回 `false`

它在 `prompt()` 解析之前触发。`prompt()` 仍然仅在完整接受运行完成后才解析，包括重试。接受后发生的失败通过常规事件和消息流报告，而非通过 `preflightResult(false)`。

`prompt()` 方法处理提示词模板、扩展命令和消息发送：

```typescript
// 基本提示（非流式时）
await session.prompt("What files are here?");

// 带图片的提示
await session.prompt("What's in this image?", {
  images: [{ type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } }]
});

// 流式处理期间：必须指定消息排队方式
await session.prompt("Stop and do this instead", { streamingBehavior: "steer" });
await session.prompt("After you're done, also check X", { streamingBehavior: "followUp" });
```

**行为说明：**
- **扩展命令**（例如 `/mycommand`）：立即执行，即使在流式处理期间也是如此。它们通过 `pi.sendMessage()` 管理自己的 LLM 交互。
- **基于文件的提示词模板**（来自 `.md` 文件）：在发送或排队之前展开为其内容。
- **流式处理期间未指定 `streamingBehavior`**：抛出错误。可直接使用 `steer()` 或 `followUp()`，或指定该选项。
- **`preflightResult(true)`**：表示提示词已被接受、排队或立即处理。
- **`preflightResult(false)`**：表示预检在接受前已拒绝。

流式处理期间显式排队：

```typescript
// 排队一条引导消息，在当前助手回合完成工具调用后投递
await session.steer("New instruction");

// 等待智能体完成（仅当智能体停止时才投递）
await session.followUp("After you're done, also do this");
```

`steer()` 和 `followUp()` 都会展开基于文件的提示词模板，但在扩展命令上会报错（扩展命令无法排队）。

### Agent 和 AgentState

`Agent` 类（来自 `@earendil-works/pi-agent-core`）处理核心 LLM 交互。可通过 `session.agent` 访问。

```typescript
// 访问当前状态
const state = session.agent.state;

// state.messages: AgentMessage[] - 对话历史
// state.model: Model - 当前模型
// state.thinkingLevel: ThinkingLevel - 当前思考级别
// state.systemPrompt: string - 只读，从记录的系统消息中重放
// state.tools: AgentTool[] - 可执行工具；更改将在下次请求前声明给模型
// state.streamingMessage?: AgentMessage - 当前部分助手消息
// state.errorMessage?: string - 最近的助手错误

// 替换消息（适用于分支或恢复）
session.agent.state.messages = messages; // 复制顶层数组

// 替换工具
session.agent.state.tools = tools; // 复制顶层数组

// 等待 agent 完成处理
await session.agent.waitForIdle();
```

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
        // 思考输出（如果已启用思考）
      }
      break;

    // 工具执行
    case "tool_execution_start":
      console.log(`工具：${event.toolName}`);
      break;
    case "tool_execution_update":
      // 流式工具输出
      break;
    case "tool_execution_end":
      console.log(`结果：${event.isError ? "错误" : "成功"}`);
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

    // 回合生命周期（一次大语言模型响应 + 工具调用）
    case "turn_start":
      break;
    case "turn_end":
      // event.message：助手响应
      // event.toolResults：本次回合的工具结果
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
  // DefaultResourceLoader 发现机制的工作目录
  cwd: process.cwd(), // 默认值

  // 全局配置目录
  agentDir: "~/.pi/agent", // 默认值（展开 ~）
});
```

`cwd` 被 `DefaultResourceLoader` 用于以下方面：
- 项目扩展（`.pi/extensions/`）
- 项目技能：
  - `.pi/skills/`
  - `cwd` 及其上级目录中的 `.agents/skills/`（向上追溯至 git 仓库根目录，若不在仓库中则追溯至文件系统根目录）
- 项目提示词（`.pi/prompts/`）
- 上下文文件（从 `cwd` 向上查找 `AGENTS.md`）
- 会话目录命名

`agentDir` 被 `DefaultResourceLoader` 用于以下方面：
- 全局扩展（`extensions/`）
- 全局技能：
  - `agentDir` 下的 `skills/`（例如 `~/.pi/agent/skills/`）
  - `~/.agents/skills/`
- 全局提示词（`prompts/`）
- 全局上下文文件（`AGENTS.md`）
- 设置（`settings.json`）
- 自定义模型（`models.json`）
- 凭据（`auth.json`）
- 会话（`sessions/`）

当你传入自定义的 `ResourceLoader` 时，`cwd` 和 `agentDir` 不再控制资源发现。它们仍然影响会话命名和工具路径解析。

### 模型

```typescript
import { getModel } from "@earendil-works/pi";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// create() 默认会恢复缓存的目录，但不会从 pi.dev 刷新它们。
// 可以选择在创建时进行网络刷新，并限制其耗时：
const refreshedRuntime = await ModelRuntime.create({
  allowModelNetwork: true,
  modelRefreshTimeoutMs: 15_000,
});

// 查找特定的内置模型（不检查 API 密钥是否存在）
const opus = getModel("anthropic", "claude-opus-4-5");
if (!opus) throw new Error("Model not found");

// 按提供商/ID 查找任何模型，包括来自 models.json 的自定义模型
// （不检查 API 密钥是否存在）
const customModel = modelRuntime.getModel("my-provider", "my-model");

// 仅获取已配置有效身份验证的模型
const available = await modelRuntime.getAvailable();

const { session } = await createAgentSession({
  model: opus,
  thinkingLevel: "medium", // off、minimal、low、medium、high、xhigh、max
  
  // 用于循环切换的模型（交互模式下按 Ctrl+P）
  scopedModels: [
    { model: opus, thinkingLevel: "high" },
    { model: haiku, thinkingLevel: "off" },
  ],
  
  modelRuntime,
});
```

如果未提供模型：
1. 尝试从会话中恢复（如果是继续会话）
2. 使用设置中的默认模型
3. 回退到第一个可用的模型

远程目录会持久化在本地，因此后续的运行时无需网络请求即可恢复它们。默认文件为 `~/.pi/agent/models-store.json`；可设置 `modelsStorePath` 选择其他位置，或注入 `modelsStore` 来控制持久化。网络刷新会限制为每个提供商每四小时一次，除非强制刷新。如需强制立即刷新，请调用 `await modelRuntime.refresh({ allowNetwork: true, force: true, signal })`。设置 `PI_OFFLINE` 会禁用模型的网络访问。

若要匹配命令行模型的解析方式，请使用导出的解析辅助函数：

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

`resolveCliModel()` 使用所有已注册的模型，因此 `--api-key` 风格的首次设置可以在存储的身份验证信息存在之前解析模型。`resolveModelScopeWithDiagnostics()` 匹配 `--models` 和 `enabledModels` 的语义，同时以警告形式返回诊断信息而不是直接打印。

> 参见 [examples/sdk/02-custom-model.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/02-custom-model.ts)

### API 密钥与 OAuth

认证解析优先级（由 `ModelRuntime` 处理）：
1. 运行时覆盖（通过 `setRuntimeApiKey`，不会持久化）
2. `auth.json` 中存储的凭据（API 密钥或 OAuth 令牌）
3. 环境变量（`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等）
4. 回退解析器（用于 `models.json` 中的自定义提供商密钥）

```typescript
import { InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";

// 默认：使用 ~/.pi/agent/auth.json 和 ~/.pi/agent/models.json
const modelRuntime = await ModelRuntime.create();

// 提供商自有的认证方法与当前状态
for (const provider of modelRuntime.getProviders()) {
  const status = await modelRuntime.checkAuth(provider.id);
  console.log(provider.name, provider.auth, status);
}

// 运行时 API 密钥覆盖（不会持久化到磁盘）
await modelRuntime.setRuntimeApiKey("anthropic", "sk-my-temp-key");

// 自定义凭据与模型位置
const customRuntime = await ModelRuntime.create({
  authPath: "/my/app/auth.json",
  modelsPath: "/my/app/models.json",
});

// 或注入任意 pi-ai CredentialStore
const credentials = new InMemoryCredentialStore();
const inMemoryRuntime = await ModelRuntime.create({ credentials });

const { session } = await createAgentSession({
  modelRuntime: customRuntime,
});
```

`login()`、`logout()`、`setRuntimeApiKey()` 和 `removeRuntimeApiKey()` 在受影响提供商的缓存/内置目录、组合与可用性快照本地一致后才会解析。它们不会等待远程目录刷新。如果凭据已提交但本地同步失败，这些方法会以导出的 `CredentialSynchronizationError` 拒绝；请检查其 `providerId`、`operation`、`credential` 和 `cause` 字段，而不是盲目重试凭据变更。

公共模型/认证操作和 `ModelRuntime.create({ signal })` 接受可选的终止信号，省略时无上界。SDK 应用自行决定远程目录新鲜度的截止时间策略：

```typescript
const signal = AbortSignal.timeout(15_000);
const result = await modelRuntime.refresh({
  providers: ["anthropic"],
  signal,
});
if (result.aborted) console.warn("目录刷新超时；使用缓存的模型");
for (const [providerId, error] of result.errors) {
  console.warn(`无法刷新 ${providerId}：`, error);
}
```

网络刷新失败或超时不会撤销成功的凭据操作。`refresh()` 会启动新的提供商代次，因此不会落后于旧的停滞刷新之后，过期的代次之后也无法发布。

> 参见 [examples/sdk/09-api-keys-and-oauth.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/09-api-keys-and-oauth.ts)

### 系统提示

使用一个 `ResourceLoader` 来覆盖系统提示：

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

指定启用的内置工具：

- 内置工具名称：`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`
- 默认内置工具：`read`、`bash`、`edit`、`write`
- `noTools: "all"` 禁用所有工具
- `noTools: "builtin"` 禁用默认内置工具，同时保留扩展和自定义工具
- `excludeTools` 在应用任何 `tools` 允许列表后，禁用特定的内置、扩展或自定义工具名称

`edit` 工具为 Pi 的 TUI 显示返回 `details.diff`，并为 SDK 使用者返回标准统一补丁 `details.patch`。

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

// 在 Windows 上使用 PowerShell 而非 Bash
const { session } = await createAgentSession({
  tools: ["read", "powershell", "edit", "write"],
});

// 在保持其余工具可用的同时禁用某个工具
const { session } = await createAgentSession({
  excludeTools: ["ask_question"],
});
```

#### 自定义 cwd 下的工具

当你传入自定义 `cwd` 时，`createAgentSession()` 会为该 `cwd` 构建选定的内置工具。

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const cwd = "/path/to/project";

// 为自定义 cwd 使用默认工具
const { session } = await createAgentSession({
  cwd,
  sessionManager: SessionManager.inMemory(cwd),
});

// 或者为自定义 cwd 选择特定工具
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
    content: [{ type: "text", text: `结果：${params.input}` }],
    details: {},
  }),
});

// 直接传递自定义工具
const { session } = await createAgentSession({
  customTools: [myTool],
});
```

使用 `defineTool()` 进行独立定义，并通过数组（如 `customTools: [myTool]`）传递。内联的 `pi.registerTool({ ... })` 已能正确推断参数类型。

通过 `customTools` 传递的自定义工具将与扩展注册的工具合并。由 ResourceLoader 加载的扩展也可以通过 `pi.registerTool()` 注册工具。

如果传入 `tools`，请包含每个需要启用的自定义或扩展工具名称，例如 `tools: ["read", "bash", "my_tool"]`。

> 参见 [examples/sdk/05-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/05-tools.ts)

### 扩展

扩展由 `ResourceLoader` 加载。`DefaultResourceLoader` 从 `~/.pi/agent/extensions/`、`.pi/extensions/` 以及 settings.json 中的扩展源发现扩展。

```typescript
import { createAgentSession, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[内联扩展] 代理正在启动");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

扩展可以注册工具、订阅事件、添加命令等。完整 API 请参见 [extensions.md](/docs/extensions/)。

**命名内联扩展：** 默认情况下，内联工厂在启动时的扩展列表中显示为 `<inline:1>`、`<inline:2>` 等。若要显示描述性名称，可包装工厂函数：

```typescript
import type { InlineExtension } from "@earendil-works/pi-coding-agent";

const myProvider: InlineExtension = {
  name: "my-provider",
  factory: (pi) => {
    pi.on("agent_start", () => {
      console.log("[my-provider] 代理正在启动");
    });
  },
};

const loader = new DefaultResourceLoader({
  extensionFactories: [myProvider],
});
```

这样将显示为 `<inline:my-provider>` 而不是 `<inline:1>`。为向后兼容，仍接受裸工厂函数。

**事件总线：** 扩展可通过 `pi.events` 进行通信。如果需要在外部发出或监听事件，请将共享的 `eventBus` 传递给 `DefaultResourceLoader`：

```typescript
import { createEventBus, DefaultResourceLoader } from "@earendil-works/pi-coding-agent";

const eventBus = createEventBus();
const loader = new DefaultResourceLoader({
  eventBus,
});
await loader.reload();

eventBus.on("my-extension:status", (data) => console.log(data));
```

> 参见 [examples/sdk/06-extensions.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/06-extensions.ts) 和 [docs/extensions.md](/docs/extensions/)

### 技能

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  type Skill,
} from "@earendil-works/pi-coding-agent";

const customSkill: Skill = {
  name: "my-skill",
  description: "Custom instructions",
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
  description: "部署应用程序",
  source: "(custom)",
  content: "# 部署\n\n1. 构建\n2. 测试\n3. 部署",
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

### 会话管理

会话使用树形结构，通过 `id`/`parentId` 链接，支持就地分支。

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

// 内存模式（无持久化）
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
});

// 新建持久化会话
const { session: persisted } = await createAgentSession({
  sessionManager: SessionManager.create(process.cwd()),
});

// 继续最近会话
const { session: continued, modelFallbackMessage } = await createAgentSession({
  sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) {
  console.log("注意：", modelFallbackMessage);
}

// 打开指定文件
const { session: opened } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

// 恢复文件系统之外保存的会话，例如数据库中的会话
const { session: restored } = await createAgentSession({
  sessionManager: SessionManager.inMemory(process.cwd(), { id: sessionId }, entries),
});

// 列出会话
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// 会话替换 API，用于 /new、/resume、/fork、/clone 以及导入流程。
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

// 用全新会话替换当前活动会话
await runtime.newSession();

// 用另一个已保存的会话替换当前活动会话
await runtime.switchSession("/path/to/session.jsonl");

// 从特定用户条目创建分支，替换当前活动会话
await runtime.fork("entry-id");

// 克隆经过特定条目的当前路径
await runtime.fork("entry-id", { position: "at" });
```

**SessionManager 树 API：**

```typescript
const sm = SessionManager.open("/path/to/session.jsonl");

// 会话列表
const currentProjectSessions = await SessionManager.list(process.cwd());
const allSessions = await SessionManager.listAll(process.cwd());

// 树遍历
const entries = sm.getEntries();        // 所有条目（不含头部）
const tree = sm.getTree();              // 完整树结构
const path = sm.getPath();              // 从根到当前叶节点的路径
const leaf = sm.getLeafEntry();         // 当前叶条目
const entry = sm.getEntry(id);          // 按 ID 获取条目
const children = sm.getChildren(id);    // 条目的直接子节点

// 标签
const label = sm.getLabel(id);          // 获取条目标签
sm.appendLabelChange(id, "checkpoint"); // 设置标签

// 分支
sm.branch(entryId);                     // 将叶节点移至更早的条目
sm.branchWithSummary(id, "摘要...");     // 带上下文摘要创建分支
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

// 带覆盖项
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

**特定于项目的设置：**

设置从两个位置加载并合并：
1. 全局：`~/.pi/agent/settings.json`
2. 项目：`<cwd>/.pi/settings.json`

项目设置覆盖全局设置。嵌套对象按键合并。设置器默认修改全局设置。

**持久化与错误处理语义：**

- 设置的 getter/setter 针对内存状态是同步的。
- 设置器会异步排队持久化写入。
- 当需要持久性边界时，调用 `await settingsManager.flush()`（例如，在进程退出前或测试中断言文件内容之前）。
- `SettingsManager` 不会打印设置 I/O 错误。请使用 `settingsManager.drainErrors()` 并在应用层报告这些错误。

> 参见 [examples/sdk/10-settings.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/sdk/10-settings.ts)

## 资源加载器

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
  
  // 如果会话模型无法恢复，则发出警告
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
  label: "Status",
  description: "获取系统状态",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `运行时间: ${process.uptime()}s` }],
    details: {},
  }),
});

const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("未找到模型");

// 带覆盖项的内存设置
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

SDK导出运行模式工具，用于在`createAgentSession()`之上构建自定义界面：

### 交互模式

完整的 TUI 交互模式，支持编辑器、聊天历史以及所有内置命令：

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

单次模式：发送提示，输出结果，然后退出：

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

用于子进程集成的 JSON-RPC 模式：

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

参见 [RPC 文档](/docs/rpc/) 以了解 JSON 协议。

## RPC 模式替代方案

对于基于子进程的集成，无需使用 SDK 构建，可直接使用 CLI：

```bash
pi --mode rpc --no-session
```

关于 JSON 协议，请参阅 [RPC 文档](/docs/rpc/)。

SDK 更适合以下情况：
- 需要类型安全性
- 处于同一 Node.js 进程中
- 需要直接访问代理状态
- 希望以编程方式自定义工具/扩展

RPC 模式更适合以下情况：
- 从其他语言进行集成
- 需要进程隔离
- 正在构建与语言无关的客户端

## 导出项

主入口文件导出以下内容：

```typescript
// 工厂函数
createAgentSession
createAgentSessionRuntime
AgentSessionRuntime

// 认证与模型
ModelRuntime // 实现 pi-ai 模型接口并管理凭据存储
ModelRegistry // 同步扩展兼容性门面
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

// 类型定义
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
