# 设置

Pi 使用 JSON 设置文件，项目设置覆盖全局设置。

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

直接编辑，或用 `/settings` 修改常用选项。想以交互方式保存启动模型默认值，用 `/model` 并在目标模型上按 Ctrl+S；保存启动思考等级用 `/thinking` 加 Ctrl+S。

## 项目信任

交互启动时，如果项目目录包含项目级设置、资源或项目 `.agents/skills`，而 `~/.pi/agent/trust.json` 中对该目录（或其父目录）没有保存过信任决定，Pi 会先询问是否信任该项目。信任后 Pi 才会加载 `.pi/settings.json` 与 `.pi` 资源、安装缺失的项目软件包、执行项目扩展。

非交互模式（`-p`、`--mode json`、`--mode rpc`）不显示信任询问。没有适用的已保存决定时，按全局设置中的 `defaultProjectTrust` 处理：`ask`（默认）和 `never` 忽略项目资源，`always` 信任它们。也可以用 `--approve`/`-a` 或 `--no-approve`/`-na` 为单次运行覆盖。

`pi config` 和软件包命令走同样的项目信任流程，但 `pi update` 从不弹询问。用 `--approve` 让单条命令信任项目本地设置，或用 `--no-approve` 忽略。

交互模式中用 `/trust` 保存项目信任决定（包括对其直接父目录的信任），供以后的会话使用。它只写入 `~/.pi/agent/trust.json`，当前会话不会重新加载，重启 Pi 后生效。

## 全部设置

### 模型与思考

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `defaultProvider` | string | - | 启动提供商（如 `"anthropic"`、`"openai"`；在 `/model` 中按 Ctrl+S 保存，或手动编辑） |
| `defaultModel` | string | - | 启动模型 ID（在 `/model` 中按 Ctrl+S 保存，或手动编辑） |
| `defaultThinkingLevel` | string | - | 启动思考等级（在 `/thinking` 中按 Ctrl+S 保存，或手动编辑）：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"` |
| `modelThinkingLevels` | object | - | 按模型设置启动思考等级，键为 `"provider/modelId"`；可在 `/settings` → Default thinking level per model 配置或手动编辑 |
| `hideThinkingBlock` | boolean | `false` | 隐藏输出中的思考块 |
| `showCacheMissNotices` | boolean | `false` | 在记录中显示显著提示词缓存未命中、压缩或分支摘要用量，以及提供商恢复诊断（如丢弃 Anthropic 思考块）的通知 |
| `thinkingBudgets` | object | - | 每个思考等级的自定义 token 预算。Anthropic、Google 和 Bedrock 原生支持；OpenAI 兼容模型在设置 `compat.thinkingTokenBudgetField`（或 `supportsThinkingTokenBudget`）后使用 |

#### thinkingBudgets

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

### UI 与显示

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `theme` | string | `"dark"` | 主题名（`"dark"`、`"light"` 或自定义） |
| `externalEditor` | string | 依次为 `$VISUAL`、`$EDITOR`，Windows 上记事本，其他平台 `nano` | Ctrl+G 外部编辑器命令；优先于环境变量 |
| `quietStartup` | boolean | `false` | 隐藏启动头部 |
| `defaultProjectTrust` | string | `"ask"` | 项目信任回退行为：`"ask"`、`"always"` 或 `"never"`。仅全局设置 |
| `collapseChangelog` | boolean | `false` | 更新后显示精简版变更日志 |
| `enableInstallTelemetry` | boolean | `true` | 发送匿名安装/更新 ping 及所选提供商的署名请求头。此项不控制更新检查 |
| `enableAnalytics` | boolean | `false` | 可选的分析数据共享。目前仅在实验性首次安装流程（`PI_EXPERIMENTAL=1`）中询问 |
| `trackingId` | string | - | 分析追踪标识，开启 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | string | `"tree"` | 双击 Escape 的动作：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | string | `"default"` | `/tree` 的默认过滤：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | number | `0` | 输入编辑器的水平内边距（0-3） |
| `outputPad` | number | `1` | 用户消息、助手消息和思考块的水平内边距（0 或 1） |
| `autocompleteMaxVisible` | number | `5` | 补全下拉的最大可见项数（3-20） |
| `showHardwareCursor` | boolean | `false` | TUI 为输入法定位终端光标时是否显示它 |
| `tuiMode` | string | `"regular"` | 交互 TUI 模式：`"regular"` 或实验性的 `"fullscreen"`。`/settings` 的修改立即生效；启动时 `--tui-mode` 覆盖此设置 |
| `fullscreenExitOutput` | string | `"transcript"` | 全屏退出输出：`"transcript"` 打印最终记录和恢复提示；`"resume-hint"` 恢复之前的屏幕并只打印恢复提示。regular 模式下无效果 |
| `fullscreenScrollbar` | string | `"auto"` | 全屏记录滚动条：`"auto"` 在滚动或指针悬停其轨道时临时显示；`"always"` 保留该列并一直显示；`"hidden"` 隐藏。regular 模式下无效果 |
| `fullscreenCopyOnSelect` | boolean | `true` | 全屏模式下选中文本自动复制。关闭时选区保持高亮，`Ctrl+X` 复制当前选区 |

