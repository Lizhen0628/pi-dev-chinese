> pi 可以创建扩展。让它为你的使用场景构建一个。

# 扩展

扩展是 TypeScript 模块，用于扩展 pi 的行为。它们可以订阅生命周期事件、注册 LLM 可调用的自定义工具、添加命令等。

> **`/reload` 放置位置：** 将扩展放在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）中以实现自动发现。仅在快速测试时使用 `pi -e ./path.ts`。放置在自动发现位置的扩展可通过 `/reload` 热重载。

**关键能力：**
- **自定义工具** - 通过 `pi.registerTool()` 注册 LLM 可调用的工具
- **事件拦截** - 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** - 通过 `ctx.ui` 提示用户（选择、确认、输入、通知）
- **自定义 UI 组件** - 通过 `ctx.ui.custom()` 实现完整的 TUI 组件及键盘输入，用于复杂交互
- **自定义命令** - 通过 `pi.registerCommand()` 注册如 `/mycommand` 之类的命令
- **会话持久化** - 通过 `pi.appendEntry()` 存储跨重启保持的状态
- **自定义渲染** - 控制工具调用/结果和消息在 TUI 中的显示方式

**典型使用场景：**
- 权限门控（在执行 `rm -rf`、`sudo` 等操作前确认）
- Git 检查点（每轮暂存，分支恢复）
- 路径保护（阻止写入 `.env`、`node_modules/`）
- 自定义压缩（以您的方式总结对话）
- 对话摘要（参见 `summarize.ts` 示例）
- 交互式工具（提问、向导、自定义对话框）
- 有状态工具（待办列表、连接池）
- 外部集成（文件监视器、Webhook、CI 触发器）
- 等待期间的小游戏（参见 `snake.ts` 示例）

参见 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/) 获取可运行的实现。

## 目录

- [快速开始](#quick-start)
- [扩展位置](#extension-locations)
- [可用导入](#available-imports)
- [编写扩展](#writing-an-extension)
  - [扩展风格](#extension-styles)
- [事件](#events)
  - [生命周期概述](#lifecycle-overview)
  - [资源事件](#resource-events)
  - [会话事件](#session-events)
  - [代理事件](#agent-events)
  - [模型事件](#model-events)
  - [工具事件](#tool-events)
- [扩展上下文](#extensioncontext)
- [扩展命令上下文](#extensioncommandcontext)
- [扩展API 方法](#extensionapi-methods)
- [状态管理](#state-management)
- [自定义工具](#custom-tools)
  - [动态工具加载](#dynamic-tool-loading)
- [自定义 UI](#custom-ui)
- [错误处理](#error-handling)
- [模式行为](#mode-behavior)
- [示例参考](#examples-reference)

## 快速开始

创建 `~/.pi/agent/extensions/my-extension.ts` 文件：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 响应事件
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("扩展已加载！", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作！", "是否允许 rm -rf？");
      if (!ok) return { block: true, reason: "已被用户阻止" };
    }
  });

  // 注册自定义工具
  pi.registerTool({
    name: "greet",
    label: "问候",
    description: "按姓名问候某人",
    parameters: Type.Object({
      name: Type.String({ description: "要问候的姓名" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `你好，${params.name}！` }],
        details: {},
      };
    },
  });

  // 注册命令
  pi.registerCommand("hello", {
    description: "打招呼",
    handler: async (args, ctx) => {
      ctx.ui.notify(`你好${args || "世界"}！`, "info");
    },
  });
}
```

使用 `--extension`（或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## 扩展位置

> **安全提示：** 扩展以您的完整系统权限运行，可执行任意代码。请仅从您信任的来源安装。

扩展会从受信任的位置自动发现。项目本地 `.pi/extensions` 目录中的条目仅在项目被信任后才会加载。

| 位置 | 作用域 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

通过 `settings.json` 配置其他路径：

```json
{
  "packages": [
    "npm:@foo/bar@1.0.0",
    "git:github.com/user/repo@v1"
  ],
  "extensions": [
    "/path/to/local/extension.ts",
    "/path/to/local/extension/dir"
  ]
}
```

要通过 npm 或 git 以 pi 软件包形式共享扩展，请参阅 [packages.md](/docs/packages/)。

## 可用导入

| 软件包 | 用途 |
|---------|---------|
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | 工具参数的模式定义 |
| `@earendil-works/pi-ai` | AI 工具（用于 Google 兼容枚举的 `StringEnum`） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖同样适用。在扩展旁边（或父目录中）添加 `package.json`，运行 `npm install`，导入的 `node_modules/` 会自动解析。

对于通过 `pi install`（npm 或 git）安装的分布式 pi 软件包，运行时依赖必须放在 `dependencies` 中。软件包安装默认使用生产安装（`npm install --omit=dev`），因此运行时 `devDependencies` 不可用；当配置了 `npmCommand` 时，git 软件包使用普通 `install` 以兼容封装器。

Node.js 内置模块（`node:fs`、`node:path` 等）同样可用。

## 编写扩展

扩展导出默认工厂函数，该函数接收 `ExtensionAPI`。工厂函数可以是同步或异步的：

```typescript
import type { ExtensionAPI } from "@pi-coding-agent/extension";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui 用于用户交互
    const ok = await ctx.ui.confirm("标题", "你确定吗？");
    ctx.ui.notify("完成！", "info");
    ctx.ui.setStatus("my-ext", "处理中...");  // 底部状态
    ctx.ui.setWidget("my-ext", ["行 1", "行 2"]);  // 编辑器上方的组件（默认）
  });

  // 注册工具、命令、快捷键、标志
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可工作。

如果工厂函数返回 `Promise`，pi 会等待它完成后再继续启动。这意味着异步初始化会在 `session_start`、`resources_discover` 以及通过 `pi.registerProvider()` 排队提供的提供商注册被刷新之前完成。

### 异步工厂函数

对于一次性启动工作（如获取远程配置或动态发现可用模型），请使用异步工厂函数。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

此模式可使所获取的模型在正常启动过程中以及执行 `pi --list-models` 命令时均可用。

### 长期资源与关闭

扩展工厂可能在从不启动会话的调用中运行。请勿从工厂启动后台资源，如进程、套接字、文件监视器或定时器。

将后台资源的启动延迟到 `session_start` 或需要该资源的命令/工具/事件触发时。注册一个幂等的 `session_shutdown` 处理器，以关闭你启动的任何会话范围内的资源。

### 扩展样式

**单文件** - 最简单，适用于小型扩展：

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**带 index.ts 的目录** - 适用于多文件扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # 入口点（导出默认函数）
    ├── tools.ts        # 辅助模块
    └── utils.ts        # 辅助模块
```

**带依赖的软件包** - 适用于需要 npm 软件包的扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # 声明依赖和入口点
    ├── package-lock.json
    ├── node_modules/   # npm install 之后
    └── src/
        └── index.ts
```

```json
// package.json
{
  "name": "my-extension",
  "dependencies": {
    "zod": "^3.0.0",
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

在扩展目录中运行 `npm install`，之后从 `node_modules/` 进行的导入将自动生效。

## 事件

### 生命周期概览

```
pi 启动
  │
  ├─► project_trust（仅限用户/全局和 CLI 扩展，在项目资源加载前触发）
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
用户发送提示词 ─────────────────────────────────────────┐
  │                                                        │
  ├─► （先检查扩展命令，若匹配则绕过后续流程）               │
  ├─► input（可拦截、转换或处理）                          │
  ├─► （若未被处理，则进行技能/提示词模板展开）              │
  ├─► before_agent_start（可注入消息、修改系统提示词）      │
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── 回合（LLM 调用工具时重复）─────────────────┐       │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context（可修改消息）                     │       │
  │   ├─► before_provider_headers（可修改请求头）           │
  │   ├─► before_provider_request（可检查或替换有效载荷）   │
  │   ├─► after_provider_response（状态 + 请求头，在流消费前）│
  │   │                                            │       │
  │   │   LLM 响应，可能调用工具：                  │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call（可阻止）                 │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result（可修改）               │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled（无剩余重试/压缩/追问）                  │
                                                           │
用户再次发送提示词 ◄────────────────────────────────┘

/new（新会话）或 /resume（切换会话）
  ├─► session_before_switch（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork 或 /clone
  ├─► session_before_fork（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name 或 pi.setSessionName()
  └─► session_info_changed

/compact 或自动压缩
  ├─► session_before_compact（可取消或自定义）
  ├─► session_compact（成功）
  └─► session_compact_failed（失败或中止）

/tree 导航
  ├─► session_before_tree（可取消或自定义）
  └─► session_tree

/model 或 Ctrl+P（模型选择/切换）
  ├─► thinking_level_select（若模型变更改变或钳制思维层级）
  └─► model_select

思维层级变更（设置、按键绑定、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C、Ctrl+D、SIGHUP、SIGTERM）
  └─► session_shutdown
```

### 启动事件

#### project_trust

在 pi 决定是否信任带有动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。它在启动期间以及会话替换（例如 `/resume`）进入当前进程中尚未解决信任的 cwd 时运行。仅用户/全局扩展和 CLI `-e` 扩展参与；项目本地扩展在信任解决之前不会被加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 拥有有限的信任上下文：cwd、mode、hasUI，以及 select/confirm/input/notify 等 UI 辅助方法
  if (await ctx.ui.confirm("Trust project?", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局或 CLI 扩展拥有决定权；第一个 yes/no 决定胜出并抑制内置的信任提示。使用 `remember: true` 持久化 yes/no 决定；否则仅适用于当前进程。返回 `"undecided"` 交由后续处理器或内置信任流程来决定。提示之前请检查 `ctx.hasUI`。如果没有处理器返回 yes/no，则继续正常信任解析：先应用已保存的 `trust.json` 决定，再由 `defaultProjectTrust` 控制 pi 默认是询问、信任还是拒绝。

### 资源事件

#### resources_discover

在 `session_start` 之后触发，以便扩展能够贡献额外的技能、提示词模板和主题路径。启动路径使用 `reason: "startup"`，重载则使用 `reason: "reload"`。

```typescript
pi.on("resources_discover", async (event, _ctx) => {
  // event.cwd - 当前工作目录
  // event.reason - "startup" | "reload"（启动 | 重载）
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

### 会话事件

关于会话存储的内部机制及 SessionManager API，请参阅[会话格式](/docs/session-format/)。

#### session_start

当会话启动、加载或重新加载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - 仅在 "new"、"resume" 和 "fork" 时存在
  ctx.ui.notify(`Session: ${ctx.sessionManager.getSessionFile() ?? "ephemeral"}`, "info");
});
```

#### session_info_changed

当通过 `/name`、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发该事件。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - 当前规范化名称，若已清除则为 undefined
  ctx.ui.notify(`会话已重命名: ${event.name ?? "(无)"}`, "info");
});
```

#### session_before_switch（会话切换前）

在开始新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 要切换到的会话文件（仅用于 "resume"）

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("清空？", "删除所有消息？");
    if (!ok) return { cancel: true };
  }
});
```

在成功切换或启动新会话操作后，pi 会为旧的扩展实例触发 `session_shutdown`，为新会话重新加载并重新绑定扩展，然后触发带有 `reason: "new" | "resume"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_fork

当通过 `/fork` 分支或 `/clone` 克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - 所选条目的 ID
  // event.position - 对于 /fork 为 "before"，对于 /clone 为 "at"
  return { cancel: true }; // 取消分支/克隆
  // 或者
  return { skipConversationRestore: true }; // 保留用于未来的会话恢复控制
});
```

在成功分支或克隆后，pi 为旧扩展实例发出 `session_shutdown`，为新的会话重新加载并重新绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中执行清理，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_compact / session_compact / session_compact_failed

在压缩时触发。详见 [compaction.md](/docs/compaction/)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual" (/compact)、"threshold" 或 "overflow"
  // willRetry - 压缩后是否重试被中断的回合（溢出恢复）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；包含在会话总计中
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - 保存的压缩
  // event.fromExtension - 是否由扩展提供
  // event.reason - "manual" (/compact)、"threshold" 或 "overflow"
  // event.willRetry - 压缩后是否重试被中断的回合（溢出恢复）
});

pi.on("session_compact_failed", async (event, ctx) => {
  // event.reason - "manual" (/compact)、"threshold" 或 "overflow"
  // event.errorMessage - 非中止失败时存在
  // event.aborted - 已取消/中止的压缩为 true
  // event.willRetry - 压缩后本会重试被中断的回合
  // event.fromExtension - 是否正在使用扩展提供的压缩内容
});
```

#### session_before_tree / session_tree

在 `/tree` 导航时触发。有关树形导航概念，请参阅 [会话](/docs/sessions/)。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // 或者提供自定义摘要：
  return {
    summary: {
      summary: "...",
      // usage: summaryResponse.usage, // 可选；计入会话总计
      details: {},
    },
  };
});

pi.on("session_tree", async (event, ctx) => {
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### session_shutdown

在已启动的会话运行时被销毁之前触发。用于清理从 `session_start` 或其他会话级别钩子中打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - 会话替换流程的目标会话文件
  // 进行清理、保存状态等操作
});
```

### 智能体事件

#### before_agent_start

在用户提交提示词后、代理循环开始前触发。可注入消息和/或修改系统提示词。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - 用户的提示词文本
  // event.images - 附加的图片（如果有）
  // event.systemPrompt - 当前为此处理函数链式拼接的系统提示词
  //   （包含先前 before_agent_start 处理函数所做的更改）
  // event.systemPromptOptions - 用于构建系统提示词的结构化选项
  //   .customPrompt - 任何自定义系统提示词（来自 --system-prompt、SYSTEM.md 或自定义模板）
  //   .selectedTools - 提示词中当前激活的工具
  //   .toolSnippets - 每个工具的单行描述
  //   .promptGuidelines - 自定义指南要点
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件及其他已加载的上下文文件
  //   .skills - 已加载的技能

  return {
    // 注入一条持久消息（存储在会话中，发送给 LLM）
    message: {
      customType: "my-extension",
      content: "为 LLM 提供的额外上下文",
      display: true,
    },
    // 替换本轮的系统提示词（在扩展间链式传递）
    systemPrompt: event.systemPrompt + "\n\n本轮的额外指令...",
  };
});
```

`systemPromptOptions` 字段为扩展提供了与 Pi 构建系统提示词所用的相同结构化数据。这样你无需重新发现资源或重新解析标志，即可检查 Pi 已加载的内容——自定义提示词、指南、工具片段、上下文文件、技能。当你的扩展需要对系统提示词进行深入、基于充分信息的修改，同时尊重用户提供的配置时，可使用此字段。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理函数所处阶段的链式系统提示词。后续的 `before_agent_start` 处理函数仍可对其进行再次修改。

#### agent_start / agent_end / agent_settled

`agent_start` 在低层代理运行开始时会触发。`agent_end` 在运行结束时触发，但 Pi 可能仍会自动重试、自动压缩并重试，或继续处理排队的追问消息。如果需要知道 Pi 不会自动继续运行的状态集成，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - 来自此低层运行的消息
});

pi.on("agent_settled", async (_event, ctx) => {
  // 除非另一个扩展启动了新运行，否则此处 ctx.isIdle() 为 true
});
```

#### ui_prompt_start / ui_prompt_end

面向用户界面的阻塞式扩展提示的通知型生命周期事件。它们会在 `ctx.ui.select()`、`ctx.ui.confirm()`、`ctx.ui.input()`、`ctx.ui.editor()` 和 `ctx.ui.custom()` 调用前后触发，以便宿主或状态集成系统报告"等待用户输入"而不是仅仅显示"正在运行"。

嵌套或重叠的提示会被合并为一个外部等待区间。处理器以尽力而为的方式调用，在显示或关闭提示之前不会被等待。

```typescript
pi.on("ui_prompt_start", async (event, ctx) => {
  // event.reason === "ui_prompt"
  // event.kind: "select" | "confirm" | "input" | "editor" | "custom"
  // event.title: 若可用，则为提示标题
});

pi.on("ui_prompt_end", async (event, ctx) => {
  // Pi 不再等待该 UI 提示区间。
});
```

#### 回合开始 / 回合结束（turn_start / turn_end）

在每一回合（一次LLM响应 + 工具调用）触发。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // 事件的回合索引、时间戳
});

pi.on("turn_end", async (event, ctx) => {
  // 事件的回合索引、消息、工具结果
});
```

#### message_start / message_update / message_end

针对消息生命周期更新触发的事件。

- `message_start` 和 `message_end` 针对用户、助手和工具结果消息触发。
- `message_update` 针对助手流式更新触发。
- `message_end` 处理器可返回 `{ message }` 以替换最终消息。替换后的消息必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent（逐词流式事件）
});

pi.on("message_end", async (event, ctx) => {
  if (event.message.role !== "assistant") return;

  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: {
          ...event.message.usage.cost,
          total: 0.123,
        },
      },
    },
  };
});
```

#### tool_execution_start / tool_execution_update / tool_execution_end

在工具执行生命周期更新时触发。

在并行工具模式下：
- `tool_execution_start` 在预检阶段按照助手源顺序发射
- `tool_execution_update` 事件可能在不同工具之间交错出现
- `tool_execution_end` 在每次工具完成之后按照工具完成顺序发射
- 最终的 `toolResult` 消息事件仍会在稍后按照助手源顺序发射

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.args, event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId, event.toolName, event.result, event.isError
});
```

#### 上下文

在每次 LLM 调用之前触发。非破坏性地修改消息。有关消息类型，请参阅 [会话格式](/docs/session-format/)。

```typescript
pi.on("context", async (event, ctx) => {
  // 事件消息 - 深拷贝，可安全修改
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered });
});
```

#### before_provider_headers

在出站 HTTP 请求头组装完成后触发。可用于添加、覆盖或删除请求头。

处理器会直接修改 `event.headers`。将某个键设置为字符串可添加或覆盖该头，设置为 `null` 则删除该头。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // 添加或覆盖 —— 例如网关追踪/归因所需的会话标识
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // 删除 pi 为本次调用添加的追踪头
  event.headers["X-OpenRouter-Title"] = null;
});
```

每次提供商请求触发一次；重试会复用相同的请求头，不会重新触发该钩子。

#### before_provider_request

在构建提供商特定负载后、发送请求前触发。处理器按扩展加载顺序运行。返回 `undefined` 保持负载不变。返回其他任意值将替换后续处理器及实际请求所使用的负载。

此钩子可重写提供商级别的系统指令或完全移除。这些负载级别的更改不会反映在 `ctx.getSystemPrompt()` 中，该函数报告的是 Pi 的系统提示词字符串，而非最终序列化的提供商负载。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // 可选：替换负载
  // return { ...event.payload, temperature: 0 };
});
```

此钩子主要用于调试提供商序列化和缓存行为。

> 完整代码见英文原文。

#### after_provider_response

在收到HTTP响应之后、流式响应体被消费之前触发。处理器按扩展加载顺序执行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP状态码
  // event.headers - 规范化后的响应头
  if (event.status === 429) {
    console.log("请求频率受限", event.headers["retry-after"]);
  }
});
```

响应头的可用性取决于提供商和传输方式。抽象了HTTP响应的提供商可能不暴露响应头。

### 模型事件</think>### 模型事件

#### model_select（模型选择）

当通过 `/model` 命令、模型循环切换（`Ctrl+P`）或会话恢复导致模型变更时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - 新选定的模型
  // event.previousModel - 之前的模型（首次选择时为 undefined）
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`模型已切换 (${event.source}): ${prev} -> ${next}`, "info");
});
```

