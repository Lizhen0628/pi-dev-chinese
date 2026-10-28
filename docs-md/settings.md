# 设置参考

本参考列出了用户可配置的设置、它们的类型、默认值及用途。项目设置优先于代理目录设置。资源列表会合并。关于文件位置和信任行为，请参阅[配置](/docs/configuration/)。

在`settings.json`中添加`"$schema": "https://pi.dev/schemas/settings.schema.json"`，以便编辑器进行验证和自动补全。

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

缓存预热仅在模型声明缓存生命周期且 Pi 估计至少可避免 $0.05 的缓存未命中成本时运行。刷新使用会计入会话总计，但不会进入模型上下文。`/session` 显示下一个决策；扩展可以使用 `cache_warming_decision` 覆盖它。参见 [提示缓存生命周期](models.md#prompt-cache-lifetimes)。

有关模型选择和思考控制，请参见 [选择模型](/docs/models/)。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的引导消息如何被传递。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队中的追问消息如何被传递。 |
| `externalEditor` | string | `$VISUAL`、`$EDITOR`，然后是平台默认值 | 外部编辑器按键绑定所打开的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 编辑器为空时双击 Escape 键的动作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree` 使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 项目信任的备用行为。**只能在代理目录设置中配置。** |

## 工具

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的工具。纯名称替换默认项；`+name` 添加工具，`-name` 移除工具。空数组会禁用所有内置工具，但不会禁用扩展或 SDK 工具。 |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | `codemode` 工具在激活时如何展示工具。`on`：已声明的工具会在其描述末尾附加一条关于从脚本调用它们的注释，且 `codemode` 仅列出未声明的工具。`only`：`codemode` 列出脚本可调用的所有工具，激活的内置和扩展工具对模型隐藏，因此模型通过 `codemode` 访问它们。 |
| `codemode.inlineBudget` | number | `3000` | `codemode` 工具描述用于工具声明的预估令牌数（字符数 / 4）。不适配的工具会被省略，可通过 `searchTools()` 找到。`0` 仅列出命名空间。 |

可用的内置工具为 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`。`defaultTools` 还可以指定 `codemode` 和 `tool_search`（内置扩展以非激活状态注册）以及其他以非激活状态注册的扩展工具。

仅包含 `+name` 和 `-name` 条目列表会修改继承的现有选择，而非替换它。例如，以下配置在默认工具旁边启用 `codemode`：

```json
{
  "defaultTools": ["+codemode"]
}
```

以下配置将 `bash` 替换为 `powershell` 并启用 `grep`：`["-bash", "+powershell", "+grep"]`。项目设置叠加在用户设置之上：仅包含 `+name` 和 `-name` 条目的项目列表会修改用户的选择，而包含纯名称的项目列表则替换它。在单个列表中，纯名称构成选择，然后按顺序应用 `+name` 和 `-name`。

`/reload` 会启用新添加到 `defaultTools` 的工具。它不会禁用从中移除的工具，也不会重新启用你已关闭且未变更的工具。带有纯名称的 `--tools`、`--no-tools` 和 `--no-builtin-tools` 会覆盖 `defaultTools`，在重新加载时同样生效。

CLI 工具选项在单次调用中覆盖此设置。仅包含 `+name` 和 `-name` 条目 `--tools` 会改为修改已解析的 `defaultTools` 选择，例如 `pi --tools +codemode`。在 `/reload` 时，这些条目也应用于重新加载的设置，因此使用 `-name` 移除的工具保持移除状态。参见[命令行](cli.md#tools)。

## 会话与上下文

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | string | 代理会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 可覆盖此设置。 |
| `sessionShareDestination` | `"auto" \| "gist" \| "radius"` | `"auto"` | `/share` 使用的目标位置。`auto` 在已认证时使用 Radius，否则创建 GitHub gist。`gist` 始终使用 gist。`radius` 需要 Radius 认证，且从不回退到 gist。 |

### 压缩

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 当可用上下文令牌数低于此值时，自动压缩启动。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 无需摘要保留的最近令牌数。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确的 `provider/modelId` 指定的每个模型的令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须是非负安全整数。每个值独立解析，优先匹配对应的模型覆盖设置，然后匹配常规压缩设置，最后使用内置默认值。项目与用户配置在模型查找前合并。

有关触发、摘要及验证行为的详细信息，请参阅 [压缩参考](/docs/compaction/)。

### 分支摘要

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 在摘要分支历史时预留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，并默认不生成摘要。 |

## 终端与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | 字符串 | `"system"` | 内置或自定义主题名称。`system` 会根据终端主题自动匹配颜色。 |
| `quietStartup` | 布尔值 \| `"header"` | `false` | `true` 会隐藏启动时的标题和加载资源列表。`"header"` 则会保留标题（版本号和按键提示），但隐藏模型作用域行和加载资源列表。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | 交互式终端界面模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时输出的内容。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏模式下的会话记录滚动条行为。 |
| `fullscreenCopyOnSelect` | 布尔值 | `true` | 在全屏模式下自动复制选中的文本。 |
| `fullscreenWheelScrollLines` | `"auto"` \| 数字 | `"auto"` | 全屏模式下每个鼠标滚轮事件滚动的行数，范围为 1 到 100。`"auto"` 在 macOS 本地终端中每次事件滚动一行，这些终端本身已对滚轮和触控板输入进行了加速；在其他环境以及通过 SSH 连接时，它会将快速滚轮滚动加速至每次最多 6 行。按住 Alt 键滚动时，滚动距离为原来的五倍。 |
| `editorPaddingX` | 数字 | `0` | 编辑器的水平内边距，范围为 0 到 3 个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 消息、工具输出、`!` 命令输出和摘要块在会话记录中的水平内边距。 |
| `autocompleteMaxVisible` | 数字 | `5` | 可见的自动补全条目数，范围为 3 到 20。 |
| `showHardwareCursor` | 布尔值 | `false` | 使用终端光标而非 Pi 自绘光标。Pi 仍会为输入法调整其位置。 |
| `terminal.showImages` | 布尔值 | `true` | 在终端支持的情况下显示内嵌图片。 |
| `terminal.imageWidthCells` | 数字 | `60` | 内嵌图片在终端单元格中的首选宽度。 |
| `terminal.clearOnShrink` | 布尔值 | `false` | 当渲染内容缩小时清除空行。若未设置，可通过 `PI_CLEAR_ON_SHRINK=1` 启用。 |
| `terminal.showTerminalProgress` | 布尔值 | `false` | 在终端标签页中显示 OSC 9;4 进度信息。 |
| `terminal.hyperlinks` | `布尔值 \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测设置。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内嵌图片协议检测设置。 |
| `terminal.trueColor` | `布尔值 \| "auto"` | `"auto"` | 覆盖真彩色检测设置。 |
| `images.autoResize` | 布尔值 | `true` | 在将图片发送给模型前，将其尺寸调整为最大 2000×2000 像素。 |
| `images.blockImages` | 布尔值 | `false` | 阻止图片被发送给模型。 |
| `markdown.codeBlockIndent` | 字符串 | `"  "` | 用于缩进渲染后代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 图表渲染模式。 |

有关格式和平台详细信息，请参见 [主题](/docs/themes/) 和 [终端设置](/docs/terminal-setup/)。

## 网络与重试

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | 支持多种传输方式的 AI 提供商的首选传输方式。 |
| `httpProxy` | string | 无 | 代理 URL，作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用于 Pi 管理的 HTTP 客户端。**仅可在代理目录设置中设置。** |
| `httpIdleTimeoutMs` | number \| `"disabled"` | `300000` | HTTP 头部和正文空闲超时（毫秒）。设置为 `0` 或 `"disabled"` 以禁用。 |
| `websocketConnectTimeoutMs` | number \| `"disabled"` | `15000` | WebSocket 连接超时（毫秒）。设置为 `0` 或 `"disabled"` 以禁用。 |
| `retry.enabled` | boolean | `true` | 启用自动代理级重试，用于临时故障。 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数。 |
| `retry.baseDelayMs` | number | `2000` | 初始指数退避延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | number | `60000` | 最大代理级重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | 提供商请求超时（毫秒）。 |
| `retry.provider.maxRetries` | number | `0` | 提供商级重试尝试次数。 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 最大服务器请求延迟（毫秒）。设置为 `0` 以禁用限制。 |

除非需要提供商级重试，否则将 `retry.provider.maxRetries` 保持为 `0`。提供商重试可能延迟 Pi 自行处理配额和使用限制错误。

## Shell

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | string | 平台默认值 | 自定义外壳可执行文件路径。支持以 `~` 开头。 |
| `shellCommandPrefix` | string | 无 | 每条外壳命令前添加的前缀。 |
| `npmCommand` | `string[]` | `npm` | 用于 npm 软件包查找和安装的命令及参数。 |

有关外壳设置，请参阅 [Shell 别名](/docs/shell-aliases/)；有关软件包管理器行为，请参阅 [Pi 软件包](/docs/packages/)。

## 资源

用户设置中的资源路径相对于代理目录解析。项目设置中的路径相对于项目的 `.pi` 目录解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | 数组 | `[]` | npm、git 或本地 Pi 软件包源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | 布尔值 | `true` | 将技能注册为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行全局排除、使用 `+path` 进行精确包含、使用 `-path` 进行精确排除。Pi 会加载用户级和项目设置中列出的资源。

内置扩展在 `extensions` 中命名为 `builtin:mcp`、`builtin:llama.cpp`、`builtin:codemode` 和 `builtin:tool-search`。它们默认加载；`-builtin:mcp` 可禁用一个。项目设置中的 `+builtin:<name>` 或 `-builtin:<name>` 条目会覆盖用户设置。`pi config` 在“内置”下列出它们。`--no-extensions` 也会禁用它们，而 `-e builtin:<name>` 可显式加载一个。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | 布尔值 | `false` | 更新后显示精简的更新日志。同时将扩展包的更新日志压缩为每个包一行。 |
| `enableInstallTelemetry` | 布尔值 | `true` | 启用匿名安装/更新报告，并附带所选提供商的归属头部信息。不控制更新检查。 |
| `enableAnalytics` | 布尔值 | `false` | 选择加入分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔值 | `true` | 当 Anthropic 订阅认证可能产生付费额外使用时发出警告。 |
