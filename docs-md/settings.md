# 设置参考

本参考列出了用户可配置的设置、其类型、默认值及用途。项目设置会覆盖代理目录设置。资源列表会被合并。关于文件位置和信任行为，请参阅[配置](/docs/configuration/)。

## 模型与思考

<a id="model-cycling"></a>

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultProvider` | string | 自动 | 启动时的 AI 提供商。 |
| `defaultModel` | string | 自动 | 启动时的模型 ID。 |
| `defaultThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | `"medium"` | 启动时的思考级别。 |
| `modelThinkingLevels` | object | 无 | 按精确的 `provider/modelId` 键控的每模型启动思考级别。 |
| `thinkingBudgets` | object | 内置预算 | 用于 `minimal`、`low`、`medium` 和 `high` 思考级别的令牌预算。 |
| `enabledModels` | `string[]` | 所有可用模型 | 用于启动选择与模型循环的模型模式。使用与 `--models` 相同的格式。 |
| `hideThinkingBlock` | boolean | `false` | 在转录中隐藏思考块。 |
| `showCacheMissNotices` | boolean | `false` | 显示关于显著缓存未命中、成功缓存预热、压缩使用以及提供商恢复的通知。 |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"streaming"` | 在活动运行期间保持符合条件的提供商提示缓存温暖，或使用 `"idle"` 在运行之间保持。仅限全局设置。 |

缓存预热仅在模型声明了缓存生命周期且 Pi 估计至少节省 $0.05 的缓存未命中成本时运行。刷新次数计入会话总计，但不进入模型上下文。`/session` 显示下一次决策；扩展可以用 `cache_warming_decision` 覆盖它。参见 [提示缓存生命周期](models.md#prompt-cache-lifetimes)。

参见 [选择模型](/docs/models/) 了解模型选择与思考控制。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的引导消息如何传递。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的追问消息如何传递。 |
| `externalEditor` | 字符串 | `$VISUAL`、`$EDITOR`，然后是平台默认值 | 外部编辑器按键绑定的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 编辑器为空时双击 Escape 键的动作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree` 使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 项目信任的默认行为。**只能在代理目录设置中配置。** |

## 工具

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的内置工具。空数组会禁用所有内置工具，但不会禁用扩展或 SDK 工具。 |

可用的内置工具包括 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`。命令行工具选项会覆盖此设置的单次调用。参见 [命令行](cli.md#tools)。

## 会话与上下文

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | string | 智能体会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 覆盖此设置。 |

### 压缩

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 为模型响应保留的令牌数。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 无需摘要而保留的近期令牌数。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确的 `provider/modelId` 键控的每模型令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须为非负安全整数。每个值分别从匹配的模型覆盖项、常规压缩设置、内置默认值中独立解析。项目与用户对象在模型查找之前合并。

关于触发、摘要及验证行为，请参阅 [压缩参考](/docs/compaction/)。

### 分支摘要

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 总结分支历史时预留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不生成摘要。 |

## 终端与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | 字符串 | 自动检测 | 内置或自定义主题名称。 |
| `quietStartup` | 布尔值 | `false` | 隐藏启动头部信息。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"regular"` | 交互式终端用户界面模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时输出的内容。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏转录滚动条行为。 |
| `fullscreenCopyOnSelect` | 布尔值 | `true` | 在全屏模式下自动复制选中的文本。 |
| `editorPaddingX` | 数字 | `0` | 编辑器水平内边距，范围从 0 到 3 个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 转录内容的水平内边距。 |
| `autocompleteMaxVisible` | 数字 | `5` | 可见的自动补全条目数，范围从 3 到 20。 |
| `showHardwareCursor` | 布尔值 | `false` | 当 Pi 为输入法定位光标时显示终端光标。 |
| `terminal.showImages` | 布尔值 | `true` | 在支持时显示内联图像。 |
| `terminal.imageWidthCells` | 数字 | `60` | 内联图像在终端单元格中的首选宽度。 |
| `terminal.clearOnShrink` | 布尔值 | `false` | 当渲染内容缩小时清除空行。 |
| `terminal.showTerminalProgress` | 布尔值 | `false` | 在终端标签页中显示 OSC 9;4 进度。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 覆盖真彩色检测。 |
| `images.autoResize` | 布尔值 | `true` | 在将图像发送给模型之前，将其调整为最大 2000×2000 像素。 |
| `images.blockImages` | 布尔值 | `false` | 阻止将图像发送给模型。 |
| `markdown.codeBlockIndent` | 字符串 | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 渲染模式。 |

有关格式和平台详细信息，请参阅 [主题](/docs/themes/) 和 [终端设置](/docs/terminal-setup/)。

## 网络与重试

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | 对于支持多种传输方式的 AI 提供商，首选传输方式。 |
| `httpProxy` | string | 无 | 代理 URL，作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用于 Pi 管理的 HTTP 客户端。**只能在代理目录设置中配置。** |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头部和主体的空闲超时时间（毫秒）。设置为 `0` 以禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | WebSocket 连接超时时间（毫秒）。设置为 `0` 以禁用。 |
| `retry.enabled` | boolean | `true` | 为瞬时故障启用自动代理级重试。 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数。 |
| `retry.baseDelayMs` | number | `2000` | 初始指数退避延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | number | `60000` | 最大代理级重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | 提供商请求超时时间（毫秒）。 |
| `retry.provider.maxRetries` | number | `0` | 提供商级重试次数。 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 服务器请求的最大延迟（毫秒）。设置为 `0` 以禁用限制。 |

除非需要提供商级重试，否则请将 `retry.provider.maxRetries` 保持为 `0`。提供商重试可能会延迟 Pi 自行处理配额和使用限制错误。

## 外壳

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | string | 平台默认值 | 自定义 shell 可执行文件路径。支持以 `~` 开头。 |
| `shellCommandPrefix` | string | 无 | 在每个 shell 命令前添加的前缀。 |
| `npmCommand` | `string[]` | `npm` | 用于 npm 软件包查找和安装的命令及参数。 |

有关外壳设置，请参阅[外壳别名](/docs/shell-aliases/)，有关软件包管理器行为，请参阅[Pi 软件包](/docs/packages/)。

## 资源

用户设置中的资源路径从代理目录解析。项目设置中的路径从项目的 `.pi` 目录解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | 数组 | `[]` | npm、git 或本地 Pi 软件包源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | 布尔值 | `true` | 将技能注册为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行全局排除，使用 `+path` 进行精确包含，使用 `-path` 进行精确排除。Pi 会加载用户级和项目设置中列出的资源。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | 布尔值 | `false` | 更新后显示精简的变更日志。 |
| `enableInstallTelemetry` | 布尔值 | `true` | 启用匿名安装/更新报告及选定的提供商归属头。不控制更新检查。 |
| `enableAnalytics` | 布尔值 | `false` | 选择加入分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 当 Anthropic 订阅认证可能使用付费额外用量时发出警告。 |
