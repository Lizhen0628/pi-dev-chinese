> pi 可以创建扩展。请让它为你的使用场景构建一个。

# 扩展

扩展是用于扩展 pi 行为的 TypeScript 模块。它们可以订阅生命周期事件、注册可供 LLM 调用的自定义工具、添加命令等。

> **关于 /reload 的放置说明：** 将扩展放置在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）中以实现自动发现。仅在快速测试时使用 `pi -e ./path.ts`。位于自动发现位置的扩展可通过 `/reload` 进行热重载。

**关键能力：**
- **自定义工具** —— 通过 `pi.registerTool()` 注册可供 LLM 调用的工具
- **事件拦截** —— 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** —— 通过 `ctx.ui` 向用户提示（选择、确认、输入、通知）
- **自定义 UI 组件** —— 通过 `ctx.ui.custom()` 实现支持键盘输入的完整 TUI 组件，用于复杂交互
- **自定义命令** —— 通过 `pi.registerCommand()` 注册类似 `/mycommand` 的命令
- **会话持久化** —— 通过 `pi.appendEntry()` 存储在重启后仍然保留的状态
- **自定义渲染** —— 控制工具调用/结果及消息在 TUI 中的显示方式

**示例使用场景：**
- 权限门控（在 `rm -rf`、`sudo` 等操作前进行确认）
- Git 检查点（每轮暂存，在分支上恢复）
- 路径保护（阻止对 `.env`、`node_modules/` 的写入）
- 自定义压缩（以你的方式总结对话）
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
  - [扩展样式](#extension-styles)
- [事件](#events)
  - [生命周期概览](#lifecycle-overview)
  - [资源事件](#resource-events)
  - [会话事件](#session-events)
  - [代理事件](#agent-events)
  - [模型事件](#model-events)
  - [工具事件](#tool-events)
- [扩展上下文](#extensioncontext)
- [扩展命令上下文](#extensioncommandcontext)
- [扩展API方法](#extensionapi-methods)
- [状态管理](#state-management)
- [自定义工具](#custom-tools)
  - [动态工具加载](#dynamic-tool-loading)
- [自定义UI](#custom-ui)
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
      const ok = await ctx.ui.confirm("危险操作！", "允许执行 rm -rf 吗？");
      if (!ok) return { block: true, reason: "已被用户阻止" };
    }
  });

  // 注册自定义工具
  pi.registerTool({
    name: "greet",
    label: "问候",
    description: "按名称问候某人",
    parameters: Type.Object({
      name: Type.String({ description: "要问候的名称" }),
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
    description: "打个招呼",
    handler: async (args, ctx) => {
      ctx.ui.notify(`你好，${args || "世界"}！`, "info");
    },
  });
}
```

使用 `--extension`（或 `-e`）标志进行测试：

```bash
pi -e ./my-extension.ts
```

## 扩展位置

> **安全警告：** 扩展将拥有完整的系统权限，可以执行任意代码。请仅安装来源可信的扩展。

扩展会从受信任的位置自动发现。项目本地的 `.pi/extensions` 条目仅在项目被信任后才会加载。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

通过 `settings.json` 配置的附加路径：

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

如需通过 npm 或 git 以 pi 软件包的形式共享扩展，请参阅 [packages.md](/docs/packages/)。

## 可用导入

| 软件包 | 用途 |
|---------|---------|
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | 工具参数的架构定义 |
| `@earendil-works/pi-ai` | AI 实用工具（用于 Google 兼容枚举的 `StringEnum`） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖同样可用。在扩展所在目录（或其父目录）中放置 `package.json`，运行 `npm install`，即可自动解析 `node_modules/` 中的导入。

对于通过 `pi install`（npm 或 git）安装的分布式 pi 软件包，运行时依赖必须放在 `dependencies` 中。软件包安装默认使用生产安装（`npm install --omit=dev`），因此 `devDependencies` 在运行时不可用；当配置了 `npmCommand` 时，git 软件包使用普通 `install` 以兼容包装器。

Node.js 内置模块（`node:fs`、`node:path` 等）同样可用。

## 编写扩展

扩展导出默认工厂函数，该函数接收 `ExtensionAPI`。工厂函数可以是同步或异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui 用于用户交互
    const ok = await ctx.ui.confirm("标题", "你确定吗？");
    ctx.ui.notify("完成！", "info");
    ctx.ui.setStatus("my-ext", "处理中...");  // 底部状态栏
    ctx.ui.setWidget("my-ext", ["第 1 行", "第 2 行"]);  // 编辑器上方的组件（默认位置）
  });

  // 注册工具、命令、快捷键、标志
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可运行。

如果工厂函数返回 `Promise`，pi 会在继续启动前等待其完成。这意味着异步初始化会在 `session_start`、`resources_discover` 之前完成，并且通过 `pi.registerProvider()` 排队注册的提供商也会在处理前完成刷新。

### 异步工厂函数

使用异步工厂函数来处理一次性启动工作，例如获取远程配置或动态发现可用模型。

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

此模式可在正常启动期间以及执行 `pi --list-models` 时，使获取到的模型信息可用。

### 长期资源与关闭

扩展工厂可能在从未启动会话的调用中运行。请勿从工厂启动后台资源，例如进程、套接字、文件监视器或定时器。

将后台资源的启动延迟到 `session_start` 或需要该资源的命令/工具/事件触发时。注册一个幂等的 `session_shutdown` 处理器，以关闭你启动的所有会话范围内的资源。

### 扩展样式

**单文件** - 适用于最简单的扩展：

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
    ├── package.json    # 声明依赖关系和入口点
    ├── package-lock.json
    ├── node_modules/   # npm install 之后生成
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

在扩展目录中运行 `npm install`，即可自动从 `node_modules/` 中进行导入。

"@lizx Laurenk"}","","@la?":""}',':[]}">","@

### 生命周期

```
pi 启动
  │
  ├─► project_trust（仅限用户/全局和 CLI 扩展，在项目资源加载之前）
  ├─► session_start { 原因："startup" }
  └─► resources_discover { 原因："startup" }
      │
      ▼
用户发送提示 ─────────────────────────────────────────┐
  │                                                        │
  ├─► （扩展命令优先检查，若发现则绕过后续步骤）        │
  ├─► input（可拦截、转换或处理）                        │
  ├─► （若未处理则进行技能/提示词模板扩展）              │
  ├─► before_agent_start（可注入消息、修改系统提示词）    │
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── 回合（当 LLM 调用工具时重复）───┐              │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context（可修改消息）                   │       │
  │   ├─► before_provider_headers（可修改请求头）          │
  │   ├─► before_provider_request（可检查或替换载荷）      │
  │   ├─► after_provider_response（状态 + 请求头，在流消费之前）│
  │   │                                            │       │
  │   │   LLM 响应，可能调用工具：                 │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call（可阻止）                │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result（可修改）              │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled（无剩余重试/压缩/追问）               │
                                                           │
用户发送另一条提示 ◄────────────────────────────────┘

/new（新会话）或 /resume（切换会话）
  ├─► session_before_switch（可取消）
  ├─► session_shutdown
  ├─► session_start { 原因："new" | "resume", previousSessionFile? }
  └─► resources_discover { 原因："startup" }

/fork 或 /clone
  ├─► session_before_fork（可取消）
  ├─► session_shutdown
  ├─► session_start { 原因："fork", previousSessionFile }
  └─► resources_discover { 原因："startup" }

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
  ├─► thinking_level_select（若模型更改改变/钳制思考级别）
  └─► model_select

思考级别更改（设置、按键绑定、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C、Ctrl+D、SIGHUP、SIGTERM）
  └─► session_shutdown
```

【 "技术细节待你的回复原文标题为"":[]，"","个"","个"","为"',''等格式符。","为"：""等等。","等。","等。" "等。","等。" "等。" "等。但","等。" "," "。","等。" ","。","等。","。"。","。"。"。

","等。"。","等。"。","等。"."。","。"。","。"。","。","。","。"。","。"。",""。"

## 技术细节

请将以上内容翻译为简体中文，仅输出译文即可。要求：
- 保持 Markdown 结构
- 代码块、命令、字段名、路径、URL 原样保留
- 术语严格遵循：harness→外壳；extension→扩展；skill→技能；prompt template→提示词模板；theme→主题；package→软件包；session→会话；compaction→压缩；steering→引导；follow-up→追问；provider→提供商；model→模型；tool→工具；command→命令
- 链接文字翻译，URL 和锚点保持不变
- 只输出译文，不要任何解释或前言，不要用代码围栏包裹全文

#### project_trust

在 pi 决定是否信任具有动态配置（`.pi` 或 `.agents/skills`）的项目时触发。它在启动时以及当会话替换（例如 `/resume`）进入当前进程中尚未解析信任状态的工作目录时运行。仅用户/全局扩展和 CLI `-e` 扩展参与；项目本地扩展在信任解析之前不会被加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 具有有限的信任上下文：cwd、mode、hasUI，以及 select/confirm/input/notify UI 辅助函数
  if (await ctx.ui.confirm("信任此项目？", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局或 CLI 扩展拥有决定权；第一个 yes/no 决定胜出，并抑制内置的信任提示。使用 `remember: true` 持久化 yes/no 决定；否则该决定仅适用于当前进程。返回 `"undecided"` 让后续处理器或内置信任流程来决定。在提示前检查 `ctx.hasUI`。如果没有处理器返回 yes/no，则继续正常的信任解析流程：首先应用已保存的 `trust.json` 决定，然后 `defaultProjectTrust` 控制 pi 默认是询问、信任还是拒绝。

### 资源事件</think>### 资源事件

#### resources_discover

在 `session_start` 之后触发，便于扩展贡献额外的技能、提示词和主题路径。
启动路径使用 `reason: "startup"`。重载使用 `reason: "reload"`。

```typescript
pi.on("resources_discover", async (event, _ctx) => {
  // event.cwd - 当前工作目录
  // event.reason - "startup" | "reload"
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

### 会话事件

参见 [会话格式](/docs/session-format/) 了解会话存储内部和 SessionManager API。

#### session_start

会话启动、加载或重载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup"（启动）| "reload"（重载）| "new"（新建）| "resume"（恢复）| "fork"（分叉）
  // event.previousSessionFile - 在“新建”、“恢复”和“分叉”时存在
  ctx.ui.notify(`会话：${ctx.sessionManager.getSessionFile() ?? "临时会话"}`, "info");
});
```

#### session_info_changed

当通过 `/name`、RPC 或 `pi.setSessionName()` 设置当前会话显示名称时触发。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - 当前规范化名称，若已清除则为 undefined
  ctx.ui.notify(`会话已重命名：${event.name ?? "(无)"}`, "info");
});
```

#### session_before_switch

在启动新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 我们正在切换到的会话文件（仅适用于 "resume"）

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("清空？", "删除所有消息？");
    if (!ok) return { cancel: true };
  }
});
```

成功切换或新建会话后，pi 会为旧的扩展实例触发 `session_shutdown`，为新会话重新加载并重绑扩展，随后以 `reason: "new" | "resume"` 和 `previousSessionFile` 触发 `session_start`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重建任何内存状态。

#### session_before_fork

在通过 `/fork` 分叉或通过 `/clone` 克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - 所选条目的ID
  // event.position - "before" 用于 /fork，"at" 用于 /clone
  return { cancel: true }; // 取消分叉/克隆
  // 或者
  return { skipConversationRestore: true }; // 保留用于未来的会话恢复控制
});
```

在成功分叉或克隆后，pi 为旧的扩展实例发出 `session_shutdown`，为新会话加载并重新绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_compact / session_compact / session_compact_failed

在压缩时触发。详见 [compaction.md](/docs/compaction/)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual"（/compact 手动触发）、"threshold"（阈值触发）或 "overflow"（溢出触发）
  // willRetry - 中断的回合是否在压缩后重试（溢出恢复）

  // 取消压缩：
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
  // event.compactionEntry - 保存的压缩内容
  // event.fromExtension - 是否由扩展提供
  // event.reason - "manual"（手动触发）、"threshold"（阈值触发）或 "overflow"（溢出触发）
  // event.willRetry - 中断的回合是否在压缩后重试（溢出恢复）
});

pi.on("session_compact_failed", async (event, ctx) => {
  // event.reason - "manual"（手动触发）、"threshold"（阈值触发）或 "overflow"（溢出触发）
  // event.errorMessage - 非中断失败时存在
  // event.aborted - 已取消/中断的压缩为 true
  // event.willRetry - 中断的回合是否会在压缩后重试
  // event.fromExtension - 是否正在使用扩展提供的压缩内容
});
```

#### session_before_tree / session_tree

在 `/tree` 导航时触发。参见 [会话](/docs/sessions/) 了解树导航概念。

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

#### 会话关闭

在已启动的会话运行时被拆除之前触发。利用此事件来清理由 `session_start` 或其他会话级挂钩打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - 会话替换流程的目标会话文件
  // 清理资源、保存状态等。
});
```

### 智能体事件

#### before_agent_start

在用户提交提示词后、代理循环开始前触发。可以注入消息和/或修改系统提示词。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - 用户的提示词文本
  // event.images - 附加的图片（如有）
  // event.systemPrompt - 当前处理器的链式系统提示词
  //   （包含先前 before_agent_start 处理器所做的更改）
  // event.systemPromptOptions - 用于构建系统提示词的结构化选项
  //   .customPrompt - 来自 --system-prompt、SYSTEM.md 或自定义模板的精确提示词前缀
  //   .forceSystemPrompt - 可选的完整提示词精确替换
  //   .selectedTools - 提示词中当前启用的工具
  //   .toolSnippets - 每个工具的单行描述
  //   .toolGuidelines - 按工具名称组织的指南条目
  //   .promptGuidelines - 额外的自定义指南条目
  //   .sections - 按标签名称组织的自定义 XML 包裹部分
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件及其他加载的上下文文件
  //   .skills - 已加载的技能

  return {
    // 注入持久消息（存储在会话中，发送给 LLM）
    message: {
      customType: "my-extension",
      content: "为 LLM 提供的额外上下文",
      display: true,
    },
    // 替换本轮的系统提示词（跨扩展链式传递）
    systemPrompt: event.systemPrompt + "\n\n本轮额外指令...",
  };
});
```

`systemPromptOptions` 字段使扩展能够访问 Pi 构建系统提示词所用的相同结构化数据。集合是可变的。建议修改 `sections`、`selectedTools` 或 `promptGuidelines`：Pi 会将生成的提示词部分与模型已有的内容进行比对，并追加仅修补变更部分的系统消息。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换本次运行的完整提示词：每个提供商都会将强制文本作为其主导系统提示词接收（变更时会产生缓存未命中），而会话记录仍会持续记录结构化部分。工具选择变更会同时更新提示词贡献和可执行的提供商工具；在处理程序内调用 `pi.setActiveTools()` 与编辑 `selectedTools` 效果相同。支持对话中途接收系统消息的模型会就地接收修补并保留其缓存前缀；其他模型则将重放的提示词作为其系统提示词，每次变更都会产生一次缓存未命中。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理器的链式系统提示词。后续的 `before_agent_start` 处理器仍可再次修改它。

#### agent_start / agent_end / agent_settled

`agent_start` 在低级运行开始时触发。`agent_end` 在该运行结束时触发。`agent_settled` 在运行结束后触发，此时 Pi 不再自动继续运行（即不会自动重试、自动压缩后重试，或继续排队中的追问消息）。对于需要知道 Pi 不会继续自动运行的状态集成，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - 本次低级运行的 messages
});

pi.on("agent_settled", async (_event, ctx) => {
  // 除非另一个扩展启动了新的运行，否则这里的 ctx.isIdle() 为 true
});
```

#### ui_prompt_start / ui_prompt_end

针对阻塞用户界面的扩展提示的仅供通知的生命周期事件。它们围绕 `ctx.ui.select()`、`ctx.ui.confirm()`、`ctx.ui.input()`、`ctx.ui.editor()` 以及 `ctx.ui.custom()` 触发，使得主机/状态集成能够报告“等待用户输入”，而不仅仅是“正在运行”。

嵌套或重叠的提示会被合并为一个外层等待区间。处理器会尽力调用，在显示或关闭提示之前不会等待其执行完毕。

```typescript
pi.on("ui_prompt_start", async (event, ctx) => {
  // event.reason === "ui_prompt"
  // event.kind: "select" | "confirm" | "input" | "editor" | "custom"
  // event.title: 当有可用标题时的提示标题
});

pi.on("ui_prompt_end", async (event, ctx) => {
  // Pi 不再等待该 UI 提示区间。
});
```

#### turn_start / turn_end

```typescript
pi.on("turn_start", async (event, ctx) => {
  // 事件轮次索引、时间戳
});

pi.on("turn_end", async (event, ctx) => {
  // 事件轮次索引、消息、工具结果
});
```

#### message_start / message_update / message_end

消息生命周期事件。

- `message_start` 在用户、助手或工具消息开始时触发。
- `message_update` 在助手消息流式更新时触发。
- `message_end` 处理器可返回 `{ message }` 以替换最终消息。替换内容必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // 事件消息
});

pi.on("message_update", async (event, ctx) => {
  // 事件消息
  // 事件中的助手消息事件（逐 token 流式事件）
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

在平行工具模式下：
- 在预检阶段，`tool_execution_start` 按照助手源顺序发出
- `tool_execution_update` 事件可能在不同工具之间交替出现
- `tool_execution_end` 在每个工具完成定稿后，按照工具完成顺序发出
- 最终 `toolResult` 消息事件仍会按照助手源顺序稍后发出

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

在每次调用 LLM 之前触发。该事件用于以非破坏性方式修改消息。有关消息类型，请参阅[会话格式](/docs/session-format/)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - 深拷贝，可安全修改
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_headers

在组装出站 HTTP 请求头之前触发。用于添加、覆盖或移除请求头。

处理器会原地修改 `event.headers`。将键设置为字符串以添加或覆盖，设置为 `null` 以删除。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // 添加或覆盖——例如用于网关追踪/归因的会话ID
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // 删除 pi 为此调用添加的跟踪请求头
  event.headers["X-OpenRouter-Title"] = null;
});
```

每个提供商请求运行一次；重试会复用相同的请求头，而不是重新触发钩子。

#### before_provider_request

在提供商特定负载构建完成后、请求发送之前触发。处理器按照扩展加载顺序执行。返回 `undefined` 保持负载不变；返回其他任何值将替换负载，供后续处理器及实际请求使用。

该钩子可重写提供商级别的系统指令或将其完全移除。这些负载级别的更改不会反映在 `ctx.getSystemPrompt()` 中，该方法报告的是 Pi 的系统提示词字符串，而非最终序列化的提供商负载。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // 可选：替换负载
  // return { ...event.payload, temperature: 0 };
});
```

这主要用于调试提供商序列化及缓存行为。

## 提供商响应后

在 HTTP 响应流式接收完毕后触发。扩展按加载顺序执行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP 状态码
  // event.headers - 规范化后的响应头
  if (event.status === 429) {
    console.log("请求频率受限", event.headers["retry-after"]);
  }
});
```

响应头的可用性取决于提供商与传输方式。抽象了 HTTP 响应的提供商可能不暴露响应头。

### 模型事件

#### model_select

当通过 `/model` 命令、模型循环（`Ctrl+P`）或会话恢复更改模型时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model —— 新选定的模型
  // event.previousModel —— 之前的模型（首次选择时为 undefined）
  // event.source —— "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`模型已更改（${event.source}）：${prev} -> ${next}`, "info");
});
```

使用此事件可在活动模型更改时更新 UI 元素（状态栏、页脚）或执行特定于模型的初始化操作。

#### thinking_level_select

当思考级别发生改变时触发。此事件仅用于通知；处理函数的返回值将被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - 新选择的思考级别
  // event.previousLevel - 之前的思考级别

  ctx.ui.setStatus("thinking", `当前思考级别: ${event.level}`);
});
```

当`pi.setThinkingLevel()`、模型变化或内置思考级别控件更改当前思考级别时，使用此事件更新扩展的用户界面。

# 工具事件

工具事件由工具在运行期间生成。工具事件旨在帮助扩展和外壳理解工具操作的生命周期，从而提供更完善的用户体验。

工具事件如下：

- `tool_init`：工具首次初始化时触发。
- `tool_call`：工具开始执行时触发。
- `tool_complete`：工具成功完成执行时触发。事件中包含工具的输出。
- `tool_error`：工具执行失败时触发。事件中包含错误信息。

#### tool_call

在 `tool_execution_start` 之后触发，于工具执行之前。**可阻塞。** 使用 `isToolCallEventType` 缩小类型范围并获得类型化输入。

在 `tool_call` 运行之前，pi 会等待之前发出的 Agent 事件通过 `AgentSession` 完成排空。这意味着 `ctx.sessionManager` 已更新至当前助手工具调用消息。

在默认的并行工具执行模式下，来自同一助手消息的同级工具调用会先顺序预检，再并发执行。`tool_call` 不保证在同一助手消息的 `ctx.sessionManager` 中看到同级工具结果。

`event.input` 是可变的。可原地修改它以在执行前修补工具参数。

行为保证：
- 对 `event.input` 的修改会影响实际工具执行
- 后续的 `tool_call` 处理器可以看到较早处理器所做的修改
- 修改后不进行重新验证
- 来自 `tool_call` 的返回值通过 `{ block: true, reason?: string, terminate?: boolean }` 控制阻塞
- `terminate` 仅适用于被阻塞的调用；仅当批处理中每个最终结果都终止时，代理才会提前停止

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash"、"read"、"write"、"edit" 等。
  // event.toolCallId
  // event.input - 工具参数（可变）

  // 内置工具：无需类型参数
  if (isToolCallEventType("bash", event)) {
    // event.input 是 { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "危险命令", terminate: true };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input 是 { path: string; offset?: number; limit?: number }
    console.log(`正在读取: ${event.input.path}`);
  }
});
```