当活动模型变更时，可利用此事件更新界面元素（如状态栏、页脚）或执行特定于模型的初始化操作。

#### thinking_level_select

当思维等级变化时触发。此事件仅用于通知；处理器的返回值会被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - 新选中的思维等级
  // event.previousLevel - 之前的思维等级

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

当 `pi.setThinkingLevel()`、模型切换或内置思维等级控件改变当前思维等级时，使用此事件来更新扩展界面。

### 工具事件

#### tool_call

在 `tool_execution_start` 之后、工具执行之前触发。**可以阻塞。** 使用 `isToolCallEventType` 来收窄并获取类型化输入。

在 `tool_call` 运行之前，pi 会等待先前发出的代理事件通过 `AgentSession` 完成排空。这意味着 `ctx.sessionManager` 在当前的助手工具调用消息中是最新的。

在默认的并行工具执行模式下，来自同一助手消息的同级工具调用会先按顺序预检，然后并发执行。`tool_call` 不保证能够在 `ctx.sessionManager` 中看到来自同一助手消息的同级工具结果。

`event.input` 是可变的。在执行前原地修改它即可修补工具参数。

行为保证：
- 对 `event.input` 的修改会影响实际的工具执行。
- 后续的 `tool_call` 处理器能够看到之前处理器所做的修改。
- 你的修改之后不进行重新验证。
- `tool_call` 的返回值通过 `{ block: true, reason?: string, terminate?: boolean }` 控制阻塞。
- `terminate` 仅适用于被阻塞的调用；只有当批次中每个最终结果都是终止的，代理才会提前停止。

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash"、"read"、"write"、"edit" 等。
  // event.toolCallId
  // event.input - 工具参数（可变）

  // 内置工具：无需类型参数
  if (isToolCallEventType("bash", event)) {
    // event.input 为 { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "Dangerous command", terminate: true };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input 为 { path: string; offset?: number; limit?: number }
    console.log(`Reading: ${event.input.path}`);
  }
});
```

#### 为自定义工具输入指定类型

自定义工具应导出其输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

在类型参数中使用 `isToolCallEventType` 显式类型：

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // 类型化
  }
});
```

#### tool_result

在工具执行结束之后、`tool_execution_end`及最终工具结果消息事件发出之前触发。**可修改结果。**

在并行工具模式下，`tool_result`和`tool_execution_end`可能按照工具完成顺序交错排列，而最终的`toolResult`消息事件仍然按照助手源码顺序稍后发出。

`tool_result`处理器像中间件一样链式执行：
- 处理器按扩展加载顺序执行
- 每个处理器在之前的处理器修改之后，能看到最新结果
- 处理器可返回部分修改（`content`、`details`、`isError`或`usage`）；未提供的字段保持当前值

在处理器内部进行嵌套异步操作时，使用`ctx.signal`。这允许Esc取消模型调用、`fetch()`以及扩展发起的其他支持中止的操作。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details 的类型为 BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // 修改结果：
  return { content: [...], details: {...}, isError: false, usage: nestedModelUsage };
});
```

### 用户 Bash 事件

#### user_bash

当用户执行 `!` 或 `!!` 命令时触发。**可拦截。**

```typescript
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";

pi.on("user_bash", (event, ctx) => {
  // event.command - bash 命令
  // event.excludeFromContext - 若为 !! 前缀则为 true
  // event.cwd - 工作目录

  // 选项 1：提供自定义操作（例如 SSH）
  return { operations: remoteBashOps };

  // 选项 2：包装 pi 的内置本地 bash 后端
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // 选项 3：完全替换 - 直接返回结果
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

### 输入事件

#### 输入

当收到用户输入时触发，此时扩展命令已检查完毕，但技能和提示词模板尚未展开。该事件接收原始输入文本，因此 `/skill:foo` 和 `/template` 尚未展开。

**处理顺序：**
1. 先检查扩展命令（`/cmd`）——若匹配，处理程序运行并跳过输入事件
2. `input` 事件触发——可拦截、转换或处理
3. 若未处理：技能命令（`/skill:name`）展开为技能内容
4. 若未处理：提示词模板（`/template`）展开为模板内容
5. 代理处理开始（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - 原始输入（技能/模板展开前）
  // event.images - 附带的图像（如有）
  // event.source - "interactive"（键入）、"rpc"（API）或 "extension"（通过 sendUserMessage）
  // event.streamingBehavior - "steer" | "followUp" | 未定义
  //   空闲时为 undefined，"steer" 用于流中断，"followUp" 用于排队到代理完成后的消息

  // 转换：在展开前改写输入
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `简要回复：${event.text.slice(7)}` };

  // 处理：无需 LLM 直接回复（扩展显示自身反馈）
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // 按来源路由：跳过扩展注入消息的处理
  if (event.source === "extension") return { action: "continue" };

  // 在展开前拦截技能命令
  if (event.text.startsWith("/skill:")) {
    // 可转换、阻止或放行
  }

  return { action: "continue" };  // 默认：放行至展开阶段
});
```

**结果：**
- `continue` - 原样放行（若处理程序无返回值则默认）
- `transform` - 修改文本/图像，然后继续展开
- `handled` - 完全跳过代理（首个返回此值的处理程序生效）

转换在多个处理程序间串联执行。参见 [input-transform.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform-streaming.ts) 了解按 `streamingBehavior` 感知的路由。

## ExtensionContext（扩展上下文）

所有处理器都会接收 `ctx: ExtensionContext` 参数。

### ctx.ui

用于用户交互的 UI 方法。完整细节请参见 [自定义 UI](#custom-ui)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。使用 `ctx.mode === "tui"` 来守护仅限终端的功能，例如 `custom()`、组件工厂、终端输入和直接 TUI 渲染。

### ctx.hasUI

在 TUI 和 RPC 模式中为 `true`。在打印模式（`-p`）和 JSON 模式中为 `false`。使用此项来保护对话框方法（`select`、`confirm`、`input`、`editor`）和即发即忘方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`），这些方法在 TUI 和 RPC 模式下均能正常工作。在 RPC 模式下，某些 TUI 特有的方法为空操作或返回默认值（参见 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

