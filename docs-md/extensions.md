# 扩展

> Pi 可以创建扩展——把你的用例告诉它，让它写一个。

扩展是扩展 Pi 行为的 TypeScript 模块：订阅生命周期事件、注册 LLM 可调用的自定义工具、添加命令等等。

> **关于 /reload 的存放位置：** 扩展放在 `~/.pi/agent/extensions/`（全局）或 `.pi/extensions/`（项目级）即可被自动发现；`pi -e ./path.ts` 只用于快速测试。自动发现位置的扩展可以用 `/reload` 热重载。

**核心能力：**
- **自定义工具** —— 经 `pi.registerTool()` 注册 LLM 可调用的工具
- **事件拦截** —— 阻止或修改工具调用、注入上下文、自定义压缩
- **用户交互** —— 通过 `ctx.ui` 询问用户（选择、确认、输入、通知）
- **自定义 UI 组件** —— 通过 `ctx.ui.custom()` 构建带键盘输入的完整 TUI 组件
- **自定义命令** —— 经 `pi.registerCommand()` 注册 `/mycommand`
- **会话持久化** —— 经 `pi.appendEntry()` 存放跨重启的状态
- **自定义渲染** —— 控制工具调用/结果和消息在 TUI 中的呈现

**典型用例：**
- 权限门（执行 `rm -rf`、`sudo` 等前先确认）
- Git 检查点（每回合 stash，切分支时恢复）
- 路径保护（禁止写 `.env`、`node_modules/`）
- 自定义压缩（用自己的方式摘要对话）
- 会话总结、交互式工具（问答、向导、自定义对话框）
- 有状态工具（待办列表、连接池）
- 外部集成（文件监视、webhook、CI 触发器）
- 等待时玩游戏（参见 `snake.ts` 示例）

可运行的完整实现见 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)。

