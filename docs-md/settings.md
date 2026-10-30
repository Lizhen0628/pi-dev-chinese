# 设置参考

本参考列出了用户可配置的设置，包括其类型、默认值和用途。项目设置会覆盖代理目录设置。资源列表会进行合并。文件位置和信任行为请参阅[配置](/docs/configuration/)。

在 `settings.json` 中添加 `"$schema": "https://pi.dev/schemas/settings.schema.json"`，以获得编辑器验证与补全功能。

## 模型与思考

<a id="model-cycling"></a>

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultProvider` | string | 自动 | 启动时的 AI 提供商。 |
| `defaultModel` | string | 自动 | 启动时的模型 ID。 |
| `defaultThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "max"` | `"medium"` | 启动时的思考级别。 |
| `modelThinkingLevels` | object | 无 | 按精确的 `provider/modelId` 键控的每模型启动思考级别。 |
| `thinkingBudgets` | object | 内置预算 | `minimal`、`low`、`medium` 和 `high` 思考级别的令牌预算。 |
| `enabledModels` | `string[]` | 所有可用模型 | 用于启动选择和模型循环的模型模式。使用与 `--models` 相同的格式。 |
| `hideThinkingBlock` | boolean | `false` | 在记录中隐藏思考块。 |
| `showCacheMissNotices` | boolean | `false` | 显示显著缓存未命中、成功缓存预热、压缩使用和提供商恢复的通知。 |
| `cacheWarming` | `"off" \| "streaming" \| "idle"` | `"streaming"` | 在活动运行期间保持符合条件的提供商提示缓存温暖，或使用 `"idle"` 在运行之间保持。仅限全局设置。 |

缓存预热仅在模型声明缓存生命周期且 Pi 估计至少避免 $0.05 的缓存未命中成本时运行。刷新使用会计入会话总数，但不会进入模型上下文。`/session` 显示下一个决策；扩展可以使用 `cache_warming_decision` 覆盖它。参见 [提示缓存生命周期](models.md#prompt-cache-lifetimes)。

有关模型选择和思考控制，请参见 [选择模型](/docs/models/)。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的引导消息如何被传递。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的追问消息如何被传递。 |
| `externalEditor` | string | `$VISUAL`, `$EDITOR`，然后是平台默认值 | 外部编辑器按键绑定所打开的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 编辑器为空时双击 Escape 键的动作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree` 使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 项目信任的默认行为。**只能在代理目录设置中配置。** |

## 工具

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`、`bash`、`edit`、`write` | 启动时启用的工具。普通名称会替换默认列表；`+name` 表示添加工具，`-name` 表示移除工具。空数组会禁用所有内置工具，但扩展工具和 SDK 工具不受影响。 |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | `codemode` 工具在活动期间如何呈现工具列表。`on`：已声明的工具会在其描述末尾追加一条说明，提示脚本可调用它们；`codemode` 仅列出未声明的工具。`only`：`codemode` 列出脚本可调用的所有工具，且活动中的内置工具和扩展工具对模型隐藏，模型需通过 `codemode` 访问它们。 |
| `codemode.inlineBudget` | number | `3000` | `codemode` 工具的描述可用于工具声明的预估 token 数（字符数 / 4）。超出预算的工具会被省略，可通过 `searchTools()` 查找。`0` 时仅列出命名空间。 |

可用内置工具包括 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`。`defaultTools` 也可以指定 `codemode` 和 `tool_search`（内置扩展会以非活动状态注册），以及其他以非活动状态注册的扩展工具。

仅包含 `+name` 和 `-name` 条目的列表会修改继承的选择，而非替换它。例如，以下配置会在默认工具之外启用 `codemode`：

```json
{
  "defaultTools": ["+codemode"]
}
```