在构建项目本地配置路径时，请使用 `CONFIG_DIR_NAME` 而非硬编码 `.pi`。重新品牌化的发行版可能使用不同的配置目录名。

```typescript
import { CONFIG_DIR_NAME, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const projectConfigPath = join(ctx.cwd, CONFIG_DIR_NAME, "my-extension.json");
    // ...
  });
}
```

### ctx.isProjectTrusted()

返回当前会话上下文中是否启用了项目本地信任，包括临时信任决定和命令行信任覆盖，而不仅仅是全局信任存储中已保存的决定。

在读取仅应对受信任项目生效的项目本地扩展配置之前，请使用此方法。

### ctx.sessionManager

提供对会话状态的只读访问。完整的 SessionManager API 及条目类型说明，请参阅 [会话格式](/docs/session-format/)。

对于 `tool_call` 而言，该状态会在处理器运行前通过当前助手消息进行同步。在并行工具执行模式下，仍不保证包含来自同一助手消息的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries()             // 所有条目
ctx.sessionManager.getBranch()              // 当前分支
ctx.sessionManager.buildContextEntries()    // 已应用压缩的活动分支条目
ctx.sessionManager.getLeafId()              // 当前叶子条目 ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

用于访问模型、提供商及已解析的认证信息。`ctx.modelRegistry.getProvider(id)` 返回有效的 pi-ai 提供商，而 `getProviderAuth(id)` 则解析其当前 API 密钥、请求头、基础 URL 以及提供商作用域内的环境变量，无需加载模型。`ctx.model` 为当前激活的模型，`ctx.thinkingLevel` 为其当前有效的思考级别。

`ctx.scopedModels` 是当前会话作用域内的模型只读列表 — 与 `/scoped-models` 命令显示的集合相同。该列表在会话启动时根据 `--models` 命令行标志及 `enabledModels` 设置解析得出（通过 minimatch 按 `provider/modelId` 或裸 `modelId` 与可用目录匹配）。当未配置作用域时，该列表为空，表示所有可用模型均可使用。每个条目形如 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在模式将其固定时设置（例如 `anthropic/*:high`）。可借助此列表填充与内置模型选择器一致的模型选择器，而无需通过 `ctx.modelRegistry.getAvailable()` 遍历整个目录。

#### 流式模型调用

对于诸如 `reasoning` 这类提供商中立的选项，请使用 `ctx.modelRegistry.streamSimple(model, context, options)` 方法；若需使用 API 特有的选项，则可调用 `stream()` 方法。这两种方法均会利用所配置的提供商，并解决身份验证问题，包括那些通过 `pi.registerProvider()` 注册的提供商。请优先使用这些方法，而不是 `pi-ai/compat` 中的流式函数，因为后者无法识别扩展的提供商注册信息。

两者都会返回一个 `AssistantMessageEventStream`。您可以遍历它以获取响应事件，并等待 `.result()` 以获取最终消息。若设置失败，则会产生错误事件和错误结果。

### ctx.signal

当前代理的中止信号，当没有代理回合处于活动状态时为 `undefined`。

用于扩展处理程序启动的、可感知中止的嵌套工作，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 参数的模型调用
- 接受 `AbortSignal` 的文件或进程辅助工具

`ctx.signal` 通常在活动回合事件中定义，例如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
在空闲或非回合上下文中，例如会话事件、扩展命令以及 pi 空闲时触发的快捷键，它通常是 `undefined`。

```typescript
pi.on("tool_result", async (event, ctx) => {
  const response = await fetch("https://example.com/api", {
    method: "POST",
    body: JSON.stringify(event),
    signal: ctx.signal,
  });

  const data = await response.json();
  return { details: data };
});
```

### ctx.isIdle() / ctx.abort() / ctx.hasPendingMessages()

控制流辅助函数。当 Pi 正在处理代理运行、自动重试、自动压缩重试或排队中的续接时，`ctx.isIdle()` 返回 `false`。

### ctx.shutdown()

请求优雅关闭 pi。

- **交互模式：** 延迟至代理空闲时（即处理完所有排队的引导和追问消息之后）。
- **RPC 模式：** 延迟至下一个空闲状态（即完成当前命令响应、等待下一条命令时）。
- **打印模式：** 无操作。处理完所有提示后，进程自动退出。

退出前向所有扩展发出 `session_shutdown` 事件。适用于所有上下文（事件处理器、工具、命令、快捷键）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前活动模型的上下文使用情况。在可用时优先使用上一次助手响应的用量数据，否则估算后续消息的令牌数。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // 处理令牌超限的情况
}
```

### ctx.compact()

触发压缩而不等待完成。使用 `onComplete` 和 `onError` 进行后续处理。

```typescript
ctx.compact({
  customInstructions: "Focus on recent changes",
  onComplete: (result) => {
    ctx.ui.notify("Compaction completed", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示词字符串。

- 在 `before_agent_start` 期间，这反映了当前回合到目前为止所做的链式系统提示词更改。
- 它不包括后来 `context` 消息的变更。
- 它不包括 `before_provider_request` 负载的重写。
- 如果稍后加载的扩展在你之后运行，它们仍然可以更改最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理程序会收到 `ExtensionCommandContext`，它通过会话控制方法扩展了 `ExtensionContext`。这些方法仅在命令中可用，因为如果从事件处理程序中调用，可能会导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示词的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

其形状与可变性与 `before_agent_start` 事件的 `event.systemPromptOptions` 相同：自定义提示词、活动工具、工具片段、提示词指南、追加的系统提示词文本、当前工作目录、已加载的上下文文件和已加载的技能。它可能包含完整的上下文文件内容，请将其视为敏感的扩展局部数据，避免通过命令列表、日志或自动补全元数据暴露。

此方法报告当前的基础提示词输入，不包含每轮 `before_agent_start` 链式系统提示词更改、后续 `context` 事件消息变更，或 `before_provider_request` 负载重写。

### ctx.waitForIdle()

等待代理完全稳定，包括自动重试、自动压缩重试和排队中的后续操作：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // 代理现在空闲，可以安全地修改会话
  },
});
```

### ctx.newSession(options?)

创建新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "在替换会话中继续";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "来自上一个会话的上下文..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // 仅在此处使用替换会话的 ctx。
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 某个扩展取消了新会话
}
```

选项说明：
- `parentSession`：父会话文件，用于记录在新会话的头部信息中
- `setup`：在 `withSession` 运行之前修改新会话的 `SessionManager`
- `withSession`：在切换后使用全新的替换会话上下文运行代码。请勿使用捕获的旧 `pi` 或命令 `ctx`；详见 [会话替换生命周期与注意事项](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从特定条目进行分支派生，创建一个新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // 此处仅使用替换会话的 ctx。
    ctx.ui.notify("现在处于分支会话中", "info");
  },
});
if (result.cancelled) {
  // 某个扩展取消了分支派生
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // 某个扩展取消了克隆操作
}
```

选项：
- `position`：`"before"`（默认）在所选的用户消息之前进行分支派生，将该提示词恢复至编辑器
- `position`：`"at"` 复制所选条目中的活动路径，而不恢复编辑器文本
- `withSession`：在切换完成后，对全新的替换会话上下文执行后续工作。请勿使用捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

在会话树中导航到另一个节点。当代理响应、手动或自动压缩或另一个树导航处于活动状态时，即使使用 `summarize: false`，该方法也会拒绝执行。这些冲突会使当前活动分支保持不变并拒绝该 promise，而不会返回 `{ cancelled: true }`。等待活动操作完成（例如，在命令处理程序中使用 `await ctx.waitForIdle()`），然后重试：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = 完全替换默认提示词
  label: "review-checkpoint",
});
```

选项：
- `summarize`: 是否生成被抛弃分支的摘要
- `customInstructions`: 用于摘要器的自定义指令
- `replaceInstructions`: 如果为 true，`customInstructions` 将完全替换默认提示词，而不是追加
- `label`: 附加到分支摘要条目（或目标条目，如果不进行摘要）的标签

### ctx.switchSession(sessionPath, options?)

切换到不同的会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("在替换会话中恢复工作");
  },
});
if (result.cancelled) {
  // 某个扩展通过 session_before_switch 取消了切换
}
```

选项：
- `withSession`：在新的替换会话上下文中运行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [会话替换生命周期与易错点](#session-replacement-lifecycle-and-footguns)。

要发现可用会话，使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

pi.registerCommand("switch", {
  description: "切换到另一个会话",
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select(
      "选择会话：",
      sessions.map(s => s.file),
    );
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify("已切换会话", "info");
        },
      });
    }
  },
});
```

### 会话替换生命周期与潜在陷阱

`withSession` 接收一个全新的 `ReplacedSessionContext`，它通过绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法扩展了`ExtensionCommandContext`。

生命周期与潜在陷阱：
- `withSession` 仅在旧会话发出 `session_shutdown`、旧运行时已拆除、替换会话已重新绑定，且新的扩展实例已收到 `session_start` 之后才运行。
- 回调仍在原始闭包中执行，而非在新扩展实例内部。这意味着你的旧扩展实例可能在 `withSession` 开始之前已经执行了其关闭清理。
- 替换后，捕获的旧 `pi` / 旧命令 `ctx` 会话绑定对象已经过期，使用时会抛出异常。对于会话绑定工作，仅使用传递给 `withSession` 的 `ctx`。
- 先前提取的原始对象仍由你负责处理。例如，如果你在替换前捕获了 `const sm = ctx.sessionManager`，`sm` 仍然是旧的 `SessionManager` 对象。替换后不要复用。
- `withSession` 中的代码应假设你的 `session_shutdown` 处理器失效的任何状态都已被移除。仅捕获能干净存活的普通数据，如字符串、ID 和序列化配置。

安全模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const kickoff = "从替换会话继续";
    await ctx.newSession({
      withSession: async (ctx) => {
        await ctx.sendUserMessage(kickoff);
      },
    });
  },
});
```

不安全模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const oldSessionManager = ctx.sessionManager;
    await ctx.newSession({
      withSession: async (_ctx) => {
        // 过期的旧对象：请不要这样做
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("wrong");
      },
    });
  },
});
```

### ctx.reload()

执行与 `/reload` 相同的重载流程。

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, themes, and context files",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为说明：
- `await ctx.reload()` 会为当前扩展运行时触发 `session_shutdown` 事件
- 随后它会重新加载资源，并触发带有 `reason: "reload"` 的 `session_start` 事件，以及带有  `reason: "reload"` 的 `resources_discover` 事件
- 当前正在运行的命令处理器仍会在旧的调用帧中继续执行
- `await ctx.reload()` 之后的代码仍由重载前的版本运行
- `await ctx.reload()` 之后的代码不得假定旧的内存中的扩展状态仍然有效
- 处理器返回之后，后续的命令/事件/工具调用将使用新的扩展版本

为了获得可预测的行为，请将重载视为该处理器的终态操作（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此它们不能直接调用 `ctx.reload()`。请使用命令作为重载入口点，然后暴露一个工具，将该命令作为追问用户消息加入队列。

