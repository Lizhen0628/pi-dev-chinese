> pi 可以创建扩展。请让它为你的使用场景构建一个。

# 扩展

扩展是扩展 pi 行为的 TypeScript 模块。它们可以订阅生命周期事件、注册可供 LLM 调用的自定义工具、添加命令等。

> **`/reload` 的放置位置：** 将扩展放在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目本地）以便自动发现。仅在进行快速测试时使用 `pi -e ./path.ts`。位于自动发现位置的扩展可通过 `/reload` 热重载。

**关键能力：**
- **自定义工具** — 通过 `pi.registerTool()` 注册 LLM 可调用的工具
- **事件拦截** — 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** — 通过 `ctx.ui` 提示用户（选择、确认、输入、通知）
- **自定义 UI 组件** — 通过 `ctx.ui.custom()` 构建支持键盘输入的完整 TUI 组件，用于复杂交互
- **自定义命令** — 通过 `pi.registerCommand()` 注册类似 `/mycommand` 的命令
- **会话持久化** — 通过 `pi.appendEntry()` 存储在重启后仍然有效的状态
- **自定义渲染** — 控制工具调用/结果和消息在 TUI 中的显示方式

**示例用例：**
- 权限门控（在 `rm -rf`、`sudo` 等操作前进行确认）
- Git 检查点（每轮切换时暂存更改，在分支上恢复）
- 路径保护（阻止写入 `.env`、`node_modules/`）
- 自定义压缩（以您自己的方式总结对话）
- 对话摘要（参见 `summarize.ts` 示例）
- 交互式工具（提问、向导、自定义对话框）
- 有状态工具（待办列表、连接池）
- 外部集成（文件监视器、Webhook、CI 触发器）
- 等待期间的小游戏（参见 `snake.ts` 示例）

参见 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/) 获取可运行的实现。

## 目录

