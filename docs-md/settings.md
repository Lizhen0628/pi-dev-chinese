# 设置

Pi 使用 JSON 设置文件，项目设置会覆盖全局设置。

| 位置 | 范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

可以直接编辑，或使用 `/settings` 查看常用选项。要以交互方式保存启动时的模型默认值，请使用 `/model` 并按 Ctrl+S 选择所需的模型。要保存启动时的思考级别，请使用 `/thinking` 并按 Ctrl+S。

## 项目信任

在交互式启动时，pi 在信任包含项目本地设置、资源或项目 `.agents/skills` 的项目文件夹之前会询问，前提是该文件夹或父文件夹在 `~/.pi/agent/trust.json` 中没有保存的决策。信任项目允许 pi 加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目软件包，并执行项目扩展。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不显示信任提示。在没有适用的已保存信任决策时，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 忽略这些项目资源，而 `always` 信任它们。传递 `--approve`/`-a` 或 `--no-approve`/`-na` 来覆盖一次运行的项目信任。

如果没有适用的扩展或保存的决策，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设置为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 更改。

`pi config` 和软件包命令使用相同的项目信任流程，但 `pi update` 从不提示。传递 `--approve` 来信任项目本地设置，或传递 `--no-approve` 忽略它们。

在交互模式下使用 `/trust` 保存项目信任决策以供将来会话使用，包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不重新加载，因此重启 pi 以使更改生效。

## 所有设置

### 模型与思考

| 设置项 | 类型 | 默认值 | 描述 |
|--------|------|--------|------|
| `defaultProvider` | string | - | 启动时的提供商（例如 `"anthropic"`、`"openai"`；可在 `/model` 中按 Ctrl+S 保存，或手动编辑） |
| `defaultModel` | string | - | 启动时的模型 ID（可在 `/model` 中按 Ctrl+S 保存，或手动编辑） |
| `defaultThinkingLevel` | string | - | 启动时的思考级别（可在 `/thinking` 中按 Ctrl+S 保存，或手动编辑）：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"` |
| `modelThinkingLevels` | object | - | 按模型设置的启动思考级别，以 `"provider/modelId"` 为键；可从 `/settings` → 按模型的默认思考级别进行配置，或手动编辑 |
| `hideThinkingBlock` | boolean | `false` | 在输出中隐藏思考块 |
| `showCacheMissNotices` | boolean | `false` | 在记录中显示提示词缓存未命中、压缩或分支摘要使用情况的重大通知，以及提供商恢复诊断信息（如被丢弃的 Anthropic 思考块） |
| `thinkingBudgets` | object | - | 每个思考级别的自定义令牌预算。Anthropic、Google 和 Bedrock 原生使用这些预算。OpenAI 兼容的模型在设置了 `compat.thinkingTokenBudgetField`（或 `supportsThinkingTokenBudget`）时使用这些预算。 |

#### 思考预算

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### 界面与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `theme` | 字符串 | `"dark"` | 主题名称（`"dark"`、`"light"` 或自定义） |
| `externalEditor` | 字符串 | `$VISUAL`，然后是 `$EDITOR`，再是 Windows 上的记事本或其它平台上的 `nano` | Ctrl+G 外部编辑器的命令；优先于环境变量 |
| `quietStartup` | 布尔值 | `false` | 隐藏启动横幅 |
| `defaultProjectTrust` | 字符串 | `"ask"` | 回退项目信任行为：`"ask"`（询问）、`"always"`（始终信任）或 `"never"`（永不信任）。仅全局设置可用 |
| `collapseChangelog` | 布尔值 | `false` | 更新后显示简化的变更日志 |
| `enableInstallTelemetry` | 布尔值 | `true` | 发送匿名的安装/更新回执和所选提供商归属报头。这不控制更新检查 |
| `enableAnalytics` | 布尔值 | `false` | 可选加入的分析数据共享。目前仅在实验性首次设置（`PI_EXPERIMENTAL=1`）期间询问 |
| `trackingId` | 字符串 | - | 分析跟踪标识符，在启用 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | 字符串 | `"tree"` | 双重 Esc 操作：`"tree"`（目录树）、`"fork"`（分叉）或 `"none"`（无） |
| `treeFilterMode` | 字符串 | `"default"` | `/tree` 的默认过滤器：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | 数字 | `0` | 输入编辑器的水平内边距（0-3） |
| `outputPad` | 数字 | `1` | 用户消息、助手消息和思考过程的水平内边距（0 或 1） |
| `autocompleteMaxVisible` | 数字 | `5` | 自动补全下拉列表的最大可见项数（3-20） |
| `showHardwareCursor` | 布尔值 | `false` | 在 TUI 定位光标以支持输入法时，显示终端光标 |
| `tuiMode` | 字符串 | `"regular"` | 交互式 TUI 模式：`"regular"`（常规）或实验性 `"fullscreen"`（全屏）。从 `/settings` 的更改会立即生效；`--tui-mode` 在启动时覆盖此设置 |
| `fullscreenExitOutput` | 字符串 | `"transcript"` | 全屏退出输出：`"transcript"` 打印最终会话记录和恢复提示，而 `"resume-hint"` 恢复之前的屏幕并仅打印恢复提示。在常规 TUI 模式下无效果 |
| `fullscreenScrollbar` | 字符串 | `"auto"` | 全屏会话记录滚动条：`"auto"` 在滚动或指针位于其最右列轨道上时临时显示，`"always"` 保留该列并保持可见，`"hidden"` 隐藏滚动条。在常规 TUI 模式下无效果 |
| `fullscreenCopyOnSelect` | 布尔值 | `true` | 在全屏模式下自动复制选中的文本。禁用时，选中的内容保持高亮，`Ctrl+X` 复制当前选中内容 |