以下是 LLM 可调用的触发重载的示例工具：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, themes, and context files",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "Reload Runtime",
    description: "Reload extensions, skills, prompts, themes, and context files",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
      };
    },
  });
}
```

## 扩展 API 方法

### pi.on(event, handler)

订阅事件。事件类型及返回值参见 [事件](#events)。

### pi.registerTool(definition)

注册一个可供 LLM 调用的自定义工具。详见[自定义工具](#custom-tools)。

`pi.registerTool()` 在扩展加载期间和启动后均可使用。你可以从 `session_start`、命令处理器或其他事件处理器内调用它。新工具会在同一会话内立即刷新，随即出现在 `pi.getAllTools()` 中，LLM 无需 `/reload` 即可调用。

使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 将自定义工具纳入 `Available tools` 中的单行条目，并使用 `promptGuidelines` 在工具启用时向默认的 `Guidelines` 部分追加工具特定的要点。

**重要：** `promptGuidelines` 的要点以扁平方式追加到 `Guidelines` 部分，不添加工具名称前缀。每条要点必须明确其所指的工具——避免使用"Use this tool when……"这类表述，因为 LLM 无法分清"this"指代哪个工具。请改为"Use my_tool when……"。

完整示例参见 [dynamic-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does",
  promptSnippet: "Summarize or transform text according to action",
  promptGuidelines: ["Use my_tool when the user asks to summarize previously generated text."],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选的兼容性垫片，在架构验证之前运行。
    // 返回当前架构形态，例如将旧字段折叠
    // 到新式参数对象中。
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 流式输出进度
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });

    return {
      content: [{ type: "text", text: "Done" }],
      details: { result: "..." },
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

向会话中注入自定义消息。自定义消息会参与 LLM 上下文。对于不应发送给 LLM 的持久化 TUI-only 内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 和 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

```typescript
pi.sendMessage({
  customType: "my-extension",
  content: "Message text",
  display: true,
  details: { ... },
}, {
  triggerTurn: true,
  deliverAs: "steer",
});
```

**选项：**
- `deliverAs` - 传递模式：
  - `"steer"`（默认）— 在流式传输期间将消息排队。在当前助手回合完成执行其工具调用后、下一次 LLM 调用之前传递。
  - `"followUp"` — 等待代理完成。仅在代理不再有工具调用时传递。
  - `"nextTurn"` — 排队等待下一条用户提示。不中断或触发任何操作。
- `triggerTurn: true` — 如果代理空闲，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 忽略）。

### pi.sendUserMessage(content, options?)

向代理发送用户消息。与发送自定义消息的 `sendMessage()` 不同，此方法发送的是实际用户消息，效果如同用户亲自输入一般。此操作始终会触发一次新一轮对话。

```typescript
// 简单文本消息
pi.sendUserMessage("2+2等于几?");

// 使用内容数组（文本加图片）
pi.sendUserMessage([
  { type: "text", text: "描述这张图片:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// 流式传输期间 - 必须指定投递模式
pi.sendUserMessage("重点关注错误处理", { deliverAs: "steer" });
pi.sendUserMessage("然后进行总结", { deliverAs: "followUp" });

// 选择启用扩展命令分发及技能/提示词模板展开
pi.sendUserMessage("/review src/index.ts", { expandPromptTemplates: true });
```

**选项：**
- `deliverAs` - 当代理正在流式传输时必填：
  - `"steer"` - 将消息排队，在当前助手轮次完成其工具调用后投递
  - `"followUp"` - 等待代理完成所有工具操作
- `expandPromptTemplates` - 分发扩展命令并展开技能命令和提示词模板。默认值为 `false`。

未处于流式传输时，消息会立即发送并触发新一轮对话。流式传输中未指定 `deliverAs` 时会抛出错误。

完整示例请参阅 [send-user-message.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目不参与 LLM 上下文。在交互模式下，当配合 `pi.registerEntryRenderer()` 使用时，它们也可以在聊天记录中渲染。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// 在重新加载时恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // 从 entry.data 中重建状态
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（在会话选择器中显示，而非第一条消息）。

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

获取当前会话名称，如果已设定的话。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, label)

设置或清除条目标签。标签是用户定义的标记，用于书签和导航（在`/tree`选择器中显示）。

```typescript
// 设置标签
pi.setLabel(entryId, "checkpoint-before-refactor");

// 清除标签
pi.setLabel(entryId, undefined);

// 通过会话管理器读取标签
const label = ctx.sessionManager.getLabel(entryId);
```

标签会保存在会话中，并且重启后依然存在。使用标签可以标记对话树中的重要节点（如转折点、检查点）。

### pi.registerCommand(name, options)

注册一个命令。

如果多个扩展注册了相同的命令名，pi 会保留所有命令，并按加载顺序分配数字后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "显示会话统计信息",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} 条记录`, "info");
  }
});
```

可选：为 `/command ...` 添加参数自动补全：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "部署到某个环境",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`正在部署: ${args}`, "info");
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、提示词模板和技能命令。
该列表与 RPC `get_commands` 的顺序一致：先扩展，后模板，再技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目具有以下形状：

```typescript
{
  name: string; // 可调用命令名称，不带前导斜杠。可能有后缀，如 "review:1"
  description?: string;
  source: "extension" | "prompt" | "skill";
  sourceInfo: {
    path: string;
    source: string;
    scope: "user" | "project" | "temporary";
    origin: "package" | "top-level";
    baseDir?: string;
  };
}
```

使用 `sourceInfo` 作为权威来源字段。不要从命令名称或临时路径解析中推断归属。

内置交互命令（如 `/model` 和 `/settings`）不在此列。它们仅在交互模式下处理，如果通过 `prompt` 发送将不会执行。

### pi.registerMessageRenderer(customType, renderer)

使用你的 `customType` 为自定义消息注册一个自定义 TUI 渲染器。自定义消息通过 `pi.sendMessage()` 创建，并参与 LLM 上下文。参见 [自定义 UI](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

注册一个转换器，用于普通用户文本、助手文本和思考块中的 Markdown。转换器按扩展加载顺序运行，每个转换器接收前一个转换器返回的 Markdown。链结束后，Pi 使用内置渲染器渲染转换后的内容。

转换器接收 Markdown 字符串和一个上下文，包含：

- `messageType` — `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 对于部分助手更新为 `true`；对于用户、最终助手和恢复的消息为 `false`
- `availableWidth` — 可用于转换后的 Markdown 内容的精确终端列数

返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

如果转换器抛出异常，Pi 保留到目前为止生成的 Markdown，并继续执行下一个转换器。该挂钩仅用于显示：原始消息在会话和模型上下文中保持不变。它运行于新用户消息、助手流式更新、恢复的会话消息和终端宽度变化时，因此转换器应保持同步且开销较小。

### pi.registerEntryRenderer(customType, renderer)

为使用你的 `customType` 的自定义条目注册自定义 TUI 渲染器。自定义条目通过 `pi.appendEntry()` 创建，不参与 LLM 上下文。

```typescript
import { Box, Text } from "@earendil-works/pi-tui";

pi.registerEntryRenderer("status-card", (entry, { expanded }, theme) => {
  const data = entry.data as { title: string; count: number };
  const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
  box.addChild(new Text(`${theme.bold(data.title)}: ${data.count}`));
  if (expanded) {
    box.addChild(new Text(theme.fg("dim", JSON.stringify(data, null, 2))));
  }
  return box;
});

pi.appendEntry("status-card", { title: "Indexed files", count: 17 });
```

### pi.registerShortcut(shortcut, options)

注册键盘快捷键。关于快捷键格式及内置键位绑定，请参阅 [keybindings.md](/docs/keybindings/)。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "切换计划模式",
  handler: async (ctx) => {
    ctx.ui.notify("已切换！");
  },
});
```

### pi.registerFlag(name, options)

注册一个 CLI 标志。

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// 检查值
if (pi.getFlag("plan")) {
  // 计划模式已启用
}
```

### pi.exec(command, args, options?)

执行一个 shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout（标准输出）, result.stderr（标准错误）, result.code（退出码）, result.killed（是否被终止）
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。此功能既适用于内置工具，也适用于动态注册的工具。`pi.getActiveTools()` 返回活动工具名称，类型为 `string[]`；`pi.getAllTools()` 返回所有已配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "读取文件内容...",
//   parameters: ...,
//   promptGuidelines: ["使用 read 检查文件，而非 cat 或 sed。"],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // 保留当前工具并启用 my_custom_tool
pi.setActiveTools(["read", "bash"]); // 切换为只读
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

典型的 `sourceInfo.source` 取值：
- 内置工具为 `builtin`
- 通过 `createAgentSession({ customTools })` 传入的工具为 `sdk`
- 由扩展注册的工具为扩展源元数据

### pi.setModel(model)

