# 设置

Pi 使用 JSON 设置文件，项目设置会覆盖全局设置。

| 位置 | 适用范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

可直接编辑文件，或使用 `/settings` 命令进行常见配置。要交互式地保存启动时的模型默认值，可使用 `/model` 并在所需模型上按 Ctrl+S。要保存启动时的思考级别，可使用 `/thinking` 并按 Ctrl+S。

## 项目信任

在交互式启动时，pi 会在信任包含项目本地设置、资源或项目 `.agents/skills` 的文件夹之前进行询问，除非该文件夹或其父文件夹在 `~/.pi/agent/trust.json` 中已有保存的决定。信任一个项目允许 pi 加载 `.pi/settings.json` 和 `.pi` 资源，安装缺失的项目软件包，并执行项目扩展。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会显示信任提示。如果没有适用的已保存信任决定，它们将使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略那些项目资源，而 `always` 则信任它们。传递 `--approve`/`-a` 或 `--no-approve`/`-na` 可覆盖单次运行的项目信任。

如果既无适用的扩展也无已保存的决定，`defaultProjectTrust` 将控制回退行为。在 `~/.pi/agent/settings.json` 中将其设置为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 更改。

`pi config` 和软件包命令使用相同的项目信任流程，但 `pi update` 从不提示。传递 `--approve` 可为单条命令信任项目本地设置，或传递 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 可为将来的会话保存项目信任决定，包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此请重启 pi 以使更改生效。

## 全部设置

### 思考

### 思考层级

PI Shell 在**思考层级**下运行推理模型。通过重复按 `Ctrl+L` 或使用 `/thinking` 命令，可在思考层级之间循环切换。以下表格描述了各层级：

| 思考层级 | 描述 |
|---|---|
| `off` | 无思考，对应低推理努力 |
| `minimal` | 仅强制思维，最少推理成本 |
| `low` | 高效能、低成本运行 |
| `medium` | 平衡推理成本与输出质量 |
| `high` | 高质量、高成本运行 |
| `xhigh` | 用于复杂任务的高强度推理 |
| `max` | 用于最复杂任务的最大推理工作量 |

您也可以通过按 `Shift+L` 逐级提升，或按 `Alt+L` 逐级降低思考层级。要直接设置具体层级，可使用 `/thinking <level>` 命令。

在 `/exit` 模式下，用户通过每次按 `L` 键循环切换思考层级，并按 `Ctrl+L` 切换高级思考模式的开关。

### 会话中调整思考

您可以在会话中通过 `/thinking` 命令或 `Ctrl+L` 调整思考，这立即生效。或者，您也可以在 `/model` 选择器中设置模型的默认思考层级。

### 配置

在 `config.yaml` 文件中，可在 `thinking:` 部分下配置思考层级设置：

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `startup` | string | `"medium"` | 启动时的默认思考层级，除非指定了 `--thinking` 标志。可用值：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"` |
| `modelThinkingLevels` | object | - | 各模型的启动思考层级，以 `"provider/modelId"` 为键；可通过 `/settings` → 各模型的默认思考层级进行配置，或手动编辑 |
| `hideThinkingBlock` | boolean | `false` | 在输出中隐藏思考块 |
| `showCacheMissNotices` | boolean | `false` | 显示关于显著提示缓存未命中、缓存预热成功使用、压缩或分支摘要使用，以及提供商恢复诊断（如丢弃的 Anthropic 思考块）的转录通知 |
| `thinkingBudgets` | object | - | 每个思考层级的自定义令牌预算。Anthropic、Google 和 Bedrock 原生使用这些预算。OpenAI 兼容模型在设置了 `compat.thinkingTokenBudgetField`（或 `supportsThinkingTokenBudget`）时使用这些预算。 |
| `cacheWarming` | string | `"streaming"` | 提示缓存预热模式：`"off"`、`"streaming"` 或 `"idle"`。仅全局设置。 |

#### 缓存预热

只有当预期避免的缓存未命中成本减去刷新成本后，仍留下至少 0.05 美元的预期节省时，才会发送刷新。活跃智能体运行使用 100% 的延续概率。`/session` 显示下一个决策、延续概率、预期节省、阈值和估计成本。当启用缓存未命中通知时，每次成功刷新都会在记录中显示其成本；通知会标识扩展覆盖。

```json
{
  "cacheWarming": "idle"
}
```