#### 为自定义工具输入添加类型

自定义工具应该导出它们的输入类型：

```typescript
// my-extension.ts
export type MyToolInput = Static<typeof myToolSchema>;
```

使用带有显式类型参数的 `isToolCallEventType`：

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

在工具执行完成后触发，并且在 `tool_execution_end` 和最终的 tool result 消息事件发出之前。**可以修改结果。**

在并行工具模式下，`tool_result` 和 `tool_execution_end` 可能按工具完成顺序交错，而最终的 `toolResult` 消息事件仍然按助手源代码顺序稍后发出。

`tool_result` 处理器像中间件一样链式执行：
- 处理器按扩展加载顺序运行
- 每个处理器在前一个处理器修改后看到最新结果
- 处理器可以返回部分补丁（`content`、`details`、`isError` 或 `usage`）；未提供的字段保持其当前值

在处理程序内部使用 `ctx.signal` 进行嵌套异步工作。这允许 Esc 取消模型调用、`fetch()` 以及由扩展启动的其他支持中止的操作。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details is typed as BashToolDetails
  }

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  // Modify result:
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
  // event.excludeFromContext - 若为 ! 前缀则为 true
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

  // 选项 3：完全替换——直接返回结果
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

返回 `undefined` 则继续传递给下一个处理器；若无处理器处理该事件，则执行本地命令。有效的返回值会终止传播：`operations` 通过提供后端执行命令，而 `result` 则记录已完成的命令但不执行它。