为当前会话设置模型。此更改会记录在会话历史中，并在恢复该会话时被还原，但不会改变新会话所使用的已配置的 `defaultProvider` 或 `defaultModel`。如果模型的提供商未配置身份验证，则返回 `false`。有关配置自定义模型的详细信息，请参阅 [models.md](/docs/models/)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("该模型没有API密钥", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取当前思考层级。该层级会被限制在模型能力范围内（非推理模型始终使用 `"off"`）。更改时会触发 `thinking_level_select` 事件。

`pi.setThinkingLevel()` 更改当前会话的思考层级。该更改会记录在会话历史中，并在恢复该会话时还原，但不会更改新会话所使用的配置默认值。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel("high");
```

### pi.events

用于扩展之间通信的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

动态注册或覆盖模型提供商。适用于代理、自定义端点或团队级模型配置。

在扩展工厂函数执行期间的调用会被排队，并在运行时初始化后应用。此后的调用——例如用户设置流程之后从命令处理器发起的调用——会立即生效，无需 `/reload`。

动态提供商可以实现 `refreshModels`。Pi 在模型刷新期间调用该方法，通过提供商同步发布返回的列表，并传递规范的凭据/存储目录/网络/信号上下文。扩展通过经过生成检查的 `context.publish({ persist: entry })` 决定是否持久化目录元数据；`llama.cpp` 等实时服务器可以在不持久化模型的情况下返回模型。

`context.signal` 始终是一个具体信号，提供商回调必须将其传递给阻塞式 I/O。公开的 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 调用接受可选信号，省略时无界；扩展和应用程序自行选择截止时间。即使提供商忽略信号，取消也会停止调用方的等待，但仍需配合才能停止底层工作。

需要原生提供商认证、过滤、刷新或流式行为的扩展可以从 `@earendil-works/pi-ai` 注册完整的 `Provider`。该提供商成为组合基础，`models.json` 覆盖仍在其之上生效。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";

const provider = createProvider({
  id: "local-server",
  name: "Local Server",
  baseUrl: "http://localhost:8080/v1",
  auth: {
    apiKey: {
      name: "Local server setup",
      async login(interaction) {
        return {
          type: "api_key",
          key: await interaction.prompt({ type: "secret", message: "API key" }),
        };
      },
      async resolve({ credential }) {
        return credential?.key
          ? { auth: { apiKey: credential.key }, source: "stored API key" }
          : undefined;
      },
    },
  },
  models: [],
  api: openAICompletionsApi(),
});

pi.registerProvider(provider);

// 使用自定义模型注册新提供商
pi.registerProvider("my-proxy", {
  name: "My Proxy",
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",  // 环境变量引用
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (proxy)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// 注册实时 llama.cpp 目录而不持久化发现的模型
pi.registerProvider("llama.cpp", {
  baseUrl: "http://localhost:8080/v1",
  apiKey: "local",
  api: "openai-completions",
  async refreshModels({ signal }) {
    const response = await fetch("http://localhost:8080/v1/models", { signal });
    const { data } = await response.json();
    return data.map(({ id }) => ({
      id,
      name: id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 16384
    }));
  }
});

// 覆盖现有提供商的 baseUrl（保留所有模型）
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// 注册支持 /login 的 OAuth 提供商
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      // 自定义 OAuth 流程
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials, signal) {
      signal.throwIfAborted();
      // 刷新逻辑
      return credentials;
    },
    getApiKey(credentials) {
      return credentials.access;
    }
  }
});
```

对象形式接受完整的 pi-ai `Provider`，包括原生 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**旧版配置选项：**
- `name` - 提供商在 `/login` 等界面中的显示名称。
- `baseUrl` - API 端点 URL。定义模型时必填。
- `apiKey` - API 密钥字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`），或 `!command` 开头。定义模型时必填（除非提供了 `oauth`）。`$$` 转义 `$`，`$!` 转义字面量 `!` 而不触发命令执行。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 请求中包含的自定义头。
- `authHeader` - 如果为 true，自动添加 `Authorization: Bearer` 头。
- `models` - 模型定义数组。如果提供，将替换此提供商的所有现有模型。模型定义可以设置 `baseUrl` 以覆盖该模型的提供商端点。
- `refreshModels` - 异步动态发现回调。其返回的模型替换扩展提供的模型。`context.stored` 包含持久化的提供商快照；仅在更新后的目录数据应持久化时使用经过生成检查的 `context.publish({ persist: entry })`。使用 `persist: null` 删除该快照。
- `oauth` - 支持 `/login` 的 OAuth 提供商配置。提供时，该提供商出现在登录菜单中。
- `streamSimple` - 非标准 API 的自定义流式实现。

高级主题参见 [custom-provider.md](/docs/custom-provider/)：自定义流式 API、OAuth 细节、模型定义参考。

### pi.unregisterProvider(name)

移除先前注册的提供商及其模型。若内置模型被该提供商覆盖，则恢复为内置模型。若该提供商从未注册，则不产生任何效果。

与 `registerProvider` 一样，在初始加载阶段之后调用此命令会立即生效，无需执行 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "移除自定义代理提供商",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // 从会话中重建状态
  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    // ...
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },  // 存储以用于重建
      };
    },
  });
}
```

## 自定义工具

通过 `pi.registerTool()` 注册 LLM 可调用的工具。工具会出现在系统提示词中，并支持自定义渲染。

使用 `promptSnippet` 在默认系统提示词的 `可用工具` 部分中生成一行简短条目。若省略，自定义工具将不会出现在该部分中。

使用 `promptGuidelines` 为默认系统提示词的 `指南` 部分添加工具专属的要点。这些要点仅在工具激活期间包含（例如，在 `pi.setActiveTools([...])` 之后）。

**重要提示：** `promptGuidelines` 中的要点会平铺追加到 `指南` 部分，不带工具名称前缀或分组。每条指南必须明确指明其针对的工具——应避免使用“使用此工具时……”，因为 LLM 无法判断“此工具”指的是哪个。应改为“使用 my_tool 时……”。

注意：有些模型比较糊涂，会在工具路径参数中加上 @ 前缀。内置工具会在解析路径前去除开头的 @。如果你的自定义工具接受路径参数，请同样处理开头的 @。

如果你的自定义工具会修改文件，请使用 `withFileMutationQueue()`，使其与内置的 `edit` 和 `write` 工具参与相同的按文件队列。这一点很重要，因为工具调用默认并行执行。若无队列，两个工具可能读取到相同的旧文件内容，计算不同的更新，最终后写入的会覆盖先写入的。

示例失败场景：你的自定义工具编辑 `foo.ts`，而内置 `edit` 在同一轮助手对话中也修改了 `foo.ts`。如果你的工具未参与队列，两者可能都读取原始的 `foo.ts`，各自应用更改，其中一方的更改将丢失。

请将真实的目标文件路径传递给 `withFileMutationQueue()`，而不是原始的用户参数。先将其解析为绝对路径，相对于 `ctx.cwd` 或你的工具的工作目录。对于已有文件，该辅助函数会通过 `realpath()` 进行规范化，因此同一文件的符号链接别名共享同一队列。对于新文件，它会回退到解析后的绝对路径，因为此时尚无内容可执行 `realpath()`。

将整个变更窗口排入该目标路径的队列，这包括读-改-写逻辑，而不仅仅是最终的写入操作。

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");

    return {
      content: [{ type: "text", text: `Updated ${params.path}` }],
      details: {},
    };
  });
}
```

### 工具定义

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

pi.registerTool({
  name: "my_tool",
  label: "我的工具",
  description: "该工具的功能描述（展示给LLM）",
  promptSnippet: "在项目待办清单中列出或添加条目",
  promptGuidelines: [
    "当用户请求任务清单时，应使用 my_tool 进行待办规划，而非直接编辑文件。"
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // 使用 StringEnum 以兼容 Google API
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;
    const input = args as { action?: string; oldAction?: string };
    if (typeof input.oldAction === "string" && input.action === undefined) {
      return { ...input, action: input.oldAction };
    }
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 检查是否已取消
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "已取消" }] };
    }

    // 流式推送进度更新
    onUpdate?.({
      content: [{ type: "text", text: "处理中..." }],
      details: { progress: 50 },
    });

    // 通过 pi.exec 运行命令（从扩展闭包中捕获）
    const result = await pi.exec("some-command", [], { signal });

    // 返回结果
    return {
      content: [{ type: "text", text: "完成" }],  // 发送给LLM
      details: { data: result },                   // 用于渲染与状态保存
      // usage: nestedModelResponse.usage,          // 可选：嵌套LLM调用统计
      // 可选：当本轮工具批次中所有已定稿的工具结果均返回
      // terminate: true 时，在此处终止后续自动调用。
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**用量统计：** 若工具内部调用了嵌套LLM，应将其合并后的 `Usage` 通过 `usage` 返回。Pi 会将之持久化到工具结果中，并计入页脚、`/session` 及 RPC 会话总量。`tool_result` 处理器可对该值进行查看或替换。

**错误信号：** 若需将工具执行标记为失败（在结果上设置 `isError: true` 并上报给LLM），请从 `execute` 中抛出错误。只要正常返回值，无论返回对象中包含哪些属性，都不会设置错误标志。

**提前终止：** 从 `execute()` 返回 `terminate: true` 表示提示：当前工具批次结束后应跳过自动的追问LLM调用。仅当该批次中所有已定稿的工具结果均返回 `terminate: true` 时才会生效。可参考 [examples/extensions/structured-output.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/structured-output.ts) 中的最小示例：智能体在最终的结构化输出工具调用上结束。

```typescript
// 正确做法：通过抛出错误来标志异常
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`无效输入: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要提示：** 字符串枚举请使用 `@earendil-works/pi-ai` 提供的 `StringEnum`。`Type.Union`/`Type.Literal` 不兼容 Google 的 API。

**参数准备：** `prepareArguments(args)` 为可选函数。若定义，则会在模式校验及 `execute()` 之前执行。当 pi 恢复旧会话时，存储的工具调用参数可能不再符合当前模式，此时可用它来兼容旧的输入结构。返回需要对照 `parameters` 进行校验的对象。保持公开模式的严格性，不要仅为了兼容旧恢复会话而向 `parameters` 添加已废弃的兼容字段。

示例：旧会话中的 `edit` 工具调用可能带有顶层 `oldText` 与 `newText` 参数，而当前模式仅接受 `edits: [{ oldText, newText }]`。

```typescript
pi.registerTool({
  name: "edit",
  label: "编辑",
  description: "使用精确文本替换来编辑单个文件",
  parameters: Type.Object({
    path: Type.String(),
    edits: Type.Array(
      Type.Object({
        oldText: Type.String(),
        newText: Type.String(),
      }),
    ),
  }),
  prepareArguments(args) {
    if (!args || typeof args !== "object") return args;

    const input = args as {
      path?: string;
      edits?: Array<{ oldText: string; newText: string }>;
      oldText?: unknown;
      newText?: unknown;
    };

    if (typeof input.oldText !== "string" || typeof input.newText !== "string") {
      return args;
    }

    return {
      ...input,
      edits: [...(input.edits ?? []), { oldText: input.oldText, newText: input.newText }],
    };
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 此处 params 已符合当前模式
    return {
      content: [{ type: "text", text: `正在应用 ${params.edits.length} 个编辑块` }],
      details: {},
    };
  },
});
```

### 覆盖内置工具

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式下发生覆盖时会显示警告。

```bash
# 扩展的 read 工具替换内置的 read
pi -e ./tool-override.ts
```

或者，使用 `--no-builtin-tools` 启动时不加载任何内置工具，同时保留扩展工具：
```bash
# 无内置工具，仅使用扩展工具
pi --no-builtin-tools -e ./my-extension.ts
```

参见 [examples/extensions/tool-override.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts) 获取一个完整的覆盖 `read` 并加入日志与访问控制的示例。

**渲染：** 内置渲染器的继承按插槽分别解析。执行覆盖与渲染覆盖相互独立。如果你的覆盖省略了 `renderCall`，将使用内置的 `renderCall`。如果省略了 `renderResult`，将使用内置的 `renderResult`。如果两者都省略，则自动使用内置渲染器（语法高亮、差异对比等）。这使得你可以在不重新实现 UI 的情况下，仅包装内置工具以增加日志或访问控制。

**提示词元数据：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。如果你的覆盖需要保留这些提示词指令，请在覆盖中显式定义它们。

**你的实现必须匹配精确的结果结构**，包括 `details` 类型。UI 和会话逻辑依赖这些结构来进行渲染与状态跟踪。

内置工具实现：
- [read.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [powershell.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/powershell.ts) - `PowerShellToolDetails`
- [edit.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

### 远程执行

内置工具支持可插拔操作，用于委托远程系统（SSH、容器等）执行：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// 使用自定义操作创建工具
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// 注册工具，执行时检查标志
pi.registerTool({
  ...remoteRead,
  async execute(id, params, signal, onUpdate, _ctx) {
    const ssh = getSshConfig();
    if (ssh) {
      const tool = createReadTool(cwd, { operations: createRemoteOps(ssh) });
      return tool.execute(id, params, signal, onUpdate);
    }
    return localRead.execute(id, params, signal, onUpdate);
  },
});
```

**操作接口：** `ReadOperations`、`WriteOperations`、`EditOperations`、`BashOperations`、`PowerShellOperations`、`LsOperations`、`GrepOperations`、`FindOperations`

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 复用 pi 的本地 shell 后端，而无需重新实现本地进程生成、shell 解析和进程树终止。

`bash` 和 `powershell` 工具还支持一个生成钩子（spawn hook），用于在执行前调整命令、工作目录或环境变量：

```typescript
import { createBashTool } from "@earendil-works/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```