当上下文发生变化（模型切换、压缩、分支导航）时，预热停止。空闲预热在最后一次真实提供商请求后最多 30 分钟停止；活跃智能体运行期间的预热在 60 分钟后停止。扩展可以通过 [`cache_warming_decision`](extensions.md#cache_warming_decision) 事件覆盖每个决策。

每次刷新按完整上下文的缓存读取加上一个输出令牌计费。使用量和成本显示在会话总计中，但永远不会进入模型上下文。Pi 在缓存生命周期的 90% 处安排候选刷新，同时在到期前至少保留十秒钟。

预热需要了解模型以及请求所使用的保留层（`short`，或带有 `PI_CACHE_RETENTION=long` 的 `long`）的已知缓存生命周期。内置目录包含直接 Anthropic 的生命周期；自定义模型和其他提供商可以在 `models.json` 中使用 `promptCache` 声明自己的生命周期（参见 [提示词缓存生命周期](models.md#prompt-cache-lifetimes)）。当思考开启时，使用基于预算而非自适应思考的 Claude 模型会被跳过，因为 Anthropic 从 `max_tokens` 推导思考预算，并以此作为消息缓存的键，因此一个令牌的请求无法重现该条目。

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

| 设置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `theme` | 字符串 | `"dark"` | 主题名称（`"dark"`、`"light"` 或自定义） |
| `externalEditor` | 字符串 | `$VISUAL`，其次 `$EDITOR`，再者为 Windows 上的 Notepad 或其他平台上的 `nano` | Ctrl+G 外部编辑器命令；优先于环境变量 |
| `quietStartup` | 布尔值 | `false` | 隐藏启动头部信息 |
| `defaultProjectTrust` | 字符串 | `"ask"` | 回退的项目信任行为：`"ask"`、`"always"` 或 `"never"`。仅全局设置 |
| `collapseChangelog` | 布尔值 | `false` | 更新后显示简化的变更日志 |
| `enableInstallTelemetry` | 布尔值 | `true` | 发送匿名安装/更新通知及选定的提供商归属报头。此设置不控制更新检查 |
| `enableAnalytics` | 布尔值 | `false` | 自愿参与的分析数据共享。目前仅在实验性首次设置时询问（`PI_EXPERIMENTAL=1`） |
| `trackingId` | 字符串 | - | 分析跟踪标识符，在开启 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | 字符串 | `"tree"` | 双重 Esc 操作：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | 字符串 | `"default"` | `/tree` 的默认过滤器：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | 数字 | `0` | 输入编辑器的水平内边距（0-3） |
| `outputPad` | 数字 | `1` | 用户消息、助手消息和思考内容的水平内边距（0 或 1） |
| `autocompleteMaxVisible` | 数字 | `5` | 自动补全下拉列表中最大可见项数（3-20） |
| `showHardwareCursor` | 布尔值 | `false` | 在 TUI 定位终端光标以支持 IME 时显示终端光标 |
| `tuiMode` | 字符串 | `"regular"` | 交互式 TUI 模式：`"regular"` 或实验性 `"fullscreen"`。通过 `/settings` 进行的更改会立即生效；`--tui-mode` 在启动时覆盖此设置 |
| `fullscreenExitOutput` | 字符串 | `"transcript"` | 全屏退出输出：`"transcript"` 打印最终转录文本和恢复提示，而 `"resume-hint"` 恢复之前的屏幕并仅打印恢复提示。在常规 TUI 模式下无效果 |
| `fullscreenScrollbar` | 字符串 | `"auto"` | 全屏转录滚动条：`"auto"` 在滚动或指针位于最右侧列轨道时临时显示，`"always"` 保留该列并保持可见，`"hidden"` 则将其隐藏。在常规 TUI 模式下无效果 |
| `fullscreenCopyOnSelect` | 布尔值 | `true` | 在全屏模式下自动复制选中的文本。禁用后，选中内容保持高亮，`Ctrl+X` 复制当前选中内容 |

对于 VS Code，请包含 `--wait`，以便编辑器退出后 pi 能恢复：

```json
{
  "externalEditor": "code --wait"
}
```

### 遥测与更新检查

`enableInstallTelemetry` 控制对 `https://pi.dev/api/report-install` 的匿名安装/更新请求，以及针对 OpenRouter、NVIDIA NIM 和 Cloudflare 提供商的 Pi 归属头部信息。选择退出将同时禁用这两项功能。它不会禁用更新检查；Pi 仍可获取 `https://pi.dev/api/latest-version` 来查找最新版本。

设置 `PI_SKIP_VERSION_CHECK=1` 可禁用 Pi 版本更新检查。使用 `--offline` 或设置 `PI_OFFLINE=1` 可禁用此处描述的所有启动网络操作，包括更新检查、软件包更新检查以及安装/更新遥测。

### 网络

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `httpProxy` | 字符串 | - | 作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用的 HTTP 代理 URL。仅全局设置。 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### 警告

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | 当 Anthropic 订阅认证可能产生额外付费使用时显示警告 |

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
| `compaction.enabled` | boolean | `true` | 启用自动压缩 |
| `compaction.reserveTokens` | number | `16384` | 为LLM响应预留的令牌数 |
| `compaction.keepRecentTokens` | number | `20000` | 保留的近期令牌数（不进行摘要） |
| `compaction.modelOverrides` | object | - | 按精确的 `"provider/modelId"` 键，对每模型的 `reserveTokens` 和 `keepRecentTokens` 进行覆盖 |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

#### 按模型的压缩覆盖设置

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000,
    "modelOverrides": {
      "some-provider/big-model": {
        "reserveTokens": 400000
      },
      "local/small-model": {
        "reserveTokens": 2048,
        "keepRecentTokens": 4096
      }
    }
  }
}
```

键名与精确、区分大小写的 `provider/modelId` 值匹配，而非名称或 glob 模式。模型 ID 可能包含斜杠（例如，`openrouter/anthropic/claude-sonnet-4`）。

每个 token 设置独立解析：匹配的模型覆盖设置 → 常规 `compaction` 设置 → 内置默认值。在示例中，`some-provider/big-model` 保留常规的 20000 个近期 token。token 值必须是非负安全整数。匹配的模型覆盖设置中无效的值在读取时会报错；只有省略的字段才回退到常规设置。模型覆盖条目必须是对象。即使当前活动模型有有效的覆盖设置，无效的常规 token 设置也会在读取时报错。只有省略的常规值才使用内置默认值。接受零值，但 `reserveTokens: 0` 不留下响应余量，同时将摘要输出预算设为零。

全局和项目设置会在模型查找**之前**递归合并。项目可以覆盖某个模型的一个字段，而不会替换其其他字段或其他模型。全局的模型特定值优先于项目范围的回退设置；在项目中覆盖同一模型条目即可更改它。

`enabled` 并非按模型区分。活动模型的 token 设置适用于手动压缩、自动阈值检查（包括助手回合之间）以及溢出恢复。切换模型在下次检查或压缩时生效。在 JSON 中配置覆盖设置；`/settings` 保留常规的自动压缩开关。

有关触发与摘要行为，请参阅 [compaction.md](/docs/compaction/)。

### 分支摘要

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | 选择分支历史时保留的令牌数；输出上限为4096个令牌 |
| `branchSummary.skipPrompt` | boolean | `false` | 在 `/tree` 导航时跳过“总结分支？”提示（默认不进行总结） |

### 重试

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `retry.enabled` | boolean | `true` | 在瞬时错误上启用自动智能体级重试 |
| `retry.maxRetries` | number | `3` | 智能体级重试的最大尝试次数 |
| `retry.baseDelayMs` | number | `2000` | 智能体级指数退避的基础延迟（2秒，4秒，8秒） |
| `retry.maxAgentDelayMs` | number | `60000` | 智能体级重试的最大延迟（60秒） |
| `retry.provider.timeoutMs` | number | SDK默认值 | 提供商/SDK请求超时（以毫秒为单位） |
| `retry.provider.maxRetries` | number | `0` | 提供商/SDK重试尝试次数 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 在失败之前服务器要求的最大延迟（60秒） |

智能体级重试使用指数退避，并以 `retry.maxAgentDelayMs` 为上限，因此长时间的退避运行在持续故障后仍能保持响应。

当提供商请求的重试延迟超过 `retry.provider.maxRetryDelayMs` 时，请求会立即失败并返回一条信息丰富的错误消息，而不是默默等待。将其设置为 `0` 可禁用此限制。

除非显式需要提供商级重试，否则请将 `retry.provider.maxRetries` 保持为 `0`。将其设置为大于 `0` 的值可能会导致 SDK/提供商在 Pi 看到错误之前处理超出使用量限制的错误，在某些情况下可能会阻塞智能体，直到提供商的配额重置。

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

### 消息传递

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `steeringMode` | 字符串 | `"one-at-a-time"` | 引导消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | 字符串 | `"one-at-a-time"` | 追问消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | 字符串 | `"auto"` | 支持多种传输方式的提供商的首选传输方式：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | 数字 | `300000` | HTTP 头部/正文空闲超时时间（毫秒），也用于具有显式流空闲超时的提供商。设置为 `0` 可禁用。 |
| `websocketConnectTimeoutMs` | 数字 | `15000` | 支持 WebSocket 传输方式的提供商的 WebSocket 连接/打开握手超时时间（毫秒）。设置为 `0` 可禁用。 |

### 终端与图片

| 设置 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | 在终端中显示图像（若支持） |
| `terminal.imageWidthCells` | number | `60` | 终端单元格中的首选内联图像宽度 |
| `terminal.clearOnShrink` | boolean | `false` | 内容缩小时清除空行（可能导致闪烁） |
| `terminal.hyperlinks` | boolean 或 `"auto"` | `"auto"` | 覆盖 OSC 8 超链接支持（高级，仅 JSON） |
| `terminal.images` | string 或 boolean | `"auto"` | 使用 `"kitty"`、`"iterm2"`、`false` 或 `"auto"` 覆盖图像协议支持（高级，仅 JSON） |
| `terminal.trueColor` | boolean 或 `"auto"` | `"auto"` | 覆盖真彩色支持（高级，仅 JSON） |
| `images.autoResize` | boolean | `true` | 将图像调整至最大 2000x2000。适用于 `@file` 附件、`read` 和工具返回的图像 |
| `images.blockImages` | boolean | `false` | 阻止所有图像发送给 LLM |

### 外壳

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `shellPath` | string | - | 自定义 shell 路径（例如，Windows 上的 Cygwin）；支持以 `~` 开头表示主目录 |
| `shellCommandPrefix` | string | - | 每条 bash 命令的前缀（例如，`"shopt -s expand_aliases"`） |
| `npmCommand` | string[] | - | 用于 npm 软件包查找/安装操作的命令参数（例如，`["mise", "exec", "node@20", "--", "npm"]`） |

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

`npmCommand` 用于所有 npm 软件包管理器操作，包括安装、卸载，以及 git 软件包内的依赖安装。用户级 npm 软件包安装在 `~/.pi/agent/npm/` 下；项目级 npm 软件包安装在 `.pi/npm/` 下。请严格使用 argv 风格的条目，与进程启动方式保持一致。当配置了 `npmCommand` 后，git 软件包的依赖安装将使用普通的 `install` 命令，以避免在包装器或替代软件包管理器中带有 npm 特有的标志。

### 工具

| 设置 | 类型 | 默认 | 描述 |
|------|------|------|------|
| `defaultTools` | string[] | - | 初始启用的内置工具。如果省略，Pi 使用标准默认值 |

`defaultTools` 选择启动时启用的内置工具。扩展和 SDK 自定义工具保持启用。可用的内置工具为 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`：

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

