# 设置参考

本参考列出了用户可配置的设置、其类型、默认值和用途。项目设置会覆盖代理目录设置。资源列表会被合并。有关文件位置和信任行为，请参阅[配置](/docs/configuration/)。

## 模型与思考

<a id="model-cycling"></a>

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultProvider` | string | 自动 | 启动时的 AI 提供商。 |
| `defaultModel` | string | 自动 | 启动时的模型 ID。 |
| `defaultThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | `"medium"` | 启动时的思考级别。 |
| `modelThinkingLevels` | object | 无 | 按精确的 `provider/modelId` 为每个模型设置启动思考级别。 |
| `thinkingBudgets` | object | 内置预算 | 用于 `minimal`、`low`、`medium` 和 `high` 思考级别的令牌预算。 |
| `enabledModels` | `string[]` | 所有可用模型 | 用于启动选择和模型循环的模型模式。使用与 `--models` 相同的格式。 |
| `hideThinkingBlock` | boolean | `false` | 在转录中隐藏思考块。 |
| `showCacheMissNotices` | boolean | `false` | 显示重大缓存未命中、成功缓存预热、压缩使用及提供商恢复的通知。 |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"streaming"` | 在活动运行期间，或使用 `"idle"` 时在运行之间，保持符合条件的提供商提示缓存温暖。仅限全局设置。 |

仅当模型声明了缓存生命周期且 Pi 估计可避免至少 $0.05 的缓存未命中成本时，缓存预热才会运行。刷新次数计入会话总数，但不进入模型上下文。`/session` 显示下一个决策；扩展可以通过 `cache_warming_decision` 覆盖它。参见[提示缓存生命周期](models.md#prompt-cache-lifetimes)。

参见[选择模型](/docs/models/)以了解模型选择和思考控制。

## 交互

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的引导消息如何被传递。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的追问消息如何被传递。 |
| `externalEditor` | 字符串 | `$VISUAL`，`$EDITOR`，然后平台默认值 | 由外部编辑器键位绑定打开的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 编辑器为空时，双击Escape键的动作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree`命令使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 项目信任的回退行为。**只能在代理目录设置中配置。** |

## 工具

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的内置工具。空数组会禁用所有内置工具，但不会影响扩展或 SDK 工具。 |

可用的内置工具包括 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`。CLI 工具选项会在单次调用中覆盖此设置。参见 [命令行](cli.md#tools)。

## 会话与上下文

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | 字符串 | 代理会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 可覆盖此设置。 |

### 压缩

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 为模型响应预留的令牌数。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 保留的近期令牌数，不进行摘要。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确的 `provider/modelId` 键控的每模型令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须是非负安全整数。每个值独立地从匹配的模型覆盖项、常规压缩设置、内置默认值中依次解析。项目和用户对象在模型查找前合并。

有关触发、摘要和验证行为，请参阅 [压缩参考](/docs/compaction/)。

### 分支摘要

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 在总结分支历史时保留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不生成摘要。 |

## 终端和显示

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | string | `"system"` | 内置或自定义主题名称。`system` 从终端主题中派生颜色。 |
| `quietStartup` | boolean | `false` | 隐藏启动横幅。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"regular"` | 交互式终端 UI 模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 全屏模式退出时打印的输出。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏记录滚动条行为。 |
| `fullscreenCopyOnSelect` | boolean | `true` | 在全屏模式下自动复制选中的文本。 |
| `editorPaddingX` | number | `0` | 编辑器水平内边距，范围 0 到 3 个字符格。 |
| `outputPad` | `0 \| 1` | `1` | 记录水平内边距。 |
| `autocompleteMaxVisible` | number | `5` | 可见的自动补全条目，范围 3 到 20。 |
| `showHardwareCursor` | boolean | `false` | 在 Pi 为输入法定位时显示终端光标。 |
| `terminal.showImages` | boolean | `true` | 在支持时显示内联图像。 |
| `terminal.imageWidthCells` | number | `60` | 内联图像在终端中的首选宽度（以字符格为单位）。 |
| `terminal.clearOnShrink` | boolean | `false` | 当渲染内容缩小时清除空行。 |
| `terminal.showTerminalProgress` | boolean | `false` | 在终端标签页中显示 OSC 9;4 进度。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 覆盖真彩色检测。 |
| `images.autoResize` | boolean | `true` | 在发送到模型之前，将图像调整为最大 2000x2000 像素。 |
| `images.blockImages` | boolean | `false` | 阻止图像发送给模型。 |
| `markdown.codeBlockIndent` | string | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 渲染模式。 |