`createBashTool()` 和 `createPowerShellTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 将当前会话暴露给命令。注入发生在 `spawnHook` 之前，因此钩子会在 `env` 中接收到这些值，并在如上展开现有环境时保留它们。设置 `exposeSessionEnvironment: false` 可禁用此功能：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

变量语义参见 [Shell 工具会话环境](environment-variables.md#shell-tool-session-environment)。完整的 SSH 示例（含 `--ssh` 标志）参见 [examples/extensions/ssh.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/ssh.ts)。

# 截断（Truncation）

如果不加以控制，外部命令输出可能会用超出上下文窗口的内容使模型不堪重负，浪费宝贵的 token 并导致：

- 上下文溢出（Prompt too long）
- 压缩失败（Compaction failures）
- 模型性能下降（Degraded model performance）

内置限制为 **50KB**（约 1 万个 token）和 **2000 行**，以先达到者为准。请使用导出的截断工具函数：

```typescript
import {
  truncateHead,      // 保留前 N 行/字节（适用于文件读取、搜索结果）
  truncateTail,      // 保留后 N 行/字节（适用于日志、命令输出）
  truncateLine,      // 将单行截断至 maxBytes 并添加省略号
  formatSize,        // 人类可读大小（例如“50KB”、“1.5MB”）
  DEFAULT_MAX_BYTES, // 50KB
  DEFAULT_MAX_LINES, // 2000
} from "@earendil-works/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();

  // 应用截断
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  let result = truncation.content;

  if (truncation.truncated) {
    // 将完整输出写入临时文件
    const tempFile = writeTempFile(output);

    // 告知 LLM 在哪里可以找到完整输出
    result += `\n\n[输出已截断：${truncation.outputLines} / ${truncation.totalLines} 行`;
    result += ` (${formatSize(truncation.outputBytes)} / ${formatSize(truncation.totalBytes)})。`;
    result += ` 完整输出已保存至：${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**要点：**
- 对于开头重要的内容（搜索结果、文件读取），使用 `truncateHead`
- 对于结尾重要的内容（日志、命令输出），使用 `truncateTail`
- 当输出被截断时，始终告知 LLM，并说明在哪里可以找到完整版本
- 在工具描述中记录截断限制

参见 [examples/extensions/truncated-tool.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts) 获取一个包装 `rg`（ripgrep）并正确截断的完整示例。

# Pi 扩展 API

Pi 扩展 API 允许开发者通过工具、上下文提供器和事件订阅来扩展 Pi 的功能。本指南涵盖了扩展 API 的架构和用法。

## 注册机制

我们以编程方式暴露了一个 `registerExtension` 函数。由于该 API 的主要使用场景是编辑器/IDE 集成，我们提供了多种获取编程式访问权限的方式：

- 将 Pi 作为库导入（`import { registerExtension } from 'pi'`）
- 通过 `--pipe` 标志的 stdin/stdout
- 通过 Unix domain socket（对于 macOS，可使用抽象命名空间或 `/tmp`；对于 Windows，则使用命名管道）

`registerExtension` 函数接受一个 `Extension` 对象作为参数。其中可以包含：

- `tools`：以 `PiTool` 对象数组的形式提供新工具。
- `contextProviders`：以 `PiContextProvider` 对象数组的形式提供新的上下文提供器。
- `events`：订阅 Pi 事件总线上的事件。
- `extName`：扩展的名称（用于错误报告）。

有关每种资源类型的详细指南，请参阅以下文档。

## 工具

工具允许你扩展 Pi 的功能。通过工具，你可以让 Pi 与外部系统进行交互。扩展能够注册新工具，这些工具会被注入到提示词中，并可供模型调用。

`tools` 字段接受一个 `PiTool[]` 数组。每个工具由以下字段定义：

- **`name`**：工具的名称。这是模型将要看到的名称。
- **`description`**：工具功能的描述。这对于模型的工具调用准确性至关重要，因此要确保描述清晰且完整。
- **`parameter_definitions`**：工具所需参数的描述。请使用 JSON Schema 格式来描述参数（即 `{ "properties": { ... }, "type": "object" }`）。
- **`command`**：工具的实现。它应当是一个接受单个 `PiToolCommand` 参数的函数，返回值为字符串或可迭代的字符串集合。返回的字符串会被直接发送给模型。参见下方“上下文”部分。

### 工具示例

```typescript
import { registerExtension } from "pi";

registerExtension({
  extName: "weather",
  tools: [
    {
      name: "get_weather",
      description: "获取给定位置的当前天气。",
      parameter_definitions: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "位置名称。",
          },
        },
      },
      command: async ({ location }) => {
        const weather = await fetchWeather(location);
        return `当前天气：${weather}`;
      },
    },
  ],
});
```

### 上下文

`PiToolCommand` 包含多个字段，用于向工具传递信息和上下文：

- **`input`**：一个包含工具参数的键值对象。
- **`context`**：一个包含 `sessionId` 和 `provider` 的对象。
- **`abortSignal`**：一个 `AbortSignal`，可用于在客户端断开连接或用户中断时中止正在进行的请求。
- **`logger`**：一个可用于输出日志的 logger 对象。
- **`debug`**：一个布尔值，指示当前会话是否为调试会话。
- **`overrides`**：一个包含 `model`、`cwd` 和 `provider` 的对象，可用于覆盖当前的设置。

### 中止信号

`abortSignal` 在客户端断开连接或用户中断时触发。你应该监听该信号以中止正在进行的请求。如果不监听，Pi 会在 3 秒后强制终止该工具。示例：

```typescript
command: async ({ input, abortSignal }) => {
  const response = await fetch(url, { signal: abortSignal });
  // ...
};
```

### 日志记录

`logger` 对象可用于输出日志。它包含 `debug`、`info`、`warn` 和 `error` 方法。Pi 会捕获日志，并在会话终止时输出这些日志。示例：

```typescript
command: async ({ input, logger }) => {
  logger.debug("正在执行工具命令...");
  // ...
  return result;
};
```

### 自定义模型与提供商

`tools` 中的 `command` 字段可以包含一个 `provider` 字段，用于指定在工具内部使用哪个提供商/模型。如果你不指定，则会使用当前的提供商。如果没有设置提供商，Pi 会默认使用 `default` 提供商。你可以使用 `overrides` 来暂时覆盖当前设置。

### 流式传输

如果你的工具是流式传输内容，你可以直接返回一个 `ReadableStream`。Pi 会将这个流的内容直接发送给模型。

### 工具钩子

Pi 目前支持工具钩子，例如 `toolCall`、`toolExec` 等。你可以订阅这些事件来拦截或修改工具的执行流程。

## 上下文提供器

上下文提供器允许你用额外的数据来丰富会话上下文。你可以通过定义 `contextProviders` 字段来注册上下文提供器。

`contextProviders` 字段接受一个 `PiContextProvider[]` 数组。每个提供器由以下字段定义：

- **`name`**：上下文提供器的名称。这会成为一个标记，用于在提示词中注入上下文。
- **`description`**：上下文提供器功能的描述。
- **`plugin`**：上下文提供器的实现。它应当是一个接受 `PiContextProviderPlugin` 参数的函数，返回一个 `PiContextProviderPlugin` 对象。该对象可以包含一个 `getContext` 函数，用于返回上下文数据。

### 上下文提供器示例

```typescript
registerExtension({
  extName: "myExtension",
  contextProviders: [
    {
      name: "timeProvider",
      description: "提供当前时间。",
      plugin: async (context) => {
        return {
          getContext: async () => {
            return { currentTime: new Date().toISOString() };
          },
        };
      },
    },
  ],
});
```

当上下文提供器被注册后，你可以通过在提示词中包含 `@timeProvider` 来在提示词中使用它。这在编辑器集成中尤其有用，用户可以通过提到 `@timeProvider` 来在提示词中引入该上下文。

注意：上下文提供器会访问会话的当前上下文，其中可能包含正在编辑的文件等信息。这使得上下文提供器能够根据当前会话状态提供相关的上下文。

## 事件

Pi 事件总线允许你订阅 Pi 生命周期中发生的各种事件。你可以使用 `events` 字段来注册事件监听器。

`events` 字段接受一个对象，其中键是事件名称，值是对应的监听器函数。目前支持的事件包括：

| 事件名            | 描述                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `message`         | 当模型生成消息时触发。                                                 |
| `session`         | 当会话开始或结束时触发。                                               |
| `toolCall`        | 当模型请求调用工具时触发。                                             |
| `toolExec`        | 当工具被执行时触发。                                                   |
| `toolError`       | 当工具执行过程中发生错误时触发。                                       |
| `session_idle`    | 当会话进入空闲状态时触发。                                             |
| `session_shutdown`| 当会话终止时触发。                                                     |
| `user_input`      | 当用户输入内容时触发。                                                 |
| `prompt`          | 当生成提示词时触发。                                                   |
| `abort`           | 当请求被中止时触发。                                                   |
| `error`           | 当发生错误时触发。                                                     |

事件监听器函数接收一个事件对象。事件对象的结构因事件类型而异。你可以通过事件总线来监听这些事件，并在事件发生时执行自定义逻辑。

### 事件示例

```typescript
registerExtension({
  extName: "myExtension",
  events: {
    session_idle: async () => {
      console.log("会话空闲，正在等待用户输入...");
    },
    session_shutdown: async () => {
      console.log("会话已终止。");
    },
  },
});
```

这种事件机制使得扩展能够感知 Pi 的生命周期，并在适当的时机执行相应操作。

## 多扩展注册

你可以多次调用 `registerExtension` 来注册多个扩展。每个扩展可以有自己的工具、上下文提供器和事件监听器。然而，需要注意的是：如果两个扩展注册了同名的工具或上下文提供器，后注册的扩展会覆盖先注册的扩展。这可能会引发冲突，因此建议确保扩展的命名空间保持唯一。

### 自定义渲染

工具可以提供 `renderCall` 和 `renderResult` 来实现自定义 TUI 显示。完整的组件 API 请参阅 [tui.md](/docs/tui/)，工具行的组合方式请参阅 [tool-execution.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出会被包裹在一个处理内边距和背景的 `Box` 中。如果定义了 `renderCall` 或 `renderResult`，则必须返回一个 `Component`。如果某个槽位的渲染器未定义，`tool-execution.ts` 会对该槽位使用回退渲染。

当工具需要自行渲染其外壳而不是使用默认的 `Box` 时，设置 `renderShell: "self"`。这对于需要完全控制边框或背景行为的工具非常有用，例如在工具稳定后必须保持视觉稳定性的大型预览。

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "自定义外壳示例",
  parameters: Type.Object({}),
  renderShell: "self",
  async execute() {
    return { content: [{ type: "text", text: "ok" }], details: undefined };
  },
  renderCall(args, theme, context) {
    return new Text(theme.fg("accent", "my custom shell"), 0, 0);
  },
});
```

`renderCall` 和 `renderResult` 都会接收一个包含以下字段的 `context` 对象：
- `args` - 当前工具调用参数
- `state` - 跨 `renderCall` 和 `renderResult` 共享的行局部状态
- `lastComponent` - 该槽位先前返回的组件（如有）
- `invalidate()` - 请求重新渲染此工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 实现跨槽位的共享状态。当需要在多次渲染间复用并修改同一组件时，将槽位局部缓存保存在返回的组件实例上。

#### renderCall

渲染工具调用或标题：

```typescript
import { Text } from "@earendil-works/pi-tui";

renderCall(args, theme, context) {
  const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
  let content = theme.fg("toolTitle", theme.bold("my_tool "));
  content += theme.fg("muted", args.action);
  if (args.text) {
    content += " " + theme.fg("dim", `"${args.text}"`);
  }
  text.setText(content);
  return text;
}
```

#### renderResult

渲染工具结果或输出：

```typescript
renderResult(result, { expanded, isPartial }, theme, context) {
  if (isPartial) {
    return new Text(theme.fg("warning", "Processing..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `Error: ${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "✓ Done");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果某个插槽有意不显示可见内容，则返回一个空的 `Component`，例如空的 `Container`。

#### 键绑定提示

使用 `keyHint()` 来显示尊重当前键位配置的键位提示：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ Done");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "展开")})`;
  }
  return new Text(text, 0, 0);
}
```

可用函数：
- `keyHint(keybinding, description)` - 格式化一个已配置的键绑定 ID，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回一个键绑定 ID 的原始配置键文本
- `rawKeyHint(key, description)` - 格式化一个原始键字符串

使用命名空间化的键绑定 ID：
- 编程代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

完整的键绑定 ID 和默认值列表见 [keybindings.md](/docs/keybindings/)。`keybindings.json` 使用相同的命名空间化 ID。

自定义编辑器以及 `ctx.ui.custom()` 组件会将 `keybindings: KeybindingsManager` 作为注入参数接收。它们应直接使用该注入的管理器，而不是调用 `getKeybindings()` 或 `setKeybindings()`。

以下文档为关于 Pi 组件外壳与多槽渲染的指南，说明了组件如何嵌入外壳、展示槽位以及通过参数动态控制外观。此部分为中文翻译版本。

---

## 外壳与多槽渲染

此功能受支持。Pi 组件的默认外壳是一个可选的、带圆角的分组框，由工具外壳系统绘制。外壳是渲染在组件内容之外的，独立于单个工具槽位的渲染结果。外壳由容器（宽度、高度）决定尺寸，通常不依赖于内部内容。可以通过 `shell` 参数为每个工具槽位覆盖默认外壳。

在自定义组件中使用 `renderShell`、`renderResult` 和 `call`/`result` 槽位可以自定义外壳渲染。`renderShell` 会接收到外壳配置，并负责绘制分组框、其标签以及背景。`renderResult` 是默认结果槽位渲染器的替代方案。

若要微调尺寸行为，可在自定义组件中直接添加 `renderShell: "self"`（或其别名 `shell: "custom"`）。在自渲染模式下，外壳的尺寸由组件内容驱动，而不是固定为容器尺寸。这样可以在内容较大时自然扩展，但需要组件自己管理内边距和背景。

使用 `width: 220` 和 `shell: "self"` 的示例：

```
width: 220
shell: "self"

<Container>
  <Box>内容 A</Box>