空数组启动时没有内置工具，但保留扩展和 SDK 自定义工具。`--tools` 用严格的白名单替换此行为，适用于所有工具；`--no-tools` 禁用所有工具；`--no-builtin-tools` 禁用内置默认值。`--exclude-tools` 过滤结果列表。项目 `defaultTools` 数组替换全局数组。

### 会话

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `sessionDir` | string | - | 存储会话文件的目录。支持绝对路径或相对路径，以及 `~`。 |

```json
{ "sessionDir": ".pi/sessions" }
```

当多个来源指定会话目录时，优先级顺序为 `--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，然后是 settings.json 中的 `sessionDir`。

### 模型循环

| 设置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | 用于 Ctrl+P 循环切换的模型模式（格式与 `--models` CLI 命令相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| 设置项 | 类型 | 默认值 | 描述 |
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
| `prompts` | string[] | `[]` | 本地提示词模板路径或目录 |
| `themes` | string[] | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | 将技能注册为 `/skill:name` 命令 |

数组支持 glob 模式和排除。使用 `!pattern` 排除。使用 `+path` 强制包含精确路径，使用 `-path` 强制排除精确路径。

#### 软件包

字符串形式从软件包加载所有资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式筛选要加载的资源：

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

有关软件包管理的详细信息，请参阅[软件包管理文档](/docs/packages/)。

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

项目设置（`.pi/settings.json`）会覆盖全局设置。嵌套对象将进行合并：

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

// 合并结果
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