对于 VS Code，请包含 `--wait` 以使 pi 在编辑器退出后恢复：

```json
{
  "externalEditor": "code --wait"
}
```

### 遥测与更新检查

`enableInstallTelemetry` 控制向 `https://pi.dev/api/report-install` 发送的匿名安装/更新数据包，以及针对 OpenRouter、NVIDIA NIM 和 Cloudflare 提供商请求的 Pi 归属标头。选择退出将同时禁用这两项功能，但不会禁用更新检查；Pi 仍会访问 `https://pi.dev/api/latest-version` 以查找最新版本。

设置 `PI_SKIP_VERSION_CHECK=1` 可禁用 Pi 版本更新检查。使用 `--offline` 或 `PI_OFFLINE=1` 可禁用此处描述的所有启动网络操作，包括更新检查、软件包更新检查以及安装/更新遥测。

### 网络

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `httpProxy` | string | - | HTTP代理URL，应用于`HTTP_PROXY`与`HTTPS_PROXY`。仅作为全局设置。 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### 警告

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 当 Anthropic 订阅认证可能产生额外付费用量时显示警告 |

```json
{
  "warnings": {
    "anthropicExtraUsage": false
  }
}
```

### 压缩

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩 |
| `compaction.reserveTokens` | 数字 | `16384` | 为LLM响应保留的Token数 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 保留的近期Token数（不进行摘要） |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### 分支概要

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | 选择分支历史时保留的令牌数；输出上限为 4096 令牌 |
| `branchSummary.skipPrompt` | boolean | `false` | 在 `/tree` 导航时跳过“是否概要分支？”提示（默认不进行概要） |

### 重试

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|-------------|-------------|
| `retry.enabled` | 布尔值 | `true` | 在瞬时错误时启用自动代理级重试 |
| `retry.maxRetries` | 数字 | `3` | 代理级最大重试次数 |
| `retry.baseDelayMs` | 数字 | `2000` | 代理级指数退避的基本延迟（2秒，4秒，8秒） |
| `retry.maxAgentDelayMs` | 数字 | `60000` | 代理级最大重试延迟（60秒） |
| `retry.provider.timeoutMs` | 数字 | SDK 默认值 | 提供商/SDK 请求超时时间（毫秒） |
| `retry.provider.maxRetries` | 数字 | `0` | 提供商/SDK 重试次数 |
| `retry.provider.maxRetryDelayMs` | 数字 | `60000` | 服务器请求的最大延迟，超过即失败（60秒） |

代理级重试采用指数退避策略，上限由 `retry.maxAgentDelayMs` 控制，因此在长时间故障后，长时间的重试运行仍能保持响应。

当提供商请求的重试延迟超过 `retry.provider.maxRetryDelayMs` 时，请求将立即失败，并给出明确的错误信息，而不是静默等待。将其设为 `0` 可禁用此限制。