</Container>
```

在自渲染模式下，Pi 不会强制外壳的尺寸限制，因此组件的布局可能会溢出。建议仅在容器尺寸受限时才使用此模式，例如在 `width` 或 `height` 已定义的情况下。

> 注意：自渲染模式会绕过默认外壳的尺寸计算，这意味着组件必须自行处理内边距和背景。若未显式设置，默认组件可能无法正确填充外壳区域。

`useTightSizing` 和 `useFitContent` 等动态尺寸工具会自然影响外壳的尺寸计算。详情请参阅尺寸工具指南。

**外壳如何适配？**

外壳的尺寸会考虑到 `width`、`height` 等显式设置，以及布局约束和内容大小。大多数情况下，Pi 会自动调整外壳以适配内容。

**标签如何工作？**

默认外壳会在组件顶部中心显示标签文本，并带有一个小背景块。标签文本是受支持的，但对于无边框主题（`theme: none`），外壳不会绘制标签。若要启用标签，可能需要使用带边框的主题。

---

这段文本的中文翻译保持了原有的技术风格和结构，术语翻译符合要求（如：外壳、组件、槽位、尺寸、布局等），并通过清晰的中文表述呈现了 Pi 组件外壳与渲染机制的相关信息。

#### 回退

如果槽位渲染器未定义或抛出错误：
- `renderCall`：显示工具名称
- `renderResult`：显示 `content` 中的原始文本

Pi 会检测工具结果的形状，并在下一个模型请求前应用更新后的活动工具集。具体来说，Pi 会记录加载器工具结果中新增工具的名称，并在必要时将更新的活动集应用到下一个模型请求之前。

这适用于所有模型。支持原生延迟加载的模型会保持稳定的提示词前缀，并在工具结果位置加载新的定义。其他模型则使用下面描述的回退方案。

生命周期如下：

1. 使用 `pi.registerTool()` 注册每个工具，使其出现在 `pi.getAllTools()` 中。
2. 保持加载器工具（如 `search_tools`）处于活动状态，而将可搜索工具保持为不活动状态。
3. 在加载器执行期间，调用 `pi.setActiveTools([...currentTools, ...matchingTools])`。该更改必须是累加的：不要在同一调用中移除当前活动的工具。
4. Pi 记录在加载器工具结果上新增了哪些工具。
5. 在下一个模型响应之前，Pi 会在支持原生延迟加载时暴露新增的定义，否则使用正常的活动工具列表。

你无需返回特定于提供商的工具引用，也无需将加载器标记为特殊搜索工具。活动工具集的更改即为信号。传递给 `pi.setActiveTools()` 的名称必须是已注册的；未知名称将被忽略。

#### 支持原生延迟加载的模型

- **Anthropic**
  - **模型**：Sonnet、Opus、Fable 4.5 或更高版本（不含 Haiku）
  - **原生表示**：延迟定义使用 `defer_loading`；加载点使用 `tool_reference` 内容。
- **Fireworks Messages API**
  - **原生表示**：延迟定义使用 `defer_loading`；加载点使用 `tool_reference` 内容。
  - **加载器名称**：使用 `ToolSearch` 或 `tool_search` 进行前缀延迟。其他加载器名称仍然有效，但 Fireworks 会将已加载的模式包含在初始工具前缀中，从而失去缓存优势。
  - 这不会改变 API 路由：Fireworks GLM 模型和 Kimi K3 使用 Chat Completions，而非 Messages。
- **OpenAI**
  - **模型**：`gpt-5.4` 及更新系列
  - **原生表示**：Pi 在加载点添加完整的客户端 `tool_search_call` 和 `tool_search_output` 项目。

对于已验证的自定义模型或代理，可通过设置 `compat.supportsToolReferences: true`（针对 `anthropic-messages`）或 `compat.supportsToolSearch: true`（针对 `openai-responses` 和 `openai-codex-responses`）来启用原生处理。除非端点和模型能够接受相应的原生协议，否则请保持禁用状态。

部分提供商支持延迟的 schema 加载。对于这些提供商，你可以设置 `cachePromptPrefix=false`（默认值）来提高缓存命中率。对于其他提供商，此属性将被忽略。

以下是您在一个支持缓存的提供商上启动带缓存功能的会话的示例：

```sh
pi --model "$MODEL" \
  --provider openai \
  --set-lazy \
  --cache-prompt-prefix \
  ...
```

如果你选择通过禁用提示词缓存来减少首令牌延迟（TTFT），只需向命令传递 `--no-cache-prompt-prefix` 参数。或者，在会话中使用 `Pi` 提示词命令 `/cache` 切换延迟加载。

> [!IMPORTANT] 延迟加载不适用于回退、备份或“默认”命令。

当工具的活跃集合不是纯粹追加时（例如，如果你用另一组工具替换当前集合），提示词前缀无法安全缓存，因此 Pi 会回退到立即加载：所有工具定义将一次性发送，工具调用无需额外往返即可执行。

我们将这种安全回退称为“立即加载”。立即加载始终有效，但如果前缀不可缓存，初始请求的大小与普通请求相同，因此没有性能或成本优势。

当活跃集合不是纯粹追加（例如用另一组工具替换当前组）时，Pi 也会采用这种安全回退。因此工具移除仍然有效，但不会使用延迟加载。

为了获得最佳缓存行为，请在整个会话中保持加载器工具活跃，并添加工具而不是替换活跃集合。另请注意，使用 `promptSnippet` 或 `promptGuidelines` 激活工具会重建系统提示词；即使提供商支持延迟的 schema，系统提示词的更改也可能使前缀失效。延迟加载的工具通常应依赖其工具 `description`，并省略仅适用于活跃状态的提示词元数据。

这段文字描述了一个技能示例，该技能实现了工具搜索与自动加载。它通过注册三个工具来演示：一个天气查询工具、一个问题搜索工具，以及一个名为 `search_tools` 的元工具。`search_tools` 会根据查询条件在所有已注册工具中（此处限定为可搜索的两个工具）进行匹配，然后自动激活匹配到的工具。该技能在会话启动时将可搜索工具设为初始非激活状态，并确保 `search_tools` 自身保持激活。

代码块内的注释需翻译为中文，其余保持不变。段落内容按规则翻译，注意术语对应的翻译。

翻译如下：

---

此技能演示了工具搜索和自动加载。它注册了两个可搜索的工具（`lookup_weather` 和 `search_issues`），以及一个名为 `search_tools` 的元工具。当任务需要当前未启用的能力时，`search_tools` 会根据查询条件在注册的工具中进行匹配，并将匹配到的工具自动加入活动工具列表。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SEARCHABLE_TOOL_NAMES = new Set(["lookup_weather", "search_issues"]);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "lookup_weather",
    label: "Lookup Weather",
    description: "Look up the current weather for a city",
    parameters: Type.Object({ city: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Weather for ${params.city}: sunny` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_issues",
    label: "Search Issues",
    description: "Search project issues by keyword",
    parameters: Type.Object({ query: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `No open issues matching ${params.query}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_tools",
    label: "Search Tools",
    description: "Search for and enable tools relevant to a task",
    promptSnippet: "Search for additional tools when the active tools cannot perform the task",
    promptGuidelines: [
      "Use search_tools when a task requires a capability that is not currently available.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Capability or task to search for" }),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
    }),
    async execute(_toolCallId, params) {
      const terms = params.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const matches = pi.getAllTools()
        .filter((tool) => SEARCHABLE_TOOL_NAMES.has(tool.name))
        .map((tool) => ({
          tool,
          score: terms.reduce(
            (score, term) =>
              score + (`${tool.name} ${tool.description}`.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, params.limit ?? 3)
        .map((match) => match.tool.name);

      if (matches.length === 0) {
        return {
          content: [{ type: "text", text: `No tools found for: ${params.query}` }],
          details: { matches: [] },
        };
      }

      const active = pi.getActiveTools();
      const added = matches.filter((name) => !active.includes(name));
      pi.setActiveTools([...new Set([...active, ...added])]);

      return {
        content: [{
          type: "text",
          text: added.length > 0
            ? `Loaded tools: ${added.join(", ")}`
            : `Matching tools already active: ${matches.join(", ")}`,
        }],
        details: { matches, added },
      };
    },
  });

  pi.on("session_start", () => {
    // 保持可搜索工具已注册但初始不激活。保留内置工具和其他扩展拥有的工具，并保持加载器本身处于激活状态。
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

当 `search_tools` 添加了一个匹配的工具时，模型会在紧接着的下一个请求中收到该工具的定义。在具有原生能力的模型上，该定义会锚定在搜索结果之后，而不改变初始的工具模式前缀。在其他模型上，它会在该后续请求中出现在常规工具列表中。

我需要先收到 pi 项目官方英文文档的源文内容，才能按照规则进行翻译并输出完整的简体中文 markdown 译文。请提供待翻译的文档内容。

`ctx.ui` 模块提供简单的界面原语。

### 确认对话框

```js
// 触发确认对话框
const ok = await ctx.ui.confirm("确认?", "此操作无法撤销");

// 文本输入
const name = await ctx.ui.input("名称:", "占位文本");

// 多行编辑器
const text = await ctx.ui.editor("编辑:", "预填充文本");

// 通知（非阻塞）
ctx.ui.notify("完成!", "信息");  // "信息" | "警告" | "错误"
```

## 对话框

你可以从外壳中的任何地方调用 `ctx.ui` 来弹出原生对话框。

### `select` 方法

`select` 方法会创建一个菜单，用户可以从中选择一个选项。如果用户取消对话框，则返回 `undefined`。

```typescript
const choice = await ctx.ui.select(
  "选择一个选项",
  ["选项 A", "选项 B", "选项 C"],
  "默认选择的选项"
);
// 返回值：选中的字符串索引，或 undefined
```

### `confirm` 方法

`confirm` 方法会创建一个确认对话框，用户可以选择确认或取消。如果用户确认则返回 `true`，取消则返回 `false`。

```typescript
const confirmed = await ctx.ui.confirm(
  "确认操作",
  "你确定要继续吗？",
  "确认",
  "取消"
);
// 返回值：布尔值
```

### `input` 方法

`input` 方法会创建一个输入对话框，用户可以在其中输入文本。如果用户取消对话框，则返回 `undefined`。

```typescript
const text = await ctx.ui.input(
  "输入文本",
  "请输入你的名字",
  "默认文本"
);
// 返回值：输入的字符串，或 undefined
```

### 对话框超时

`select`、`confirm` 和 `input` 方法都接受一个 `timeout` 选项，该选项以毫秒为单位指定对话框自动取消前的等待时间。

```typescript
const confirmed = await ctx.ui.confirm(
  "限时确认",
  "此对话框将在 5 秒后自动取消。确认吗？",
  { timeout: 5000 }
);

if (confirmed) {
  // 用户已确认
} else {
  // 用户已取消或超时
}
```

**超时时的返回值：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### 使用 AbortSignal 手动取消

若需更精细的控制（例如，区分超时与用户取消），可结合 `AbortSignal` 使用：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。是否确认？",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // 用户已确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按了 Escape 或选择了“否”）
}
```

完整示例请参见 [examples/extensions/timed-confirm.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/timed-confirm.ts)。

// 扩展 API

// 扩展上下文（省略了与外壳部分重合的字段）
export type ExtensionContext = {
  // 当前扩展的绝对路径
  extensionPath: string;
  // 扩展清单内容
  extension: ExtensionManifest;
  // 当前会话
  session: Session;
  // `ctx.ui` 访问外壳的用户界面（TUI）
  ui: ExtensionUI;
  // 添加交互式工具
  tool: (spec: ToolSpec) => Promise<Tool>;
  // 设置异步任务的状态
  setTask: (task: { title?: string; label?: string; state?: TaskState; progress?: number }) => void;
  // 提供纯文本
  provideText: (spec: { title?: string; prompt?: string }) => Promise<string | undefined>;
  // 获取最近一次使用的密钥列表
  listRecentKeys: (prefix?: string) => Promise<{ key: string; modified: number }[]>;
  // 为扩展持久化键值对
  setState: (key: string, value: unknown) => Promise<boolean>;
  getState: (key: string) => Promise<unknown>;
  deleteState: (key: string) => Promise<boolean>;
  // 按键值列出状态，返回键列表
  listState: () => Promise<string[]>;
  // 在会话中渲染 Markdown 内容
  renderMarkdown: (markdown: string) => void;
  // 访问当前命令的帮助信息（例如 `ctx.help("think")`）
  help: (selector?: string) => Promise<string | undefined>;
  // 执行 /editor 命令，指定模型和系统提示词
  runEditor: (args: string) => Promise<{ content: string; interrupted: boolean }>;
  // 切换内置 `/chat` 命令的自动确认模式
  toggleAutoAccept: () => Promise<void>;
  // 订阅事件
  on: (事件: "session" | "compacted" | "abort" | "tool" | "error" | "command" | "message" | "context" | "theme", 监听器: (数据: never) => void) => void;
  // 启动事件
  start: () => void;
  // 中止外壳会话（例如 Ctrl+C）
  abort: () => Promise<void>;
};

// 外壳界面

// 显示通知消息
ctx.ui.notify("消息", "info"); // 可选类型: "info" | "success" | "warning" | "error"

// 运行进度指示
ctx.ui.runProgress({ total: 10, message: "运行中..." });
ctx.ui.runProgress(undefined); // 结束

// 工作负载显示
ctx.ui.showLoad("正在加载...");
ctx.ui.hideLoad();

// 交互式工具（详见 tools.md）
ctx.ui.showTool(tool);
ctx.ui.hideTool(tool);
ctx.ui.focusTool(tool);
ctx.ui.blurTool(tool);
ctx.ui.setToolContent(tool, "新内容");
ctx.ui.getToolContent(tool); // => string
ctx.ui.setToolActive(tool, true);
ctx.ui.setToolProgress(tool, { total: 10, current: 3 });

// 文本光标位置
ctx.ui.getCursor(); // => 行号或“会话”
ctx.ui.showLine(行号);
ctx.ui.accentLine(行号);

// 文本选择（用于控制复制行为）
ctx.ui.getSelection(); // => string

// 设置/获取输入框文本
ctx.ui.setInput("预填文本");
ctx.ui.getInput(); // => string

// 输入框提示
ctx.ui.setInputPlaceholder("自定义提示");
// 等待用户按 Enter
const value = await ctx.ui.getInputPromise();

// 在输入框中输入文本
ctx.ui.setTextInput("文本输入");
ctx.ui.backspace(1); // 参数：删除字符数

// 按键绑定
// 可用键：escape, enter, tab, backspace, delete, arrowup, arrowdown, arrowleft, arrowright, home, end, pageup, pagedown, space, ctrl+o, ctrl+r, ctrl+t, ctrl+y, ctrl+i, ctrl+e, ctrl+l, ctrl+n, ctrl+p, ctrl+w, ctrl+u, ctrl+a, ctrl+d, ctrl+f, ctrl+b, ctrl+k, ctrl+j, ctrl+g, ctrl+z, ctrl+x, ctrl+c, ctrl+v
ctx.ui.keyBindings.unbind("ctrl+l");
ctx.ui.keyBindings.bind("ctrl+l", "用户自定义命令");
// 清除所有输入框按键绑定，以便在自定义编辑器中注册
ctx.ui.keyBindings.clear();

// 会话滚动
ctx.ui.scrollToTop();
ctx.ui.scrollToBottom();
ctx.ui.scrollPageUp();
ctx.ui.scrollPageDown();
ctx.ui.scrollLines(-5);
ctx.ui.scrollToLine(10);
ctx.ui.getScrollOffset(); // => 行号

在光标前检查文本；

- 当你的扩展特定语法匹配时，返回你自己的建议；
- 否则，委托给 `current.getSuggestions(...)`；
- 除非你需要自定义插入行为，否则委托 `applyCompletion(...)`。

```typescript
pi.on("session_start", (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    triggerCharacters: ["#"],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const beforeCursor = line.slice(0, cursorCol);
      const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
      if (!match) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: `#${match[1] ?? ""}`,
        items: [
          { value: "#2983", label: "#2983", description: "扩展API，用于注册自定义 @ 自动补全提供器" },
          { value: "#2753", label: "#2753", description: "重新加载过时的资源设置" },
        ],
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  }));
});
```

完整示例参见 [github-issue-autocomplete.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/github-issue-autocomplete.ts)，该示例预加载了最新的 GitHub 开放问题（使用 `gh issue list`），并在本地进行过滤以实现快速的 `#...` 补全。它需要 GitHub CLI（`gh`）以及一个 GitHub 仓库的检出。

