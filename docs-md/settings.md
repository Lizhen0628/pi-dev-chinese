# 设置参考

此参考列出了用户可配置的设置、它们的类型、默认值及用途。项目设置会覆盖代理目录设置。资源列表会合并。有关文件位置和信任行为，请参阅[配置](/docs/configuration/)。

在`settings.json`中添加`"$schema": "https://pi.dev/schemas/settings.schema.json"`，以获得编辑器验证和补全功能。

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

缓存预热仅在模型声明缓存生命周期且 Pi 估计至少可避免 $0.05 的缓存未命中成本时运行。刷新使用会计入会话总数，但不会进入模型上下文。`/session` 显示下一个决策；扩展可以使用 `cache_warming_decision` 覆盖它。参见 [提示缓存生命周期](models.md#prompt-cache-lifetimes)。

有关模型选择和思考控制，请参见 [选择模型](/docs/models/)。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 队列中的引导消息如何传递。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 队列中的追问消息如何传递。 |
| `externalEditor` | 字符串 | `$VISUAL`, `$EDITOR`, 然后是平台默认 | 外部编辑器键盘绑定打开的命令。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 空编辑器时双击 Escape 的操作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | 由 `/tree` 使用的初始过滤器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 回退的项目信任行为。**只能在代理目录设置中设置。** |

## 工具

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的工具。普通名称替换默认值；`+name` 添加工具，`-name` 移除工具。空数组禁用所有内置工具，但不禁用扩展或 SDK 工具。 |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | `codemode` 工具在激活时如何呈现工具。`on`：声明的工具会在其描述中附加脚本调用说明，`codemode` 仅列出未声明的工具。`only`：`codemode` 列出脚本可调用的所有工具，激活的内置和扩展工具对模型隐藏，因此模型通过 `codemode` 访问它们。 |
| `codemode.inlineBudget` | number | `3000` | `codemode` 工具描述在工具声明上可能花费的估算 tokens（字符 / 4）。不合适的工具被省略，并通过 `searchTools()` 找到。`0` 仅列出命名空间。 |

可用内置工具是 `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find` 和 `ls`。`defaultTools` 还可以指定 `codemode` 和 `tool_search`，这些由内置扩展注册为未激活，以及其他扩展工具注册为未激活。

仅包含 `+name` 和 `-name` 条目的列表会更改继承的选择，而不是替换它。例如，这能在默认工具旁边启用 `codemode`：

```json
{
  "defaultTools": ["+codemode"]
}
```

这将 `bash` 替换为 `powershell` 并启用 `grep`：`["-bash", "+powershell", "+grep"]`。项目设置应用于用户设置之上：仅包含 `+name` 和 `-name` 条目的项目列表会更改用户的选择，而包含普通名称的项目列表则替换它。在一个列表中，普通名称构成选择，然后 `+name` 和 `-name` 按顺序应用。

`/reload` 启用新添加到 `defaultTools` 的工具。它不会禁用移除的工具，也不会重新启用已关闭的未更改工具。`--tools` 带普通名称、`--no-tools` 和 `--no-builtin-tools` 覆盖 `defaultTools`，在重载时也是如此。

CLI 工具选项为一次调用覆盖此设置。`--tools` 仅带 `+name` 和 `-name` 条目时，改为更改已解析的 `defaultTools` 选择，例如 `pi --tools +codemode`。在 `/reload` 时，这些条目也应用于重载的设置，因此用 `-name` 移除的工具会保持移除。参见 [命令行](cli.md#tools)。

## 会话和上下文

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | string | 代理会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 覆盖此设置。 |
| `sessionShareDestination` | `"auto" \| "gist" \| "radius"` | `"auto"` | `/share` 使用的目标。`auto` 在已认证时使用 Radius，否则创建 GitHub gist。`gist` 始终使用 gist。`radius` 需要 Radius 认证，且不会回退到 gist。 |

### 压缩

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 为模型响应预留的令牌数。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 保留的近期令牌数，不进行摘要处理。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确的 `provider/modelId` 键控的逐模型令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须为非负安全整数。每个值独立地从匹配的模型覆盖项、常规压缩设置、内置默认值中依次解析。项目和用户对象在模型查找前合并。

参见 [压缩参考](/docs/compaction/) 了解触发、摘要和验证行为。

### 分支摘要

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 汇总分支历史时预留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不生成摘要。 |

## 终端与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | string | `"system"` | 内置或自定义主题名称。`system` 从终端主题中派生颜色。 |
| `quietStartup` | boolean \| `"header"` | `false` | `true` 隐藏启动标题和已加载资源列表。`"header"` 保留标题（版本和按键提示），但隐藏模型作用域行和已加载资源列表。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | 交互式终端用户界面模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时打印的输出。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏会话记录的滚动条行为。 |
| `fullscreenCopyOnSelect` | boolean | `true` | 在全屏模式下自动复制选中的文本。 |
| `fullscreenWheelScrollLines` | `"auto"` \| number | `"auto"` | 全屏模式下每次鼠标滚轮事件的行数，范围为 1 到 100。`"auto"` 在本地 macOS 终端中每次事件移动一行，这些终端已对滚轮和触控板输入进行加速；在其他环境及通过 SSH 连接时，它会将快速滚轮旋转加速至每次事件最多 6 行。Alt+滚轮移动的距离是上述的五倍。 |
| `editorPaddingX` | number | `0` | 编辑器水平内边距，范围为 0 到 3 个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 消息、工具输出、`!` 命令输出和摘要块的会话记录水平内边距。 |
| `autocompleteMaxVisible` | number | `5` | 可见的自动补全条目数，范围为 3 到 20。 |
| `showHardwareCursor` | boolean | `false` | 使用终端光标代替 Pi 绘制的光标。Pi 仍会为输入法定位该光标。 |
| `terminal.showImages` | boolean | `true` | 在支持时显示内联图像。 |
| `terminal.imageWidthCells` | number | `60` | 终端单元格中内联图像的首选宽度。 |
| `terminal.clearOnShrink` | boolean | `false` | 当渲染内容缩小时清除空行。 |
| `terminal.showTerminalProgress` | boolean | `false` | 在终端选项卡中显示 OSC 9;4 进度。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 覆盖真彩色检测。 |
| `images.autoResize` | boolean | `true` | 在将图像发送给模型之前，将其调整为最大 2000×2000 像素。 |
| `images.blockImages` | boolean | `false` | 阻止图像被发送给模型。 |
| `markdown.codeBlockIndent` | string | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 渲染模式。 |

有关格式和平台详情，请参阅[主题](/docs/themes/)和[终端设置](/docs/terminal-setup/)。

## 网络与重试

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | AI 提供商支持多种传输协议时，优先选用的传输方式。 |
| `httpProxy` | 字符串 | 无 | 应用于 Pi 管理的 HTTP 客户端的代理 URL（将设置为 `HTTP_PROXY` 和 `HTTPS_PROXY`）。**只能在代理目录设置中配置。** |
| `httpIdleTimeoutMs` | 数字 | `300000` | HTTP 头部和主体的空闲超时时间（毫秒）。设置为 `0` 可禁用。 |
| `websocketConnectTimeoutMs` | 数字 | `15000` | WebSocket 连接超时时间（毫秒）。设置为 `0` 可禁用。 |
| `retry.enabled` | 布尔值 | `true` | 为临时性故障启用代理级别的自动重试。 |
| `retry.maxRetries` | 数字 | `3` | 代理级别的最大重试次数。 |
| `retry.baseDelayMs` | 数字 | `2000` | 初始指数退避延迟时间（毫秒）。 |
| `retry.maxAgentDelayMs` | 数字 | `60000` | 代理级别重试的最大延迟时间（毫秒）。 |
| `retry.provider.timeoutMs` | 数字 | `httpIdleTimeoutMs` | 提供商请求超时时间（毫秒）。 |
| `retry.provider.maxRetries` | 数字 | `0` | 提供商级别的重试次数。 |
| `retry.provider.maxRetryDelayMs` | 数字 | `60000` | 提供商请求的最大延迟时间（毫秒）。设置为 `0` 可禁用此限制。 |

除非需要提供商级别的重试，否则应保持 `retry.provider.maxRetries` 为 `0`。提供商重试可能会延迟 Pi 自行处理配额和用量限制错误的时间。

## Shell

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `shellPath` | 字符串 | 平台默认 | 自定义 shell 可执行路径。支持前置 `~`。 |
| `shellCommandPrefix` | 字符串 | 无 | 附加到每个 shell 命令的前缀。 |
| `npmCommand` | 字符串数组 | `npm` | 用于 npm 软件包查找和安装的命令和参数。 |

有关 shell 配置，参见 [Shell 别名](/docs/shell-aliases/)；有关软件包管理器行为，参见 [Pi 软件包](/docs/packages/)。

## 资源

用户设置中的资源路径相对于代理目录解析。项目设置中的路径相对于项目的 `.pi` 目录解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `packages` | 数组 | `[]` | npm、git 或本地 Pi 软件包来源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | 布尔值 | `true` | 将技能注册为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行通配排除、使用 `+path` 进行精确包含、使用 `-path` 进行精确排除。Pi 会加载用户级和项目设置中列出的资源。

内置扩展在 `extensions` 中命名为 `builtin:mcp`、`builtin:llama.cpp`、`builtin:codemode` 和 `builtin:tool-search`。它们默认加载；`-builtin:mcp` 可禁用一个。项目设置中的 `+builtin:<name>` 或 `-builtin:<name>` 条目会覆盖用户设置。`pi config` 在“内置”下列出它们。`--no-extensions` 也会禁用它们，而 `-e builtin:<name>` 可显式加载一个。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `collapseChangelog` | boolean | `false` | 更新后显示精简的变更日志。 |
| `enableInstallTelemetry` | boolean | `true` | 启用匿名安装/更新报告以及所选提供商的归属标头。此设置不控制更新检查。 |
| `enableAnalytics` | boolean | `false` | 选择加入分析数据共享。目前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | boolean | `true` | 当 Anthropic 订阅认证可能产生付费额外用量时发出警告。 |