VS Code 用户请加 `--wait`，编辑器退出后 Pi 才会恢复：

```json
{
  "externalEditor": "code --wait"
}
```

### 遥测与更新检查

`enableInstallTelemetry` 控制发往 `https://pi.dev/api/report-install` 的匿名安装/更新 ping，以及 OpenRouter、NVIDIA NIM、Cloudflare 请求中的 Pi 署名头。关闭会同时停用两者；但不会关闭更新检查——Pi 仍可请求 `https://pi.dev/api/latest-version` 查询最新版本。

设置 `PI_SKIP_VERSION_CHECK=1` 可禁用版本更新检查。`--offline` 或 `PI_OFFLINE=1` 可禁用上述所有启动网络操作，包括更新检查、软件包更新检查和安装/更新遥测。

### 网络

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `httpProxy` | string | - | HTTP 代理 URL，作用于 `HTTP_PROXY` 和 `HTTPS_PROXY`。仅全局设置 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### 警告

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `warnings.anthropicExtraUsage` | boolean | `true` | Anthropic 订阅认证可能产生付费额外用量时显示警告 |

```json
{
  "warnings": {
    "anthropicExtraUsage": false
  }
}
```

### 压缩

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `compaction.enabled` | boolean | `true` | 启用自动压缩 |
| `compaction.reserveTokens` | number | `16384` | 为 LLM 回复保留的 token |
| `compaction.keepRecentTokens` | number | `20000` | 保留（不摘要）的近期 token 数 |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### 分支摘要

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `branchSummary.reserveTokens` | number | `16384` | 选取分支历史时保留的 token；输出上限 4096 token |
| `branchSummary.skipPrompt` | boolean | `false` | 在 `/tree` 导航时跳过"是否摘要分支？"询问（默认不摘要） |

### 重试

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `retry.enabled` | boolean | `true` | 出现瞬时错误时启用智能体级自动重试 |
| `retry.maxRetries` | number | `3` | 智能体级最大重试次数 |
| `retry.baseDelayMs` | number | `2000` | 智能体级指数退避的基础延迟（2s、4s、8s） |
| `retry.provider.timeoutMs` | number | SDK 默认 | 提供商/SDK 请求超时（毫秒） |
| `retry.provider.maxRetries` | number | `0` | 提供商/SDK 重试次数 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 接受的服务端要求延迟上限（60s） |

提供商要求的重试延迟超过 `retry.provider.maxRetryDelayMs` 时，请求会立即失败并给出说明性错误，而不是默默等待。设为 `0` 关闭该上限。

除非确有需要，`retry.provider.maxRetries` 保持 `0`。设为大于 0 时，SDK/提供商层重试可能先于 Pi 处理用量超限错误，某些情况下会阻塞智能体直到提供商配额重置。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "timeoutMs": 3600000,
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

### 消息投递

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `steeringMode` | string | `"one-at-a-time"` | 引导消息的投递方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | 追问消息的投递方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | string | `"auto"` | 支持多传输方式的提供商的偏好传输：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头/体空闲超时（毫秒），也供有显式流空闲超时的提供商使用。设为 `0` 禁用 |
| `websocketConnectTimeoutMs` | number | `15000` | 支持 WebSocket 传输的提供商的连接握手超时（毫秒）。设为 `0` 禁用 |