### 自定义组件

对于复杂的界面，请使用 `ctx.ui.custom()`。该方法会临时用您的组件替换编辑器，直到调用 `done()` 为止：

```typescript
import { Text, Component } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("按回车确认，按 Esc 取消", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // 用户按了回车键
}
```

回调函数接收以下参数：
- `tui` - TUI 实例（用于获取屏幕尺寸、焦点管理）
- `theme` - 当前主题，用于样式设置
- `keybindings` - 应用程序按键绑定管理器（用于检查快捷键）
- `done(value)` - 调用以关闭组件并返回值

完整的组件 API 请参阅 [tui.md](/docs/tui/)。

#### 覆盖模式（实验性）

传递 `{ overlay: true }` 将组件渲染为浮动模态，覆盖在现有内容之上，而不清除屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

对于高级定位（锚点、边距、百分比、响应式可见性），请传递 `overlayOptions`。使用 `onHandle` 以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // 聚焦此覆盖层并将其置于视觉前端
      // handle.unfocus({ target: editorComponent }); // 将输入释放到特定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    }
  }
);
```

聚焦的可见覆盖层可以在临时非覆盖自定义 UI 关闭后重新获取输入。如果你有意让另一个组件在覆盖层保持可见时继续持有输入，请调用 `handle.unfocus({ target })`。传递 `{ target: null }` 会释放覆盖层而不聚焦其他组件。

有关完整的 `OverlayOptions` 和 `OverlayHandle` API，请参阅 [tui.md](/docs/tui/)，示例请参见 [overlay-qa-tests.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。

### 自定义编辑器

将主输入编辑器替换为自定义实现（vim 模式、emacs 模式等）：

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";

  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);  // 应用按键绑定 + 文本编辑
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimEditor(tui, theme, keybindings)
    );
  });
}
```

**要点：**
- 继承 `CustomEditor`（而非基础 `Editor`）以获取应用按键绑定（escape 中止、ctrl+d、模型切换）
- 对于你未处理的按键，调用 `super.handleInput(data)`
- 自定义编辑器默认保留独立的操作行。若需改用内置的编辑器边框加载指示器，可将 `{ embedWorkingStatus: true }` 作为 `CustomEditor` 构造函数的第四个参数传入。
- 工厂函数从应用接收 `tui`、`theme` 和 `keybindings`
- 在 `setEditorComponent()` 前使用 `ctx.ui.getEditorComponent()` 来包装先前配置的自定义编辑器
- 传入 `undefined` 以恢复默认：`ctx.ui.setEditorComponent(undefined)`

若需与已替换编辑器的其他扩展组合使用，可在设置你的编辑器之前捕获先前的工厂函数：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

完整的带模式指示器示例见 [tui.md](/docs/tui/) 模式 7。

### 消息与条目渲染

使用你的 `customType` 为消息注册自定义渲染器。对于需要参与 LLM 上下文的内容，请使用消息渲染器：

```typescript
import { Text } from "@earendil-works/pi-tui";

pi.registerMessageRenderer("my-extension", (message, options, theme) => {
  const { expanded, outputPad } = options;
  let text = theme.fg("accent", `[${message.customType}] `);
  text += message.content;

  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
  }

  return new Text(text, outputPad, 0);
});
```

消息通过 `pi.sendMessage()` 发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // 与 registerMessageRenderer 匹配
  content: "Status update",
  display: true,               // 在 TUI 中显示
  details: { ... },            // 在渲染器中可用
});
```

对于仅用于 TUI 显示、不应发送给 LLM 的内容，请改为渲染自定义条目：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### 主题颜色

所有渲染函数都会接收一个 `theme` 对象。参见 [themes.md](/docs/themes/) 了解如何创建自定义主题及完整的调色板。

```typescript
// 前景色
theme.fg("toolTitle", text)   // 工具名称
theme.fg("accent", text)      // 高亮
theme.fg("success", text)     // 成功（绿色）
theme.fg("error", text)       // 错误（红色）
theme.fg("warning", text)     // 警告（黄色）
theme.fg("muted", text)       // 次要文本
theme.fg("dim", text)         // 三级文本

// 文本样式
theme.bold(text)
theme.italic(text)
theme.strikethrough(text)
```

自定义工具渲染器中的语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";

// 使用显式语言高亮代码
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// 根据文件路径自动检测语言
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## 错误处理

- 扩展错误会被记录到日志，代理会话继续执行
- `tool` 调用错误会通过抛出异常来标识；捕获到的异常会以 `isError: true` 标记报告给大语言模型，执行流程继续
- 回退策略：如果工具调用因 5xx 错误或速率限制失败，外壳会使用 `invoke` 工具捕获异常，并自动重试该调用，直到成功为止，然后向模型返回正常结果
- 在某些提供商中，如果未绑定 `invoke` 工具，则会在会话中保留可操作的消息，并在错误位置显式暂停代理，以便用户手动介入处理

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 说明 |
|------|------------|-------------|-------|
| Interactive | `"tui"` | `true` | 完整 TUI，终端渲染 |
| RPC（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议提供对话框和通知；`custom()` 返回 `undefined`。参见 [rpc.md](/docs/rpc/) |
| JSON（`--mode json`） | `"json"` | `false` | 事件流输出至 stdout；UI 方法为无操作 |
| Print（`-p`） | `"print"` | `false` | 扩展运行但不支持提示 |

在使用 TUI 专属功能（`custom()`、组件工厂、终端输入）之前，请使用 `ctx.mode === "tui"`。在 TUI 和 RPC 模式下均生效的对话框及通知方法之前，请使用 `ctx.hasUI`。

## 示例参考

所有示例位于 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/) 目录。

| 示例 | 描述 | 关键 API |
|---------|-------------|----------|
| **工具** |||
| `hello.ts` | 最小工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`, 会话事件 |
| `dynamic-tools.ts` | 启动后及命令执行期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 带 `terminate: true` 的最终结构化输出工具 | `registerTool`, 终止工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置读取工具 | `registerTool`（与内置同名） |
| **命令** |||
| `pirate.ts` | 逐轮修改系统提示词 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨提供商模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 自定义 UI 的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重载命令和 LLM 工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件与门控** |||
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 从用户/全局或 CLI 扩展决定或延迟项目信任 | `on("project_trust")`, 信任 UI, 必需信任结果 |
| `protected-paths.ts` | 阻止对特定路径的写入 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话变更 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 对脏 git 仓库发出警告 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 支持流式的输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型变更 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查负载和提供商响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示词信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知的工具引导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监视器触发消息 | `sendMessage` |
| **压缩与会话** |||
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | 每轮 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 拉取、合并并解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时自动提交 | `on("session_shutdown")`, `exec` |
| **UI 组件** |||
| `status-line.ts` | 底部状态指示器 | `setStatus`, 会话事件 |
| `working-indicator.ts` | 自定义流式工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 通过预加载 `gh issue list` 中的最近打开问题，在内置自动补全之上添加 `#1234` 问题补全 | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换底部栏 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动时头部 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | 覆盖层组件 | `ui.custom` 带覆盖层选项 |
| `overlay-qa-tests.ts` | 综合覆盖层测试 | `ui.custom`, 所有覆盖层选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | `ui.confirm` 带超时/信号 |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`, `exec` |
| **复杂扩展** |||
| `plan-mode/` | 完整计划模式实现 | 所有事件类型, `registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | 可保存预设（模型、工具、思考） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | 工具开关 UI | `registerCommand`, `setActiveTools`, `SettingsList`, 会话事件 |
| **远程与沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`, 工具操作 |
| `interactive-shell.ts` | 持久 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `gondolin/` | 将内置工具和 `!` 命令路由到 Gondolin 微虚拟机 | 工具操作, 内置工具覆盖, `on("user_bash")` |
| `subagent/` | 生成子代理 | `registerTool`, `exec` |
| **游戏** |||
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`, `ui.custom`, 键盘处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`, `ui.custom` |
| `doom-overlay/` | 覆盖层中的 Doom | `ui.custom` 带覆盖层 |
| **提供商** |||
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | `registerProvider` 带 OAuth |
| **消息与通信** |||
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`, `sendMessage` |
| `entry-renderer.ts` | 仅 TUI 的自定义条目渲染 | `registerEntryRenderer`, `appendEntry` |
| `event-bus.ts` | 扩展间事件 | `pi.events` |
| **会话元数据** |||
| `session-name.ts` | 为选择器命名会话 | `setSessionName`, `getSessionName` |
| `bookmark.ts` | 为 `/tree` 书签条目 | `setLabel` |
| **其他** |||
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 在执行前调整 bash 命令、工作目录和环境变量 | `createBashTool`, `spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 带 `package.json` 的软件包结构 |