### 输入事件

#### input

当收到用户输入时触发，此时扩展命令已检查完毕，但技能与模板展开尚未进行。事件接收到的是原始输入文本，因此 `/skill:foo` 和 `/template` 尚未展开。

**处理顺序：**
1. 扩展命令（`/cmd`）优先检查——若命中，则运行处理程序并跳过 input 事件
2. `input` 事件触发——可拦截、转换或处理
3. 若未处理：技能命令（`/skill:name`）展开为技能内容
4. 若未处理：提示词模板（`/template`）展开为模板内容
5. 智能体处理开始（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - 原始输入（技能/模板展开之前）
  // event.images - 附带的图片（如有）
  // event.source - "interactive"（键入）、"rpc"（API）或 "extension"（通过 sendUserMessage）
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   空闲时为 undefined，流式中断时为 "steer"，
  //   消息排队等待智能体完成时为 "followUp"

  // 转换：在展开之前重写输入
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `Respond briefly: ${event.text.slice(7)}` };

  // 处理：不经过 LLM 直接响应（扩展显示自身反馈）
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // 按来源路由：跳过扩展注入消息的处理
  if (event.source === "extension") return { action: "continue" };

  // 在展开前拦截技能命令
  if (event.text.startsWith("/skill:")) {
    // 可在此转换、阻止或放行
  }

  return { action: "continue" };  // 默认：放行进入展开
});
```

**结果：**
- `continue` - 原样放行（默认行为，若处理程序未返回任何内容）
- `transform` - 修改文本/图片，然后继续展开
- `handled` - 完全跳过智能体（第一个返回此值的处理程序生效）

转换会跨处理程序链式执行。参见 [input-transform.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform-streaming.ts) 了解 `streamingBehavior` 感知的路由方式。

## ExtensionContext

所有处理器都会接收 `ctx: ExtensionContext`。

### ctx.ui

用于用户交互的 UI 方法。完整详情请参阅[自定义 UI](#custom-ui)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。使用 `ctx.mode === "tui"` 来保护仅限终端的功能，如 `custom()`、组件工厂、终端输入和直接 TUI 渲染。

### ctx.hasUI

在 TUI 和 RPC 模式下为 `true`。在打印模式（`-p`）和 JSON 模式下为 `false`。使用此属性来保护在 TUI 和 RPC 模式下均有效的对话方法（`select`、`confirm`、`input`、`editor`）和即发即弃方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`）。在 RPC 模式下，某些 TUI 特有的方法为无操作或返回默认值（参见 [rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

在构建项目本地配置路径时，使用 `CONFIG_DIR_NAME` 而非硬编码 `.pi`。品牌重塑的发行版可能使用不同的配置目录名称。

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

返回当前会话上下文中项目本地信任是否处于活动状态。这包括临时信任决策和 CLI 信任覆盖，而不仅仅是全局信任存储中已保存的决策。

在读取仅应针对受信任项目生效的项目本地扩展配置之前，请使用此方法。

### ctx.sessionManager

对会话状态的只读访问。完整的 SessionManager API 和条目类型请参阅[会话格式](/docs/session-format/)。

对于 `tool_call`，该状态会在处理程序运行前通过当前助手消息同步。在并行工具执行模式下，仍无法保证包含来自同一助手消息的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries()             // 所有条目
ctx.sessionManager.getBranch()              // 当前分支
ctx.sessionManager.buildContextEntries()    // 应用压缩后的活动分支条目
ctx.sessionManager.getLeafId()              // 当前叶子条目 ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

访问模型、提供商及已解析的认证信息。`ctx.modelRegistry.getProvider(id)` 返回有效的 pi-ai 提供商，而 `getProviderAuth(id)` 解析其当前的 API 密钥、请求头、基础 URL 及提供商作用域环境，无需加载模型即可使用。`ctx.model` 是当前激活的模型，`ctx.thinkingLevel` 是其当前有效的思考级别。

`ctx.scopedModels` 是限定于当前会话的只读模型列表——与 `/scoped-models` 命令显示的内容一致。它在会话开始时根据 `--models` 命令行标志和 `enabledModels` 设置解析（通过 minimatch 将 `provider/modelId` 或单独的 `modelId` 与可用目录匹配）。当未配置任何作用域时，该列表为空，意味着所有可用模型均可使用。每个条目为 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在模式固定时设置（例如 `anthropic/*:high`）。可用它来填充与内置模型选择器一致的模型选择器，而无需通过 `ctx.modelRegistry.getAvailable()` 枚举整个目录。

#### 流式模型调用

使用 `ctx.modelRegistry.streamSimple(model, context, options)` 处理与提供商无关的选项（如 `reasoning`），或使用 `stream()` 处理 API 特定选项。两者都使用已配置的提供商并解析身份验证，包括通过 `pi.registerProvider()` 注册的提供商。请使用这些函数，而非 `pi-ai/compat` 的流式函数，后者无法看到扩展提供商注册。

两者都返回一个 `AssistantMessageEventStream`。对其进行迭代以获取响应事件，并等待 `.result()` 获取最终消息。设置失败会产生错误事件和错误结果。

### ctx.signal

当前代理的终止信号，如果没有代理轮次处于活动状态，则为 `undefined`。

在扩展处理器启动的嵌套工作中使用此信号以实现终止感知，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程辅助函数

`ctx.signal` 通常在活动轮次事件中定义，如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
在空闲或非轮次上下文中（如会话事件、扩展命令以及 pi 空闲时触发的快捷键），它通常为 `undefined`。

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

控制流辅助函数。`ctx.isIdle()` 在 Pi 处理代理运行、自动重试、自动压缩重试或排队继续时为 false。

### ctx.shutdown()

请求优雅地关闭 pi。

- **交互模式：** 延迟执行，直到智能体变为空闲（在处理完所有排队的引导和追问消息后）。
- **RPC 模式：** 延迟执行，直到下一个空闲状态（在完成当前命令响应后，等待下一条命令时）。
- **打印模式：** 无操作。当所有提示词处理完毕后，进程自动退出。

在退出前，向所有扩展发出 `session_shutdown` 事件。适用于所有上下文（事件处理器、工具、命令、快捷键）。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

###  ctx.getContextUsage()

返回当前模型的上下文用量。若存在最近的助手用量，则优先使用之；否则，对尾部消息的令牌数进行估算。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // 其他逻辑
}
```

### ctx.compact()

触发压缩而不等待完成。使用 `onComplete` 和 `onError` 来处理后续操作。

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

- 在 `before_agent_start` 期间，这反映当前轮次迄今为止的链式系统提示词变更。
- 它不包含后续 `context` 消息的变更。
- 它不包含 `before_provider_request` 负载重写。
- 如果在你的扩展之后加载了其他扩展，它们仍然可以改变最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`系统提示词长度: ${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理器接收 `ExtensionCommandContext`，它通过会话控制方法扩展了 `ExtensionContext`。这些方法仅在命令中可用，因为如果从事件处理器调用它们可能会导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示词的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

该返回值与 `before_agent_start` 事件的 `event.systemPromptOptions` 具有相同的结构和可变性：包括自定义或强制提示词、已激活的工具、工具片段、按工具和自定义规则、自定义小节、追加的提示词文本、当前工作目录（cwd）、加载的上下文文件以及已加载的技能。它可能包含完整的上下文文件内容，因此请将其视为敏感的扩展本地数据，避免通过命令列表、日志或自动补全元数据暴露。

此方法报告当前的系统提示词基础输入。它不包括每轮 `before_agent_start` 链式的系统提示词更改、后续 `context` 事件消息的修改，或 `before_provider_request` 中对负载的重写。

### ctx.waitForIdle()

等待代理完全稳定，包括自动重试、自动压缩重试以及队列中的后续操作：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // 代理现已空闲，可安全修改会话
  },
});
```

### ctx.newSession(options?)

创建一个新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "在替代会话中继续";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "来自上一会话的上下文..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // 在此处仅使用替代会话的 ctx。
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 一个扩展取消了新会话
}
```