### 终端与图片

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `terminal.showImages` | boolean | `true` | 在终端中显示图片（如受支持） |
| `terminal.imageWidthCells` | number | `60` | 内联图片的偏好宽度（终端列数） |
| `terminal.clearOnShrink` | boolean | `false` | 内容变矮时清除空行（可能闪烁） |
| `terminal.hyperlinks` | boolean 或 `"auto"` | `"auto"` | 覆盖 OSC 8 超链接支持（高级，仅 JSON） |
| `terminal.images` | string 或 boolean | `"auto"` | 覆盖图片协议支持：`"kitty"`、`"iterm2"`、`false` 或 `"auto"`（高级，仅 JSON） |
| `terminal.trueColor` | boolean 或 `"auto"` | `"auto"` | 覆盖真彩支持（高级，仅 JSON） |
| `images.autoResize` | boolean | `true` | 图片缩放至最大 2000x2000。作用于 `@文件` 附件、`read` 以及工具返回的图片 |
| `images.blockImages` | boolean | `false` | 禁止任何图片发送给 LLM |

### Shell

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `shellPath` | string | - | 自定义 shell 路径（如 Windows 上的 Cygwin）；支持 `~` 前缀表示主目录 |
| `shellCommandPrefix` | string | - | 每条 bash 命令的前缀（如 `"shopt -s expand_aliases"`） |
| `npmCommand` | string[] | - | 用于 npm 包查询/安装的命令 argv（如 `["mise", "exec", "node@20", "--", "npm"]`） |

JSON 中的 Windows 路径必须用正斜杠或转义反斜杠：

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

`npmCommand` 用于所有 npm 包管理操作，包括安装、卸载和 git 包内的依赖安装。用户级 npm 包装在 `~/.pi/agent/npm/`；项目级装在 `.pi/npm/`。argv 按进程启动时的形式书写。配置了 `npmCommand` 时，git 包的依赖安装使用普通 `install`，避免包装器或其他包管理器不认识 npm 特有标志。

### 工具

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `defaultTools` | string[] | - | 初始启用的内置工具。省略时使用 Pi 的标准默认值 |

`defaultTools` 选择启动时启用的内置工具。扩展和 SDK 自定义工具不受影响。可用的内置工具为 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`：

```json
{
  "defaultTools": ["bash", "edit", "write"]
}
```

Windows 上选 `powershell` 而非 `bash`，或两者都保留：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

空数组表示不启用任何内置工具，同时保留扩展与 SDK 自定义工具。`--tools` 用严格白名单替代此行为；`--no-tools` 禁用全部工具；`--no-builtin-tools` 禁用内置默认；`--exclude-tools` 在结果列表上过滤。项目的 `defaultTools` 数组会整体替换全局数组。

### 会话

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `sessionDir` | string | - | 会话文件存储目录。支持绝对、相对路径及 `~` |

```json
{ "sessionDir": ".pi/sessions" }
```

多个来源同时指定会话目录时，优先级为 `--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，然后是 settings.json 的 `sessionDir`。

### 模型轮换

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enabledModels` | string[] | - | Ctrl+P 轮换的模型模式（与 `--models` CLI 参数格式相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `markdown.codeBlockIndent` | string | `"  "` | 代码块缩进 |
| `markdown.mermaid` | string | `"streaming"` | Mermaid 渲染模式：`"off"`、`"final"` 或 `"streaming"` |

### 资源

这些设置定义从哪里加载扩展、技能、提示词和主题。

`~/.pi/agent/settings.json` 中的路径相对 `~/.pi/agent` 解析；`.pi/settings.json` 中的路径相对 `.pi` 解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `packages` | array | `[]` | 从中加载资源的 npm/git 软件包 |
| `extensions` | string[] | `[]` | 本地扩展文件路径或目录 |
| `skills` | string[] | `[]` | 本地技能文件路径或目录 |
| `prompts` | string[] | `[]` | 本地提示词模板路径或目录 |
| `themes` | string[] | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | 把技能注册为 `/skill:名称` 命令 |

数组支持 glob 模式与排除：`!模式` 排除；`+路径` 强制包含；`-路径` 强制排除。

#### packages

字符串形式加载软件包的全部资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式过滤要加载的资源：

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

软件包管理详情见 [Pi 软件包](/docs/packages/)。

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

项目设置（`.pi/settings.json`）覆盖全局设置。嵌套对象会合并：

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
