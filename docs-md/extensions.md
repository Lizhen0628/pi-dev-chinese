> pi 可以创建扩展。要求它针对你的使用场景构建一个。

# 扩展

扩展是TypeScript模块，用于扩展pi的功能。它们可以订阅生命周期事件、注册可供LLM调用的自定义工具、添加命令等。

> **/reload的放置说明：** 将扩展放在`~/.pi/agent/extensions/`（全局）或`.pi/extensions/`（项目本地）下以实现自动发现。仅用于快速测试时使用`pi -e ./path.ts`。位于自动发现位置下的扩展可通过`/reload`热重载。

**主要能力：**

- **自定义工具** — 通过`pi.registerTool()`注册可供LLM调用的工具
- **事件拦截** — 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** — 通过`ctx.ui`向用户提示（选择、确认、输入、通知）
- **自定义UI组件** — 通过`ctx.ui.custom()`实现带键盘输入的完整TUI组件，用于复杂交互
- **自定义命令** — 通过`pi.registerCommand()`注册`/mycommand`这类命令
- **会话持久化** — 通过`pi.appendEntry()`存储重启后仍存在的状态
- **自定义渲染** — 控制工具调用/结果及消息在TUI中的显示方式

**示例使用场景：**

- 权限门控（在`rm -rf`、`sudo`等危险命令前确认）
- Git检查点（每轮暂存，分支切换时恢复）
- 路径保护（阻止对`.env`、`node_modules/`的写入）
- 自定义压缩（以你自己的方式总结对话）
- 对话摘要（参见`summarize.ts`示例）
- 交互式工具（提问、向导、自定义对话框）
- 有状态工具（待办列表、连接池）
- 外部集成（文件监视器、Webhooks、CI触发器）
- 等待期间的小游戏（参见`snake.ts`示例）

有关可用实现，请参阅[示例/扩展/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)。

## 目录