选项：
- `parentSession`：要在新会话标题中记录的父会话文件。
- `setup`：在 `withSession` 运行之前修改新会话的 `SessionManager`。
- `withSession`：在新的替代会话上下文中执行切换后的工作。不要使用已捕获的旧 `pi` / 命令 `ctx`；请参阅 [会话替代生命周期及其陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从特定记录分支，创建新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // 此处仅使用替换会话的 ctx。
    ctx.ui.notify("现在位于分支会话中", "info");
  },
});
if (result.cancelled) {
  // 某扩展取消了分支操作
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // 某扩展取消了复制操作
}
```

选项：
- `position`: `"before"`（默认）在选中的用户消息前分支，将该提示词恢复至编辑器
- `position`: `"at"` 复制经过选中记录的当前活动路径，不恢复编辑器文本
- `withSession`: 在新的替换会话上下文中执行切换后的操作。不要使用捕获的旧 `pi`/命令 `ctx`；参见 [会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

导航到会话树中的不同节点。当代理响应、手动或自动压缩或另一个树导航处于活动状态时，即使使用`summarize: false`，该操作也会被拒绝。这些冲突会使活动分支保持不变，并拒绝promise，而不是返回`{ cancelled: true }`。等待活动操作完成（例如，在命令处理器中使用`await ctx.waitForIdle()`），然后重试：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "Focus on error handling changes",
  replaceInstructions: false, // true = 完全替换默认提示词
  label: "review-checkpoint",
});
```

选项：
- `summarize`：是否为被放弃的分支生成摘要
- `customInstructions`：为摘要生成器提供的自定义指令
- `replaceInstructions`：如果为 true，则`customInstructions`完全替换默认提示词，而不是追加
- `label`：添加到分支摘要条目（如果未汇总，则添加到目标条目）上的标签

### ctx.switchSession(sessionPath, options?)

切换到不同的会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Resume work in the replacement session");
  },
});
if (result.cancelled) {
  // 扩展通过 session_before_switch 取消了切换
}
```

选项：
- `withSession`：基于全新的替换会话上下文执行 post-switch 工作。不要使用捕获的旧 `pi` / 命令 `ctx`；请参阅 [会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

要发现可用会话，请使用静态 `SessionManager.list()` 或 `SessionManager.listAll()` 方法：

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
          ctx.ui.notify("会话已切换", "info");
        },
      });
    }
  },
});
```

### 会话替换生命周期与常见陷阱

`withSession` 接收一个全新的 `ReplacedSessionContext`，该上下文在 `ExtensionCommandContext` 基础上扩展了绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法。

生命周期与陷阱：
- `withSession` 仅在旧会话已发出 `session_shutdown`、旧运行时已拆除、替换会话已重新绑定，且新扩展实例已收到 `session_start` 之后运行。
- 回调仍在原始闭包内执行，而非在新扩展实例内部。这意味着在 `withSession` 启动之前，旧扩展实例可能已经运行了其关闭清理逻辑。
- 捕获的旧 `pi` / 旧命令 `ctx` 中绑定会话的对象在替换后已失效，使用时会抛出异常。与会话相关的工作请仅使用传递给 `withSession` 的 `ctx`。
- 之前提取出的原始对象仍需自行负责。例如，如果在替换前捕获了 `const sm = ctx.sessionManager`，则 `sm` 仍是旧的 `SessionManager` 对象。替换后请勿再复用它。
- `withSession` 中的代码应假定所有由 `session_shutdown` 处理器失效的状态均已消失。仅捕获能够在关闭过程中干净存活的纯数据，如字符串、ID 和序列化配置。

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
        // 旧对象已失效：切勿这样做
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("错误");
      },
    });
  },
});
```

### 运行时重载

`ctx.reload()` 会重新加载扩展、技能、提示词模板、主题和上下文文件。这对于在运行时中动态引入新能力或将旧版扩展替换为新版扩展非常有用。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "重新加载扩展、技能、提示词模板、主题和上下文文件",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });
}
```

重要行为特性：
- `await ctx.reload()` 会为当前扩展运行时发出 `session_shutdown` 事件
- 随后它会重新加载资源，并发出带有 `reason: "reload"` 的 `session_start` 事件和带有 `reason: "reload"` 的 `resources_discover` 事件
- 当前正在运行的命令处理器仍会在旧调用帧中继续执行
- `await ctx.reload()` 之后的代码仍会从重载前的版本运行
- `await ctx.reload()` 之后的代码不得假设旧的进程内扩展状态仍然有效
- 处理器返回后，未来的命令、事件或工具调用将使用新的扩展版本

为获得可预测的行为，应将重载视为该处理器的终态（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此它们无法直接调用 `ctx.reload()`。请使用命令作为重载入口，然后暴露一个工具，将该命令作为追问用户消息排队执行。