除非明确需要提供商级重试，否则应将 `retry.provider.maxRetries` 保持为 `0`。将其设为大于 `0` 可能导致 SDK/提供商重试在处理超出使用限制的错误时抢先于 Pi，这可能会在提供商配额重置之前（某些情况下）阻塞代理。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "maxAgentDelayMs": 60000,
    "provider": {
      "timeoutMs": 3600000,
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

### 消息投递

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | 引导消息如何发送：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | 追问消息如何发送：`"all"` 或 `"one-at-a-time"` |
| `transport` | string | `"auto"` | 支持多种传输的提供商的首选传输方式：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头部/正文空闲超时时间（毫秒），也用于具有显式流空闲超时的提供商。设置为 `0` 以禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | 支持 WebSocket 传输的提供商的 WebSocket 连接/打开握手超时时间（毫秒）。设置为 `0` 以禁用。 |

### 终端与图像

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `terminal.showImages` | 布尔值 | `true` | 在终端中显示图像（如果支持） |
| `terminal.imageWidthCells` | 数字 | `60` | 终端单元格中首选的内联图像宽度 |
| `terminal.clearOnShrink` | 布尔值 | `false` | 内容缩小时清除空行（可能导致闪烁） |
| `terminal.hyperlinks` | 布尔值或 `"auto"` | `"auto"` | 覆盖 OSC 8 超链接支持（高级，仅 JSON） |
| `terminal.images` | 字符串或布尔值 | `"auto"` | 使用 `"kitty"`、`"iterm2"`、`false` 或 `"auto"` 覆盖图像协议支持（高级，仅 JSON） |
| `terminal.trueColor` | 布尔值或 `"auto"` | `"auto"` | 覆盖真彩色支持（高级，仅 JSON） |
| `images.autoResize` | 布尔值 | `true` | 将图像调整为最大 2000x2000。适用于 `@file` 附件、`read` 以及工具返回的图像 |
| `images.blockImages` | 布尔值 | `false` | 阻止所有图像发送到 LLM |

### 外壳

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `shellPath` | 字符串 | - | 自定义外壳路径（例如，Windows 上的 Cygwin）；支持以 `~` 开头表示主目录 |
| `shellCommandPrefix` | 字符串 | - | 每条 bash 命令的前缀（例如，`"shopt -s expand_aliases"`） |
| `npmCommand` | 字符串数组 | - | 用于 npm 软件包查找/安装操作的命令 argv（例如，`["mise", "exec", "node@20", "--", "npm"]`） |

JSON 中的 Windows 路径必须使用正斜杠或转义的反斜杠：

```json
{
  "shellPath": "C:/Program Files/Git/bin/bash.exe"
}
```

```json
{
  "shellPath": "C:\\Program Files\\Git\\bin\\bash.exe"
}
```

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

`npmCommand` 用于所有 npm 软件包管理器操作，包括安装、卸载以及 git 软件包内的依赖安装。用户级 npm 软件包安装到 `~/.pi/agent/npm/`；项目级 npm 软件包安装到 `.pi/npm/`。请使用与进程启动方式完全一致的 argv 风格条目。当配置了 `npmCommand` 时，git 软件包依赖安装使用普通 `install`，以避免在包装器或其他软件包管理器中出现 npm 特有的标志。

### 工具

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `defaultTools` | string[] | - | 初始启用的内置工具。省略时，Pi 使用其标准默认值 |

`defaultTools` 选择启动时启用的内置工具。扩展和 SDK 自定义工具保持启用。可用的内置工具是 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`：

```json
{
  "defaultTools": ["bash", "edit", "write"]
}
```

在 Windows 上，选择 `powershell` 而不是 `bash`，或同时包含两者：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

空数组启动时不包含内置工具，但保留扩展和 SDK 自定义工具。`--tools` 用严格的允许列表替换此行为，用于所有工具，`--no-tools` 禁用所有工具，`--no-builtin-tools` 禁用内置默认值。`--exclude-tools` 过滤生成的列表。项目 `defaultTools` 数组替换全局数组。

### 会话

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `sessionDir` | 字符串 | - | 存储会话文件的目录。支持绝对或相对路径，以及`~`。 |

```json
{ "sessionDir": ".pi/sessions" }
```

当多个来源指定会话目录时，优先级顺序为`--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，然后是settings.json中的`sessionDir`。

### 模型循环切换

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | 用于Ctrl+P循环切换的模型模式（格式与 `--models` 命令行标志相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | string | `"  "` | 代码块缩进 |
| `markdown.mermaid` | string | `"streaming"` | Mermaid 渲染模式：`"off"`、`"final"` 或 `"streaming"` |

### 资源

这些设置定义了从哪里加载扩展、技能、提示词和主题。

`~/.pi/agent/settings.json` 中的路径相对于 `~/.pi/agent` 解析。`.pi/settings.json` 中的路径相对于 `.pi` 解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `packages` | array | `[]` | 用于加载资源的 npm/git 软件包 |
| `extensions` | string[] | `[]` | 本地扩展文件路径或目录 |
| `skills` | string[] | `[]` | 本地技能文件路径或目录 |
| `prompts` | string[] | `[]` | 本地提示词模板文件路径或目录 |
| `themes` | string[] | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | 将技能注册为 `/skill:name` 命令 |

数组支持 glob 模式和排除规则。使用 `!pattern` 进行排除。使用 `+path` 强制包含精确路径，使用 `-path` 强制排除精确路径。

#### 软件包

字符串形式会加载软件包中的所有资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式则可筛选要加载的资源：

```json
{
  "packages": [
    {
      "source": "pi-skills",
      "skills": ["brave-search", "transcribe"],
      "extensions": []
    }
  ]
}
```

有关软件包管理的详细说明，请参阅 [packages.md](/docs/packages/)。

## 示例

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "modelThinkingLevels": {
    "anthropic/claude-sonnet-4-20250514": "high"
  },
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "warnings": {
    "anthropicExtraUsage": true
  },
  "packages": ["pi-skills"]
}
```

## 项目覆盖

项目设置（`.pi/settings.json`）覆盖全局设置。嵌套对象将被合并：

```json
// ~/.pi/agent/settings.json（全局）
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// .pi/settings.json（项目）
{
  "compaction": { "reserveTokens": 8192 }
}

// 结果
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