- [快速入门](#quick-start)
- [扩展位置](#extension-locations)
- [可用导入](#available-imports)
- [编写扩展](#writing-an-extension)
  - [扩展样式](#extension-styles)
- [事件](#events)
  - [生命周期概述](#lifecycle-overview)
  - [资源事件](#resource-events)
  - [会话事件](#session-events)
  - [代理事件](#agent-events)
  - [模型事件](#model-events)
  - [工具事件](#tool-events)
- [扩展上下文（ExtensionContext）](#extensioncontext)
- [扩展命令上下文（ExtensionCommandContext）](#extensioncommandcontext)
- [扩展API方法](#extensionapi-methods)
- [状态管理](#state-management)
- [自定义工具](#custom-tools)
  - [动态工具加载](#dynamic-tool-loading)
- [自定义界面](#custom-ui)
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
    description: "按名字问候某人",
    parameters: Type.Object({
      name: Type.String({ description: "要问候的名字" }),
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
      ctx.ui.notify(`你好，${args || "世界"}！`, "info");
    },
  });
}
```

使用 `--extension`（或 `-e`）标志测试：

```bash
pi -e ./my-extension.ts
```

## 扩展位置

> **安全：** 扩展会以你的完整系统权限运行，并可执行任意代码。请只从可信来源安装。

扩展会自动从受信任位置被发现。项目本地的 `.pi/extensions` 条目仅在项目被信任后才会加载。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

通过 `settings.json` 添加额外路径：

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

如需通过 npm 或 git 将扩展作为 pi 软件包分享，请参阅 [packages.md](/docs/packages/)。

## 可用导入

| 软件包 | 用途 |
|---------|---------|
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | 工具参数的模式定义 |
| `@earendil-works/pi-ai` | AI 工具（用于 Google 兼容枚举的 `StringEnum`） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖同样适用。在你的扩展旁边（或其父目录中）添加 `package.json`，运行 `npm install`，即可自动解析 `node_modules/` 中的导入。

对于通过 `pi install`（npm 或 git）安装的分布式 pi 软件包，运行时依赖必须放在 `dependencies` 中。软件包安装默认使用生产环境安装（`npm install --omit=dev`），因此运行时无法使用 `devDependencies`；当配置了 `npmCommand` 时，git 软件包使用普通 `install` 以兼容包装器。

Node.js 内置模块（`node:fs`、`node:path` 等）也可用。

## 编写扩展

扩展导出一个默认工厂函数，该函数接收 `ExtensionAPI`。工厂函数可以是同步的，也可以是异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui 用于用户交互
    const ok = await ctx.ui.confirm("标题", "您确定吗？");
    ctx.ui.notify("已完成！", "info");
    ctx.ui.setStatus("my-ext", "处理中...");  // 底部状态
    ctx.ui.setWidget("my-ext", ["行 1", "行 2"]);  // 编辑器上方的部件（默认）
  });

  // 注册工具、命令、快捷键、标志
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可工作。

如果工厂函数返回一个 `Promise`，pi 会等待其完成再继续启动。这意味着异步初始化会在 `session_start`、`resources_discover` 之前完成，并且通过 `pi.registerProvider()` 排队注册的提供商也会在此时刷新。

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

此模式使得获取的模型在正常启动期间以及通过 `pi --list-models` 命令时均可用。

### 长期存在的资源与关闭

扩展工厂可能在从未启动会话的调用中运行。不要从工厂启动后台资源（如进程、套接字、文件监视器或定时器）。

将后台资源启动推迟到需要该资源的 `session_start` 或命令/工具/事件发生之时。注册一个幂等的 `session_shutdown` 处理器，以关闭你启动的任何会话级资源。

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

在扩展目录中运行 `npm install`，然后 `node_modules/` 中的导入会自动生效。

## 事件

### 生命周期概览

```
pi 启动
  │
  ├─► project_trust（仅用户/全局与 CLI 扩展，在项目资源加载前触发）
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
用户发送提示词 ─────────────────────────────────────────┐
  │                                                        │
  ├─► （优先检查扩展命令，若命中则跳过以下流程）           │
  ├─► input（可拦截、转换或直接处理）                      │
  ├─► （若未被处理，则进行技能/模板展开）                  │
  ├─► before_agent_start（可注入消息、修改系统提示词）    │
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── turn（当 LLM 调用工具时循环重复）───┐            │
  │   │                                            │       │
  │   ├─► turn_start                               │       │
  │   ├─► context（可修改消息）                    │       │
  │   ├─► before_provider_headers（可修改请求头）         │
  │   ├─► before_provider_request（可检查或替换载荷）     │
  │   ├─► after_provider_response（获取状态码+响应头，在流式消费之前）
  │   │                                            │       │
  │   │   LLM 响应，可能调用工具：                  │       │
  │   │     ├─► tool_execution_start               │       │
  │   │     ├─► tool_call（可阻止）                │       │
  │   │     ├─► tool_execution_update              │       │
  │   │     ├─► tool_result（可修改）              │       │
  │   │     └─► tool_execution_end                 │       │
  │   │                                            │       │
  │   └─► turn_end                                 │       │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled（无剩余重试/压缩/追问时触发）          │
                                                           │
用户发送另一条提示词 ◄─────────────────────────────────────┘

/new（新会话）或 /resume（切换会话）
  ├─► session_before_switch（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "new" | "resume", previousSessionFile? }
  └─► resources_discover { reason: "startup" }

/fork 或 /clone（派生或克隆会话）
  ├─► session_before_fork（可取消）
  ├─► session_shutdown
  ├─► session_start { reason: "fork", previousSessionFile }
  └─► resources_discover { reason: "startup" }

/name 或 pi.setSessionName()（设置会话名称）
  └─► session_info_changed

/compact 或自动压缩
  ├─► session_before_compact（可取消或自定义）
  ├─► session_compact（成功）
  └─► session_compact_failed（失败或中止）

/tree 导航（目录树操作）
  ├─► session_before_tree（可取消或自定义）
  └─► session_tree

/model 或 Ctrl+P（模型选择/切换）
  ├─► thinking_level_select（若模型变更会改变/限制思考级别）
  └─► model_select

思考级别变化（设置项、按键绑定、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C、Ctrl+D、SIGHUP、SIGTERM）
  └─► session_shutdown
```

### 启动事件

#### project_trust

在 pi 决定是否信任带有动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。它在启动时以及当会话替换（例如 `/resume`）进入当前进程中信任尚未解决的 cwd 时运行。只有用户/全局扩展和 CLI `-e` 扩展参与；项目本地扩展在信任解决之前不会加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 具有有限的信任上下文：cwd、mode、hasUI 以及 select/confirm/input/notify UI 辅助函数
  if (await ctx.ui.confirm("信任项目？", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局或 CLI 扩展拥有决定权；第一个 yes/no 决定胜出并抑制内置信任提示。使用 `remember: true` 持久化 yes/no 决定；否则仅适用于当前进程。返回 `"undecided"` 让后续处理器或内置信任流程决定。在提示前检查 `ctx.hasUI`。如果没有处理器返回 yes/no，则继续正常的信任解决流程：先应用已保存的 `trust.json` 决定，然后 `defaultProjectTrust` 控制 pi 默认是询问、信任还是拒绝。

### 资源事件

#### resources_discover

在 `session_start` 之后触发，以便扩展可以提供额外的技能、提示词模板和主题路径。
启动路径使用 `reason: "startup"`。重新加载使用 `reason: "reload"`。

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

请参阅 [会话格式](/docs/session-format/) 了解会话存储内部机制和会话管理器 API。

#### session_start

当会话开始、加载或重新加载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"
  // event.previousSessionFile - 在 "new"、"resume" 和 "fork" 情况下存在
  ctx.ui.notify(`会话: ${ctx.sessionManager.getSessionFile() ?? "临时"}`, "info");
});
```

#### session_info_changed

当通过 `/name` 命令、RPC 调用或 `pi.setSessionName()` 方法设置当前会话的显示名称时触发此事件。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - 当前规范化名称，若已清除则为 undefined
  ctx.ui.notify(`会话已重命名：${event.name ?? "(无)"}`, "info");
});
```

#### session_before_switch

在开始新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 要切换到的会话文件（仅用于 "resume"）

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("清除？", "删除所有消息？");
    if (!ok) return { cancel: true };
  }
});
```

切换或新建会话操作成功后，pi 会为旧的扩展实例触发 `session_shutdown`，为新会话重新加载并绑定扩展，然后触发 `session_start`，其中包含 `reason: "new" | "resume"` 和 `previousSessionFile`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重建任何内存中的状态。

#### session_before_fork

通过 `/fork` 分支或 `/clone` 克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - 所选条目的 ID
  // event.position - "/fork" 为 "before"，"/clone" 为 "at"
  return { cancel: true }; // 取消分支/克隆
  // 或
  return { skipConversationRestore: true }; // 保留用于未来的会话恢复控制
});
```

分支或克隆成功后，pi 会为旧扩展实例发出 `session_shutdown`，为新会话重新加载并重新绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重新建立任何内存状态。

#### session_before_compact / session_compact / session_compact_failed

会话压缩时触发。详见 [compaction.md](/docs/compaction/)。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // reason - "manual"（/compact）、"threshold"（阈值）或 "overflow"（溢出）
  // willRetry - 被中止的回合是否会在压缩后重试（溢出恢复）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；计入会话总数
    }
  };
});

pi.on("session_compact", async (event, ctx) => {
  // event.compactionEntry - 保存的压缩结果
  // event.fromExtension - 是否由扩展提供
  // event.reason - "manual"（/compact）、"threshold"（阈值）或 "overflow"（溢出）
  // event.willRetry - 被中止的回合是否会在压缩后重试（溢出恢复）
});

pi.on("session_compact_failed", async (event, ctx) => {
  // event.reason - "manual"（/compact）、"threshold"（阈值）或 "overflow"（溢出）
  // event.errorMessage - 非中止失败时存在
  // event.aborted - 为 true 表示压缩被取消/中止
  // event.willRetry - 被中止的回合原本是否会在压缩后重试
  // event.fromExtension - 正在使用的是否为扩展提供的压缩内容
});
```

#### session_before_tree / session_tree

在 `/tree` 导航时触发。关于树导航概念，请参阅[会话](/docs/sessions/)。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;
  return { cancel: true };
  // 或者提供自定义摘要：
  return {
    summary: {
      summary: "...",
      // usage: summaryResponse.usage, // 可选；包含在会话总计中
      details: {},
    },
  };
});

pi.on("session_tree", async (event, ctx) => {
  // 事件包含新叶子ID、旧叶子ID、摘要条目、来自扩展
});
```

#### session_shutdown

在已启动的会话运行时被拆除之前触发。使用此事件来清理从 `session_start` 或其他会话级钩子中打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit"（退出） | "reload"（重载） | "new"（新建） | "resume"（恢复） | "fork"（分叉）
  // event.targetSessionFile - 会话替换流程中的目标会话文件
  // 执行清理、保存状态等操作
});
```

### 智能体事件

#### before_agent_start

在用户提交提示词后、代理循环开始前触发。可注入消息和/或修改系统提示词。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - 用户的提示词文本
  // event.images - 附加的图片（如有）
  // event.systemPrompt - 当前处理器的链式系统提示词
  //   （包含先前 before_agent_start 处理器所做的更改）
  // event.systemPromptOptions - 用于构建系统提示词的结构化选项
  //   .customPrompt - 来自 --system-prompt、SYSTEM.md 或自定义模板的确切提示词前缀
  //   .forceSystemPrompt - 可选，完整提示词的确切替换
  //   .selectedTools - 当前在提示词中激活的工具
  //   .toolSnippets - 每个工具的单行描述
  //   .toolGuidelines - 按工具名称键控的指南要点
  //   .promptGuidelines - 额外的自定义指南要点
  //   .sections - 按标签名称键控的自定义 XML 包裹部分
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件及其他加载的上下文文件
  //   .skills - 加载的技能

  return {
    // 注入持久消息（存储在会话中，发送给 LLM）
    message: {
      customType: "my-extension",
      content: "为 LLM 提供的额外上下文",
      display: true,
    },
    // 替换本轮的系统提示词（跨扩展链式传递）
    systemPrompt: event.systemPrompt + "\n\n本轮的额外指令...",
  };
});
```

`systemPromptOptions` 字段让扩展能够访问 Pi 构建系统提示词所用的相同结构化数据。集合是可变的。建议优先修改 `sections`、`selectedTools` 或 `promptGuidelines`：Pi 会将生成的提示词部分与模型已有的内容进行差异比对，并追加一条仅修补变更部分的系统消息。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换整个运行的提示词：每个提供商都会将强制文本作为其引导系统提示词接收（变更时会导致缓存未命中），而会话记录会继续记录结构化部分。工具选择变更会同时更新提示词贡献和可执行的提供商工具；在处理器内调用 `pi.setActiveTools()` 与编辑 `selectedTools` 效果相同。支持在对话中途接收系统消息的模型会就地接收补丁并保留其缓存前缀；其他模型会将重放的提示词作为其系统提示词，每次变更都会导致一次缓存未命中。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理器的链式系统提示词。后续的 `before_agent_start` 处理器仍可再次修改它。

#### agent_start / agent_end / agent_settled

`agent_start` 在低级代理运行开始时触发。`agent_end` 在该运行结束时触发，但 Pi 仍可能自动重试、自动压缩并重试，或继续处理排队的追问消息。对于需要知道 Pi 不会自动继续运行的状态集成，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - 来自此底层运行的消息
});

pi.on("agent_settled", async (_event, ctx) => {
  // 这里 ctx.isIdle() 为 true，除非另一个扩展启动了新的运行
});
```

#### ui_prompt_start / ui_prompt_end

面向用户交互界面提示的阻塞式通知生命周期事件。它们围绕 `ctx.ui.select()`、`ctx.ui.confirm()`、`ctx.ui.input()`、`ctx.ui.editor()` 和 `ctx.ui.custom()` 触发，以便宿主/状态集成能够报告"等待用户输入"而非仅报告"正在运行"。

嵌套或重叠的提示会合并为单一的外部等待区间。处理程序以尽力而为的方式调用，并且在显示或关闭提示之前不会等待其完成。

```typescript
pi.on("ui_prompt_start", async (event, ctx) => {
  // event.reason === "ui_prompt"
  // event.kind: "select" | "confirm" | "input" | "editor" | "custom"
  // event.title: 提示标题（若可用）
});

pi.on("ui_prompt_end", async (event, ctx) => {
  // Pi 不再等待该 UI 提示区间。
});
```

#### turn_start / turn_end

每一轮（一次 LLM 响应及工具调用）触发。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // 事件轮次索引、事件时间戳
});

pi.on("turn_end", async (event, ctx) => {
  // 事件轮次索引、事件消息、事件工具结果
});
```

#### message_start / message_update / message_end

触发消息生命周期的更新事件。

- `message_start` 和 `message_end` 适用于用户消息、助手消息及工具结果消息。
- `message_update` 触发于助手消息的流式更新过程。
- `message_end` 处理函数可返回 `{ message }` 以替换最终消息。替换消息必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // event.message
});

pi.on("message_update", async (event, ctx) => {
  // event.message
  // event.assistantMessageEvent (逐token流式事件)
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
- `tool_execution_start` 在预检阶段按助手源顺序发出
- `tool_execution_update` 事件可能在不同工具之间交错出现
- `tool_execution_end` 在每个工具完成后按其完成顺序发出
- 最终的 `toolResult` 消息事件仍会在后续按助手源顺序发出

```typescript
pi.on("tool_execution_start", async (event, ctx) => {
  // event.toolCallId、event.toolName、event.args
});

pi.on("tool_execution_update", async (event, ctx) => {
  // event.toolCallId、event.toolName、event.args、event.partialResult
});

pi.on("tool_execution_end", async (event, ctx) => {
  // event.toolCallId、event.toolName、event.result、event.isError
});
```

#### context

每次LLM调用前触发。以非破坏性方式修改消息。消息类型参见[会话格式](/docs/session-format/)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - 深拷贝，可安全修改
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_headers

在出站 HTTP 标头组装完成后触发。可用来添加、覆盖或移除请求标头。

处理程序就地修改 `event.headers`。将键设为字符串以添加或覆盖，或设为 `null` 以删除。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // 添加或覆盖 — 例如用于网关跟踪/归因的会话 ID
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // 删除 pi 为此调用添加的跟踪标头
  event.headers["X-OpenRouter-Title"] = null;
});
```

每个提供商请求运行一次；重试复用相同标头，而不会再次触发钩子。

#### before_provider_request

在构建提供商特有的负载之后、发送请求之前触发。处理程序按扩展加载顺序执行。返回 `undefined` 保持负载不变。返回任何其他值将替换负载，供后续处理程序和实际请求使用。

此钩子可以重写提供商级别的系统指令或完全移除它们。这些负载级别的更改不会反映在 `ctx.getSystemPrompt()` 中，后者报告的是 Pi 的系统提示字符串，而非最终序列化的提供商负载。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // 可选：替换负载
  // return { ...event.payload, temperature: 0 };
});
```

这主要用于调试提供商的序列化和缓存行为。

#### after_provider_response

在收到 HTTP 响应之后、流式响应体被消费之前触发。处理器按扩展加载顺序执行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP 状态码
  // event.headers - 规范化后的响应标头
  if (event.status === 429) {
    console.log("请求受限", event.headers["retry-after"]);
  }
});
```

标头的可用性取决于提供商和传输层。抽象了 HTTP 响应的提供商可能不会暴露标头。

#### cache_warming_decision

在每次提示缓存刷新之前触发，事件中携带了 pi 的决定。该事件仅包含 pi 的成本估算；如需其他信息，请使用 `ctx.model`、`ctx.isIdle()` 和 `ctx.getContextUsage()`。

```typescript
pi.on("cache_warming_decision", (event, ctx) => {
  // event.warmCost：此次刷新的价格
  // event.missCost：如果条目丢失，下一次请求的额外价格
  // event.continuationProbability：pi 对请求是否会及时到达的估算
  // event.action: "warm" | "stop"，pi 的决定

  if (ctx.model?.provider === "my-provider") {
    return { action: "stop" };
  }
});
```

返回 `{ action: "warm" }` 或 `{ action: "stop" }` 以覆盖默认行为；最后一个返回操作的处理器将生效。`"stop"` 会终止预热，直到下一次实际请求到来。

### 模型事件

当通过 `/model` 命令、模型循环（`Ctrl+P`）或会话恢复来切换模型时触发。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - 新选中的模型
  // event.previousModel - 之前的模型（首次选择时为 undefined）
  // event.source - "set" | "cycle" | "restore"

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`模型已切换（${event.source}）：${prev} -> ${next}`, "info");
});
```

当活动模型变更时，可使用此事件更新界面元素（状态栏、页脚）或执行特定于模型的初始化操作。

#### thinking_level_select

当思考级别发生变化时触发。此事件仅用于通知；处理函数的返回值将被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - 新选择的思考级别
  // event.previousLevel - 之前的思考级别

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

当 `pi.setThinkingLevel()`、模型变更或内置思考级别控件更改当前思考级别时，使用此事件可更新扩展 UI。

### 工具事件

#### 工具调用

在 `tool_execution_start` 之后触发，但在工具实际执行之前。**可选。** 可使用 `isToolCallEventType` 收窄事件类型并获取类型化输入。

在 `tool_call` 运行之前，pi 会等待先前发出的 Agent 事件通过 `AgentSession` 完成排空。这意味着 `ctx.sessionManager` 在当前的助手工具调用消息中是最新的。

在默认的并行工具执行模式下，来自同一助手消息的兄弟工具调用会先按顺序预检，然后并发执行。`tool_call` 不保证能在 `ctx.sessionManager` 中看到来自同一助手消息的兄弟工具执行结果。

`event.input` 是可变的。在执行前原地修改它即可修补工具参数。

行为保证：
- 对 `event.input` 的修改会影响实际的工具执行
- 后续的 `tool_call` 处理器能看到先前处理器所做的修改
- 在你的修改之后不会进行重新验证
- `tool_call` 的返回值通过 `{ block: true, reason?: string, terminate?: boolean }` 控制阻塞
- `terminate` 仅适用于被阻塞的调用；只有当批次中每个最终结果都是终止性的时，代理才会提前停止

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash", "read", "write", "edit" 等
  // event.toolCallId
  // event.input - 工具参数（可变）

  // 内置工具：无需类型参数
  if (isToolCallEventType("bash", event)) {
    // event.input 为 { command: string; timeout?: number }
    event.input.command = `source ~/.profile\n${event.input.command}`;

    if (event.input.command.includes("rm -rf")) {
      return { block: true, reason: "危险命令", terminate: true };
    }
  }

  if (isToolCallEventType("read", event)) {
    // event.input 为 { path: string; offset?: number; limit?: number }
    console.log(`正在读取：${event.input.path}`);
  }
});
```

#### 为自定义工具输入添加类型

使用带显式类型参数的 `isToolCallEventType`：

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { MyToolInput } from "my-extension";

pi.on("tool_call", (event) => {
  if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
    event.input.action;  // 类型已推断
  }
});
```

#### 工具结果

在工具执行完成之后、`tool_execution_end` 以及最终工具结果消息事件发出之前触发。**可修改结果。**

在并行工具模式下，`tool_result` 和 `tool_execution_end` 可能按照工具完成顺序交错出现，而最终的 `toolResult` 消息事件仍会按照助手来源顺序稍后发出。

`tool_result` 处理器像中间件一样串联：

- 处理器按扩展加载顺序运行
- 每个处理器在前一个处理器修改后看到最新结果
- 处理器可返回部分修补（`content`、`details`、`isError` 或 `usage`）；省略的字段保持当前值

在处理器内部使用 `ctx.signal` 进行嵌套异步工作。这可以让 Esc 取消模型调用、`fetch()` 以及其他由扩展启动的、支持中止的操作。

```typescript
import { isBashToolResult } from "@earendil-works/pi-coding-agent";