而 `["-bash", "+powershell", "+grep"]` 会用 `powershell` 替换 `bash` 并启用 `grep`。项目设置叠加在用户设置之上：仅含 `+name` 和 `-name` 条目的项目列表会修改用户的选择，而含普通名称的项目列表则替换用户的选择。在同一个列表中，普通名称构成选择基础，`+name` 和 `-name` 随后按顺序应用。

`/reload` 会启用新添加到 `defaultTools` 中的工具，但不会禁用已移除的工具，也不会重新启用你手动关闭且未更改的工具。`--tools`（携带普通名称）、`--no-tools` 和 `--no-builtin-tools` 会覆盖 `defaultTools`，在重载时同样生效。

CLI 工具选项仅对单次调用覆盖此设置。仅含 `+name` 和 `-name` 条目的 `--tools` 则会修改已解析的 `defaultTools` 选择，例如 `pi --tools +codemode`。在 `/reload` 时，这些条目同样应用于重载后的设置，因此通过 `-name` 移除的工具会保持移除状态。参见 [命令行](cli.md#tools)。

## 会话与上下文

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | string | Agent 会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 可覆盖此设置。 |
| `sessionShareDestination` | `"auto" \| "gist" \| "radius"` | `"auto"` | `/share` 命令使用的目标位置。`auto` 在已认证时使用 Radius，否则创建 GitHub gist。`gist` 始终使用 gist。`radius` 需要 Radius 认证，且绝不回退到 gist。 |

### 压缩

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 低于该空闲上下文令牌数时，自动压缩开始。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 不进行摘要而保留的最近令牌数。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确的 `provider/modelId` 键控的按模型令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须是非负安全整数。每个值均独立地从匹配的模型覆盖中解析，然后从常规压缩设置中解析，最后从内置默认值中解析。项目和用户对象在模型查找之前合并。

参见 [压缩参考](/docs/compaction/) 了解触发、摘要和验证行为。

### 分支摘要

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 总结分支历史时保留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不生成摘要。 |

## 终端与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | string | `"system"` | 内置或自定义主题名称。`system` 会根据终端主题自动适配颜色。 |
| `quietStartup` | boolean \| `"header"` | `false` | `true` 隐藏启动头部信息和已加载资源列表。`"header"` 保留头部信息（版本号和按键提示），但隐藏模型范围行和已加载资源列表。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | 交互式终端 UI 模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时输出的内容。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏记录滚动条的行为。 |
| `fullscreenCopyOnSelect` | boolean | `true` | 在全屏模式下选中文本时自动复制。 |
| `fullscreenWheelScrollLines` | `"auto"` \| number | `"auto"` | 全屏模式下每次鼠标滚轮事件滚动的行数，范围 1 到 100。`"auto"` 在本地 macOS 终端中每次事件滚动一行，终端本身已加速滚轮和触控板输入；在其他环境及 SSH 连接下，会加速快速滚动，每次事件最多滚动 6 行。Alt+滚轮滚动量为五倍。 |
| `editorPaddingX` | number | `0` | 编辑器水平内边距，范围为 0 到 3 个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 消息、工具输出、`!` 命令输出和摘要块的水平记录内边距。 |
| `autocompleteMaxVisible` | number | `5` | 可见的自动补全条目数，范围 3 到 20。 |
| `showHardwareCursor` | boolean | `false` | 使用终端光标而不是 Pi 绘制的光标。Pi 仍会为输入法定位光标位置。 |
| `terminal.showImages` | boolean | `true` | 在支持的环境下显示内联图像。 |
| `terminal.imageWidthCells` | number | `60` | 终端单元格中首选内联图像宽度。 |
| `terminal.clearOnShrink` | boolean | `false` | 渲染内容缩小时清除空行。未设置时，可通过 `PI_CLEAR_ON_SHRINK=1` 启用。 |
| `terminal.showTerminalProgress` | boolean | `false` | 在终端标签页中显示 OSC 9;4 进度指示。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 覆盖真彩色检测。 |
| `images.autoResize` | boolean | `true` | 在发送给模型前，将图像调整到最大 2000 x 2000 像素。 |
| `images.blockImages` | boolean | `false` | 阻止将图像发送给模型。 |
| `markdown.codeBlockIndent` | string | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 渲染模式。 |

有关格式和平台详细信息，请参阅 [主题](/docs/themes/) 与 [终端设置](/docs/terminal-setup/) 两大章节。

## 网络和重试

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | 支持多种传输的 AI 提供商的优先传输方式。 |
| `httpProxy` | string | 无 | 用于 Pi 管理的 HTTP 客户端的代理 URL，作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用。**只能在代理目录设置中设置。** |
| `httpIdleTimeoutMs` | number \| `"disabled"` | `300000` | HTTP 头部和主体的空闲超时时间（毫秒）。设置为 `0` 或 `"disabled"` 以禁用。 |
| `websocketConnectTimeoutMs` | number \| `"disabled"` | `15000` | WebSocket 连接超时时间（毫秒）。设置为 `0` 或 `"disabled"` 以禁用。 |
| `retry.enabled` | boolean | `true` | 启用自动代理级重试以处理瞬时故障。 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数。 |
| `retry.baseDelayMs` | number | `2000` | 初始指数退避延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | number | `60000` | 最大代理级重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | 提供商请求超时时间（毫秒）。 |
| `retry.provider.maxRetries` | number | `0` | 提供商级重试次数。 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 服务器请求的最大延迟（毫秒）。设置为 `0` 以禁用限制。 |

除非需要提供商级重试，否则将 `retry.provider.maxRetries` 保持为 `0`。提供商重试可能会延迟 Pi 自行处理配额和使用限制错误。

## Shell

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | string | 平台默认 | 自定义 shell 可执行文件路径。支持前导 `~`。 |
| `shellCommandPrefix` | string | 无 | 在每个 shell 命令前面添加的前缀。 |
| `npmCommand` | `string[]` | `npm` | 用于 npm 软件包查找和安装的命令和参数。 |
| `selfUpdateCommand` | `string[]` | 无 | `pi update` 运行来更新 Pi 本身所使用的命令和参数，包含 `{packageName}`、`{version}` 和 `{installSpec}` 占位符。`PI_SELF_UPDATE_COMMAND` 优先。**只能在 agent 目录设置中设置。** 参见 [自定义更新命令](cli.md#custom-update-command)。 |

有关 shell 配置，参见 [Shell 别名](/docs/shell-aliases/)；有关包管理器行为，参见 [Pi 软件包](/docs/packages/)。

## 资源

用户设置中的资源路径相对于代理目录解析。项目设置中的路径相对于项目 `.pi` 目录解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | 数组 | `[]` | npm、git 或本地 Pi 软件包源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | 布尔值 | `true` | 将技能注册为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行通配排除、使用 `+path` 进行精确包含、使用 `-path` 进行精确排除。Pi 会加载用户级和项目设置中列出的资源。

内置扩展在 `extensions` 中命名为 `builtin:mcp`、`builtin:llama.cpp`、`builtin:codemode` 和 `builtin:tool-search`。它们默认加载；`-builtin:mcp` 可禁用其中一个。项目设置中的 `+builtin:<name>` 或 `-builtin:<name>` 条目会覆盖用户设置。`pi config` 在“内置”下列出它们。`--no-extensions` 也会禁用它们，而 `-e builtin:<name>` 可显式加载一个。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | 布尔值 | `false` | 更新后显示精简的更新日志。同时将扩展包更新日志压缩为每个软件包一行。 |
| `enableInstallTelemetry` | 布尔值 | `true` | 启用匿名安装/更新报告及选定的提供商来源归属标识。不控制更新检查。 |
| `enableAnalytics` | 布尔值 | `false` | 选择加入分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 当Anthropic订阅认证可能产生付费额外用量时发出警告。 |