以下是供大语言模型调用的触发重载的工具示例：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "重新加载扩展、技能、提示词模板、主题和上下文文件",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "重载运行时",
    description: "重新加载扩展、技能、提示词模板、主题和上下文文件",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "已将 /reload-runtime 作为追问命令加入队列。" }],
      };
    },
  });
}
```

## 扩展 API 方法

### pi.on(event, handler)

订阅事件。返回一个取消订阅函数，仅移除该次注册。事件类型及返回值参见[事件](#events)。

```typescript
const unsubscribe = pi.on("agent_end", async (event) => {
  unsubscribe();
  await updateIntegration(event.messages);
});
```

处理器按扩展加载顺序运行，同一扩展内按注册顺序运行。添加或移除处理器不会影响正在进行中的分发。

### pi.registerTool(definition)

注册一个可由 LLM 调用的自定义工具。完整细节参见 [自定义工具](#custom-tools)。

`pi.registerTool()` 在扩展加载期间和启动后均可使用。你可以在 `session_start`、命令处理器或其他事件处理器中调用它。新工具会在同一会话中立即刷新，因此它们会出现在 `pi.getAllTools()` 中，并且无需 `/reload` 即可被 LLM 调用。

使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

可使用 `promptSnippet` 将自定义工具作为一行条目加入 `可用的工具` 列表中；当工具处于活动状态时，可使用 `promptGuidelines` 将特定于工具的条目追加到默认的 `指南` 部分。

**重要提示：** `promptGuidelines` 条目是平铺追加到 `指南` 部分的，不带有工具名前缀。每条指南必须指明其引用的工具——避免使用“使用此工具时……”这样的写法，因为 LLM 无法判断“此工具”指代哪个工具。请改为“使用 my_tool 时……”。

完整示例参见 [dynamic-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "此工具的功能说明",
  promptSnippet: "根据操作对文本进行摘要或转换",
  promptGuidelines: ["当用户要求对之前生成的文本进行摘要时，使用 my_tool。"],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选的兼容性垫片。在字段校验之前执行。
    // 返回当前字段结构，例如将旧字段折叠到现代参数对象中。
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 流式输出进度
    onUpdate?.({ content: [{ type: "text", text: "正在处理……" }] });

    return {
      content: [{ type: "text", text: "完成" }],
      details: { result: "……" },
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

向会话中注入自定义消息。自定义消息会参与 LLM 上下文。如需向仅限 TUI 展示且不应发送至 LLM 的持久内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 配合 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

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
  - `"steer"`（默认）- 在流式输出期间将消息排队。在当前助手回合完成其工具调用后、下一次 LLM 调用前传递。
  - `"followUp"` - 等待智能体完成。仅在智能体不再有工具调用时传递。
  - `"nextTurn"` - 排队等待下一条用户提示。不会中断或触发任何操作。
- `triggerTurn: true` - 若智能体处于空闲状态，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 模式忽略）。

### pi.sendUserMessage(content, options?)

向代理发送一条用户消息。与发送自定义消息的`sendMessage()`不同，此方法发送的是真实的用户消息，显示效果如同用户亲自输入一样。该操作总会触发一次对话回合。

```typescript
// 简单文本消息
pi.sendUserMessage("What is 2+2?");

// 使用内容数组（文本 + 图片）
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// 流式传输期间 - 必须指定投递模式
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });

// 选择启用扩展命令分发及技能/提示词模板展开
pi.sendUserMessage("/review src/index.ts", { expandPromptTemplates: true });
```

**选项：**
- `deliverAs` - 当代理处于流式传输状态时必需：
  - `"steer"` - 将消息排队，在当前助手回合完成其工具调用后投递
  - `"followUp"` - 等待代理完成所有工具操作
- `expandPromptTemplates` - 分发扩展命令以及展开技能命令和提示词模板。默认为`false`。

非流式传输状态下，消息会立即发送并触发新的对话回合。在流式传输状态下若未指定`deliverAs`，则会抛出错误。

完整示例参见 [send-user-message.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目不参与 LLM 上下文。在交互模式下，当与 `pi.registerEntryRenderer()` 配对时，它们也可以渲染在聊天记录中。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// 在重载时恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // 从 entry.data 重建
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（在会话选择器中显示，而不是第一条消息）。

```typescript
pi.setSessionName("Refactor auth module");
```

### pi.getSessionName()

获取当前会话的名称（如果已设置）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId, label)

为条目设置或清除标记。标记是用户自定义的注记，用于书签和导航（显示在 `/tree` 选择器中）。

```typescript
// 设置标记
pi.setLabel(entryId, "checkpoint-before-refactor");

// 清除标记
pi.setLabel(entryId, undefined);

// 通过 sessionManager 读取标记
const label = ctx.sessionManager.getLabel(entryId);
```

标记在会话中持久保存，并在重启后依然存在。使用它们来标记对话树中的重要节点（轮次、检查点）。

### pi.registerCommand(name, options)

注册一个命令。

如果多个扩展注册了相同的命令名，pi 会全部保留，并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "Show session statistics",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} entries`, "info");
  }
});
```

可选：为 `/command ...` 添加参数自动补全：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying: ${args}`, "info");
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 调用的斜杠命令。包含扩展命令、提示词模板和技能命令。
列表顺序与 RPC `get_commands` 一致：先是扩展，再是模板，最后是技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目结构如下：

```typescript
{
  name: string; // 可调用的命令名，不含前导斜杠。可能带后缀，如 "review:1"
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

使用 `sourceInfo` 作为规范来源字段。不要根据命令名或临时路径解析来推断所有权。

内置交互命令（如 `/model` 和 `/settings`）不在此列。它们仅在交互模式中处理，通过 `prompt` 发送也不会执行。

### pi.registerMessageRenderer(customType, renderer)

为自定义消息注册一个自定义 TUI 渲染器，其中 `customType` 是你的自定义类型。自定义消息通过 `pi.sendMessage()` 创建，并参与 LLM 上下文。参见 [自定义 UI](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

为普通用户文本、助手文本和思考块中的 Markdown 注册一个转换器。转换器按扩展加载顺序执行，每个转换器接收上一个转换器返回的 Markdown。链式处理完成后，Pi 使用其内置渲染器渲染转换后的内容。

转换器接收 Markdown 字符串及一个上下文对象，包含：

- `messageType` — `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 对于部分助手更新为 `true`；对于用户消息、最终确定的助手消息和恢复的消息为 `false`
- `availableWidth` — 转换后的 Markdown 内容可用的精确终端列数

返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

如果某个转换器抛出异常，Pi 会保留已生成的 Markdown 并继续执行下一个转换器。该钩子仅用于显示：原始消息在会话和模型上下文中保持不变。它会在新用户消息、助手流式更新、恢复的会话消息以及终端宽度变化时运行，因此转换器应保持同步且开销较小。

### pi.registerEntryRenderer(customType, renderer)

注册一个自定义 TUI 渲染器，用于你的 `customType` 自定义条目。自定义条目通过 `pi.appendEntry()` 创建，不参与 LLM 上下文。

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

注册一个键盘快捷键。请参阅 [keybindings.md](/docs/keybindings/) 了解快捷键格式及内置按键绑定。

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "切换计划模式",
  handler: async (ctx) => {
    ctx.ui.notify("已切换！");
  },
});
```

### pi.registerFlag(name, options)

注册一个命令行标志。

```typescript
pi.registerFlag("plan", {
  description: "以计划模式启动",
  type: "boolean",
  default: false,
});

// 检查值
if (pi.getFlag("plan")) {
  // 计划模式已启用
}
```

### pi.exec(command, args, options?)

执行一个shell命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// 提供stdout、stderr、code和killed。
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。此功能适用于内置工具和动态注册的工具。`pi.getActiveTools()` 返回活动工具名称，类型为 `string[]`；`pi.getAllTools()` 返回所有已配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "读取文件内容...",
//   parameters: ...,
//   promptGuidelines: ["使用 read 检查文件，而不是 cat 或 sed。"],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // 保留当前工具并启用 my_custom_tool
pi.setActiveTools(["read", "bash"]); // 切换为只读工具集
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

常见的 `sourceInfo.source` 取值：
- `builtin` 表示内置工具
- `sdk` 表示通过 `createAgentSession({ customTools })` 传入的工具
- 扩展来源元数据表示由扩展注册的工具

### pi.setModel(model)

为当前会话设置模型。该变更会记录在会话历史中，并在会话恢复时还原，但不会改变新会话所使用的已配置 `defaultProvider` 或 `defaultModel`。如果模型对应的提供商未配置认证，则返回 `false`。参见 [models.md](/docs/models/) 了解如何配置自定义模型。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("此模型没有 API 密钥", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取当前思考水平。思考水平受限于模型能力范围（非推理模型始终使用 "off"）。更改会触发 `thinking_level_select` 事件。

`pi.setThinkingLevel()` 可更改当前会话的思考水平。该更改会记录在会话历史中，并在恢复会话时恢复，但不会更改新会话使用的配置默认值。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel("high");
```

### pi.events

用于扩展间通信的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

动态注册或覆盖模型提供商。适用于代理、自定义端点或团队级模型配置。

在扩展工厂函数期间进行的调用会排队，并在运行器初始化后应用。之后进行的调用——例如用户设置流程后的命令处理器中——会立即生效，无需 `/reload`。

动态提供商可以实现 `refreshModels`。Pi 在模型刷新时调用它，通过提供商同步发布返回的列表，并传递规范的凭证/存储目录/网络/信号上下文。扩展通过生成检查的 `context.publish({ persist: entry })` 决定是否持久化目录元数据；像 llama.cpp 这样的实时服务器可以不持久化模型就返回它们。

`context.signal` 始终是具体信号，提供商回调必须将其传递给阻塞 I/O。公开的 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 调用接受可选信号，省略时不受限；扩展和应用程序自行选择截止时间。即使提供商忽略信号，取消也会停止调用者等待，但仍需协作才能停止底层工作。