pi.on("tool_result", async (event, ctx) => {
  // event.toolName, event.toolCallId, event.input
  // event.content, event.details, event.isError, event.usage

  if (isBashToolResult(event)) {
    // event.details 类型化为 BashToolDetails
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
  // event.excludeFromContext - 若为 true，表示使用了 !! 前缀
  // event.cwd - 工作目录

  // 选项1：提供自定义操作（例如，SSH）
  return { operations: remoteBashOps };

  // 选项2：包装 pi 内置的本地 bash 后端
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      }
    }
  };

  // 选项3：完全替换 — 直接返回结果
  return { result: { output: "...", exitCode: 0, cancelled: false, truncated: false } };
});
```

返回 `undefined` 将继续传递到下一个处理器；若无处理器处理该事件，则执行本地命令。有效结果会阻止事件传播：`operations` 通过提供的后端执行命令，而 `result` 记录已完成的命令但不执行。

### 输入事件

输入事件

markdown 结构完整保留，内容翻译为简体中文说明中的格式元素保持，链接文字翻译，URL与锚点不变。

#### input

当收到用户输入时触发，此事件在扩展命令检查之后、技能与模板扩展之前发生。该事件接收原始输入文本，因此 `/skill:foo` 和 `/template` 尚未被展开。

**处理顺序：**
1. 首先检查扩展命令（`/cmd`）——若匹配，则运行处理器并跳过 input 事件
2. 触发 `input` 事件——可拦截、转换或处理
3. 若未处理：技能命令（`/skill:name`）展开为技能内容
4. 若未处理：提示词模板（`/template`）展开为模板内容
5. 代理处理开始（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text — 原始输入（在技能/模板展开之前）
  // event.images — 附加的图片（如有）
  // event.source — "interactive"（键入）、"rpc"（API）或 "extension"（通过 sendUserMessage）
  // event.streamingBehavior — "steer" | "followUp" | undefined
  //   空闲时为 undefined，"steer" 表示流中断时的引导，
  //   "followUp" 表示排队等待代理完成后的追问

  // 转换：在展开前重写输入
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `简要回复：${event.text.slice(7)}` };

  // 处理：无需 LLM 直接响应（扩展显示其自身反馈）
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

**返回结果：**
- `continue` — 原样放行（若处理器无返回值则为默认行为）
- `transform` — 修改文本/图片，然后继续至展开阶段
- `handled` — 完全跳过代理（首个返回此值的处理器生效）

转换会在多个处理器之间链式传递。有关 `streamingBehavior` 感知的路由，请参阅 [input-transform.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform-streaming.ts)。

## 译文待翻译的（即扩展的英文"output"——这里，output: 参见上文已明确：output=原文，input=译文，若您特指“扩展上下文”英文为 Extension Context，则其译文为“扩展上下文”。）

## Extension Context（扩展上下文）

所有处理器均接收 `ExtensionContext` 类型的 `ctx` 参数。

### ctx.ui

用于用户交互的 UI 方法。完整细节请参阅[自定义 UI](#custom-ui)。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。使用 `ctx.mode === "tui"` 来保护仅限终端的特性，例如 `custom()`、组件工厂、终端输入和直接 TUI 渲染。

### ctx.hasUi

在TUI和RPC模式下为`true`，在打印模式（`-p`）和JSON模式下为`false`。使用它来守护对话框方法（`select`、`confirm`、`input`、`editor`）和即发即弃方法（`notify`、`setStatus`、`setWidget`、`setTitle`、`setEditorText`），这些方法在TUI和RPC模式下均有效。在RPC模式下，某些TUI特定的方法为无操作或返回默认值（参见[rpc.md](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

在构建项目本地配置路径时，应使用 `CONFIG_DIR_NAME` 而不是硬编码 `.pi`。复制的发行版可以使用不同的配置目录名称。

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

返回当前会话上下文中项目本地信任是否处于激活状态。这包括临时信任决策和 CLI 信任覆盖，而不仅仅是全局信任存储中保存的决策。

在读取仅应对受信任项目生效的项目本地扩展配置之前，请使用此方法。

### ctx.sessionManager

对会话状态的只读访问。参见[会话格式](/docs/session-format/)以了解完整的SessionManager API和条目类型。

对于`tool_call`，此状态在处理程序运行之前通过当前助手消息进行同步。在并行工具执行模式下，仍不保证包含来自同一条助手消息的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries()             // 所有条目
ctx.sessionManager.getBranch()              // 当前分支
ctx.sessionManager.buildContextEntries()    // 应用压缩后的活动分支条目
ctx.sessionManager.getLeafId()              // 当前叶子条目ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

访问模型、提供商和已解析认证。`ctx.modelRegistry.getProvider(id)` 返回有效的 pi-ai 提供商，而 `getProviderAuth(id)` 解析其当前 API 密钥、请求头、基础 URL 和提供商范围的环境，无需加载模型。`ctx.model` 是当前活动模型，`ctx.thinkingLevel` 是其当前有效思考级别。

`ctx.scopedModels` 是当前会话作用域内模型的只读列表——与 `/scoped-models` 命令显示的一致。它在会话开始时从 `--models` CLI 标志和 `enabledModels` 设置解析（使用 minimatch 在 `provider/modelId` 或裸 `modelId` 上匹配可用目录）。当未配置作用域时为空，意味着所有可用模型都可用。每个条目是 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在模式固定时设置（例如 `anthropic/*:high`）。使用它来填充与内置选择器镜像的模型选择器，而不是通过 `ctx.modelRegistry.getAvailable()` 枚举整个目录。

#### 流式模型调用

使用 `ctx.modelRegistry.streamSimple(model, context, options)` 处理提供商无关的选项，如 `reasoning`，或使用 `stream()` 处理 API 特定的选项。两者均使用已配置的提供商并解析身份验证，包括通过 `pi.registerProvider()` 注册的提供商。请优先使用这些方法，而非 `pi-ai/compat` 的流式函数，后者无法识别扩展的提供商注册。

两者均返回 `AssistantMessageEventStream`。遍历它以获取响应事件，并等待 `.result()` 获取最终消息。设置失败会产生错误事件和错误结果。

### ctx.signal

当前代理的中止信号，当没有活动的代理轮次时为 `undefined`。

将其用于由扩展处理器启动的、可感知中止的嵌套工作，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程辅助函数

`ctx.signal` 通常在活动轮次事件中定义，例如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`。
在空闲或非轮次上下文（如会话事件、扩展命令以及 pi 空闲时触发的快捷键）中，它通常为 `undefined`。

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

控制流辅助方法。当 Pi 正在处理代理运行、自动重试、自动压缩重试或排队续接时，`ctx.isIdle()` 返回 `false`。

### ctx.shutdown()

请求优雅关闭 pi。

- **交互模式：** 延迟到代理空闲（处理完所有排队的引导和追问消息后）。
- **RPC模式：** 延迟到下一个空闲状态（完成当前命令响应后，等待下一条命令时）。
- **打印模式：** 无操作。当所有提示处理完毕后，进程自动退出。

在退出前向所有扩展发出 `session_shutdown` 事件。在所有上下文（事件处理器、工具、命令、快捷键）中可用。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前活动模型的上下文使用量。在可用时使用最后一条助手消息的使用量，然后估算后续消息的令牌数。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发压缩但不等待其完成。使用 `onComplete` 和 `onError` 进行后续操作。

```typescript
ctx.compact({
  customInstructions: "关注最近的变化",
  onComplete: (result) => {
    ctx.ui.notify("压缩完成", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`压缩失败: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示词字符串。

- 在 `before_agent_start` 期间，这反映了当前轮次到目前为止已进行的链式系统提示词更改。
- 它不包括后续的 `context` 消息变更。
- 它不包括 `before_provider_request` 负载重写。
- 如果稍后加载的扩展在您的扩展之后运行，它们仍然可以更改最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`System prompt length: ${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理器接收 `ExtensionCommandContext`，它通过会话控制方法扩展了 `ExtensionContext`。这些方法仅在命令中可用，因为如果从事件处理器中调用，可能会导致死锁。

### ctx.getSystemPromptOptions()

返回当前 Pi 用于构建系统提示词的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

其形状和可变性与 `before_agent_start` 事件的 `event.systemPromptOptions` 相同：自定义或强制提示词、启用的工具、工具片段、按工具定制的规则与自定义规则、自定义区块、追加的提示词文本、当前工作目录（cwd）、已加载的上下文文件以及已加载的技能。它可能包含完整的上下文文件内容，因此应将其视为敏感的扩展局部数据，避免通过命令列表、日志或自动补全元数据暴露。

此方法报告当前的基础提示词输入。它不包含每次会话的 `before_agent_start` 链式系统提示词更改、后续 `context` 事件的消息修改，也不包含 `before_provider_request` 的有效载荷重写。

### ctx.waitForIdle()

等待代理完全稳定，包括自动重试、自动压缩重试和排队的后续操作：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // 代理现已空闲，可以安全地修改会话
  },
});
```

### ctx.newSession(options?)

创建一个新会话：

```typescript
const parentSession = ctx.sessionManager.getSessionFile();
const kickoff = "Continue in the replacement session";

const result = await ctx.newSession({
  parentSession,
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Context from previous session..." }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    // 这里只能使用替换会话的 ctx。
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 某个扩展取消了新会话
}
```

选项：
- `parentSession`：要记录在新会话头中的父会话文件
- `setup`：在 `withSession` 运行之前修改新会话的 `SessionManager`
- `withSession`：基于全新的替换会话上下文运行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期和陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从特定条目派生，创建新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // 仅在此处使用替换会话的ctx。
    ctx.ui.notify("现在处于派生会话中", "info");
  },
});
if (result.cancelled) {
  // 有扩展取消了派生操作
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // 有扩展取消了克隆操作
}
```

选项：
- `position`：`"before"`（默认）在所选用户消息之前派生，将该提示词恢复到编辑器中
- `position`：`"at"`复制通过所选条目的活跃路径，而不恢复编辑器文本
- `withSession`：在新的替换会话上下文上执行切换后的工作。请勿使用捕获的旧`pi`/命令`ctx`；参见[会话替换生命周期及常见陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

在会话树中导航到不同的节点。当代理响应、手动或自动压缩、或另一个树导航处于活动状态时，即使使用 `summarize: false`，该调用也会被拒绝。这些冲突会保持活动分支不变，并拒绝 Promise，而不是返回 `{ cancelled: true }`。等待活动操作完成（例如，在命令处理器中使用 `await ctx.waitForIdle()`），然后重试：

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
- `customInstructions`：为摘要器提供的自定义指令
- `replaceInstructions`：如果为 true，`customInstructions` 将完全替换默认提示词，而不是追加
- `label`：附加到分支摘要条目（或如果不进行摘要，则附加到目标条目）的标签

### ctx.switchSession(sessionPath, options?)

切换到不同的会话文件：

```typescript
const result = await ctx.switchSession("/path/to/session.jsonl", {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("在替换会话中继续工作");
  },
});
if (result.cancelled) {
  // 扩展通过 session_before_switch 取消了切换
}
```

选项：
- `withSession`：在全新的替换会话上下文上运行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

要发现可用会话，请使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

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

### 会话替换生命周期与注意事项

`withSession` 会接收一个全新的 `ReplacedSessionContext`，它扩展了 `ExtensionCommandContext`，并添加了绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法。

生命周期与注意事项：
- `withSession` 仅在旧会话发出 `session_shutdown`、旧运行时被拆除、替换会话重新绑定，并且新的扩展实例已经收到 `session_start` 之后才会运行。
- 该回调仍然在原始闭包中执行，而非在新的扩展实例内部。这意味着你的旧扩展实例在 `withSession` 开始之前可能已经执行了其关闭清理逻辑。
- 捕获的旧 `pi` / 旧命令 `ctx` 中绑定会话的对象在替换后即失效，如果使用将抛出异常。对于会话绑定的工作，请仅使用传递给 `withSession` 的 `ctx`。
- 先前提取的原始对象仍由你负责管理。例如，如果你在替换前捕获了 `const sm = ctx.sessionManager`，那么 `sm` 仍然是旧的 `SessionManager` 对象。替换后请勿再使用它。
- `withSession` 中的代码应假设被你的 `session_shutdown` 处理器置为无效的任何状态都已消失。只捕获能够干净存活的纯数据，例如字符串、ID 和序列化配置。

安全模式：

```typescript
pi.registerCommand("handoff", {
  handler: async (_args, ctx) => {
    const kickoff = "Continue from the replacement session";
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
        // 旧的过期对象：请勿这样做
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
  description: "重载扩展、技能、提示词、主题和上下文文件",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为说明：
- `await ctx.reload()` 会为当前扩展运行时发出 `session_shutdown` 事件
- 然后它会重载资源，并发出带有 `reason: "reload"` 的 `session_start` 事件，以及带有 `reason: "reload"` 的 `resources_discover` 事件
- 当前正在运行的命令处理器仍会在旧调用帧中继续执行
- `await ctx.reload()` 之后的代码仍然从重载前的版本运行
- `await ctx.reload()` 之后的代码不得假定旧的进程内扩展状态仍然有效
- 处理器返回后，未来的命令/事件/工具调用将使用新版本的扩展

为了获得可预测的行为，请将重载视为该处理器的终止操作（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此它们无法直接调用 `ctx.reload()`。请使用命令作为重载入口点，然后暴露一个工具，将该命令作为追问（follow-up）用户消息排入队列。

下面是LLM可调用以触发重载的工具示例：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("reload-runtime", {
    description: "重载扩展、技能、提示词、主题和上下文文件",
    handler: async (_args, ctx) => {
      await ctx.reload();
      return;
    },
  });

  pi.registerTool({
    name: "reload_runtime",
    label: "重载运行时",
    description: "重载扩展、技能、提示词、主题和上下文文件",
    parameters: Type.Object({}),
    async execute() {
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: "已将 /reload-runtime 作为追问命令排入队列。" }],
      };
    },
  });
}
```

## 扩展 API 方法

### pi.on(event, handler)

订阅事件。返回一个退订函数，该函数仅移除这一注册。事件类型及返回值见 [事件](#events)。

```typescript
const unsubscribe = pi.on("agent_end", async (event) => {
  unsubscribe();
  await updateIntegration(event.messages);
});
```

处理器按扩展加载顺序执行，扩展内部则按注册顺序执行。添加或移除处理器不影响已在进行的派发。

### pi.registerTool(definition)

注册一个可供LLM调用的自定义工具。完整细节参见[自定义工具](#custom-tools)。

`pi.registerTool()` 既可在扩展加载期间调用，也可在启动后调用。你可以在 `session_start`、命令处理器或其他事件处理器中调用它。新工具会在同一会话中立即刷新，因此它们会出现在 `pi.getAllTools()` 中，且无需 `/reload` 即可被LLM调用。

使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 可为自定义工具在 `Available tools` 中注册一行简介，使用 `promptGuidelines` 可在工具激活时向默认的 `Guidelines` 部分追加针对该工具的要点。

**重要提示：** `promptGuidelines` 要点以平铺方式追加到 `Guidelines` 部分，不带工具名称前缀。每条要点必须指明其所指的工具——避免使用“Use this tool when...”，因为LLM无法判断“this”指的是哪个工具。请改为“Use my_tool when...”的写法。

完整示例参见 [dynamic-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "该工具的功能说明",
  promptSnippet: "根据 action 对文本进行摘要或转换",
  promptGuidelines: ["当用户要求对先前生成的文本进行摘要时，使用 my_tool。"],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选的兼容层。在 schema 校验之前执行。
    // 返回当前 schema 形态，例如将遗留字段合并到新参数对象中。
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

将自定义消息注入会话。自定义消息会参与 LLM 上下文。对于仅用于 TUI 显示、不应发送给 LLM 的持久内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 配合 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

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
- `deliverAs` - 投递模式：
  - `"steer"`（默认）- 在流式输出期间将消息排队。在当前助手轮次完成执行其工具调用之后、下一次 LLM 调用之前投递。
  - `"followUp"` - 等待智能体完成。仅在智能体不再有工具调用时投递。
  - `"nextTurn"` - 排队等待下一次用户提示。不会中断或触发任何操作。
- `triggerTurn: true` - 如果智能体空闲，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 忽略）。

### pi.sendUserMessage(content, options?)

向代理发送一条用户消息。与发送自定义消息的 `sendMessage()` 不同，此方法发送的是一条真实用户消息，显示效果如同用户亲自输入。该方法始终会触发一轮对话。

```typescript
// 简单文本消息
pi.sendUserMessage("What is 2+2?");

// 使用内容数组（文本 + 图片）
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// 流式传输期间 - 必须指定传递方式
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });

// 选择启用扩展命令分发以及技能/提示词模板扩展
pi.sendUserMessage("/review src/index.ts", { expandPromptTemplates: true });
```

**选项参数：**

- `deliverAs` - 代理处于流式传输状态时必填：
  - `"steer"` - 将消息排队，在当前助手轮次执行完其工具调用后传递
  - `"followUp"` - 等待代理完成所有工具执行后再传递
- `expandPromptTemplates` - 分发扩展命令，并扩展技能命令和提示词模板。默认值为 `false`。

在非流式状态下，消息会立即发送并触发新一轮对话。在流式状态下若未指定 `deliverAs`，则会抛出错误。

完整示例请参见 [send-user-message.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目不参与 LLM 上下文。在交互模式下，当与 `pi.registerEntryRenderer()` 配合使用时，它们也可以在聊天记录中渲染。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// 重新加载时恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // 从 entry.data 重建
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（显示在会话选择器中，替代第一条消息）。

```typescript
pi.setSessionName("重构认证模块");
```

### pi.getSessionName()

获取当前会话名称（如果已设置）。

```typescript
const name = pi.getSessionName();
if (name) {
  console.log(`Session: ${name}`);
}
```

### pi.setLabel(entryId， label)

设置或清除某个条目的标签。标签是用户自定义的标记，用于书签和导航（显示在 `/tree` 选择器中）。

```typescript
// 设置标签
pi.setLabel(entryId， "checkpoint-before-refactor")；

// 清除标签
pi.setLabel(entryId， undefined)；

// 通过 sessionManager 读取标签
const label = ctx.sessionManager.getLabel(entryId)；
```

标签在会话中持久保存，重启后仍然保留。使用标签标记对话树中的重要节点（如转折点、检查点）。

### pi.registerCommand(name, options)

注册一个命令。

如果多个扩展注册了相同的命令名，pi 会保留全部命令，并按加载顺序分配数字调用后缀，例如 `/review:1` 和 `/review:2`。

```typescript
pi.registerCommand("stats", {
  description: "显示会话统计信息",
  handler: async (args, ctx) => {
    const count = ctx.sessionManager.getEntries().length;
    ctx.ui.notify(`${count} 条记录`, "info");
  }
});
```

可选：为 `/命令 ...` 添加参数自动补全：

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "部署到指定环境",
  getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
    const envs = ["dev", "staging", "prod"];
    const items = envs.map((e) => ({ value: e, label: e }));
    const filtered = items.filter((i) => i.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`正在部署：${args}`, "info");
  },
});
```

### pi.getCommands()

获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、提示词模板和技能命令。
列表顺序与 RPC `get_commands` 一致：先扩展，再模板，最后技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每一项的结构如下：

```typescript
{
  name: string; // 可调用的命令名，不包含前导斜杠。可能带有后缀，如 "review:1"
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

请将 `sourceInfo` 视为权威的来源字段。不要从命令名或临时解析的路径推断命令归属。

内置交互命令（如 `/model` 和 `/settings`）不包含在此列表中。它们仅在交互模式下处理，通过 `prompt` 发送时不会执行。

### pi.registerMessageRenderer(customType, renderer)

为你的 `customType` 注册自定义消息的自定义 TUI 渲染器。自定义消息通过 `pi.sendMessage()` 创建，并参与 LLM 上下文。参见[自定义界面](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

为普通用户文本、助手文本和思考块中的 Markdown 注册一个转换器。转换器按扩展加载顺序执行，每个转换器接收前一个转换器返回的 Markdown。链完成后，Pi 使用其内置渲染器渲染转换后的内容。

转换器接收 Markdown 字符串和一个上下文，包含：

- `messageType` — `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 对于部分助手更新为 `true`；对于用户、最终确定的助手和恢复的消息为 `false`
- `availableWidth` — 可用于转换后 Markdown 内容的精确终端列数

返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

如果转换器抛出异常，Pi 保留已生成的 Markdown 并继续执行下一个转换器。该钩子仅用于显示：原始消息在会话和模型上下文中保持不变。它会在新用户消息、助手流式更新、恢复的会话消息以及终端宽度变化时运行，因此转换器应保持同步且开销较小。

### pi.registerEntryRenderer(customType, renderer)

使用你的 `customType` 为自定义条目注册一个自定义 TUI 渲染器。自定义条目通过 `pi.appendEntry()` 创建，不参与 LLM 上下文。

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

执行 shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。此功能同时适用于内置工具和动态注册的工具。`pi.getActiveTools()` 返回活动工具名称，类型为 `string[]`；`pi.getAllTools()` 返回所有已配置工具的元数据。

```typescript
const active = pi.getActiveTools(); // ["read", "bash", ...]
const all = pi.getAllTools();
// all = [{
//   name: "read",
//   description: "读取文件内容...",
//   parameters: ...,
//   promptGuidelines: ["使用 read 而非 cat 或 sed 来查看文件。"],
//   sourceInfo: { path: "<builtin:read>", source: "builtin", scope: "temporary", origin: "top-level" }
// }, ...]
const builtinTools = all.filter((t) => t.sourceInfo.source === "builtin");
const extensionTools = all.filter((t) => t.sourceInfo.source !== "builtin" && t.sourceInfo.source !== "sdk");
pi.setActiveTools([...new Set([...active, "my_custom_tool"])]); // 保留当前工具并启用 my_custom_tool
pi.setActiveTools(["read", "bash"]); // 切换为只读模式
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo`。

常见的 `sourceInfo.source` 取值：
- `builtin` —— 内置工具
- `sdk` —— 通过 `createAgentSession({ customTools })` 传入的工具
- 扩展工具 —— 由扩展注册的工具对应的扩展来源元数据

### pi.setModel(model)

为当前会话设置模型。该更改会记录在会话历史中，并在会话恢复时还原，但不会改变新会话使用的已配置 `defaultProvider` 或 `defaultModel`。如果模型提供商未配置身份验证，则返回 `false`。有关自定义模型配置，请参阅 [models.md](/docs/models/)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("该模型未配置 API 密钥", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取当前的思考级别。思考级别被限制在模型能力范围内（非推理模型总是使用 "off"）。变更会触发 `thinking_level_select` 事件。

`pi.setThinkingLevel()` 会改变当前会话的思考级别。该变更会记录在会话历史中，并在会话恢复时还原，但不会改变新会话使用的配置默认值。

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

---
描述: 动态注册模型提供商
--- 在运行时注册或覆盖模型提供商。这对于代理、自定义端点或团队级模型配置很有用。

在外壳（extension）工厂函数创建期间进行的调用会被排队，并在运行器初始化后应用。之后进行的调用——例如在用户设置流程之后的命令处理器中——会立即生效，无需 `/reload`。

动态提供商可以实现 `refreshModels`。Pi 在模型刷新期间调用它，通过提供商同步发布返回的列表，并传递规范的凭据/存储目录/网络/信号上下文。扩展通过生成检查的 `context.publish({ persist: entry })` 决定是否持久化目录元数据；诸如 llama.cpp 之类的实时服务器可以返回模型而不持久化它们。

`context.signal` 总是一个具体的信号，提供商的回调必须将其传递给阻塞 I/O。公共的 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 调用接受一个可选的信号，当省略时是无界的；扩展和应用会选择自己的截止时间。即使提供商忽略信号，取消操作也会停止调用者等待，但停止底层工作仍然需要协作。

需要原生提供商认证、过滤、刷新或流行为的扩展可以从 `@earendil-works/pi-ai` 注册一个完整的 `Provider`。提供商成为组合基础，`models.json` 的覆盖配置仍将应用在其之上。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";

const provider = createProvider({
  id: "local-server",
  name: "本地服务器",
  baseUrl: "http://localhost:8080/v1",
  auth: {
    apiKey: {
      name: "本地服务器设置",
      async login(interaction) {
        return {
          type: "api_key",
          key: await interaction.prompt({ type: "secret", message: "API 密钥" }),
        };
      },
      async resolve({ credential }) {
        return credential?.key
          ? { auth: { apiKey: credential.key }, source: "已存储的 API 密钥" }
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
  name: "我的代理",
  baseUrl: "https://proxy.example.com",
  apiKey: "$PROXY_API_KEY",  // 环境变量引用
  api: "anthropic-messages",
  models: [
    {
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet (代理)",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// 注册一个实时 llama.cpp 目录而不持久化发现的模型
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

// 为现有提供商覆盖 baseUrl（保留所有模型）
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// 注册支持 /登录 的 OAuth 提供商
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "企业 AI（SSO）",
    async login(callbacks) {
      // 自定义 OAuth 流程
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "输入代码：" });
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

对象形式接受完整的 pi-ai `Provider`，包括原生的 `auth`、`getModels`、`refreshModels`、`filterModels`、`stream` 和 `streamSimple` 行为。

**旧版配置选项：**
- `name` - 提供商在 UI 中的显示名称，例如 `/登录`。
- `baseUrl` - API 端点 URL。定义模型时需要。
- `apiKey` - API 密钥字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`）、或前导 `!command`。定义模型时需要（除非提供了 `oauth`）。`$$` 转义 `$`，`$!` 转义字面量 `!` 而不触发命令执行。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 要包含在请求中的自定义请求头。
- `authHeader` - 如果为 true，则自动添加 `Authorization: Bearer` 请求头。
- `models` - 模型定义数组。如果提供，则替换该提供商的所有现有模型。模型定义可以设置 `baseUrl` 以覆盖该模型的提供商端点。
- `refreshModels` - 异步动态发现回调。其返回的模型替换扩展提供的模型。`context.stored` 包含持久化的提供商快照；仅在更新的目录数据应持久化时，使用生成检查的 `context.publish({ persist: entry })`。使用 `persist: null` 删除该快照。
- `oauth` - 用于 `/登录` 支持的 OAuth 提供商配置。提供后，该提供商将出现在登录菜单中。
- `streamSimple` - 用于非标准 API 的自定义流实现。

更多高级主题，如自定义流 API、OAuth 详细信息、模型定义参考，请参阅 [custom-provider.md](/docs/custom-provider/)。
```

### pi.unregisterProvider(name)

移除先前注册的提供商及其模型。被该提供商覆盖的内置模型将被恢复。如果提供商未注册，则此操作无效。

与 `registerProvider` 类似，在初始加载阶段之后调用此函数会立即生效，因此无需执行 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "移除自定义代理提供商",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

带有状态的扩展应将状态存储在工具结果的 `details` 中，以支持正确的分支：

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  // 从会话重建状态
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

通过 `pi.registerTool()` 注册 LLM 可以调用的工具。工具会出现在系统提示中，并可以自定义渲染。

使用 `promptSnippet` 为默认系统提示中的“可用工具”部分提供简短的一行条目。如果省略，自定义工具将不会出现在该部分中。

使用 `promptGuidelines` 向默认系统提示的“指南”部分添加工具特定的项目符号。这些项目符号仅在工具激活时包含（例如，在 `pi.setActiveTools([...])` 之后）。

**重要提示：** `promptGuidelines` 项目符号直接添加到“指南”部分，没有工具名称前缀或分组。每条准则必须指明所引用的工具——避免使用“使用此工具时……”之类的表述，因为 LLM 无法判断“此工具”是指哪个。应改为“使用 my_tool 时……”之类的表述。

注意：有些模型比较愚蠢，会在工具路径参数中包含 @ 前缀。内置工具在解析路径之前会去掉开头的 @。如果你的自定义工具接受路径，也应该去掉开头的 @。

如果你的自定义工具修改文件，请使用 `withFileMutationQueue()`，以便它与内置的 `edit` 和 `write` 一样参与相同的按文件队列。这一点很重要，因为默认情况下工具调用是并行执行的。如果没有队列，两个工具可能会读取相同的旧文件内容，计算出不同的更新，然后后写入的会覆盖先写入的。

示例失败场景：在同一个助手回合中，你的自定义工具编辑 `foo.ts`，同时内置的 `edit` 也修改 `foo.ts`。如果你的工具不参与队列，两者都可能读取原始的 `foo.ts`，分别应用更改，其中一部分更改将会丢失。

将实际目标文件路径传给 `withFileMutationQueue()`，而不是原始用户参数。先将其解析为绝对路径，相对于 `ctx.cwd` 或你的工具的工作目录。对于现有文件，该辅助函数会通过 `realpath()` 进行规范化，因此同一文件的符号链接别名会共享一个队列。对于新文件，它会回退到解析后的绝对路径，因为还没有任何东西可以 `realpath()`。

在该目标路径上对整个修改窗口进行排队。这包括读-改-写逻辑，而不仅仅是最终的写入。

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
  description: "该工具的功能说明（展示给大语言模型）",
  promptSnippet: "在项目待办列表中列出或添加项目",
  promptGuidelines: [
    "当用户要求任务清单时，请使用 my_tool 进行待办规划，而不是直接编辑文件。"
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // 使用 StringEnum 以确保与 Google 兼容
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

    // 推送进度更新
    onUpdate?.({
      content: [{ type: "text", text: "处理中..." }],
      details: { progress: 50 },
    });

    // 通过 pi.exec 执行命令（从扩展闭包中捕获）
    const result = await pi.exec("some-command", [], { signal });

    // 返回结果
    return {
      content: [{ type: "text", text: "完成" }],  // 发送给大语言模型
      details: { data: result },                   // 用于渲染与状态保存
      // usage: nestedModelResponse.usage,          // 可选的嵌套大语言模型用量
      // 可选：当该批次所有已完成的工具结果都返回 terminate: true 时，
      // 在此工具批次后停止后续调用。
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**用量记录：** 若工具内部调用了嵌套大语言模型，请将其合并后的 `Usage` 作为 `usage` 返回。Pi 会将其持久化到工具结果中，并计入页脚、`/session` 以及 RPC 会话总计。`tool_result` 处理器可以检查或替换该值。

**错误信号传递：** 若要将工具执行标记为失败（在结果上设置 `isError: true` 并向大语言模型报告），请在 `execute` 中抛出错误。返回一个值绝不会设置错误标志，无论返回对象中包含哪些属性。

**提前终止：** 从 `execute()` 返回 `terminate: true`，以提示在当前工具批次后应跳过自动追问的大语言模型调用。仅当该批次中所有已完成的工具结果均为终止状态时，此设置才会生效。参见 [examples/extensions/structured-output.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/structured-output.ts) 中的最小示例，其中代理在最后的结构化输出工具调用上结束。

```typescript
// 正确做法：通过抛出错误来指示失败
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`无效输入：${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要提示：** 对于字符串枚举，请使用 `@earendil-works/pi-ai` 中的 `StringEnum`。`Type.Union`/`Type.Literal` 无法与 Google API 配合使用。

**参数预整理：** `prepareArguments(args)` 为可选函数。若已定义，它将在模式验证之前及 `execute()` 之前运行。当 Pi 恢复旧会话而所存储的工具调用参数不再匹配当前模式时，可使用该函数来模拟旧的输入格式以兼容。返回你希望根据 `parameters` 进行验证的对象。保持公开模式严格，不要为了兼容旧的恢复会话而将已弃用的兼容字段添加到 `parameters` 中。

示例：旧会话可能包含一个带有顶层 `oldText` 与 `newText` 的 `edit` 工具调用，而当前模式仅接受 `edits: [{ oldText, newText }]`。

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
    // params 现在匹配当前模式
    return {
      content: [{ type: "text", text: `正在应用 ${params.edits.length} 个编辑块` }],
      details: {},
    };
  },
});
```

### 覆盖内置工具

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`）。当发生覆盖时，交互模式会显示一条警告。

```bash
# 扩展的 read 工具替换内置的 read
pi -e ./tool-override.ts
```

另外，可以使用 `--no-builtin-tools` 在不加载任何内置工具的情况下启动，同时保持扩展工具启用：

```bash
# 无内置工具，仅扩展工具
pi --no-builtin-tools -e ./my-extension.ts
```

完整的覆盖示例（使用日志记录和访问控制覆盖 `read`）请参阅 [examples/extensions/tool-override.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts)。

**渲染：** 内置渲染器的继承按插槽（slot）分别处理。执行覆盖与渲染覆盖相互独立。如果你的覆盖省略了 `renderCall`，则使用内置的 `renderCall`；如果省略了 `renderResult`，则使用内置的 `renderResult`；如果两者都省略，则自动使用内置渲染器（语法高亮、差异对比等）。这样你就可以在不重新实现 UI 的前提下，为内置工具添加日志记录或访问控制等包装功能。

**提示词元数据：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。如果你的覆盖需要保留这些提示词指令，请在覆盖中显式定义。

**你的实现必须与确切的返回结构相匹配**，包括 `details` 的类型。UI 和会话逻辑依赖这些结构进行渲染与状态跟踪。

内置工具的实现：
- [read.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) - `ReadToolDetails`
- [bash.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/bash.ts) - `BashToolDetails`
- [powershell.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/powershell.ts) - `PowerShellToolDetails`
- [edit.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/edit.ts)
- [write.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/write.ts)
- [grep.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/grep.ts) - `GrepToolDetails`
- [find.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/find.ts) - `FindToolDetails`
- [ls.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/ls.ts) - `LsToolDetails`

### 远程执行

内置工具支持可插拔操作，用于委托给远程系统（SSH、容器等）执行：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// 使用自定义操作创建工具
const remoteRead = createReadTool(cwd, {
  operations: {
    readFile: (path) => sshExec(remote, `cat ${path}`),
    access: (path) => sshExec(remote, `test -r ${path}`).then(() => {}),
  }
});

// 注册，并在执行时检查标志
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

对于 `user_bash`，扩展可以通过 `createLocalBashOperations()` 复用 pi 的本地 shell 后端，而无需重新实现本地进程派生、shell 解析和进程树终止。

`bash` 和 `powershell` 工具还支持派生钩子（spawn hook），可在执行前调整命令、工作目录或环境变量：

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

`createBashTool()` 和 `createPowerShellTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 将会话信息暴露给命令。注入发生在 `spawnHook` 之前，因此钩子能在 `env` 中接收到这些值，并在如上展开现有环境时保留它们。设置 `exposeSessionEnvironment: false` 可禁用此功能：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

查看 [Shell 工具会话环境](environment-variables.md#shell-tool-session-environment) 了解变量语义。查看 [examples/extensions/ssh.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/ssh.ts) 获取带有 `--ssh` 标志的完整 SSH 示例。

### 输出截断

**工具必须截断其输出**，以避免淹没 LLM 上下文。过大的输出可能导致：
- 上下文溢出错误（提示词过长）
- 压缩失败
- 模型性能下降

内置限制为 **50KB**（约 10k 个词元）和 **2000 行**，以先达到者为准。请使用导出的截断工具：

```typescript
import {
  truncateHead,      // 保留前 N 行/字节（适用于文件读取、搜索结果）
  truncateTail,      // 保留后 N 行/字节（适用于日志、命令输出）
  truncateLine,      // 将单行截断至 maxBytes，并加省略号
  formatSize,        // 人类可读的大小（例如 "50KB"、"1.5MB"）
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

    // 告知 LLM 完整输出的位置
    result += `\n\n[输出已截断：${truncation.outputLines} / ${truncation.totalLines} 行`;
    result += `（${formatSize(truncation.outputBytes)} / ${formatSize(truncation.totalBytes)}）。`;
    result += ` 完整输出已保存至：${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**关键要点：**
- 对于开头内容重要的输出，使用 `truncateHead`（如搜索结果、文件读取）
- 对于结尾内容重要的输出，使用 `truncateTail`（如日志、命令输出）
- 当输出被截断时，务必告知 LLM 完整版本的存放位置
- 在你的工具描述中写明截断限制

完整示例（使用 `rg`（ripgrep）配合正确截断）参见 [examples/extensions/truncated-tool.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 多工具

一个扩展可以注册多个工具，并可共享状态：

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;

  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });

  pi.on("session_shutdown", async () => {
    connection?.close(); // 关闭连接
  });
}
```

### 自定义渲染

工具可提供 `renderCall` 和 `renderResult` 实现自定义 TUI 显示。完整的组件 API 参见 [tui.md](/docs/tui/)，工具行的组成方式参见 [tool-execution.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出会被包裹在负责内边距和背景的 `Box` 中。已定义的 `renderCall` 或 `renderResult` 必须返回一个 `Component`。如果某个槽位的渲染器未定义，`tool-execution.ts` 会为该槽位使用回退渲染。

当工具需要渲染自己的外壳而非默认 `Box` 时，设置 `renderShell: "self"`。这对于需要完全掌控框架或背景行为的工具很有用，例如在工具稳定后必须保持视觉稳定的大型预览。

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

- `args` — 当前工具调用的参数
- `state` — 跨 `renderCall` 和 `renderResult` 共享的行级本地状态
- `lastComponent` — 该槽位先前返回的组件（如有）
- `invalidate()` — 请求重新渲染该工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 实现跨槽位的共享状态。当需要跨渲染复用并修改同一组件时，请将槽位本地缓存保留在返回的组件实例上。

</think>

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

如果某个插槽有意不显示任何内容，请返回一个空的 `Component`，例如空的 `Container`。

#### 键位提示

使用 `keyHint()` 显示遵循当前键位配置的键位提示：

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

可用函数：
- `keyHint(keybinding, description)` - 格式化已配置的键位ID，如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回键位ID对应的原始配置键文本
- `rawKeyHint(key, description)` - 格式化原始键字符串

使用带命名空间的键位ID：
- 编码代理ID使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享TUI ID使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

有关键位ID及默认值的完整列表，请参阅 [keybindings.md](/docs/keybindings/)。`keybindings.json` 使用相同的命名空间ID。

自定义编辑器和 `ctx.ui.custom()` 组件会将 `keybindings: KeybindingsManager` 作为注入参数接收。它们应直接使用该注入的管理器，而非调用 `getKeybindings()` 或 `setKeybindings()`。

#### 最佳实践

- 使用 `Text` 并设置内边距 `(0, 0)`。默认的 Box 会处理内边距。
- 使用 `\n` 处理多行内容。
- 处理 `isPartial` 以支持流式进度。
- 支持 `expanded` 以按需提供详细信息。
- 保持默认视图紧凑。
- 在 `renderResult` 中读取 `context.args`，而不是将参数复制到 `context.state`。
- 仅在必须跨调用和结果槽共享数据时使用 `context.state`。
- 当同一组件实例可以就地更新时，复用 `context.lastComponent`。
- 仅在默认的盒式外壳妨碍使用时，才使用 `renderShell: "self"`。在自外壳模式下，工具负责自身的框架、内边距和背景。

#### 回退机制

若插槽渲染器未定义或抛出异常：
- `renderCall`：显示工具名称
- `renderResult`：展示`content`中的原始文本

### 动态工具加载

扩展可以注册大量工具，同时仅保持一小部分初始工具处于激活状态。工具在执行过程中可以通过 `pi.setActiveTools()` 更改激活集。Pi 将初始提示和工具配置存储在转录的第一条系统消息中，然后在下一个模型请求前追加工具和提示增量。无法表示这种转换的提供商将收到完整的转录检查点，这可能会使缓存前缀失效。

生命周期如下：

1. 使用 `pi.registerTool()` 注册每个工具，使其出现在 `pi.getAllTools()` 中。
2. 保持加载器工具（如 `search_tools`）处于激活状态，而将可搜索工具保持为非激活状态。
3. 在加载器执行期间，使用所需的激活工具名称调用 `pi.setActiveTools()`。名称必须已注册；未知名称将被忽略。

#### 搜索工具示例

以下扩展注册了两个可搜索工具，将它们从初始活动集合中移除，并仅保留 `search_tools` 作为它们的加载器。该示例使用简单的关键字匹配，但搜索实现可以使用 BM25、嵌入、远程目录或项目特定路由。

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
    // 保持可搜索工具已注册但初始未激活。保留内建工具
    // 以及其他扩展拥有的工具，并保持加载器本身处于激活状态。
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

当 `search_tools` 添加一个匹配项时，模型会在紧接着的下一次请求中收到完整的更新后的工具列表。

## 自定义界面

扩展可通过 `ctx.ui` 方法与用户交互，并自定义消息/工具的渲染方式。

**如需自定义组件，请参阅 [tui.md](/docs/tui/)**，其中包含以下可直接复制使用的模式：
- 选择对话框（SelectList）
- 带取消功能的异步操作（BorderedLoader）
- 设置开关（SettingsList）
- 状态指示器（setStatus）
- 流式传输期间的工作消息、可见性与指示器（`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`）
- 编辑器上方/下方的组件（setWidget）
- 叠加在内置斜杠/路径补全之上的自动补全提供器（addAutocompleteProvider）
- 自定义页脚（setFooter）

### 对话框

```typescript
// 从选项中选择
const choice = await ctx.ui.select("请选择：", ["A", "B", "C"]);

// 确认对话框
const ok = await ctx.ui.confirm("要删除吗？", "此操作无法撤销");

// 文本输入
const name = await ctx.ui.input("名称：", "占位符");

// 多行编辑器
const text = await ctx.ui.editor("编辑：", "预填文本");

// 通知（非阻塞）
ctx.ui.notify("完成！", "info");  // "info" | "warning" | "error"
```

#### 带倒计时的定时对话框

对话框支持 `timeout` 选项，可自动关闭并显示实时倒计时：

```typescript
// 对话框显示 "标题 (5s)" → "标题 (4s)" → ... → 倒计时归零时自动关闭
const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。确认？",
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

#### 使用 AbortSignal 手动关闭

如需更精细的控制（例如区分超时与用户取消），可使用 `AbortSignal`：

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
  // 用户已确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按下 Escape 或选择“否”）
}
```

完整示例请参阅 [examples/extensions/timed-confirm.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/timed-confirm.ts)。

### 窗口部件、状态与页脚

```typescript
// 页脚中的状态（持续显示，直到清除）
ctx.ui.setStatus("my-ext", "处理中...");
ctx.ui.setStatus("my-ext", undefined);  // 清除

// 工作加载提示（流式传输期间显示）
ctx.ui.setWorkingMessage("正在深入思考...");
ctx.ui.setWorkingMessage();  // 恢复默认
ctx.ui.setWorkingVisible(false);  // 完全隐藏内置的工作加载行
ctx.ui.setWorkingVisible(true);   // 显示内置的工作加载行

// 工作指示器（流式传输期间显示）
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
ctx.ui.setWorkingIndicator();  // 恢复默认的旋转指示器

// 编辑器上方的窗口部件（默认）
ctx.ui.setWidget("my-widget", ["第 1 行", "第 2 行"]);
// 编辑器下方的窗口部件
ctx.ui.setWidget("my-widget", ["第 1 行", "第 2 行"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "自定义"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // 清除

// 自定义页脚（完全替换内置页脚）
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "自定义页脚")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // 恢复内置页脚

// 终端标题
ctx.ui.setTitle("pi - 我的项目");

// 编辑器文本
ctx.ui.setEditorText("预填充文本");
const current = ctx.ui.getEditorText();

// 粘贴到编辑器（触发粘贴处理，包括对大内容进行折叠）
ctx.ui.pasteToEditor("粘贴的内容");

// 在内置提供程序之上叠加自定义自动完成行为
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
      items: [{ value: "#2983", label: "#2983", description: "用于自动完成的扩展 API" }],
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

// 主题管理（创建主题的详细信息请参阅 themes.md）
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // 加载而不切换
const result = ctx.ui.setTheme("light");  // 按名称切换
if (!result.success) {
  ctx.ui.notify(`失败: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // 或通过 Theme 对象切换
ctx.ui.theme.fg("accent", "带样式的文本");  // 访问当前主题
```

自定义的工作指示器帧会按原样渲染。如果需要颜色，请自行在帧字符串中添加，例如使用 `ctx.ui.theme.fg(...)`。

### 自动补全提供商

使用 `ctx.ui.addAutocompleteProvider()` 在内置的斜杠命令和路径提供商之上叠加自定义自动补全逻辑。设置 `triggerCharacters` 以支持自定义自然触发字符，例如 `$`。

典型模式：

- 检查光标前的文本
- 当扩展特定语法匹配时，返回你自己的建议
- 否则委托给 `current.getSuggestions(...)`
- 除非需要自定义插入行为，否则委托 `applyCompletion(...)`

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

参见 [github-issue-autocomplete.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/github-issue-autocomplete.ts) 获取完整示例，该示例使用 `gh issue list` 预加载最新的开源 GitHub 问题，并在本地过滤以实现快速 `#...` 补全。它需要 GitHub CLI (`gh`) 和 GitHub 仓库的检出。

自定义组件

对于复杂的UI场景，您可以使用UI构建器创建自定义TUI组件，以完全替换整个界面。`ctx.ui.custom()` 方法接受一个回调函数并返回一个Promise，该Promise在组件关闭时解析为返回值：

```typescript
import { Text, Component } from "@pi-tui/core";

const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("按 Enter 确认，按 Escape 取消", 1, 1);

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

回调函数接收以下参数：
- `tui` - TUI实例（用于获取屏幕尺寸、管理焦点）
- `theme` - 当前主题，用于设置样式
- `keybindings` - 应用按键绑定管理器（用于检查快捷键）
- `done(value)` - 调用此函数以关闭组件并返回结果

完整的组件API请参阅 [tui.md](/docs/tui/)。

#### 叠加层模式 (实验性)

将 `overlay: true` 传入 `custom`，即可将组件渲染为现有内容上方的浮动叠加层：

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
      handle.focus(); // 聚焦此叠加层并将其置于视觉最前方
      // handle.unfocus({ target: editorComponent }); // 将输入权释放给特定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    }
  }
);
```

处于焦点且可见的叠加层可在临时非叠加层自定义UI关闭后重新获得输入权。如果你有意让另一个组件在叠加层保持可见时继续持有输入权，请调用 `handle.unfocus({ target })`。传入 `{ target: null }` 会释放叠加层且不聚焦任何其他组件。

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

**要点：**
- 继承 `CustomEditor`（而非基础 `Editor`）以获得应用按键绑定（escape 中止、ctrl+d、模型切换）
- 对未处理的按键调用 `super.handleInput(data)`
- 自定义编辑器默认保留独立的操作行。传递 `{ embedWorkingStatus: true }` 作为第四个 `CustomEditor` 构造函数参数，以改用内置的编辑器边框旋转指示器。
- 工厂函数从应用接收 `tui`、`theme` 和 `keybindings`
- 在 `setEditorComponent()` 之前使用 `ctx.ui.getEditorComponent()` 来包装先前配置的自定义编辑器
- 传递 `undefined` 以恢复默认值：`ctx.ui.setEditorComponent(undefined)`

要与其他已替换编辑器的扩展组合使用，请在设置你的工厂函数之前捕获之前的工厂：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

参见 [tui.md](/docs/tui/) 模式 7，获取带模式指示器的完整示例。

### 发送与渲染消息

外壳扩展通过注册渲染器来为消息和条目提供自定义的 TUI 渲染方式。调用 `pi.registerMessageRenderer()` 即可注册消息渲染器：

```typescript
import { Text } from "@pi-tui/pi";

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

通过 `pi.sendMessage()` 发送消息：

```typescript
pi.sendMessage({
  customType: "my-extension",  // 与 registerMessageRenderer 注册的类型匹配
  content: "状态更新",
  display: true,               // 在 TUI 中显示
  details: { ... },            // 渲染器可获取的详情数据
});
```

如需仅显示在 TUI 中而不发送给 LLM 的内容，可以改为渲染自定义条目：

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

- 扩展错误会被记录，代理继续运行
- `tool_call` 错误会阻止该工具执行（故障安全）
- 工具 `execute` 错误必须通过抛出异常来发出信号；捕获到的异常会以 `isError: true` 报告给 LLM，并继续执行

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 说明 |
|------|------------|-------------|-------|
| 交互式 | `"tui"` | `true` | 带终端渲染的完整 TUI |
| RPC（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议进行对话框和通知；`custom()` 返回 `undefined`。参见 [rpc.md](/docs/rpc/) |
| JSON（`--mode json`） | `"json"` | `false` | 事件流输出到 stdout；UI 方法为无操作 |
| 打印（`-p`） | `"print"` | `false` | 扩展可运行但不能提示 |

在 TUI 特定功能（`custom()`、组件工厂、终端输入）之前使用 `ctx.mode === "tui"`。在 TUI 和 RPC 模式中都适用的对话框和通知方法之前使用 `ctx.hasUI`。

# 示例

所有示例请参见 [extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/extensions/)。

| 示例 | 描述 | 关键 API |
|---------|-------------|----------|
| **工具** | | |
| `hello.ts` | 最小工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`，会话事件 |
| `dynamic-tools.ts` | 启动后及命令期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 使用 `terminate: true` 的最终结构化输出工具 | `registerTool`，终止型工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置读取工具 | `registerTool`（与内置工具同名） |
| **命令** | | |
| `pirate.ts` | 每轮修改系统提示词 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 会话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨提供商模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 带自定义 UI 的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重启命令与 LLM 工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件与门控** | | |
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 从用户/全局或 CLI 扩展决定或延后项目信任 | `on("project_trust")`，信任 UI，必需的信任结果 |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话更改 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 在未提交的 git 仓库上发出警告 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 转换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 支持流式的输入转换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型切换 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查载荷与提供商响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示词信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文相关的工具指导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监视器触发消息 | `sendMessage` |
| **压缩与会话** | | |
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | 每轮 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 拉取、合并并解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时自动提交 | `on("session_shutdown")`, `exec` |
| **UI 组件** | | |
| `status-line.ts` | 底部状态指示器 | `setStatus`，会话事件 |
| `working-indicator.ts` | 自定义流式工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 通过预加载 `gh issue list` 中最近的未关闭问题，在内置自动补全之上添加 `#1234` 问题补全 | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换页脚 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动页头 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模态编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | 覆盖层组件 | `ui.custom` 与覆盖层选项 |
| `overlay-qa-tests.ts` | 全面的覆盖层测试 | `ui.custom`，所有覆盖层选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | `ui.confirm` 与超时/信号 |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`, `exec` |
| **复杂扩展** | | |
| `plan-mode/` | 完整计划模式实现 | 所有事件类型，`registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思考） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | 工具开关 UI | `registerCommand`, `setActiveTools`, `SettingsList`，会话事件 |
| **远程与沙箱** | | |
| `ssh.ts` | SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`，工具操作 |
| `interactive-shell.ts` | 持久化 Shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `gondolin/` | 将内置工具和 `!` 命令路由到 Gondolin 微型虚拟机 | 工具操作，内置工具覆盖，`on("user_bash")` |
| `subagent/` | 生成子代理 | `registerTool`, `exec` |
| **游戏** | | |
| `snake.ts` | 贪吃蛇游戏 | `registerCommand`, `ui.custom`，键盘处理 |
| `space-invaders.ts` | 太空侵略者游戏 | `registerCommand`, `ui.custom` |
| `doom-overlay/` | 覆盖层中的 Doom | `ui.custom` 与覆盖层 |
| **提供商** | | |
| `custom-provider-anthropic/` | 自定义 Anthropic 代理 | `registerProvider` |
| `custom-provider-gitlab-duo/` | GitLab Duo 集成 | `registerProvider` 与 OAuth |
| **消息与通信** | | |
| `message-renderer.ts` | 自定义消息渲染 | `registerMessageRenderer`, `sendMessage` |
| `entry-renderer.ts` | 仅 TUI 的自定义条目渲染 | `registerEntryRenderer`, `appendEntry` |
| `event-bus.ts` | 扩展间事件 | `pi.events` |
| **会话元数据** | | |
| `session-name.ts` | 为会话选择器命名会话 | `setSessionName`, `getSessionName` |
| `bookmark.ts` | 为 `/tree` 添加条目书签 | `setLabel` |
| **其他** | | |
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 在执行前调整 bash 命令、工作目录和环境变量 | `createBashTool`, `spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 带有 `package.json` 的软件包结构 |