- [快速入门](#quick-start)
- [扩展位置](#extension-locations)
- [可用导入](#available-imports)
- [编写扩展](#writing-an-extension)
  - [扩展风格](#extension-styles)
- [事件](#events)
  - [生命周期概览](#lifecycle-overview)
  - [资源事件](#resource-events)
  - [会话事件](#session-events)
  - [代理事件](#agent-events)
  - [模型事件](#model-events)
  - [工具事件](#tool-events)
- [ExtensionContext](#extensioncontext)
- [ExtensionCommandContext](#extensioncommandcontext)
- [ExtensionAPI 方法](#extensionapi-methods)
- [状态管理](#state-management)
- [自定义工具](#custom-tools)
  - [动态工具加载](#dynamic-tool-loading)
- [自定义界面](#custom-ui)
- [错误处理](#error-handling)
- [模式行为](#mode-behavior)
- [示例参考](#examples-reference)

## 快速开始

创建 `~/.pi/agent/extensions/my-extension.ts`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 对事件作出反应
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("扩展已加载！", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作！", "允许执行 rm -rf 吗？");
      if (!ok) return { block: true, reason: "已被用户阻止" };
    }
  });

  // 注册一个自定义工具
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

  // 注册一个命令
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

# 扩展

Pi 自动加载与其一起安装的本地扩展，位置如下。`*.ts` 通配符匹配扩展源文件，`*/index.ts` 则匹配包含 `index.ts` 的目录，其中 `index.ts` 为扩展的入口文件。

**注意**：全局扩展仅当项目被信任时才加载。项目本地扩展仅当项目被信任时加载。

| 位置 | 作用范围 |
|------|---------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目本地 |
| `.pi/extensions/*/index.ts` | 项目本地（子目录） |

可通过 `settings.json` 添加额外路径：

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

如需通过 npm 或 git 以 pi 软件包形式共享扩展，请参阅 [packages.md](/docs/packages/)。

# 扩展

扩展就是简单的 Node.js 库。实际上，它们存放在一个目录中。

```text
extension/
├── manifest.yaml
├── main.ts  # 已编译为 main.js
└── ...任意其他文件...
```

扩展入口是 `require` 了你的 `manifest.yaml` 中 `main` 字段的模块。它应当导出一个默认的 `Extension` 实例。

你的扩展目录（以及父目录）会被添加到 node 的 `NODE_PATH` 中，这样就能从扩展内部导入核心包以及扩展内的其他文件。下面列举一些可用导入的示例：

```ts
import { config } from "@earendil-works/pi-core";
import { extension } from "@earendil-works/pi-core";
import type { Tool, ToolContext } from "@earendil-works/pi-core";

import { tool } from "@earendil-works/pi-core";

import { z } from "zod"; // zod 已内置
```

以下软件包可供使用：

| 软件包 | 用途描述 |
|---|---|
| `@earendil-works/pi-core` | 主 API：`config`、`defineConfig`、`extension`、`command`、`tools`、`tool`、`ai`、`ui` 等 |
| `@earendil-works/pi-errors` | 错误类型（`Panic`、`ApiError` 等） |
| `@earendil-works/pi-memory` | 会话、压缩、记忆工具 |
| `@earendil-works/pi-toolcalls` | 工具调用管理器，包括中断机制 |
| `@earendil-works/pi-ai` | AI 工具（用于与 Google 兼容枚举的 `StringEnum`） |
| `@earendil-works/pi-tui` | 用于自定义渲染的 TUI 组件 |

npm 依赖同样可用。在你的扩展旁边（或任意父目录中）添加一个 `package.json`，运行 `npm install`，然后从 `node_modules/` 导入的内容就会自动解析。

对于通过 `pi install`（npm 或 git）安装的已发布 pi 软件包，运行时依赖必须放在 `dependencies` 中。软件包安装默认使用生产安装（`npm install --omit=dev`），因此 `devDependencies` 在运行时不可用；当配置了 `npmCommand` 时，git 软件包使用普通 `install` 以兼容封装工具。

Node.js 内置模块（`node:fs`、`node:path` 等）同样可用。

## 编写扩展

扩展导出默认工厂函数，接收 `ExtensionAPI`。工厂函数可以是同步或异步的：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // 订阅事件
  pi.on("event_name", async (event, ctx) => {
    // ctx.ui 用于用户交互
    const ok = await ctx.ui.confirm("Title", "Are you sure?");
    ctx.ui.notify("Done!", "info");
    ctx.ui.setStatus("my-ext", "Processing...");  // 底部状态栏
    ctx.ui.setWidget("my-ext", ["Line 1", "Line 2"]);  // 编辑器上方的组件（默认）
  });

  // 注册工具、命令、快捷键、标志
  pi.registerTool({ ... });
  pi.registerCommand("name", { ... });
  pi.registerShortcut("ctrl+x", { ... });
  pi.registerFlag("my-flag", { ... });
}
```

扩展通过 [jiti](https://github.com/unjs/jiti) 加载，因此 TypeScript 无需编译即可工作。

如果工厂函数返回 `Promise`，pi 会在继续启动前等待它。这意味着异步初始化会在 `session_start`、`resources_discover` 之前完成，并且通过 `pi.registerProvider()` 排队的提供商注册也会在刷新之前完成。

### 异步工厂函数

对于一次性启动任务（如获取远程配置或动态发现可用模型），请使用异步工厂函数。

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

这种模式使获取到的模型在正常启动期间以及执行 `pi --list-models` 时均可用。

### 长期资源与关闭

扩展工厂可能在从未启动会话的调用中运行。不要从工厂启动后台资源，如进程、套接字、文件监视器或定时器。

将后台资源的启动推迟到 `session_start` 或需要该资源的命令/工具/事件。注册一个幂等的 `session_shutdown` 处理器，用于关闭你启动的任何会话级资源。

### 扩展样式

**单文件** - 最简单的形式，适用于小型扩展：

```
~/.pi/agent/extensions/
└── my-extension.ts
```

**带有 index.ts 的目录** - 适用于多文件扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts        # 入口点（导出默认函数）
    ├── tools.ts        # 辅助模块
    └── utils.ts        # 辅助模块
```

**带有依赖的软件包** - 适用于需要 npm 软件包的扩展：

```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json    # 声明依赖和入口点
    ├── package-lock.json
    ├── node_modules/   # 执行 npm install 后生成
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

在扩展目录中运行 `npm install`，然后 `node_modules/` 中的导入将自动生效。

## 事件</think>## 事件

### 生命周期概述

```
pi 启动
  │
  ├─► project_trust（仅用户/全局和 CLI 扩展，在项目资源加载之前）
  ├─► session_start { reason: "startup" }
  └─► resources_discover { reason: "startup" }
      │
      ▼
用户发送提示 ─────────────────────────────────────────┐
  │                                                        │
  ├─► （先检查扩展命令，若找到则绕过）                    │
  ├─► input（可拦截、转换或处理）                        │
  ├─► （若未处理，则进行技能/模板扩展）                   │
  ├─► before_agent_start（可注入消息、修改系统提示词）    │
  ├─► agent_start                                          │
  ├─► message_start / message_update / message_end         │
  │                                                        │
  │   ┌─── 回合（当 LLM 调用工具时重复） ───┐         │
  │   │                                      │         │
  │   ├─► turn_start                         │         │
  │   ├─► context（可修改消息）              │         │
  │   ├─► before_provider_headers（可修改头部）     │
  │   ├─► before_provider_request（可检查或替换载荷） │
  │   ├─► after_provider_response（状态 + 头部，在消费流之前）│
  │   │                                      │         │
  │   │   LLM 响应，可能调用工具：            │         │
  │   │     ├─► tool_execution_start         │         │
  │   │     ├─► tool_call（可阻止）          │         │
  │   │     ├─► tool_execution_update        │         │
  │   │     ├─► tool_result（可修改）        │         │
  │   │     └─► tool_execution_end           │         │
  │   │                                      │         │
  │   └─► turn_end                           │         │
  │                                                        │
  ├─► agent_end                                            │
  └─► agent_settled（无剩余重试/压缩/追问）               │
                                                           │
用户发送另一提示 ◄────────────────────────────────┘

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

/model 或 Ctrl+P（模型选择/循环）
  ├─► thinking_level_select（若模型更改改变/限制思维级别）
  └─► model_select

思维级别更改（设置、快捷键、pi.setThinkingLevel()）
  └─► thinking_level_select

退出（Ctrl+C、Ctrl+D、SIGHUP、SIGTERM）
  └─► session_shutdown
```

### 启动事件

#### project_trust

在pi决定是否信任带有动态配置（`.pi` 或 `.agents/skills`）的项目之前触发。该事件在启动时以及当会话替换（例如 `/resume`）进入当前进程中尚未解析信任状态的cwd时运行。仅用户/全局扩展和CLI `-e` 扩展参与；项目本地扩展直到信任解析后才加载。

```typescript
pi.on("project_trust", async (event, ctx) => {
  // event.cwd - 当前工作目录
  // ctx 具有有限的信任上下文：cwd、mode、hasUI 以及 select/confirm/input/notify UI 辅助函数
  if (await ctx.ui.confirm("信任此项目？", event.cwd)) {
    return { trusted: "yes", remember: true };
  }
  return { trusted: "undecided" };
});
```

`project_trust` 处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 `"yes"` 或 `"no"` 的用户/全局或CLI扩展拥有决定权；第一个 yes/no 决定生效，并抑制内置信任提示。使用 `remember: true` 持久化 yes/no 决定；否则仅适用于当前进程。返回 `"undecided"` 以让后续处理器或内置信任流程决定。在提示前检查 `ctx.hasUI`。如果没有处理器返回 yes/no，则继续正常信任解析流程：首先应用已保存的 `trust.json` 决定，然后由 `defaultProjectTrust` 控制pi是询问、信任还是默认拒绝。

### 资源事件

#### resources_discover

在 `session_start` 之后触发，以便扩展能够贡献额外的技能、提示词和主题路径。
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

关于会话存储内部机制和 SessionManager API，请参阅 [会话格式](/docs/session-format/)。

#### session_start

会话启动、加载或重新加载时触发。

```typescript
pi.on("session_start", async (event, ctx) => {
  // event.reason - "startup" | "reload" | "new" | "resume" | "fork"（启动|重新加载|新建|恢复|分支）
  // event.previousSessionFile - 在"new"、"resume"和"fork"时存在
  ctx.ui.notify(`会话：${ctx.sessionManager.getSessionFile() ?? "临时"}`, "info");
});
```

#### session_info_changed（会话信息变更）

当通过 `/name` 命令、RPC 或 `pi.setSessionName()` 设置当前会话的显示名称时触发。

```typescript
pi.on("session_info_changed", async (event, ctx) => {
  // event.name - 当前规范化名称，若已被清除则为 undefined
  ctx.ui.notify(`会话已重命名：${event.name ?? "（无）"}`, "info");
});
```

#### session_before_switch

在开始新会话（`/new`）或切换会话（`/resume`）之前触发。

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // event.reason - "new" 或 "resume"
  // event.targetSessionFile - 正在切换至的会话文件（仅适用于 "resume"）

  if (event.reason === "new") {
    const ok = await ctx.ui.confirm("清除？", "删除所有消息？");
    if (!ok) return { cancel: true };
  }
});
```

成功切换或新建会话后，pi 对旧扩展实例触发 `session_shutdown`，为新会话重新加载并绑定扩展，然后以 `reason: "new" | "resume"` 和 `previousSessionFile` 触发 `session_start`。
在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重建任何内存状态。

#### session_before_fork

当通过 `/fork` 进行 fork 或通过 `/clone` 进行克隆时触发。

```typescript
pi.on("session_before_fork", async (event, ctx) => {
  // event.entryId - 所选条目的 ID
  // event.position - "/fork" 为 "before"，"/clone" 为 "at"
  return { cancel: true }; // 取消 fork/clone
  // 或者
  return { skipConversationRestore: true }; // 保留用于未来的会话恢复控制
});
```

在成功的 fork 或 clone 之后，pi 为旧的扩展实例发出 `session_shutdown`，为新会话重新加载并重新绑定扩展，然后发出带有 `reason: "fork"` 和 `previousSessionFile` 的 `session_start`。在 `session_shutdown` 中执行清理工作，然后在 `session_start` 中重新建立任何内存中的状态。

#### session_before_compact / session_compact / session_compact_failed

触发于压缩时。详见 [compaction.md](/docs/compaction/)。

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
      // usage: summaryResponse.usage, // 可选；计入会话总计
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
  // event.errorMessage - 对于非中断失败存在
  // event.aborted - 对于已取消/中断的压缩为 true
  // event.willRetry - 压缩后是否会重试被中断的回合
  // event.fromExtension - 是否正在使用扩展提供的压缩内容
});
```

#### session_before_tree / session_tree

在 `/tree` 导航时触发。参见[会话](/docs/sessions/)了解树导航概念。

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
  // event.newLeafId, oldLeafId, summaryEntry, fromExtension
});
```

#### session_shutdown

在已启动的会话运行时被拆除之前触发。利用此事件来清理从 `session_start` 或其他会话级钩子中打开的资源。

```typescript
pi.on("session_shutdown", async (event, ctx) => {
  // event.reason - "quit" | "reload" | "new" | "resume" | "fork"
  // event.targetSessionFile - 会话替换流程中的目标会话文件
  // 进行清理、保存状态等操作
});
```

### 代理事件</think>### 代理事件

#### before_agent_start

在用户提交提示词后、代理循环开始前触发。可注入消息和/或修改系统提示词。

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  // event.prompt - 用户的提示词文本
  // event.images - 附加的图片（如有）
  // event.systemPrompt - 当前处理器的链式系统提示词
  //   （包含先前 before_agent_start 处理器的修改）
  // event.systemPromptOptions - 用于构建系统提示词的结构化选项
  //   .customPrompt - 来自 --system-prompt、SYSTEM.md 或自定义模板的确切提示词前缀
  //   .forceSystemPrompt - 可选，完整提示词的确切替代文本
  //   .selectedTools - 当前在提示词中启用的工具
  //   .toolSnippets - 每个工具的单行描述
  //   .toolGuidelines - 按工具名索引的准则条目
  //   .promptGuidelines - 额外的自定义准则条目
  //   .sections - 按标签名索引的自定义 XML 包装片段
  //   .appendSystemPrompt - 来自 --append-system-prompt 标志的文本
  //   .cwd - 工作目录
  //   .contextFiles - AGENTS.md 文件及其他已加载的上下文文件
  //   .skills - 已加载的技能

  return {
    // 注入持久消息（存储在会话中，发送给 LLM）
    message: {
      customType: "my-extension",
      content: "为 LLM 提供的附加上下文",
      display: true,
    },
    // 替换本轮的系统提示词（跨扩展链式传递）
    systemPrompt: event.systemPrompt + "\n\n本轮附加指令...",
  };
});
```

`systemPromptOptions` 字段让扩展能够访问 Pi 构建系统提示词所用的同一组结构化数据。集合是可变的。建议优先修改 `sections`、`selectedTools` 或 `promptGuidelines`：Pi 会将生成的提示词片段与模型已有的内容进行比对，并追加一条仅修补变更部分的系统消息。返回 `systemPrompt` 或设置 `forceSystemPrompt` 会替换整个提示词：Pi 会持久化一条 `replace: true` 的系统消息，丢弃模型原有的提示词，所有提供商随后都会将强制文本作为其起始系统提示词接收（变更时会造成缓存未命中）。工具选择的变更会同时更新提示词贡献和可执行的提供商工具；在处理器内调用 `pi.setActiveTools()` 与编辑 `selectedTools` 效果相同。支持在对话中途接收系统消息的模型会就地接收补丁并保留其缓存前缀；其他模型则会将重放的提示词作为其系统提示词接收，每次变更都会造成一次缓存未命中。

在 `before_agent_start` 内部，`event.systemPrompt` 和 `ctx.getSystemPrompt()` 都反映当前处理器为止的链式系统提示词。后续的 `before_agent_start` 处理器仍可再次修改它。

#### agent_start / agent_end / agent_settled

`agent_start` 在低级代理运行开始时触发。`agent_end` 在该运行结束时触发，但 Pi 仍可能自动重试、自动压缩并重试，或继续处理排队的追问消息。对于需要确认 Pi 不会自动继续运行的状态集成，请使用 `agent_settled`。

```typescript
pi.on("agent_start", async (_event, ctx) => {});

pi.on("agent_end", async (event, ctx) => {
  // event.messages - 本次低级运行产生的消息
});

pi.on("agent_settled", async (_event, ctx) => {
  // 除非其他扩展启动了新运行，否则此处 ctx.isIdle() 为 true
});
```

#### ui_prompt_start / ui_prompt_end

用于阻塞用户界面扩展提示的仅通知生命周期事件。这些事件在 `ctx.ui.select()`、`ctx.ui.confirm()`、`ctx.ui.input()`、`ctx.ui.editor()` 和 `ctx.ui.custom()` 调用前后触发，以便宿主/状态集成可以报告“正在等待用户”而非“正在运行”。

嵌套或重叠的提示会被合并到单个外层等待循环中。处理器以尽力而为的方式调用，在显示或关闭提示之前不会等待其完成。

```typescript
pi.on("ui_prompt_start", async (event, ctx) => {
  // event.reason === "ui_prompt"
  // event.kind: "select" | "confirm" | "input" | "editor" | "custom"
  // event.title: 可用的提示标题
});

pi.on("ui_prompt_end", async (event, ctx) => {
  // Pi 不再等待该 UI 提示循环。
});
```

#### turn_start / turn_end

每一轮（一次 LLM 响应 + 工具调用）触发。

```typescript
pi.on("turn_start", async (event, ctx) => {
  // event.turnIndex（轮次索引）、event.timestamp（时间戳）
});

pi.on("turn_end", async (event, ctx) => {
  // event.turnIndex（轮次索引）、event.message（消息）、event.toolResults（工具结果）
});
```

#### message_start / message_update / message_end

在消息生命周期更新时触发。

- `message_start` 和 `message_end` 在用户、助手和 toolResult 消息时触发。
- `message_update` 在助手流式更新时触发。
- `message_end` 处理程序可以返回 `{ message }` 以替换最终消息。替换后的消息必须保持相同的 `role`。

```typescript
pi.on("message_start", async (event, ctx) => {
  // 事件消息
});

pi.on("message_update", async (event, ctx) => {
  // 事件消息
  // 助手消息事件（逐token流式事件）
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
- `tool_execution_start` 在预检阶段按助手消息源顺序发出
- `tool_execution_update` 事件可能在不同工具之间交错出现
- `tool_execution_end` 在每个工具完成后按工具完成顺序发出
- 最终的 `toolResult` 消息事件仍会在稍后按助手消息源顺序发出

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

#### context

每次调用 LLM 之前触发。以非破坏性方式修改消息。消息类型参见[会话格式](/docs/session-format/)。

```typescript
pi.on("context", async (event, ctx) => {
  // event.messages - 深拷贝，可安全修改
  const filtered = event.messages.filter(m => !shouldPrune(m));
  return { messages: filtered };
});
```

#### before_provider_headers

在出站HTTP头部组装完成后触发。用于添加、覆盖或移除请求头。

处理器会直接修改`event.headers`。将键设为字符串以添加或覆盖，设为`null`以删除。

```typescript
pi.on("before_provider_headers", (event, ctx) => {
  // 添加或覆盖——例如用于网关追踪/归因的会话ID
  event.headers["x-session-id"] = ctx.sessionManager.getSessionId();

  // 删除pi为此调用添加的追踪头部
  event.headers["X-OpenRouter-Title"] = null;
});
```

每个提供商请求仅触发一次；重试时复用相同的请求头，而非重新触发此钩子。

#### 请求前回调

当提供商专属请求体构建完成之后、请求即将发出之前触发。处理程序按照扩展加载顺序依次执行。返回 `undefined` 则保持请求体不变；返回其他任何值则会替换请求体，供后续处理程序及实际请求使用。

该钩子可以重写提供商级别的系统指令，也可以完全移除这些指令。但这些基于请求体的更改不会反映在 `ctx.getSystemPrompt()` 中，该方法返回的是 Pi 的系统提示词字符串，而非最终序列化后的提供商请求体。

```typescript
pi.on("before_provider_request", (event, ctx) => {
  console.log(JSON.stringify(event.payload, null, 2));

  // 可选的：替换请求体
  // return { ...event.payload, temperature: 0 };
});
```

该钩子主要用于调试提供商的序列化与缓存行为。

#### after_provider_response

在收到 HTTP 响应后、流式响应体被消费前触发。处理器按扩展加载顺序执行。

```typescript
pi.on("after_provider_response", (event, ctx) => {
  // event.status - HTTP 状态码
  // event.headers - 标准化响应头
  if (event.status === 429) {
    console.log("请求被限流", event.headers["retry-after"]);
  }
});
```

响应头是否可用取决于提供商和传输方式。抽象 HTTP 响应的提供商可能不会暴露响应头。

### 模型事件

#### 模型选择

当通过 `/model` 命令、循环切换模型（`Ctrl+P`）或恢复会话时，模型发生变化触发此事件。

```typescript
pi.on("model_select", async (event, ctx) => {
  // event.model - 新选中的模型
  // event.previousModel - 上一个模型（首次选择时为 undefined）
  // event.source - "set"（设置）| "cycle"（循环）| "restore"（恢复）

  const prev = event.previousModel
    ? `${event.previousModel.provider}/${event.previousModel.id}`
    : "none";
  const next = `${event.model.provider}/${event.model.id}`;

  ctx.ui.notify(`模型已更改（${event.source}）：${prev} -> ${next}`, "info");
});
```

当活动模型发生变化时，使用此事件更新界面元素（状态栏、页脚）或执行特定于模型的初始化。

#### thinking_level_select

当思维层级变化时触发。此事件仅用于通知；处理函数的返回值会被忽略。

```typescript
pi.on("thinking_level_select", async (event, ctx) => {
  // event.level - 新选择的思维层级
  // event.previousLevel - 之前的思维层级

  ctx.ui.setStatus("thinking", `thinking: ${event.level}`);
});
```

当 `pi.setThinkingLevel()`、模型变更或内置思维层级控件改变当前思维层级时，可使用此事件更新扩展的用户界面。

### 工具事件

#### tool_call

在`tool_execution_start`之后、工具执行之前触发。**可以阻塞。** 使用`isToolCallEventType`来缩小事件类型并获取类型化输入。

在`tool_call`运行之前，pi会等待先前发出的Agent事件通过`AgentSession`完成排空。这意味着`ctx.sessionManager`会更新到当前助手工具调用消息为止。

在默认的并行工具执行模式下，来自同一助手消息的同级工具调用会先依次进行预检，然后并发执行。`tool_call`不能保证在`ctx.sessionManager`中看到来自同一助手消息的同级工具结果。

`event.input`是可变的。在执行前直接修改它以修补工具参数。

行为保证：
- 对`event.input`的修改会影响实际的工具执行
- 后续的`tool_call`处理器会看到先前处理器所做的修改
- 修改后不会重新验证
- 通过`{ block: true, reason?: string, terminate?: boolean }`从`tool_call`的返回值控制阻塞
- `terminate`仅适用于被阻塞的调用；只有当批次中所有最终结果都是终止性的，Agent才会提前停止

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  // event.toolName - "bash"、"read"、"write"、"edit" 等
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
    console.log(`正在读取：${event.input.path}`);
  }
});
```

#### 自定义工具输入的类型

自定义工具应导出其输入类型：

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

工具执行完成后、`tool_execution_end` 以及最终工具结果消息事件发出之前触发。**可修改结果。**

在并行工具模式下，`tool_result` 与 `tool_execution_end` 可能按工具完成顺序交错出现，而最终的 `toolResult` 消息事件仍会按助手源顺序稍后发出。

`tool_result` 处理器像中间件一样链式串联：
- 处理器按扩展加载顺序运行
- 每个处理器会看到前一个处理器修改后的最新结果
- 处理器可返回部分补丁（`content`、`details`、`isError` 或 `usage`）；未包含的字段保持当前值

在处理器内部使用 `ctx.signal` 处理嵌套异步操作。这可让 Esc 取消模型调用、`fetch()` 以及扩展启动的其他支持中止的操作。

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

#### 用户 Bash 外壳

Fire 当用户执行 `!` 或 `!!` 命令时。**可拦截。**

```typescript
import { createLocalBashOperations } from "@earendil-aworks/pi";

pi.on("user_bash", (event, ctx) => {
  // event.command - bash 命令
  // event.excludeFromContext - 如果使用 !! 前缀则为 true
  // event.cwd - 工作目录

  // 选项 1：提供自定义操作（例如，SSH）
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

返回 `undefined` 会继续传递给下一个处理器，若无任何处理器处理该事件，则最终执行本地命令。一个有效的结果会停止传播：`operations` 通过提供的后端执行命令，而 `result` 则记录已完成命令而不执行它。

### 输入事件

---
title: 输入事件流
description: 在输入解析为提示词并通过外壳处理前，拦截该输入。
keywords: 扩展，输入，事件，变换，处理，路由
---

## 输入事件流

在输入解析为提示词并通过外壳处理前，进行拦截。

**处理顺序：**

1. 首先检查扩展命令（`/cmd`）——若找到，则运行处理器并跳过输入事件
2. 触发 `input` 事件——可进行拦截、变换或处理
3. 若未处理：技能命令（`/skill:name`）展开为技能内容
4. 若未处理：提示词模板（`/template`）展开为模板内容
5. 代理处理开始（`before_agent_start` 等）

```typescript
pi.on("input", async (event, ctx) => {
  // event.text - 原始输入（在技能/模板展开之前）
  // event.images - 附加的图片（若有）
  // event.source - "interactive"（键盘输入）、"rpc"（API）或 "extension"（通过 sendUserMessage 发送）
  // event.streamingBehavior - "steer" | "followUp" | undefined
  //   空闲时为 undefined，"steer" 用于中断流式响应，
  //   "followUp" 用于排队等待代理完成的消息

  // 变换：在展开前重写输入
  if (event.text.startsWith("?quick "))
    return { action: "transform", text: `请简要回复：${event.text.slice(7)}` };

  // 处理：无需 LLM 直接响应（扩展显示其自身的反馈）
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }

  // 按来源路由：跳过扩展注入消息的处理
  if (event.source === "extension") return { action: "continue" };

  // 在展开前拦截技能命令
  if (event.text.startsWith("/skill:")) {
    // 可进行变换、阻止或放行
  }

  return { action: "continue" };  // 默认：放行至展开阶段
});
```

**处理结果：**
- `continue` - 原样放行（若处理器未返回任何内容则为默认行为）
- `transform` - 修改文本/图片，然后继续进入展开阶段
- `handled` - 完全跳过代理（首个返回此结果的处理器优先）

变换会在各处理器之间链式传递。参见 [input-transform.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform.ts) 和 [input-transform-streaming.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/input-transform-streaming.ts) 了解支持 `streamingBehavior` 感知的路由方式。

## ExtensionContext

所有处理器都会接收到 `ctx: ExtensionContext`。

### 标题

完整代码见原文。

### ctx.mode

当前运行模式：`"tui"`、`"rpc"`、`"json"` 或 `"print"`。使用 `ctx.mode === "tui"` 来保护仅限终端的功能，例如 `custom()`、组件工厂、终端输入和直接 TUI 渲染。

### ctx.hasUI

在 TUI 和 RPC 模式下为 `true`，在打印模式（`-p`）和 JSON 模式下为 `false`。使用此变量来保护对话框方法（`select`, `confirm`, `input`, `editor`）和即发即忘方法（`notify`, `setStatus`, `setWidget`, `setTitle`, `setEditorText`），这些方法在 TUI 和 RPC 模式下均有效。在 RPC 模式下，一些 TUI 特有的方法是空操作或返回默认值（参见 [RPC 文档](rpc.md#extension-ui-protocol)）。

### ctx.cwd

当前工作目录。

在构建项目本地配置路径时，使用 `CONFIG_DIR_NAME` 而不是硬编码 `.pi`。重新品牌化的发行版可以使用不同的配置目录名称。

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

返回当前会话上下文中项目本地信任是否生效。这包括临时信任决定和 CLI 信任覆盖，而不仅仅是全局信任存储中保存的决定。

请在读取仅应针对受信任项目生效的项目本地扩展配置之前，使用此函数。

### ctx.sessionManager

对会话状态的只读访问。完整的SessionManager API和条目类型请参阅[会话格式](/docs/session-format/)。

对于 `tool_call`，该状态在处理器运行之前通过当前助手消息同步。在并行工具执行模式下，仍不保证包含来自同一助手消息的兄弟工具结果。

```typescript
ctx.sessionManager.getEntries()             // 所有条目
ctx.sessionManager.getBranch()              // 当前分支
ctx.sessionManager.buildContextEntries()    // 带有压缩功能的活动分支条目
ctx.sessionManager.getLeafId()              // 当前叶子条目ID
```

### ctx.modelRegistry / ctx.model / ctx.thinkingLevel / ctx.scopedModels

访问模型、提供商和已解析的认证。`ctx.modelRegistry.getProvider(id)` 返回有效的 pi-ai 提供商，而 `getProviderAuth(id)` 解析其当前的 API 密钥、请求头、基础 URL 和提供商作用域的环境，无需加载模型。`ctx.model` 是活动模型，`ctx.thinkingLevel` 是其当前有效的思考级别。

`ctx.scopedModels` 是限定到当前会话的模型的只读列表——与 `/scoped-models` 命令显示的集合相同。它在会话开始时从 `--models` CLI 标志和 `enabledModels` 设置中解析（使用 minimatch 在 `provider/modelId` 或裸 `modelId` 上与可用目录匹配）。当未配置作用域时，它为空，意味着所有可用模型均可使用。每个条目是 `{ model, thinkingLevel? }`，其中 `thinkingLevel` 仅在模式固定时设置（例如 `anthropic/*:high`）。使用它来填充一个镜像内置模型选择器，而非通过 `ctx.modelRegistry.getAvailable()` 枚举整个目录。

#### 流式模型调用

使用`ctx.modelRegistry.streamSimple(model, context, options)`可进行提供商无关的选项设置（如`reasoning`），或使用`stream()`处理特定于API的选项。两者均利用已配置的提供商并解决认证问题，包括通过`pi.registerProvider()`注册的提供商。应优先使用这些方法，而非`pi-ai/compat`中的流式函数，因为后者无法识别扩展的提供商注册。

这两种方法都会返回一个`AssistantMessageEventStream`。通过迭代该流来处理响应事件，并通过等待`.result()`获取最终消息。设置失败会导致错误事件和错误结果。

### ctx.signal

当前代理的中止信号，当没有代理回合处于活动状态时，则为 `undefined`。

在扩展处理器启动的嵌套工作中使用此信号以支持中止，例如：
- `fetch(..., { signal: ctx.signal })`
- 接受 `signal` 的模型调用
- 接受 `AbortSignal` 的文件或进程辅助函数

`ctx.signal` 通常在活动回合事件（如 `tool_call`、`tool_result`、`message_update` 和 `turn_end`）期间定义。
而在空闲或非回合上下文（如会话事件、扩展命令以及在 pi 空闲时触发的快捷键）中，它通常为 `undefined`。

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

控制流辅助函数。当 Pi 正在处理代理运行、自动重试、自动压缩重试或排队中的后续操作时，`ctx.isIdle()` 返回 `false`。

### ctx.shutdown()

请求优雅关闭 pi。

- **交互模式：** 推迟到代理空闲时（在处理完所有排队的引导和追问消息之后）。
- **RPC 模式：** 推迟到下一个空闲状态（在完成当前命令响应之后，等待下一条命令时）。
- **打印模式：** 无操作。当所有提示词处理完后进程自动退出。

退出前向所有扩展发出 `session_shutdown` 事件。在所有上下文（事件处理器、工具、命令、快捷键）中可用。

```typescript
pi.on("tool_call", (event, ctx) => {
  if (isFatal(event.input)) {
    ctx.shutdown();
  }
});
```

### ctx.getContextUsage()

返回当前模型的上下文使用情况。在可用时会使用最近的助手用量，然后估算尾部消息的令牌数。

```typescript
const usage = ctx.getContextUsage();
if (usage && usage.tokens > 100_000) {
  // ...
}
```

### ctx.compact()

触发压缩而不等待完成。使用 `onComplete` 和 `onError` 执行追问操作。

```typescript
ctx.compact({
  customInstructions: "关注最近的更改",
  onComplete: (result) => {
    ctx.ui.notify("压缩已完成", "info");
  },
  onError: (error) => {
    ctx.ui.notify(`压缩失败: ${error.message}`, "error");
  },
});
```

### ctx.getSystemPrompt()

返回 Pi 当前的系统提示词字符串。

- 在 `before_agent_start` 期间，这反映了当前回合到目前为止已进行的链式系统提示词更改。
- 它不包括之后的 `context` 消息修改。
- 它不包括 `before_provider_request` 负载重写。
- 如果在您的扩展之后加载的扩展仍在运行，它们仍可能更改最终发送的内容。

```typescript
pi.on("before_agent_start", (event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  console.log(`系统提示词长度: ${prompt.length}`);
});
```

## ExtensionCommandContext

命令处理器接收 `ExtensionCommandContext`，它通过会话控制方法扩展了 `ExtensionContext`。这些方法仅在命令中可用，因为如果从事件处理器中调用，可能会导致死锁。

### ctx.getSystemPromptOptions()

返回 Pi 当前用于构建系统提示词的基础输入。

```typescript
const options = ctx.getSystemPromptOptions();
const contextPaths = options.contextFiles?.map((file) => file.path) ?? [];
```

该函数返回的对象与 `before_agent_start` 事件的 `event.systemPromptOptions` 具有相同的结构和可变性：包含自定义或强制提示词、活动工具、工具片段、按工具和自定义规则、自定义小节、附加提示词文本、当前工作目录（cwd）、已加载的上下文文件以及已加载的技能。该返回值可能包含完整的上下文文件内容，请将其视为敏感的扩展本地数据，避免通过命令列表、日志或自动补全元数据暴露。

此函数报告的是当前的基础提示词输入，不包括每次对话轮次中 `before_agent_start` 链式系统提示词变更、后续 `context` 事件的消息修改，以及 `before_provider_request` 负载重写。

### ctx.waitForIdle()

等待代理完全稳定，包括自动重试、自动压缩重试和排队的延续操作：

```typescript
pi.registerCommand("my-cmd", {
  handler: async (args, ctx) => {
    await ctx.waitForIdle();
    // 代理现在已空闲，可以安全地修改会话
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
    // 仅在此处使用替换会话的 ctx。
    await ctx.sendUserMessage(kickoff);
  },
});

if (result.cancelled) {
  // 一个扩展取消了新会话
}
```

选项：
- `parentSession`：父会话文件，用于记录在新会话标头中
- `setup`：在 `withSession` 运行之前，修改新会话的 `SessionManager`
- `withSession`：使用全新的替换会话上下文执行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见 [会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.fork(entryId, options?)

从特定条目分叉，创建一个新的会话文件：

```typescript
const result = await ctx.fork("entry-id-123", {
  withSession: async (ctx) => {
    // 此处仅使用替换会话的 ctx。
    ctx.ui.notify("现在处于分叉会话中", "info");
  },
});
if (result.cancelled) {
  // 一个扩展取消了分叉
}

const cloneResult = await ctx.fork("entry-id-456", { position: "at" });
if (cloneResult.cancelled) {
  // 一个扩展取消了克隆
}
```

选项：
- `position`：`"before"`（默认）在选定的用户消息之前分叉，将该提示词恢复到编辑器中。
- `position`：`"at"` 复制通过选定条目的活动路径，而不恢复编辑器文本。
- `withSession`：针对新的替换会话上下文运行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；参见[会话替换生命周期和陷阱](#session-replacement-lifecycle-and-footguns)。

### ctx.navigateTree(targetId, options?)

在会话树中导航至不同节点。当代理响应、手动或自动压缩、或另一个树导航活动正在进行时，该操作会被拒绝执行，即使使用`summarize: false`也不例外。这些冲突会保持活动分支不变，并拒绝promise，而不是返回`{ cancelled: true }`。请等待活动操作完成（例如，在命令处理器中使用`await ctx.waitForIdle()`）后重试：

```typescript
const result = await ctx.navigateTree("entry-id-456", {
  summarize: true,
  customInstructions: "聚焦于错误处理更改",
  replaceInstructions: false, // true = 完全替换默认提示
  label: "review-checkpoint",
});
```

选项：
- `summarize`：是否生成废弃分支的摘要
- `customInstructions`：为摘要器提供的自定义指令
- `replaceInstructions`：如果为true，`customInstructions`将完全替换默认提示，而非追加
- `label`：附加到分支摘要条目（若无摘要，则附加到目标条目）的标签

> 完整代码见英文原文。

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
- `withSession`：使用新的替换会话上下文运行切换后的工作。不要使用捕获的旧 `pi` / 命令 `ctx`；请参阅 [会话替换生命周期与陷阱](#session-replacement-lifecycle-and-footguns)。

要发现可用会话，请使用静态方法 `SessionManager.list()` 或 `SessionManager.listAll()`：

```typescript
import { SessionManager } from "@earendil-works/pi-coding-agent";

pi.registerCommand("switch", {
  description: "Switch to another session",
  handler: async (args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    if (sessions.length === 0) return;
    const choice = await ctx.ui.select(
      "Pick session:",
      sessions.map(s => s.file),
    );
    if (choice) {
      await ctx.switchSession(choice, {
        withSession: async (ctx) => {
          ctx.ui.notify("Switched session", "info");
        },
      });
    }
  },
});
```

### 会话替换生命周期与易踩的坑

`withSession` 接收一个全新的 `ReplacedSessionContext`，它通过绑定到替换会话的异步 `sendMessage()` 和 `sendUserMessage()` 辅助方法扩展了 `ExtensionCommandContext`。

生命周期与易踩的坑：
- `withSession` 仅在旧会话已发出 `session_shutdown`、旧运行时已拆除、替换会话已重新绑定，且新扩展实例已经收到 `session_start` 之后才运行。
- 回调仍然在原始闭包中执行，而不是在新扩展实例内部。这意味着在 `withSession` 启动之前，你的旧扩展实例可能已经执行了其关闭清理。
- 捕获的旧 `pi` / 旧命令 `ctx` 会话绑定对象在替换后已经失效，如果使用会抛出异常。仅使用传递给 `withSession` 的 `ctx` 进行会话绑定工作。
- 之前提取的原始对象仍由你负责。例如，如果在替换之前捕获 `const sm = ctx.sessionManager`，`sm` 仍然是旧的 `SessionManager` 对象。替换后不要重复使用它。
- `withSession` 中的代码应假定任何已被你的 `session_shutdown` 处理器失效的状态都已经不存在。只捕获能够干净地跨会话存活的纯数据，例如字符串、ID 和序列化配置。

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
        // 陈旧的旧对象：不要这样做
        oldSessionManager.getSessionFile();
        pi.sendUserMessage("错误");
      },
    });
  },
});
```

### ctx.reload()

执行与 `/reload` 相同的重新加载流程。

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, themes, and context files",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

重要行为：
- `await ctx.reload()` 为当前扩展运行时发出 `session_shutdown`
- 随后重新加载资源，并以 `reason: "reload"` 发出 `session_start`，以 `reason: "reload"` 发出 `resources_discover`
- 当前正在运行的命令处理器仍会在旧调用帧中继续执行
- `await ctx.reload()` 之后的代码仍以重新加载前的版本运行
- `await ctx.reload()` 之后的代码不得假定旧的内存中扩展状态仍然有效
- 处理器返回后，后续的命令/事件/工具调用将使用新版本的扩展

为保证行为可预测，请将重新加载视为该处理器的终态（`await ctx.reload(); return;`）。

工具使用 `ExtensionContext` 运行，因此无法直接调用 `ctx.reload()`。请以命令作为重新加载的入口，再暴露一个工具，将该命令排队为追问用户消息。

LLM 可调用以触发重新加载的示例工具：

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

## 扩展API 方法

### pi.on(event, handler)

订阅事件。查看 [事件](#events) 了解事件类型和返回值。

### pi.registerTool(definition)

注册一个可供 LLM 调用的自定义工具。完整细节参见 [自定义工具](#custom-tools)。

`pi.registerTool()` 既可在扩展加载期间调用，也可在启动后调用。你可以在 `session_start`、命令处理器或其他事件处理器中调用它。新工具会在同一会话中立即刷新，因此它们会出现在 `pi.getAllTools()` 中，并可在无需 `/reload` 的情况下被 LLM 调用。

使用 `pi.setActiveTools()` 可在运行时启用或禁用工具（包括动态添加的工具）。

使用 `promptSnippet` 将自定义工具以单行条目形式纳入 `可用工具`，使用 `promptGuidelines` 在工具激活时向默认 `指南` 部分追加工具专属的要点。

**重要提示：** `promptGuidelines` 中的要点会直接平铺追加到 `指南` 部分，不附带工具名前缀。每条指南必须明确指出其所指的工具——避免使用“使用此工具时……”这类表述，因为 LLM 无法判断“此工具”具体指哪个。应改为“使用 my_tool 时……”。

完整示例参见 [dynamic-tools.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/dynamic-tools.ts)。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "这个工具的作用",
  promptSnippet: "根据操作对文本进行摘要或转换",
  promptGuidelines: ["当用户要求对先前生成的文本进行摘要时，使用 my_tool。"],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // 可选兼容性垫片。在模式校验之前运行。
    // 返回当前模式的结构，例如将旧字段折叠到新参数对象中。
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // 流式输出进度
    onUpdate?.({ content: [{ type: "text", text: "处理中..." }] });

    return {
      content: [{ type: "text", text: "完成" }],
      details: { result: "..." },
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

### pi.sendMessage(message, options?)

向会话中注入自定义消息。自定义消息会参与 LLM 上下文。对于不应发送至 LLM 的持久化 TUI 专用内容，请使用 [`pi.appendEntry()`](#piappendentrycustomtype-data) 配合 [`pi.registerEntryRenderer()`](#piregisterentryrenderercustomtype-renderer)。

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
- `deliverAs` - 交付模式：
  - `"steer"`（默认）- 在流式输出期间将消息排队。在当前助手的回合完成其工具调用后、下一次 LLM 调用之前交付。
  - `"followUp"` - 等待代理完成。仅在代理没有更多工具调用时交付。
  - `"nextTurn"` - 排队等待下一个用户提示。不中断或触发任何操作。
- `triggerTurn: true` - 如果代理处于空闲状态，立即触发 LLM 响应。仅适用于 `"steer"` 和 `"followUp"` 模式（对 `"nextTurn"` 忽略）。

### pi.sendUserMessage(content, options?)

向代理发送一条用户消息。与 `sendMessage()` 发送自定义消息不同，此方法发送的是实际用户消息，看起来就像用户自行输入一样。始终会触发一个回合（turn）。

```typescript
// 简单文本消息
pi.sendUserMessage("What is 2+2?");

// 使用内容数组（文本+图片）
pi.sendUserMessage([
  { type: "text", text: "Describe this image:" },
  { type: "image", source: { type: "base64", mediaType: "image/png", data: "..." } },
]);

// 流式传输期间 - 必须指定传递模式
pi.sendUserMessage("Focus on error handling", { deliverAs: "steer" });
pi.sendUserMessage("And then summarize", { deliverAs: "followUp" });

// 选择启用扩展命令分发及技能/提示词模板扩展
pi.sendUserMessage("/review src/index.ts", { expandPromptTemplates: true });
```

**选项：**
- `deliverAs` - 当代理正在流式传输时必填：
  - `"steer"` - 将消息排队，待当前助手回合完成工具调用后发送
  - `"followUp"` - 等待代理完成所有工具操作
- `expandPromptTemplates` - 分发扩展命令并扩展技能命令及提示词模板。默认为 `false`。

未流式传输时，消息会立即发送并触发新回合。若处于流式传输状态但未指定 `deliverAs`，则会抛出错误。

完整示例见[发送用户消息示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/send-user-message.ts)。

### pi.appendEntry(customType, data?)

持久化扩展数据。自定义条目不参与 LLM 上下文。在交互模式下，当与 `pi.registerEntryRenderer()` 配对时，它们也可以在聊天记录中渲染。

```typescript
pi.appendEntry("my-state", { count: 42 });
pi.appendEntry("status-card", { title: "Indexed files", count: 17 });

// 重新加载时恢复
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // 从 entry.data 重构
    }
  }
});
```

### pi.setSessionName(name)

设置会话显示名称（在会话选择器中显示，而非第一条消息）。

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

### pi.setLabel(entryId, label)

在条目上设置或清除标签。标签是用户自定义的标记，用于书签标记和导航（显示在 `/tree` 选择器中）。

```typescript
// 设置标签
pi.setLabel(entryId, "checkpoint-before-refactor");

// 清除标签
pi.setLabel(entryId, undefined);

// 通过 sessionManager 读取标签
const label = ctx.sessionManager.getLabel(entryId);
```

标签在会话中持久保存，并在重启后仍然保留。使用它们来标记对话树中的重要点（轮次、检查点）。

### pi.registerCommand(name, options)

注册一个命令。

如果多个扩展注册了相同的命令名，pi 会保留所有这些命令，并按加载顺序分配带数字的后缀来调用，例如 `/review:1` 和 `/review:2`。

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

获取当前会话中可通过 `prompt` 调用的斜杠命令。包括扩展命令、提示词模板和技能命令。
返回列表的顺序与 RPC `get_commands` 一致：先扩展，后模板，再技能。

```typescript
const commands = pi.getCommands();
const bySource = commands.filter((command) => command.source === "extension");
const userScoped = commands.filter((command) => command.sourceInfo.scope === "user");
```

每个条目结构如下：

```typescript
{
  name: string; // 可调用的命令名称，不含前导斜杠。可能带后缀，如 "review:1"
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

请将 `sourceInfo` 作为权威来源字段。不要从命令名或临时路径解析中推断来源归属。

内置交互式命令（如 `/model` 和 `/settings`）不包含在此列表中。它们仅在交互模式下处理，通过 `prompt` 发送不会执行。

### pi.registerMessageRenderer(customType, renderer)

注册一个自定义TUI渲染器，用于带有你的`customType`的自定义消息。自定义消息通过`pi.sendMessage()`创建，并参与LLM上下文。参见[自定义界面](#custom-ui)。

### pi.registerMarkdownTransformer(transformer)

为普通用户文本、助手文本和思考块中的 Markdown 注册一个转换器。转换器按扩展加载顺序运行，每个转换器接收上一个转换器返回的 Markdown。链条完成后，Pi 使用其内置渲染器渲染转换后的内容。

转换器接收 Markdown 字符串和一个包含以下内容的对象：

- `messageType` — `"user"`、`"assistant"` 或 `"assistant-thinking"`
- `isStreaming` — 对部分助手更新为 `true`；对用户、最终确定的助手和恢复的消息为 `false`
- `availableWidth` — 转换后的 Markdown 内容可用的精确终端列数

返回转换后的 Markdown：

```typescript
pi.registerMarkdownTransformer((markdown, { messageType, isStreaming }) => {
  if (isStreaming || messageType === "assistant-thinking") return markdown;
  return markdown.replaceAll("-->", "→");
});
```

如果某个转换器抛出异常，Pi 会保留目前已生成的 Markdown 并继续执行下一个转换器。该挂钩仅用于显示：原始消息在会话和模型上下文中保持不变。它会在新用户消息、助手流式更新、恢复的会话消息和终端宽度变化时运行，因此转换器应保持同步且开销较小。

### pi.registerEntryRenderer(customType, renderer)

为你的 `customType` 自定义条目注册一个自定义TUI渲染器。自定义条目通过 `pi.appendEntry()` 创建，不参与 LLM 上下文。

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

注册一个键盘快捷键。关于快捷键格式和内置键位绑定，请参阅 [keybindings.md](/docs/keybindings/)。

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

执行一个 shell 命令。

```typescript
const result = await pi.exec("git", ["status"], { signal, timeout: 5000 });
// result.stdout, result.stderr, result.code, result.killed
```

### pi.getActiveTools() / pi.getAllTools() / pi.setActiveTools(names)

管理活动工具。这既适用于内置工具，也适用于动态注册的工具。`pi.getActiveTools()` 返回当前活动工具名称，类型为 `string[]`；`pi.getAllTools()` 返回所有已配置工具的元数据。

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
pi.setActiveTools(["read", "bash"]); // 切换到只读模式
```

`pi.getAllTools()` 返回 `name`、`description`、`parameters`、`promptGuidelines` 和 `sourceInfo` 字段。

常见的 `sourceInfo.source` 取值：

- `builtin` — 内置工具
- `sdk` — 通过 `createAgentSession({ customTools })` 传入的工具
- 扩展源元数据 — 由扩展注册的工具

### pi.setModel(model)

为当前会话设置模型。该更改会记录在会话历史中，并在该会话恢复时应用，但不会改变新会话使用的已配置 `defaultProvider` 或 `defaultModel`。如果模型的提供商未配置认证，则返回 `false`。有关自定义模型的配置，请参阅 [models.md](/docs/models/)。

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) {
    ctx.ui.notify("No API key for this model", "error");
  }
}
```

### pi.getThinkingLevel() / pi.setThinkingLevel(level)

获取当前的思考级别。该级别会被限制在模型能力范围内（非推理模型始终使用`"off"`）。更改时会触发`thinking_level_select`事件。

`pi.setThinkingLevel()`更改当前会话的思考级别。该更改会记录在会话历史中，并在恢复该会话时还原，但不会更改新会话使用的配置默认值。

```typescript
const current = pi.getThinkingLevel();  // "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"
pi.setThinkingLevel("high");
```

### pi.events

供扩展之间通信使用的共享事件总线：

```typescript
pi.events.on("my:event", (data) => { ... });
pi.events.emit("my:event", { ... });
```

### pi.registerProvider(name, config)

动态注册或覆盖模型提供商。适用于代理、自定义端点或团队级模型配置。

在外壳工厂函数执行期间进行的调用会被排队，并在运行器初始化时应用。此后的调用——例如用户设置流程后从命令处理器发出的调用——会立即生效，无需 `/reload`。

动态提供商可以实现 `refreshModels`。Pi 会在模型刷新期间调用它，通过提供商同步发布返回的列表，并传递规范的凭据/存储目录/网络/信号上下文。扩展通过生成检查的 `context.publish({ persist: entry })` 决定是否持久化目录元数据；诸如 llama.cpp 之类的实时服务器可以返回模型而无需持久化它们。

`context.signal` 始终是一个具体的信号，提供商回调必须将其传递给阻塞式 I/O。公共的 `ModelRuntime.refresh()` 和 `ModelRegistry.refresh()` 调用接受可选信号，省略时无界；扩展和应用程序自行选择截止时间。即使提供商忽略信号，取消也会停止调用方等待，但仍需协作才能停止底层工作。

需要原生提供商认证、过滤、刷新或流行为的扩展可以从 `@earendil-works/pi-ai` 注册完整的 `Provider`。该提供商成为组合基础，`models.json` 覆盖仍在其之上生效。

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
- `name` - 提供商在 UI（如 `/login`）中显示的名称。
- `baseUrl` - API 端点 URL。定义模型时为必填。
- `apiKey` - API 密钥字面量、环境变量插值（`$ENV_VAR` 或 `${ENV_VAR}`），或前导 `!command`。定义模型时为必填（除非提供了 `oauth`）。`$$` 转义 `$`，`$!` 转义字面量 `!` 而不触发命令执行。
- `api` - API 类型：`"anthropic-messages"`、`"openai-completions"`、`"openai-responses"` 等。
- `headers` - 包含在请求中的自定义标头。
- `authHeader` - 若为 true，自动添加 `Authorization: Bearer` 标头。
- `models` - 模型定义数组。若提供，则替换该提供商的所有现有模型。模型定义可设置 `baseUrl` 以覆盖该模型的提供商端点。
- `refreshModels` - 异步动态发现回调。其返回的模型替换扩展提供的模型。`context.stored` 包含持久化的提供商快照；仅在更新的目录数据应持久化时使用生成检查的 `context.publish({ persist: entry })`。使用 `persist: null` 删除该快照。
- `oauth` - 用于 `/login` 支持的 OAuth 提供商配置。提供时，该提供商出现在登录菜单中。
- `streamSimple` - 用于非标准 API 的自定义流实现。

高级主题（自定义流 API、OAuth 细节、模型定义参考）参见 [custom-provider.md](/docs/custom-provider/)。

### pi.unregisterProvider(name)

移除先前注册的提供商及其模型。由该提供商覆盖的内置模型将被恢复。若提供商未注册，则此操作无效。

与 `registerProvider` 类似，在初始加载阶段之后调用时，此操作会立即生效，因此无需 `/reload`。

```typescript
pi.registerCommand("my-setup-teardown", {
  description: "移除自定义代理提供商",
  handler: async (_args, _ctx) => {
    pi.unregisterProvider("my-proxy");
  },
});
```

## 状态管理

有状态的扩展应将状态存储在工具结果的 `details` 中，以确保正确的分支支持：

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
        content: [{ type: "text", text: "已添加" }],
        details: { items: [...items] },  // 存储供重建
      };
    },
  });
}
```

## 自定义工具

通过 `pi.registerTool()` 注册可供 LLM 调用的工具。工具会显示在系统提示中，并支持自定义渲染。

使用 `promptSnippet` 在默认系统提示的 `可用工具` 部分添加简短的单行条目。若省略，自定义工具将不会出现在该部分。

使用 `promptGuidelines` 为默认系统提示的 `指南` 部分添加工具专属要点。这些要点仅在工具处于活动状态时包含（例如，在 `pi.setActiveTools([...])` 之后）。

**重要提示：** `promptGuidelines` 要点会平铺追加到 `指南` 部分，不带工具名称前缀或分组。每条指南必须指明其涉及的工具——请避免使用“使用此工具时……”这类表述，因为 LLM 无法判断“此工具”具体指哪个。应改为“使用 my_tool 时……”。

注意：部分模型不够智能，会在工具路径参数中包含 @ 前缀。内置工具在解析路径前会去除开头的 @。如果你的自定义工具接受路径参数，也请同样规范化开头的 @。

如果自定义工具会修改文件，请使用 `withFileMutationQueue()`，使其与内置的 `edit` 和 `write` 工具参与相同的按文件队列。这很重要，因为工具调用默认并行执行。没有队列时，两个工具可能读取到相同旧文件内容，计算出不同更新，最终后写入的一方覆盖另一方。

失败案例：你的自定义工具编辑 `foo.ts`，而同一次助手交互中内置 `edit` 也修改了 `foo.ts`。如果工具不参与队列，两者可能都读取了原始 `foo.ts`，分别应用各自修改，导致其中一处修改丢失。

请将真实目标文件路径传给 `withFileMutationQueue()`，而非原始用户参数。先基于 `ctx.cwd` 或工具工作目录将路径解析为绝对路径。对于已存在的文件，该辅助函数会通过 `realpath()` 进行规范化，因此同一文件的符号链接别名共享同一队列。对于新文件，由于尚未存在可供 `realpath()` 解析的内容，它会回退到解析后的绝对路径。

将整个修改窗口排入该目标路径的队列，这包括读-改-写逻辑，而不仅仅是最终的写操作。

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
  label: "My Tool",
  description: "该工具的功能描述（展示给大语言模型）",
  promptSnippet: "列出或添加项目待办列表中的条目",
  promptGuidelines: [
    "当用户请求任务清单时，请使用 my_tool 进行待办规划，而非直接编辑文件。"
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

    // 流式更新进度
    onUpdate?.({
      content: [{ type: "text", text: "处理中..." }],
      details: { progress: 50 },
    });

    // 通过 pi.exec 运行命令（由扩展闭包捕获）
    const result = await pi.exec("some-command", [], { signal });

    // 返回结果
    return {
      content: [{ type: "text", text: "完成" }],  // 发送给大语言模型
      details: { data: result },                   // 用于渲染和状态
      // usage: nestedModelResponse.usage,          // 可选：嵌套大语言模型调用用量
      // 可选：当该批次中每个已完成的工具结果都返回 terminate: true 时，
      // 在本次工具批次后停止。
      terminate: true,
    };
  },

  // 可选：自定义渲染
  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
});
```

**用量统计：** 如果工具进行了嵌套的大语言模型调用，请将其合并后的 `Usage` 作为 `usage` 返回。Pi 会将其持久化到工具结果上，并计入页脚、`/session` 和 RPC 会话总计中。`tool_result` 处理器可以检查或替换该值。

**错误信号：** 要将工具执行标记为失败（在结果上设置 `isError: true` 并报告给大语言模型），请从 `execute` 中抛出错误。无论返回对象中包含哪些属性，返回值本身不会设置错误标记。

**提前终止：** 从 `execute()` 返回 `terminate: true` 可提示在当前工具批次之后跳过自动追问的大语言模型调用。仅当该批次中每个已完成的工具结果都返回终止标记时才生效。参见 [examples/extensions/structured-output.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/structured-output.ts) 获取最小示例——智能体在最终的结构化输出工具调用后结束。

```typescript
// 正确：抛错以发出错误信号
async execute(toolCallId, params) {
  if (!isValid(params.input)) {
    throw new Error(`无效输入：${params.input}`);
  }
  return { content: [{ type: "text", text: "OK" }], details: {} };
}
```

**重要：** 字符串枚举请使用 `@earendil-works/pi-ai` 中的 `StringEnum`。`Type.Union`/`Type.Literal` 不适用于 Google 的 API。

**参数准备：** `prepareArguments(args)` 是可选的。若已定义，它会在模式验证之前、`execute()` 之前运行。当 pi 恢复一个较旧的会话，存储的工具调用参数与当前模式不再匹配时，可使用它来模拟旧的已接受输入形状。返回你希望用 `parameters` 验证的对象。保持公共模式严格。不要仅为让旧的已恢复会话继续工作而将已弃用的兼容字段添加到 `parameters` 中。

示例：一个较旧的会话可能包含一个带有顶层 `oldText` 和 `newText` 的 `edit` 工具调用，而当前模式只接受 `edits: [{ oldText, newText }]`。

```typescript
pi.registerTool({
  name: "edit",
  label: "Edit",
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
      content: [{ type: "text", text: `正在应用 ${params.edits.length} 个编辑块` }],
      details: {},
    };
  },
});
```

### 覆盖内置工具

扩展可以通过注册同名工具来覆盖内置工具（`read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`）。交互模式在此情况下会显示警告。

```bash
# 扩展的 read 工具替换内置的 read
pi -e ./tool-override.ts
```

或者，使用 `--no-builtin-tools` 启动，不带任何内置工具，同时保持扩展工具启用：
```bash
# 无内置工具，仅扩展工具
pi --no-builtin-tools -e ./my-extension.ts
```

完整的覆盖 `read` 并添加日志记录与访问控制的示例，参见 [examples/extensions/tool-override.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts)。

**渲染：** 内置渲染器的继承按插槽（slot）分别解析。执行覆盖与渲染覆盖相互独立。如果你的覆盖省略了 `renderCall`，则使用内置的 `renderCall`。如果省略了 `renderResult`，则使用内置的 `renderResult`。如果两者都省略，则自动使用内置渲染器（语法高亮、差异对比等）。这使你可以包装内置工具以进行日志记录或访问控制，而无需重新实现 UI。

**提示词元数据：** `promptSnippet` 和 `promptGuidelines` 不会从内置工具继承。如果你的覆盖需要保留这些提示词指令，请在覆盖中显式定义。

**你的实现必须匹配精确的结果结构**，包括 `details` 类型。UI 和会话逻辑依赖这些结构进行渲染和状态跟踪。

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

内置工具支持可插拔操作，用于委托给远程系统（SSH、容器等）执行：

```typescript
import { createReadTool, createBashTool, type ReadOperations } from "@earendil-works/pi-coding-agent";

// 创建带自定义操作的工具
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

`createBashTool()` 和 `createPowerShellTool()` 通过 `PI_SESSION_ID`、`PI_SESSION_FILE`、`PI_PROVIDER`、`PI_MODEL` 和 `PI_REASONING_LEVEL` 将会话暴露给命令。注入发生在 `spawnHook` 之前，因此钩子能在 `env` 中接收到这些值，并在如上述示例中展开现有环境时予以保留。设置 `exposeSessionEnvironment: false` 可禁用它们：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
});
```

变量语义参见 [Shell 工具会话环境](environment-variables.md#shell-tool-session-environment)。完整的 SSH 示例（含 `--ssh` 标志）参见 [examples/extensions/ssh.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/ssh.ts)。

### 输出截断

**工具必须截断其输出**，以避免压倒LLM上下文。过大的输出可能导致：
- 上下文溢出错误（提示词过长）
- 压缩失败
- 模型性能下降

内置限制为 **50KB**（约1万token）和 **2000行**，以先触达者为准。使用导出的截断工具：

```typescript
import {
  truncateHead,      // 保留前N行/字节（适用于文件读取、搜索结果）
  truncateTail,      // 保留后N行/字节（适用于日志、命令输出）
  truncateLine,      // 将单行截断至maxBytes并添加省略号
  formatSize,        // 人类可读的大小（如："50KB"、"1.5MB"）
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
    result += ` (${formatSize(truncation.outputBytes)} / ${formatSize(truncation.totalBytes)})。`;
    result += ` 完整输出已保存至：${tempFile}]`;
  }

  return { content: [{ type: "text", text: result }] };
}
```

**关键要点：**
- 当开头内容重要时使用 `truncateHead`（搜索结果、文件读取）
- 当结尾内容重要时使用 `truncateTail`（日志、命令输出）
- 输出被截断时务必告知LLM，并提供完整版本的获取位置
- 在工具描述中注明截断限制

完整的 `rg`（ripgrep）包装示例及正确的截断处理，请参阅 [examples/extensions/truncated-tool.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/truncated-tool.ts)。

### 多个工具

一个扩展可以注册多个工具，并共享状态：

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

工具可以提供 `renderCall` 和 `renderResult` 来实现自定义 TUI 显示。完整的组件 API 参见 [tui.md](/docs/tui/)，工具行的组成方式参见 [tool-execution.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/components/tool-execution.ts)。

默认情况下，工具输出被包裹在一个负责内边距和背景的 `Box` 中。定义了 `renderCall` 或 `renderResult` 时必须返回一个 `Component`。如果某个槽位的渲染器未定义，`tool-execution.ts` 会为该槽位使用回退渲染。

当工具应自行渲染其外壳而非使用默认的 `Box` 时，设置 `renderShell: "self"`。这对于需要完全控制边框或背景行为的工具非常有用，例如在工具稳定后必须保持视觉稳定的大型预览。

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Custom shell example",
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

`renderCall` 和 `renderResult` 各自接收一个 `context` 对象，包含：
- `args` - 当前工具调用参数
- `state` - 跨 `renderCall` 和 `renderResult` 共享的行级局部状态
- `lastComponent` - 该槽位先前返回的组件（如有）
- `invalidate()` - 请求重新渲染该工具行
- `toolCallId`、`cwd`、`executionStarted`、`argsComplete`、`isPartial`、`expanded`、`showImages`、`isError`

使用 `context.state` 实现跨槽位的共享状态。当需要跨渲染复用和修改同一组件时，将槽位局部缓存保存在返回的组件实例上。

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
    return new Text(theme.fg("warning", "处理中..."), 0, 0);
  }

  if (result.details?.error) {
    return new Text(theme.fg("error", `错误: ${result.details.error}`), 0, 0);
  }

  let text = theme.fg("success", "✓ 完成");
  if (expanded && result.details?.items) {
    for (const item of result.details.items) {
      text += "\n  " + theme.fg("dim", item);
    }
  }
  return new Text(text, 0, 0);
}
```

如果某个槽位有意不展示可见内容，可返回一个空的 `Component`，例如空的 `Container`。

#### 按键绑定提示

使用 `keyHint()` 显示遵循当前按键绑定配置的快捷键提示：

```typescript
import { keyHint } from "@earendil-works/pi-coding-agent";

renderResult(result, { expanded }, theme, context) {
  let text = theme.fg("success", "✓ Done");
  if (!expanded) {
    text += ` (${keyHint("app.tools.expand", "to expand")})`;
  }
  return new Text(text, 0, 0);
}
```

可用函数：
- `keyHint(keybinding, description)` - 格式化已配置的按键绑定 ID，例如 `"app.tools.expand"` 或 `"tui.select.confirm"`
- `keyText(keybinding)` - 返回按键绑定 ID 对应的原始配置按键文本
- `rawKeyHint(key, description)` - 格式化原始按键字符串

使用命名空间化的按键绑定 ID：
- 编码代理 ID 使用 `app.*` 命名空间，例如 `app.tools.expand`、`app.editor.external`、`app.session.rename`
- 共享 TUI ID 使用 `tui.*` 命名空间，例如 `tui.select.confirm`、`tui.select.cancel`、`tui.input.tab`

有关按键绑定 ID 及默认值的完整列表，请参阅 [keybindings.md](/docs/keybindings/)。`keybindings.json` 使用相同的命名空间化 ID。

自定义编辑器及 `ctx.ui.custom()` 组件会收到 `keybindings: KeybindingsManager` 作为注入参数。它们应直接使用注入的管理器，而不应调用 `getKeybindings()` 或 `setKeybindings()`。

#### 最佳实践

- 使用带内边距 `(0, 0)` 的 `Text`。默认的 `Box` 会处理内边距。
- 对于多行内容，使用 `\n`。
- 处理 `isPartial` 以支持流式进度。
- 支持 `expanded` 以实现按需展开详细信息。
- 保持默认视图紧凑。
- 在 `renderResult` 中读取 `context.args`，而不是将参数复制到 `context.state` 中。
- 仅在必须跨调用和结果槽共享数据时，才使用 `context.state`。
- 当同一组件实例可以就地更新时，复用 `context.lastComponent`。
- 仅在默认带框外壳造成阻碍时，才使用 `renderShell: "self"`。在自渲染外壳模式下，工具需自行负责其框架、内边距和背景。

#### 回退

如果插槽渲染器未定义或抛出异常：
- `renderCall`：显示工具名称
- `renderResult`：显示来自 `content` 的原始文本

### 动态工具加载

扩展可以注册大量工具，同时只保持少量初始活动工具。工具可在执行期间通过 `pi.setActiveTools()` 更改活动集合。Pi 将初始提示及工具配置存储于对话记录的首条系统消息中，并在下一次模型请求前追加工具与提示的增量更新。对于无法表示此类转换的提供商，将收到完整的对话记录检查点，这可能导致缓存前缀失效。

生命周期如下：

1. 使用 `pi.registerTool()` 注册每个工具，使其出现在 `pi.getAllTools()` 中。
2. 保持加载器工具（如 `search_tools`）为活动状态，而将可搜索工具保持为非活动状态。
3. 在加载器执行期间，以所需的活动工具名称调用 `pi.setActiveTools()`。名称必须已注册；未知名称将被忽略。

#### 搜索工具示例

以下扩展注册了两个可搜索的工具，将它们从初始活动集中移除，并保留 `search_tools` 作为其加载器。该示例使用简单的关键词匹配，但搜索实现可以使用 BM25、嵌入、远程目录或针对特定项目的路由。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const SEARCHABLE_TOOL_NAMES = new Set(["lookup_weather", "search_issues"]);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "lookup_weather",
    label: "查询天气",
    description: "查询某个城市的当前天气",
    parameters: Type.Object({ city: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `${params.city}的天气：晴` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_issues",
    label: "搜索问题",
    description: "按关键词搜索项目问题",
    parameters: Type.Object({ query: Type.String() }),
    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `没有与${params.query}匹配的未解决问题` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "search_tools",
    label: "搜索工具",
    description: "搜索并启用与任务相关的工具",
    promptSnippet: "当当前工具无法胜任任务时，搜索额外工具",
    promptGuidelines: [
      "当任务需要当前不具备的能力时，使用search_tools。",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "要搜索的能力或任务" }),
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
          content: [{ type: "text", text: `未找到与${params.query}相关的工具` }],
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
            ? `已加载工具：${added.join(", ")}`
            : `匹配的工具已处于活动状态：${matches.join(", ")}`,
        }],
        details: { matches, added },
      };
    },
  });

  pi.on("session_start", () => {
    // 保持可搜索工具已注册但初始不活动，保留内置工具和其他扩展拥有的工具，
    // 并保持加载器本身处于活动状态。
    const initialTools = pi.getActiveTools().filter(
      (name) => !SEARCHABLE_TOOL_NAMES.has(name),
    );
    pi.setActiveTools([...new Set([...initialTools, "search_tools"])]);
  });
}
```

当 `search_tools` 添加一个匹配项时，模型会在紧接着的下一个请求中接收完整的更新后的工具列表。

## 自定义界面

扩展可通过 `ctx.ui` 方法与用户交互，并自定义消息及工具的呈现方式。

**有关自定义组件，请参阅 [tui.md](/docs/tui/)**，其中提供了可直接复制使用的模式，涵盖：
- 选择对话框 (SelectList)
- 支持取消的异步操作 (BorderedLoader)
- 设置切换项 (SettingsList)
- 状态指示器 (setStatus)
- 流式传输过程中的工作消息、可见性与指示器 (`setWorkingMessage`、`setWorkingVisible`、`setWorkingIndicator`)
- 编辑器上方/下方的组件 (setWidget)
- 叠加在内置斜杠/路径补全之上的自动补全提供器 (addAutocompleteProvider)
- 自定义页脚 (setFooter)

### 对话框

```typescript
// 从选项中选择
const choice = await ctx.ui.select("请选择：", ["A", "B", "C"]);

// 确认对话框
const ok = await ctx.ui.confirm("删除？", "此操作无法撤销");

// 文本输入
const name = await ctx.ui.input("姓名：", "占位文本");

// 多行编辑器
const text = await ctx.ui.editor("编辑：", "预填充文本");

// 通知（非阻塞）
ctx.ui.notify("完成！", "info");  // "info" | "warning" | "error"
```

#### 带倒计时的定时对话框

对话框支持 `timeout` 选项，可在实时倒计时显示后自动关闭：

```typescript
// 对话框显示 "标题 (5s)" → "标题 (4s)" → ... → 倒计时归零时自动关闭
const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在 5 秒后自动取消。是否确认？",
  { timeout: 5000 }
);

if (confirmed) {
  // 用户已确认
} else {
  // 用户取消或超时
}
```

**超时时返回值：**
- `select()` 返回 `undefined`
- `confirm()` 返回 `false`
- `input()` 返回 `undefined`

#### 使用 AbortSignal 手动取消

为了获得更多控制（例如，区分超时和用户取消），可以使用 `AbortSignal`：

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

const confirmed = await ctx.ui.confirm(
  "定时确认",
  "此对话框将在5秒后自动取消。确认？",
  { signal: controller.signal }
);

clearTimeout(timeoutId);

if (confirmed) {
  // 用户确认
} else if (controller.signal.aborted) {
  // 对话框超时
} else {
  // 用户取消（按了 Escape 或选择了“否”）
}
```

完整示例见 [examples/extensions/timed-confirm.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/timed-confirm.ts)。

### 小组件、状态与页脚

```typescript
// 页脚中的状态（持续显示，直到清除）
ctx.ui.setStatus("my-ext", "正在处理...");
ctx.ui.setStatus("my-ext", undefined);  // 清除

// 工作中的加载指示器（在流式传输期间显示）
ctx.ui.setWorkingMessage("正在深度思考...");
ctx.ui.setWorkingMessage();  // 恢复默认
ctx.ui.setWorkingVisible(false);  // 完全隐藏内置的工作加载行
ctx.ui.setWorkingVisible(true);   // 显示内置的工作加载行

// 工作指示器（在流式传输期间显示）
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
ctx.ui.setWorkingIndicator();  // 恢复默认的加载动画

// 编辑器上方的小组件（默认）
ctx.ui.setWidget("my-widget", ["第1行", "第2行"]);
// 编辑器下方的小组件
ctx.ui.setWidget("my-widget", ["第1行", "第2行"], { placement: "belowEditor" });
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

// 在内置提供商之上堆叠自定义的自动完成行为
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
      items: [{ value: "#2983", label: "#2983", description: "用于自动完成的扩展API" }],
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

// 自定义编辑器（vim模式、emacs模式等）
ctx.ui.setEditorComponent((tui, theme, keybindings) => new VimEditor(tui, theme, keybindings));
const currentEditor = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new WrappedEditor(tui, theme, keybindings, currentEditor?.(tui, theme, keybindings))
);
ctx.ui.setEditorComponent(undefined);  // 恢复默认编辑器

// 主题管理（创建主题请参阅 themes.md）
const themes = ctx.ui.getAllThemes();  // [{ name: "dark", path: "/..." | undefined }, ...]
const lightTheme = ctx.ui.getTheme("light");  // 加载而不切换
const result = ctx.ui.setTheme("light");  // 按名称切换
if (!result.success) {
  ctx.ui.notify(`失败: ${result.error}`, "error");
}
ctx.ui.setTheme(lightTheme!);  // 或通过 Theme 对象切换
ctx.ui.theme.fg("accent", "样式文本");  // 访问当前主题
```

自定义工作指示器的帧会原文渲染。如果你想要颜色，请自行在帧字符串中添加，例如使用 `ctx.ui.theme.fg(...)`。

### 自动补全提供商

使用 `ctx.ui.addAutocompleteProvider()` 在内置的斜杠命令和路径提供商之上叠加自定义自动补全逻辑。设置 `triggerCharacters` 以定义自定义自然触发字符，例如 `$`。

典型模式如下：

- 检查光标前的文本
- 当你的扩展特定语法匹配时，返回你自己的建议
- 否则，委托给 `current.getSuggestions(...)` 处理
- 除非你需要自定义插入行为，否则委托 `applyCompletion(...)` 处理

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

完整的示例请参阅 [github-issue-autocomplete.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/github-issue-autocomplete.ts)，该示例通过 `gh issue list` 预加载最新的 GitHub 开放问题，并在本地过滤以实现快速的 `#...` 补全。该示例需要 GitHub CLI（`gh`）以及一个 GitHub 仓库的检出副本。

这是一段用于完整替换**编辑器**的组件。在 `done()` 被调用前，它会在 UI 栈中临时替代编辑器。

```typescript
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const prompt = new Text("按 Enter 确认，按 Escape 取消", 1, 1);

  prompt.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };

  return prompt;
});

if (result) {
  // 用户按下了 Enter
}
```

该回调接收以下参数：
- `tui` — TUI 实例（用于获取屏幕尺寸、管理焦点）
- `theme` — 用于设置样式的当前主题
- `keybindings` — 应用按键绑定管理器（用于检查快捷方式）
- `done(value)` — 调用后关闭组件并返回对应值

完整的组件 API 请参阅 [tui.md](/docs/tui/)。

# 自定义UI覆盖层

`ctx.ui.custom` API 默认会创建一个仅作为组件的非覆盖层组件。如果要暂时保留屏幕上的其他内容，并在其上层显示内容，请传递 `{ overlay: true }`，以清除屏幕内容，并允许与下方组件的交互。覆盖层组件关闭后，之前的 UI 会被恢复。

对于高级定位（锚点、边距、百分比、响应式可见性），请传递 `overlayOptions`。使用 `onHandle` 以编程方式控制焦点或可见性：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyOverlayComponent({ onClose: done }),
  {
    overlay: true,
    overlayOptions: { anchor: "top-right", width: "50%", margin: 2 },
    onHandle: (handle) => {
      handle.focus(); // 聚焦此覆盖层并将其置于视觉最前方
      // handle.unfocus({ target: editorComponent }); // 将输入释放到特定组件
      // handle.setHidden(true/false); // 切换可见性
      // handle.hide(); // 永久移除
    }
  }
);
```

一个处于焦点且可见的覆盖层，在临时非覆盖层自定义 UI 关闭后，可以重新获取输入。如果您有意让另一个组件在覆盖层保持可见时继续接收输入，请调用 `handle.unfocus({ target })`。传入 `{ target: null }` 会释放覆盖层，而不会将输入焦点转移到其他组件。

完整的 `OverlayOptions` 和 `OverlayHandle` API 请参见 [tui.md](/docs/tui/)，示例请参考 [overlay-qa-tests.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。
```

### 自定义编辑器

用自定义实现替换主输入编辑器（vim 模式、emacs 模式等）：

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
    super.handleInput(data);  // 应用键位绑定 + 文本编辑
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
- 继承 `CustomEditor`（而非基础 `Editor`）以获取应用键位绑定（escape 中止、ctrl+d、模型切换）
- 对未自行处理的按键调用 `super.handleInput(data)`
- 自定义编辑器默认保留独立的工作行。传递 `{ embedWorkingStatus: true }` 作为 `CustomEditor` 构造函数的第四个参数，改用内置的编辑器边框旋转指示器。
- 工厂函数接收来自应用的 `tui`、`theme` 和 `keybindings`
- 在 `setEditorComponent()` 之前使用 `ctx.ui.getEditorComponent()` 来包装先前配置的自定义编辑器
- 传递 `undefined` 以恢复默认：`ctx.ui.setEditorComponent(undefined)`

若要与其他已替换编辑器的扩展组合，请在设置你的工厂函数之前捕获之前的工厂：

```typescript
const previous = ctx.ui.getEditorComponent();
ctx.ui.setEditorComponent((tui, theme, keybindings) =>
  new MyEditor(tui, theme, keybindings, { base: previous?.(tui, theme, keybindings) })
);
```

参见 [tui.md](/docs/tui/) 模式 7，获取带有模式指示器的完整示例。

### 消息与条目渲染

使用你的 `customType` 为消息注册自定义渲染器。对需要参与 LLM 上下文的内容使用消息渲染器：

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

对于仅供 TUI 显示且不应发送给 LLM 的内容，改用自定义条目渲染：

```typescript
pi.registerEntryRenderer("my-card", (entry, options, theme) => {
  return new Text(theme.fg("accent", JSON.stringify(entry.data)));
});

pi.appendEntry("my-card", { status: "done" });
```

### 主题颜色

所有渲染函数都会接收一个 `theme` 对象。有关创建自定义主题和完整调色板的信息，请参阅 [themes.md](/docs/themes/)。

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

// 使用显式语言类型高亮代码
const highlighted = highlightCode("const x = 1;", "typescript", theme);

// 根据文件路径自动检测语言
const lang = getLanguageFromPath("/path/to/file.rs");  // "rust"
const highlighted = highlightCode(code, lang, theme);
```

## 错误处理

- 扩展错误会被记录，代理继续运行
- `tool_call` 错误会阻止该工具（故障安全）
- 工具 `execute` 错误必须通过抛出异常来触发；抛出的错误会被捕获，并带着 `isError: true` 报告给 LLM，然后继续执行。

## 模式行为

| 模式 | `ctx.mode` | `ctx.hasUI` | 备注 |
|------|------------|-------------|-------|
| 交互式 | `"tui"` | `true` | 完整 TUI，支持终端渲染 |
| RPC（`--mode rpc`） | `"rpc"` | `true` | 通过 JSON 协议提供对话框与通知；`custom()` 返回 `undefined`。参见 [rpc.md](/docs/rpc/) |
| JSON（`--mode json`） | `"json"` | `false` | 事件流输出到 stdout；UI 方法为空操作 |
| 打印（`-p`） | `"print"` | `false` | 扩展可运行，但不能提示用户 |

在使用 TUI 专属功能（`custom()`、组件工厂、终端输入）之前，先检查 `ctx.mode === "tui"`；在使用同时适用于 TUI 与 RPC 模式的对话框及通知方法之前，先检查 `ctx.hasUI`。

## 示例参考

所有示例位于 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)。

| 示例 | 描述 | 关键 API |
|---------|-------------|----------|
| **工具** |||
| `hello.ts` | 最小化工具注册 | `registerTool` |
| `question.ts` | 带用户交互的工具 | `registerTool`, `ui.select` |
| `questionnaire.ts` | 多步骤向导工具 | `registerTool`, `ui.custom` |
| `todo.ts` | 带持久化的有状态工具 | `registerTool`, `appendEntry`, `renderResult`, 会话事件 |
| `dynamic-tools.ts` | 启动后及命令执行期间注册工具 | `registerTool`, `session_start`, `registerCommand` |
| `structured-output.ts` | 使用 `terminate: true` 的最终结构化输出工具 | `registerTool`, 终止型工具结果 |
| `truncated-tool.ts` | 输出截断示例 | `registerTool`, `truncateHead` |
| `tool-override.ts` | 覆盖内置读取工具 | `registerTool`（与内置工具同名） |
| **命令** |||
| `pirate.ts` | 每轮修改系统提示词 | `registerCommand`, `before_agent_start` |
| `summarize.ts` | 对话摘要命令 | `registerCommand`, `ui.custom` |
| `handoff.ts` | 跨提供商模型交接 | `registerCommand`, `ui.editor`, `ui.custom` |
| `qna.ts` | 自定义 UI 的问答 | `registerCommand`, `ui.custom`, `setEditorText` |
| `send-user-message.ts` | 注入用户消息 | `registerCommand`, `sendUserMessage` |
| `reload-runtime.ts` | 重载命令与 LLM 工具交接 | `registerCommand`, `ctx.reload()`, `sendUserMessage` |
| `shutdown-command.ts` | 优雅关闭命令 | `registerCommand`, `shutdown()` |
| **事件与门控** |||
| `permission-gate.ts` | 阻止危险命令 | `on("tool_call")`, `ui.confirm` |
| `project-trust.ts` | 从用户/全局或 CLI 扩展决定或推迟项目信任 | `on("project_trust")`, 信任 UI, 必需的信任结果 |
| `protected-paths.ts` | 阻止写入特定路径 | `on("tool_call")` |
| `confirm-destructive.ts` | 确认会话变更 | `on("session_before_switch")`, `on("session_before_fork")` |
| `dirty-repo-guard.ts` | 脏 git 仓库时发出警告 | `on("session_before_*")`, `exec` |
| `input-transform.ts` | 变换用户输入 | `on("input")` |
| `input-transform-streaming.ts` | 感知流式处理的输入变换 | `on("input")`, `streamingBehavior` |
| `model-status.ts` | 响应模型变更 | `on("model_select")`, `setStatus` |
| `provider-payload.ts` | 检查负载与提供商响应头 | `on("before_provider_request")`, `on("after_provider_response")` |
| `system-prompt-header.ts` | 显示系统提示词信息 | `on("agent_start")`, `getSystemPrompt` |
| `claude-rules.ts` | 从文件加载规则 | `on("session_start")`, `on("before_agent_start")` |
| `prompt-customizer.ts` | 使用 `systemPromptOptions` 添加上下文感知的工具指导 | `on("before_agent_start")`, `BuildSystemPromptOptions` |
| `file-trigger.ts` | 文件监视器触发消息 | `sendMessage` |
| **压缩与会话** |||
| `custom-compaction.ts` | 自定义压缩摘要 | `on("session_before_compact")` |
| `trigger-compact.ts` | 手动触发压缩 | `compact()` |
| `git-checkpoint.ts` | 轮次时 git stash | `on("turn_start")`, `on("session_before_fork")`, `exec` |
| `git-merge-and-resolve.ts` | 获取、合并与解决冲突 | `on("agent_end")`, `exec`, `sendUserMessage` |
| `auto-commit-on-exit.ts` | 关闭时自动提交 | `on("session_shutdown")`, `exec` |
| **UI 组件** |||
| `status-line.ts` | 底部状态指示器 | `setStatus`, 会话事件 |
| `working-indicator.ts` | 自定义流式工作指示器 | `setWorkingIndicator`, `registerCommand` |
| `github-issue-autocomplete.ts` | 通过预加载 `gh issue list` 中的近期未关闭问题，在内置自动补全之上添加 `#1234` 问题补全 | `addAutocompleteProvider`, `on("session_start")`, `exec` |
| `custom-footer.ts` | 完全替换底部栏 | `registerCommand`, `setFooter` |
| `custom-header.ts` | 替换启动头部 | `on("session_start")`, `setHeader` |
| `modal-editor.ts` | Vim 风格模式编辑器 | `setEditorComponent`, `CustomEditor` |
| `rainbow-editor.ts` | 自定义编辑器样式 | `setEditorComponent` |
| `widget-placement.ts` | 编辑器上方/下方的小部件 | `setWidget` |
| `overlay-test.ts` | 覆盖层组件 | `ui.custom` 带覆盖层选项 |
| `overlay-qa-tests.ts` | 综合覆盖层测试 | `ui.custom`, 所有覆盖层选项 |
| `notify.ts` | 简单通知 | `ui.notify` |
| `timed-confirm.ts` | 带超时的对话框 | `ui.confirm` 带超时/信号 |
| `mac-system-theme.ts` | 自动切换主题 | `setTheme`, `exec` |
| **复杂扩展** |||
| `plan-mode/` | 完整计划模式实现 | 所有事件类型, `registerCommand`, `registerShortcut`, `registerFlag`, `setStatus`, `setWidget`, `sendMessage`, `setActiveTools` |
| `preset.ts` | 可保存的预设（模型、工具、思考） | `registerCommand`, `registerShortcut`, `registerFlag`, `setModel`, `setActiveTools`, `setThinkingLevel`, `appendEntry` |
| `tools.ts` | 工具开/关切换 UI | `registerCommand`, `setActiveTools`, `SettingsList`, 会话事件 |
| **远程与沙箱** |||
| `ssh.ts` | SSH 远程执行 | `registerFlag`, `on("user_bash")`, `on("before_agent_start")`, 工具操作 |
| `interactive-shell.ts` | 持久化 shell 会话 | `on("user_bash")` |
| `sandbox/` | 沙箱化工具执行 | 工具操作 |
| `gondolin/` | 将内置工具和 `!` 命令路由到 Gondolin 微型虚拟机 | 工具操作, 内置工具覆盖, `on("user_bash")` |
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
| `bookmark.ts` | 为 /tree 添加书签条目 | `setLabel` |
| **其他** |||
| `inline-bash.ts` | 工具调用中的内联 bash | `on("tool_call")` |
| `bash-spawn-hook.ts` | 执行前调整 bash 命令、工作目录与环境变量 | `createBashTool`, `spawnHook` |
| `with-deps/` | 带 npm 依赖的扩展 | 使用 `package.json` 的软件包结构 |