> 本文为结构化中文编译版；完整的 API 类型签名、事件负载与示例代码见[英文原文](https://pi.dev/docs/latest/extensions)。

## 快速上手

创建 `~/.pi/agent/extensions/my-extension.ts`，导出一个接收 `ExtensionAPI` 的默认工厂函数：

```typescript
export default function (pi) {
  pi.registerCommand("hello", async (ctx) => {
    ctx.ui.notify("Hello from my extension!");
  });
}
```

用 `--extension`（或 `-e`）参数测试：

```bash
pi -e ./my-extension.ts
```

## 扩展位置

> **安全提示：** 扩展以你的完整系统权限运行并可执行任意代码。只从可信来源安装。

扩展从受信任的位置自动发现。项目级 `.pi/extensions` 只在项目被信任后加载。

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/extensions/*.ts` | 全局（所有项目） |
| `~/.pi/agent/extensions/*/index.ts` | 全局（子目录） |
| `.pi/extensions/*.ts` | 项目级 |
| `.pi/extensions/*/index.ts` | 项目级（子目录） |

更多路径通过 `settings.json` 配置。要通过 npm 或 git 以 Pi 软件包分享扩展，见[软件包](/docs/packages/)。

## 可用导入

| 包 | 用途 |
|----|------|
| `@earendil-works/pi-coding-agent` | 扩展类型（`ExtensionAPI`、`ExtensionContext`、事件） |
| `typebox` | 工具参数的 schema 定义 |
| `@earendil-works/pi-ai` | AI 工具（`StringEnum` 等 Google 兼容枚举） |
| `@earendil-works/pi-tui` | 自定义渲染用的 TUI 组件 |

npm 依赖同样可用：在扩展旁边（或父目录）放一个 `package.json`，运行 `npm install`，`node_modules/` 的导入自动解析。

经 `pi install` 分发的 Pi 软件包，运行时依赖必须放在 `dependencies`（包安装默认 `npm install --omit=dev`，`devDependencies` 运行时不可用）。Node.js 内置模块（`node:fs`、`node:path` 等）也可直接使用。

## 编写扩展

扩展导出一个默认工厂函数，接收 `ExtensionAPI`；工厂可以是同步或异步的。扩展经 [jiti](https://github.com/unjs/jiti) 加载，TypeScript 无需编译。

工厂返回 `Promise` 时，Pi 会等待其完成再继续启动——异步初始化会在 `session_start`、`resources_discover` 之前完成，经 `pi.registerProvider()` 排队的提供商注册也会被 flush。

### 异步工厂

适合一次性的启动工作，如抓取远程配置或动态发现模型：

```typescript
export default async function (pi) {
  const models = await fetch("https://my-endpoint/models").then(r => r.json());
  pi.registerProvider("my-provider", { ... });
}
```

### 长生命周期资源与关闭

扩展工厂可能运行在永不启动会话的调用里。不要在工厂里启动进程、套接字、文件监视器或定时器等后台资源——推迟到 `session_start` 或真正需要它的命令/工具/事件里，并注册幂等的 `session_shutdown` 处理器来关闭会话级资源。

### 扩展形态

- **单文件** —— 最简单，适合小扩展
- **带 index.ts 的目录** —— 多文件扩展
- **带依赖的包** —— 需要 npm 包的扩展；在扩展目录里 `npm install` 后 `node_modules/` 导入自动生效

## 事件

### 生命周期概览

启动事件 → 资源事件 → 会话事件 → 智能体/模型/工具/输入事件，贯穿整个会话。所有事件都用 `pi.on(事件名, 处理器)` 订阅。

### 启动事件

#### project_trust

在 Pi 决定是否信任带动态配置（`.pi` 或 `.agents/skills`）的项目之前触发：启动时，以及会话替换（如 `/resume`）进入当前进程未解决信任的 cwd 时。只有用户/全局扩展和 CLI `-e` 扩展参与；项目本地扩展在信任解决后才加载。

处理器必须返回 `{ trusted: "yes" | "no" | "undecided" }`。返回 yes/no 的用户/全局或 CLI 扩展拥有决定权（第一个 yes/no 生效并抑制内置询问）；`remember: true` 把 yes/no 决定持久化，否则仅当前进程有效。返回 `"undecided"` 交给后续处理器或内置流程。询问前先检查 `ctx.hasUI`。无人返回 yes/no 时走正常流程：`trust.json` 已存决定优先，然后 `defaultProjectTrust` 决定默认询问/信任/拒绝。

### 资源事件

#### resources_discover

在 Pi 发现扩展、技能、提示词模板与主题时触发，扩展可借此动态注入或调整资源。

### 会话事件

包括 `session_start`、`session_shutdown`、`session_before_compact`、`session_compact_failed`、`session_before_tree`、`session_fork` 等。压缩与分支摘要的拦截见[压缩](/docs/compaction/)。

### 智能体事件

围绕回合与消息生命周期：智能体开始/结束、回合开始/结束、消息开始/更新/结束、回合结束前（`turn_start` 前可注入上下文）等。

### 模型事件

模型切换与思考等级变更前后触发，可记录或限制可用模型。

### 工具事件

`tool_call`（可阻止或改写参数）、`tool_execute`、`tool_result`（可修改结果）等，是权限门与审计类扩展的基础。

### 用户 bash 事件

用户 `!` 命令执行前后触发，可拦截或增强。

### 输入事件

编辑器输入相关事件，可监听按键或注入内容。

## ExtensionContext

`ctx` 是扩展访问 Pi 运行时的入口：

| 成员 | 说明 |
|------|------|
| `ctx.ui` | 用户交互（select、confirm、input、notify、custom、setWidget 等） |
| `ctx.mode` / `ctx.hasUI` | 当前运行模式；有无交互 UI |
| `ctx.cwd` | 当前工作目录 |
| `ctx.isProjectTrusted()` | 项目是否已信任 |
| `ctx.sessionManager` | 会话树与条目管理（见[会话格式](/docs/session-format/)） |
| `ctx.modelRegistry` / `ctx.model` / `ctx.thinkingLevel` / `ctx.scopedModels` | 模型注册表与当前模型状态 |
| `ctx.signal` | 与当前运行关联的 AbortSignal |
| `ctx.isIdle()` / `ctx.abort()` / `ctx.hasPendingMessages()` | 运行状态查询与中止 |
| `ctx.shutdown()` | 退出 Pi |
| `ctx.getContextUsage()` | 上下文占用 |
| `ctx.compact()` | 手动触发压缩 |
| `ctx.getSystemPrompt()` | 读取当前系统提示 |

### ExtensionCommandContext

命令处理器收到的上下文在 `ExtensionContext` 之上追加会话操作：

| 成员 | 说明 |
|------|------|
| `ctx.getSystemPromptOptions()` | 系统提示选项 |
| `ctx.waitForIdle()` | 等待智能体空闲 |
| `ctx.newSession(options?)` | 开始新会话 |
| `ctx.fork(entryId, options?)` | 从指定条目分叉 |
| `ctx.navigateTree(targetId, options?)` | 导航到树中某节点 |
| `ctx.switchSession(sessionPath, options?)` | 切换会话 |

## 状态管理、自定义工具与自定义 UI

- **状态管理**：`pi.appendEntry()` 写入自定义条目（不入 LLM 上下文），`/reload` 时按 `customType` 读回；会话内消息注入用 `pi.sendCustomMessage()`（入上下文）。
- **自定义工具**：`pi.registerTool()` 用 TypeBox 定义参数 schema，支持动态加载/卸载工具组。
- **自定义 UI**：简单交互用 `ctx.ui` 的高阶方法；复杂交互用 `ctx.ui.custom()` 挂载完整的 [TUI 组件](/docs/tui/)，支持焦点、键盘与主题。
- **错误处理**：扩展抛错会被捕获并显示，不会拖垮主进程；`extension_error` 事件可用于遥测。
- **模式行为**：扩展代码在交互、print、JSON、RPC 模式下都会加载；有 UI 的调用走 `ctx.ui`，无 UI 时应检查 `ctx.hasUI` 并回退为非交互行为。

## 示例参考

官方示例覆盖：权限门（`permission-gate.ts`）、路径保护（`protected-paths.ts`）、自定义压缩（`custom-compaction.ts`）、子智能体（`subagent/`）、计划模式（`plan-mode/`）、SSH、沙箱、GitLab Duo 提供商、snake 游戏等。全部见 [examples/extensions/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/)。