需要原生提供商认证、过滤、刷新或流式行为的扩展，可以注册来自 `@earendil-works/pi-ai` 的完整 `Provider`。该提供商成为组合基础，`models.json` 覆盖仍在其之上应用。

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
```

```typescript
// 注册一个具有自定义模型的新提供商
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
```

> 完整代码见英文原文。

对象形式接受完整的 pi-ai `Provider`，包括原生 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**旧版配置选项：**
- `name` - 提供商在 UI 中的显示名称，例如 `/login`。
- `baseUrl` - API 端点 URL。定义模型时必需。
- `apiKey` - API 密钥字面量、环境插值（`$ENV_VAR` 或 `${ENV_VAR}`）或前导 `!command`。定义模型时必需（除非提供 `oauth`）。`$$` 转义 `$`，`$!` 转义字面 `!` 而不触发命令执行。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 请求中包含的自定义标头。
- `authHeader` - 如果为 true，自动添加 `Authorization: Bearer` 标头。
- `models` - 模型定义数组。如果提供，则替换此提供商的所有现有模型。模型定义可以设置 `baseUrl` 以覆盖该模型的提供商端点。
- `refreshModels` - 异步动态发现回调。其返回的模型替换扩展提供的模型。`context.stored` 包含持久化的提供商快照；仅当更新的目录数据应持久化时，使用生成检查的 `context.publish({ persist: entry })`。使用 `persist: null` 删除该快照。
- `oauth` - 支持 `/login` 的 OAuth 提供商配置。提供时，提供商出现在登录菜单中。
- `streamSimple` - 非标准 API 的自定义流实现。

参见 [自定义提供商](/docs/custom-provider/) 了解高级主题：自定义流 API、OAuth 详情、模型定义参考。

### pi.unregisterProvider(name)

移除先前注册的提供商及其模型。被提供商覆盖的内置模型将被恢复。如果提供商未经注册，此操作无效果。

与 `registerProvider` 类似，该方法在初始加载阶段之后调用时立即生效，因此无需执行 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "移除自定义代理提供商",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

有状态的扩展应将状态存储在工具结果的 `details` 字段中，以实现正确的分支支持：

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
        details: { items: [...items] },  // 存储以供重建
      };
    },
  });
}
```

## 自定义工具

通过 `pi.registerTool()` 注册 LLM 可以调用的工具。工具会出现在系统提示词中，并支持自定义渲染。

使用 `promptSnippet` 在默认系统提示词的“可用工具”部分中提供一行短条目。如果省略，自定义工具将不会出现在该部分中。

使用 `promptGuidelines` 向默认系统提示词的“准则”部分添加工具专属的要点。这些要点仅在工具激活时才会包含（例如，在 `pi.setActiveTools([...])` 之后）。

**重要提示：** `promptGuidelines` 的要点是扁平地追加到“准则”部分的，没有工具名称前缀或分组。每条准则必须明确指出其指代的工具——避免使用“使用此工具时……”这样的表述，因为 LLM 无法判断“此工具”具体指哪个。应改为“使用 my_tool 时……”。

注意：有些模型不太聪明，会在工具路径参数中加上 @ 前缀。内置工具在解析路径前会去掉开头的 @。如果你的自定义工具接受路径参数，请同样规范化开头的 @。

如果你的自定义工具会修改文件，请使用 `withFileMutationQueue()`，以便它与内置的 `edit` 和 `write` 工具一样参与相同的按文件队列。这一点很重要，因为工具调用默认是并行执行的。如果没有队列，两个工具可能会读取到相同的旧文件内容，计算出不同的更新，然后后写入的那个会覆盖前一个。

失败示例：你的自定义工具编辑了 `foo.ts`，而内置的 `edit` 在同一轮助手响应中也修改了 `foo.ts`。如果你的工具不参与队列，两者都可能读取原始的 `foo.ts`，应用各自的修改，其中之一会被覆盖丢失。

传给 `withFileMutationQueue()` 的必须是真实的目标文件路径，而不是用户的原始参数。请先将其解析为绝对路径，相对于 `ctx.cwd` 或你的工具的工作目录。对于已存在的文件，该辅助函数会通过 `realpath()` 进行规范化，因此同一文件的符号链接别名会共享同一个队列。对于新文件，它会回退到解析后的绝对路径，因为还没有什么可执行 `realpath()` 的。