有关格式和平台详细信息，请参阅 [主题](/docs/themes/) 和 [终端设置](/docs/terminal-setup/)。

根据您的要求，以下是文档中表格部分及其前后说明文字的简体中文翻译。我保留了markdown结构、代码块和原始字段名，对表格内的描述及说明性文字进行了翻译。

---

#### 传输传输

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `transport` | 字符串 | `"websocket"` | WebSocket 和 `http` 是当前支持的传输协议。请参考 `https://github.com/yaacov/pi/tree/master/docs/transports` 了解更详细的信息。 |
| `httpProxy` | 字符串 | 无 | 为 Pi 管理的 HTTP 客户端设置代理 URL，该值将同时应用于 `HTTP_PROXY` 和 `HTTPS_PROXY`。**只能在代理目录设置中配置。** |
| `httpIdleTimeoutMs` | 数字 | `300000` | HTTP 消息头和消息体的空闲超时时间（毫秒）。设为 `0` 可禁用。 |
| `websocketConnectTimeoutMs` | 数字 | `15000` | WebSocket 连接超时时间（毫秒）。设为 `0` 可禁用。 |
| `retry.enabled` | 布尔值 | `true` | 对瞬时故障启用自动代理级重试。 |
| `retry.maxRetries` | 数字 | `3` | 最大代理级重试次数。 |
| `retry.baseDelayMs` | 数字 | `2000` | 指数退避的初始延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | 数字 | `60000` | 代理级最大重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | 数字 | `httpIdleTimeoutMs` | 提供商的请求超时时间（毫秒）。 |
| `retry.provider.maxRetries` | 数字 | `0` | 提供商级别的重试次数。 |
| `retry.provider.maxRetryDelayMs` | 数字 | `60000` | 服务器请求的最大延迟（毫秒）。设为 `0` 可禁用该限制。 |

除非确实需要提供商级别的重试，否则请将 `retry.provider.maxRetries` 保持为 `0`。提供商级别的重试可能会延迟 Pi 处理配额和使用量限制错误的能力。

## 外壳

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | 字符串 | 平台默认 | 自定义外壳可执行文件路径。支持前导 `~`。 |
| `shellCommandPrefix` | 字符串 | 无 | 在每个外壳命令前添加的前缀。 |
| `npmCommand` | `string[]` | `npm` | 用于 npm 软件包查找和安装的命令及参数。 |

有关外壳设置，请参阅 [外壳别名](/docs/shell-aliases/)；有关软件包管理器行为，请参阅 [Pi 软件包](/docs/packages/)。

## 资源

用户设置中的资源路径从代理目录解析。项目设置中的路径从项目的 `.pi` 目录解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | 数组 | `[]` | npm、git 或本地 Pi 软件包来源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | 布尔值 | `true` | 将技能注册为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行全局排除、使用 `+path` 进行精确包含、使用 `-path` 进行精确排除。Pi 会加载用户级和项目设置中列出的资源。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | 布尔值 | `false` | 更新后显示精简的变更日志。 |
| `enableInstallTelemetry` | 布尔值 | `true` | 启用匿名安装/更新报告及选定的提供商归属头。不控制更新检查。 |
| `enableAnalytics` | 布尔值 | `false` | 选择加入分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 当 Anthropic 订阅认证可能产生付费额外使用时发出警告。 |