将整个变更窗口都排入该目标路径的队列，包括读取-修改-写入的完整逻辑，而不仅仅是最终的写入操作。

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
      content: [{ type: "text", text: `已更新 ${params.path}` }],
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
  description: "此工具的功能说明（展示给LLM）",
  promptSnippet: "在项目待办列表中列出或添加项目",
  promptGuidelines: [
    "当用户请求任务清单时，使用my_tool进行待办规划，而不是直接编辑文件。"
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // 使用StringEnum以确保Google兼容性
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
    // 检查取消信号
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "已取消" }] };
    }

    // 流式推送进度更新
    onUpdate?.({
      content: [{ type: "text", text: "处理中..." }],
      details: { progress: 50 },
    });

    // 通过pi.exec运行命令（从扩展闭包中捕获）
    const result = await pi.exec("some-command", [], { signal });

    // 返回结果
    return {
      content: [{ type: "text", text: "完成" }],  // 发送给LLM
      details: { data: result },                   // 用于渲染与状态
      // usage: nestedModelResponse.usage,          // 可选：嵌套LLM调用用量
      // 可选：当批次中每个最终工具结果都返回terminate: true时，
      // 在此工具批次后停止自动追问。
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**用量记录：** 如果工具进行了嵌套LLM调用，请将其合并后的 `Usage` 作为 `usage` 返回。Pi 会将其持久化到工具结果中，并计入页脚、`/session` 和 RPC 会话汇总。`tool_result` 处理器可以检查或替换该值。

**错误信号：** 若要将工具执行标记为失败（在结果上设置 `isError: true` 并报告给LLM），请在 `execute` 中抛出错误。返回一个值永远不会设置错误标志，无论返回对象中包含什么属性。

**提前终止：** 从 `execute()` 返回 `terminate: true` 以提示在当前工具批次后跳过自动追问LLM调用。仅当该批次中每个最终化的工具结果都返回终止标志时才生效。参见 [examples/extensions/structured-output.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/structured-output.ts) 中的最小示例，其中代理在最终的结构化输出工具调用上结束。

```typescript
// 正确示例：抛出错误以指示失败
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`输入无效: ${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要提示：** 字符串枚举请使用 `@earendil-works/pi-ai` 中的 `StringEnum`。`Type.Union`/`Type.Literal` 不兼容 Google 的 API。

**参数预处理：** `prepareArguments(args)` 是可选的。若定义，它会在模式验证和 `execute()` 之前运行。用于在 pi 恢复旧会话且存储的工具调用参数与当前模式不匹配时，模拟旧版可接受的输入格式。返回要针对 `parameters` 验证的对象。保持公共模式的严格性。不要仅为兼容旧的恢复会话而向 `parameters` 添加已废弃的兼容字段。

示例：旧会话可能包含带有顶层 `oldText` 和 `newText` 的 `edit` 工具调用，而当前模式仅接受 `edits: [{ oldText, newText }]`。

```typescript
pi.registerTool({
  name: "edit",
  label: "编辑",
  description: "使用精确文本替换编辑单个文件",
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
    // params 现在与当前模式匹配
    return {
      content: [{ type: "text", text: `正在应用${params.edits.length}个编辑块` }],
      details: {},
    };
  },
});
```

### 覆盖内置工具

扩展可以通过注册同名的工具来覆盖内置工具（`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式下出现这种情况时会显示警告。

```bash
# 扩展的 read 工具将替换内置的 read 工具
pi -e ./tool-override.ts
```

或者，使用 `--no-builtin-tools` 启动时不加载任何内置工具，但保留扩展工具：

```bash
# 不加载内置工具，仅使用扩展工具
pi --no-builtin-tools -e ./my-extension.ts
```

参见 [examples/extensions/tool-override.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts) 获取一个完整示例，该示例通过日志记录和访问控制来覆盖 `read` 工具。

**渲染：** 内置渲染器的继承按插槽（slot）解析。执行覆盖和渲染覆盖相互独立。如果你的覆盖实现省略了 `renderCall`，则使用内置的 `renderCall`。如果省略了 `renderResult`，则使用内置的 `renderResult`。如果两者都省略，则自动使用内置渲染器（语法高亮、差异对比等）。这样你可以在不重新实现 UI 的情况下，为内置工具添加日志记录或访问控制。

**提示词元数据：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。如果你的覆盖实现需要保留这些提示词指令，请显式地在覆盖定义中声明它们。

**你的实现必须匹配精确的结果结构（result shape）**，包括 `details` 类型。UI 和会话逻辑依赖这些结构进行渲染和状态跟踪。

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

// 注册，在运行时检查标志
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

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 复用 pi 的本地 Shell 后端，而无需重新实现本地进程启动、Shell 解析和进程树终止。

`bash` 和 `powershell` 工具还支持在执行前调整命令、cwd 或 env 的 spawn 挂钩：

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

`createBashTool()` 和 `createPowerShellTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 向命令暴露当前会话。注入发生在 `spawnHook` 之前，因此挂钩会在 `env` 中接收这些值，并在如上展开现有环境时保留它们。设置为 `exposeSessionEnvironment: false` 可禁用：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

变量语义参见 [Shell 工具会话环境](environment-variables.md#shell-tool-session-environment)。完整的 SSH 示例（带 `--ssh` 标志）参见 [examples/extensions/ssh.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/ssh.ts)。

### 输出截断

**工具必须截断其输出**，以避免淹没LLM上下文。过大的输出可能导致：
- 上下文溢出错误（提示词过长）
- 压缩失败
- 模型性能下降

内置限制为**50KB**（约1万token）和**2000行**，以先达到者为准。请使用导出的截断工具函数：

```typescript
import {
  truncateHead,      // 保留前N行/字节（适用于文件读取、搜索结果）
  truncateTail,      // 保留后N行/字节（适用于日志、命令输出）
  truncateLine,      // 将单行截断至maxBytes并添加省略号
  formatSize,        // 人类可读的大小格式（如 "50KB"、"1.5MB"）
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

    // 告知LLM完整输出的位置
    result += `\n\n[输出已截断：${truncation.outputLines} / ${truncation.totalLines} 行`;
    result += `（${formatSize(truncation.outputBytes)} / ${formatSize(truncation.totalBytes)}）。`;
    result += ` 完整输出已保存至：${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**要点：**
- 对于开头部分重要的内容（搜索结果、文件读取），使用 `truncateHead`
- 对于结尾部分重要的内容（日志、命令输出），使用 `truncateTail`
- 当输出被截断时，始终告知LLM去哪里找到完整版本
- 在工具的描述中记录截断限制

参见 [examples/extensions/truncated-tool.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)，了解包装 `rg`（ripgrep）并正确截断的完整示例。

### 多个工具

一个扩展可以注册多个带有共享状态的工具：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close();
  });
}
```

### 自定义渲染

工具可以提供 `renderCall` 和 `renderResult` 来实现自定义 TUI 显示。完整的组件 API 请参阅 [tui.md](/docs/tui/)，工具行的组合方式请参阅 [tool-execution.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出会被包裹在用于处理内边距和背景的 `Box` 中。若定义了 `renderCall` 或 `renderResult`，则必须返回一个 `Component`。如果某个插槽的渲染器未定义，`tool-execution.ts` 将对该插槽使用后备渲染方式。

当工具应自行渲染外壳而非使用默认 `Box` 时，可设置 `renderShell: "self"`。这适用于需要完全控制边框或背景行为的工具，例如在工具稳定后必须保持视觉稳定的大型预览。

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

`renderCall` 和 `renderResult` 各自接收一个包含以下内容的 `context` 对象：
- `args` — 当前的工具调用参数
- `state` — 在 `renderCall` 和 `renderResult` 之间共享的行级本地状态
- `lastComponent` — 该插槽之前返回的组件（如果有）
- `invalidate()` — 请求重新渲染此工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 实现跨插槽的共享状态。若想在多次渲染中复用并修改同一个组件，可将插槽本地缓存保存在返回的组件实例上。

#### renderCall

渲染工具调用或头部：

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

如果某个插槽故意没有可见内容，返回一个空的 `Component`，例如空的 `Container`。

#### 按键绑定提示

使用 `keyHint()` 来显示尊重当前按键绑定配置的按键绑定提示：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ 完成");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "展开")})`;
  }
  return new Text(text, 0, 0);
}
```

可用的函数：
- `keyHint(keybinding, description)` - 格式化配置的按键绑定 ID，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回按键绑定 ID 对应的原始配置按键文本
- `rawKeyHint(key, description)` - 格式化原始按键字符串

使用命名空间的按键绑定 ID：
- 编码代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

关于按键绑定 ID 和默认值的完整列表，请参阅 [keybindings.md](/docs/keybindings/)。`keybindings.json` 使用相同的命名空间 ID。

自定义编辑器和 `ctx.ui.custom()` 组件将 `keybindings: KeybindingsManager` 作为注入参数接收。它们应直接使用注入的 manager，而不是调用 `getKeybindings()` 或 `setKeybindings()`。

#### 最佳实践

- 使用 `Text` 并设置内边距 `(0, 0)`。默认外壳负责处理内边距。
- 使用 `\n` 处理多行内容。
- 处理 `isPartial` 以支持流式进度。
- 支持 `expanded` 以按需显示详情。
- 保持默认视图简洁。
- 在 `renderResult` 中读取 `context.args`，而不要将参数复制到 `context.state` 中。
- 仅在需要跨调用和结果槽共享数据时使用 `context.state`。
- 当同一组件实例可以原地更新时，重用 `context.lastComponent`。
- 仅当默认带外壳的渲染方式造成阻碍时，才使用 `renderShell: "self"`。在自外壳模式下，工具负责自身的边框、内边距和背景。

#### 回退

如果插槽渲染器未定义或抛出错误：
- `renderCall`：显示工具名称
- `renderResult`：显示 `content` 中的原始文本

### 动态工具加载

扩展可以注册大量工具，同时仅保持少量初始工具处于活动状态。在工具执行期间，可通过 `pi.setActiveTools()` 更改活动工具集。Pi 会将初始提示词和工具配置存储于会话记录的首条系统消息中，并在下一次模型请求前追加工具及提示词的增量变更。对于无法表示这种状态切换的提供商，系统会发送完整的会话记录检查点，这可能导致缓存前缀失效。

其生命周期如下：

1. 使用 `pi.registerTool()` 注册每个工具，使其出现在 `pi.getAllTools()` 列表中。
2. 保持加载器工具（如 `search_tools`）处于活动状态，而将可搜索的工具保持为非活动状态。
3. 在加载器执行过程中，通过传入所需的活动工具名称来调用 `pi.setActiveTools()`。这些名称必须是已注册的；未知名称将被忽略。

#### 搜索工具示例

下面的扩展注册了两个可搜索工具，将它们从初始激活集合中移除，仅保留 `search_tools` 作为其加载器。该示例采用简单的关键词匹配，但实际搜索实现可使用 BM25、嵌入向量、远程目录或项目特定的路由。

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
    // 保持可搜索工具处于注册但初始未激活状态。保留内置工具
    // 及其他扩展拥有的工具，并保持加载器本身处于激活状态。
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

当 `search_tools` 添加匹配项后，模型会在紧随其后的请求中收到完整更新的工具列表。

## 自定义界面

扩展可以通过 `ctx.ui` 方法与用户交互，并定制消息/工具的渲染方式。

**关于自定义组件，请参阅 [tui.md](/docs/tui/)**，其中提供了可直接复制的模式，涵盖：
- 选择对话框（SelectList）
- 带取消的异步操作（BorderedLoader）
- 设置开关（SettingsList）
- 状态指示器（setStatus）
- 流式传输期间的工作消息、可见性与指示器（`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`）
- 编辑器上方/下方的组件（setWidget）
- 在内置斜杠/路径补全之上叠加的自动补全提供商（addAutocompleteProvider）
- 自定义页脚（setFooter）

### 对话框

```typescript
// 从选项中选择
const choice = await ctx.ui.select("请选择：", ["A", "B", "C"]);

// 确认对话框
const ok = await ctx.ui.confirm("删除？", "此操作无法撤销");

// 文本输入
const name = await ctx.ui.input("名称：", "占位符");

// 多行编辑器
const text = await ctx.ui.editor("编辑：", "预填文本");

// 通知（非阻塞）
ctx.ui.notify("完成！", "info");  // "info" | "warning" | "error"
```

#### 带倒计时的定时对话框

对话框支持 `timeout` 选项，可实时显示倒计时并自动关闭：

```typescript
// 对话框显示“标题 (5s)”→“标题 (4s)”→ ... → 减至 0 时自动关闭
const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒内自动取消。确认吗？",
  { timeout: 5000 }
);

if (confirmed) {
  // 用户已确认
} else {
  // 用户取消或超时
}
```

**超时时的返回值：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### 使用 AbortSignal 手动取消

为了更精细的控制（例如区分超时与用户取消），可以使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。确认？",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // 用户确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按下 Escape 或选择“否”）
}
```

完整示例请参见 [examples/extensions/timed-confirm.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/timed-confirm.ts)。

### 部件、状态与页脚

```typescript
// 页脚状态（持续显示直至清除）
ctx.ui.setStatus("my-ext", "Processing...");
ctx.ui.setStatus("my-ext", undefined);  // 清除

// 工作加载提示（在流式输出期间显示）
ctx.ui.setWorkingMessage("Thinking deeply...");
ctx.ui.setWorkingMessage();  // 恢复默认
ctx.ui.setWorkingVisible(false);  // 隐藏内置的工作加载行
ctx.ui.setWorkingVisible(true);   // 显示内置的工作加载行

// 工作指示器（在流式输出期间显示）
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });  // 静态圆点
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});
ctx.ui.setWorkingIndicator({ frames: [] });  // 隐藏指示器
ctx.ui.setWorkingIndicator();  // 恢复默认加载动画

// 编辑器上方部件（默认）
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
// 编辑器下方部件
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "Custom"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // 清除

// 自定义页脚（完全替换内置页脚）
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "Custom footer")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // 恢复内置页脚

// 终端标题
ctx.ui.setTitle("pi - my-project");

// 编辑器文本
ctx.ui.setEditorText("Prefill text");
const current = ctx.ui.getEditorText();

// 粘贴到编辑器（触发粘贴处理，包括对大内容的压缩）
ctx.ui.pasteToEditor("pasted content");

// 在内置提供商之上叠加自定义自动补全行为
ctx.ui.addAutocompleteProvider((current) => ({
  triggerCharacters: ["#"],
  async getSuggestions(lines, line, col, options) {
    const beforeCursor = (lines[line] ?? "").slice(0, col);
    const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
    if (!match) {
      return current.getSuggestions(lines, line, col, options);
    }

    return {
      prefix: `#${match[1] ?? ""}`,
      items: [{ value: "#2983", label: "#2983", description: "自动补全的扩展 API" }],
    };
  },
  applyCompletion(lines, line, col, item, prefix) {
    return current.applyCompletion(lines, line, col, item, prefix);
  },
  shouldTriggerFileCompletion(lines, line, col) {
    return current.shouldTriggerFileCompletion?.(lines, line, col) ?? true;
  },
}));

// 工具输出展开
const wasExpanded = ctx.ui.getToolsExpanded();
ctx.ui.setToolsExpanded(true);
ctx.ui.setToolsExpanded(wasExpanded);

// 自定义编辑器（vim 模式、emacs 模式等）
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings))
);
ctx.ui.setEditorComponent(undefined);  // 恢复默认编辑器

// 主题管理（创建主题请参阅 themes.md）
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // 加载但不切换
const result = ctx.ui.setTheme("light");  // 按名称切换
if (!result.success) {
  ctx.ui.notify(`Failed: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // 或按 Theme 对象切换
ctx.ui.theme.fg("accent", "styled text");  // 访问当前主题
```

自定义工作指示器帧原样渲染。如需彩色效果，请在帧字符串中自行添加颜色，例如使用 `ctx.ui.theme.fg(...)`。

### 自动补全提供商（Autocomplete Providers）

使用 `ctx.ui.addAutocompleteProvider()` 可在内置的斜杠命令与路径提供商之上叠加自定义自动补全逻辑。设置 `triggerCharacters` 可触发自定义的自然输入条件，例如 `$`。

典型模式：

- 检查光标前的文本
- 当你的扩展特定语法匹配时，返回你自己的建议
- 否则委托给 `current.getSuggestions(...)`
- 委托 `applyCompletion(...)`，除非你需要自定义插入行为

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
          { value: "#2983", label: "#2983", description: "用于注册自定义 @ 自动补全提供商的扩展 API" },
          { value: "#2753", label: "#2753", description: "重新加载过期的资源设置" },
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

参见 [github-issue-autocomplete.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/github-issue-autocomplete.ts) 获取完整示例，该示例使用 `gh issue list` 预加载最新的 GitHub 开放问题，并在本地过滤以实现快速的 `#...` 补全。它需要 GitHub CLI（`gh`）以及一个 GitHub 仓库的检出。

### 自定义组件

对于复杂 UI，使用 `ctx.ui.custom()`。这会临时用你的组件替换编辑器，直到调用 `done()`：

```typescript
import { Text, Component } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);

  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return text;
});

if (result) {
  // 用户按了 Enter
}
```

回调接收：
- `tui` - TUI 实例（用于屏幕尺寸、焦点管理）
- `theme` - 当前主题，用于样式
- `keybindings` - 应用按键绑定管理器（用于检查快捷方式）
- `done(value)` - 调用以关闭组件并返回值

参见 [tui.md](/docs/tui/) 获取完整组件 API。

#### 覆盖层模式（实验性）

传入 `{ overlay: true }` 可将组件渲染为现有内容上方的浮动模态，而无需清除屏幕：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  { overlay: true }
);
```

如需高级定位（锚点、边距、百分比、响应式可见性），请传入 `overlayOptions`。使用 `onHandle` 以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // 聚焦此覆盖层并将其置于视觉最前方
      // handle.unfocus({ target: editorComponent }); // 将输入释放给特定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    }
  }
);
```

当临时非覆盖层自定义 UI 关闭后，一个已聚焦且可见的覆盖层可以重新获得输入。如果你有意让另一个组件在覆盖层保持可见的同时继续持有输入，请调用 `handle.unfocus({ target })`。传入 `{ target: null }` 会释放覆盖层而不聚焦其他组件。

完整的 `OverlayOptions` 和 `OverlayHandle` API 请参阅 [tui.md](/docs/tui/)，示例请参阅 [overlay-qa-tests.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。

### 自定义编辑器

用自定义实现（vim 模式、emacs 模式等）替换主输入编辑器：

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

**关键点：**
- 继承 `CustomEditor`（而非基础 `Editor`）以获得应用按键绑定（escape 中止、ctrl+d、模型切换）
- 对于不处理的按键，调用 `super.handleInput(data)`
- 自定义编辑器默认保留独立的输出行。传入 `{ embedWorkingStatus: true }` 作为 `CustomEditor` 构造函数的第四个参数，改用内置的编辑器边框旋转指示器。
- 工厂函数从应用接收 `tui`、`theme` 和 `keybindings`
- 在 `setEditorComponent()` 之前使用 `ctx.ui.getEditorComponent()` 来包装先前配置的自定义编辑器
- 传入 `undefined` 恢复默认：`ctx.ui.setEditorComponent(undefined)`

要与已替换编辑器的其他扩展组合，先捕获之前的工厂函数，再设置你自己的：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

完整示例（含模式指示器）参见 [tui.md](/docs/tui/) 模式 7。

### 消息与条目渲染

通过`customType`为消息注册自定义渲染器。对于需要参与LLM上下文的内容，使用消息渲染器：

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

消息通过`pi.sendMessage()`发送：

```typescript
pi.sendMessage({
  customType: "my-extension",  // 与 registerMessageRenderer 匹配
  content: "Status update",
  display: true,               // 在TUI中显示
  details: { ... },            // 在渲染器中可用
});
```

对于仅用于TUI展示、不应发送给LLM的内容，可改为渲染自定义条目：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### 主题颜色

所有渲染函数都会接收一个 `theme` 对象。有关创建自定义主题及完整调色板的信息，请参阅 [themes.md](/docs/themes/)。

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

用于自定义工具渲染器中的语法高亮：

```typescript
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";

// 使用显式语言高亮代码
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// 根据文件路径自动检测语言
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## 错误处理

- 扩展错误会被记录，代理继续运行
- `tool_call` 错误会阻断该工具（故障安全机制）
- 工具 `execute` 错误必须通过抛出异常来发出信号；捕获到的异常会以 `isError: true` 标记报告给 LLM，然后继续执行

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 备注 |
|------|------------|-------------|------|
| 交互式 | `"tui"` | `true` | 带终端渲染的完整 TUI |
| RPC（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议进行对话框和通知；`custom()` 返回 `undefined`。参见 [rpc.md](/docs/rpc/) |
| JSON（`--mode json`） | `"json"` | `false` | 事件流输出至 stdout；UI 方法为无效操作 |
| 打印（`-p`） | `"print"` | `false` | 扩展运行但不能提示 |

在 TUI 特定功能（`custom()`、组件工厂、终端输入）之前，请使用 `ctx.mode === "tui"`。在 TUI 和 RPC 模式下都有效的对话框和通知方法之前，请使用 `ctx.hasUI`。

## 示例参考

所有示例位于 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/) 目录下。

| 示例 | 说明 | 关键 API |
|---------|-------------|----------|
| **工具** |||
| `hello.ts` | 最小化工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`, 会话事件 |
| `dynamic-tools.ts` | 启动后及命令执行期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 使用 `terminate: true` 的最终结构化输出工具 | `registerTool`, 终止工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置读取工具 | `registerTool`（与内置工具同名） |
| **命令** |||
| `pirate.ts` | 逐轮修改系统提示词 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 会话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨提供商模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 带自定义界面的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重载命令与 LLM 工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件与门控** |||
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 从用户/全局或 CLI 扩展决定或延迟项目信任 | `on("project_trust")`, 信任 UI, 必需的信任结果 |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话变更 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 在 git 仓库脏状态时发出警告 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 支持流式的输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型变更 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查载荷与提供商响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示词信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知的工具指导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监视器触发消息 | `sendMessage` |
| **压缩与会话** |||
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | 回合切换时 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 拉取、合并并解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时自动提交 | `on("session_shutdown")`, `exec` |
| **UI 组件** |||
| `status-line.ts` | 底部状态指示器 | `setStatus`, 会话事件 |
| `working-indicator.ts` | 自定义流式工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 通过从 `gh issue list` 预加载最近打开的问题，在内置自动补全之上添加 `#1234` 问题补全 | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换底部栏 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动头部 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | 覆盖层组件 | 带覆盖层选项的 `ui.custom` |
| `overlay-qa-tests.ts` | 综合性覆盖层测试 | `ui.custom`, 所有覆盖层选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | 带超时/信号的 `ui.confirm` |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`, `exec` |
| **复杂扩展** |||
| `plan-mode/` | 完整计划模式实现 | 所有事件类型, `registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思考） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | 工具开关界面 | `registerCommand`, `setActiveTools`, `SettingsList`, 会话事件 |
| **远程与沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`, 工具操作 |
| `interactive-shell.ts` | 持久化 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `gondolin/` | 将内置工具和 `!` 命令路由到 Gondolin 微型虚拟机中 | 工具操作, 内置工具覆盖, `on("user_bash")` |
| `subagent/` | 生成子代理 | `registerTool`, `exec` |
| **游戏** |||
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`, `ui.custom`, 键盘处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`, `ui.custom` |
| `doom-overlay/` | 覆盖层中的 Doom 游戏 | 带覆盖层的 `ui.custom` |
| **提供商** |||
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | 带 OAuth 的 `registerProvider` |
| **消息与通信** |||
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`, `sendMessage` |
| `entry-renderer.ts` | 仅 TUI 的自定义条目渲染 | `registerEntryRenderer`, `appendEntry` |
| `event-bus.ts` | 扩展间事件 | `pi.events` |
| **会话元数据** |||
| `session-name.ts` | 为选择器命名会话 | `setSessionName`, `getSessionName` |
| `bookmark.ts` | 为 /tree 添加书签条目 | `setLabel` |
| **其他** |||
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 执行前调整 bash 命令、工作目录和环境变量 | `createBashTool`, `spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 带 `package.json` 的软件包结构 |
