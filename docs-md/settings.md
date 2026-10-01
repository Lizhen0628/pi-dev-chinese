# 设置参考

本参考列出了用户可配置的设置、其类型、默认值及用途。项目设置会覆盖代理目录设置。资源列表会合并。关于文件位置和信任行为，请参阅[配置](/docs/configuration/)。

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

缓存预热仅在模型声明缓存生命周期且 Pi 估计至少可避免 $0.05 的缓存未命中成本时运行。刷新使用计入会话总数，但不进入模型上下文。`/session` 显示下一个决策；扩展可以使用 `cache_warming_decision` 覆盖它。参见 [提示缓存生命周期](models.md#prompt-cache-lifetimes)。

有关模型选择和思考控制，请参见 [选择模型](/docs/models/)。

## 交互

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `steeringMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队引导消息的传递方式。 |
| `followUpMode` | `"all" \| "one-at-a-time"` | `"one-at-a-time"` | 排队追问消息的传递方式。 |
| `externalEditor` | string | `$VISUAL`、`$EDITOR`，然后是平台默认值 | 由外部编辑器按键绑定的命令打开。 |
| `doubleEscapeAction` | `"tree" \| "fork" \| "none"` | `"tree"` | 编辑器为空时双击 Escape 的操作。 |
| `treeFilterMode` | `"default" \| "no-tools" \| "user-only" \| "labeled-only" \| "all"` | `"default"` | `/tree` 使用的初始筛选器。 |
| `defaultProjectTrust` | `"ask" \| "always" \| "never"` | `"ask"` | 项目信任的回退行为。**只能在代理目录设置中设置。** |

## 工具

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `defaultTools` | `string[]` | `read`, `bash`, `edit`, `write` | 启动时启用的工具。纯名称会替换默认值；`+name` 添加工具，`-name` 移除工具。空数组会禁用所有内置工具，但不会禁用扩展或 SDK 工具。 |
| `codemode.mode` | `"on"` \| `"only"` | `"on"` | `codemode` 工具在激活时如何展示工具。`on`：已声明的工具会在其描述末尾附加一条关于从脚本调用它们的说明，且 `codemode` 仅列出未声明的工具。`only`：`codemode` 列出脚本可调用的所有工具，且激活的内置和扩展工具对模型隐藏，因此模型通过 `codemode` 访问它们。 |
| `codemode.inlineBudget` | number | `3000` | `codemode` 工具的描述可能用于工具声明的预估令牌数（字符数 / 4）。超出预算的工具会被省略，可通过 `searchTools()` 找到。`0` 仅列出命名空间。 |

可用的内置工具包括 `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find` 和 `ls`。`defaultTools` 也可以指定 `codemode` 和 `tool_search`（内置扩展注册为未激活状态），以及其他注册为未激活状态的扩展工具。

仅包含 `+name` 和 `-name` 条目的列表会修改继承的选择，而不是替换它。例如，以下配置在默认工具旁边启用 `codemode`：

```json
{
  "defaultTools": ["+codemode"]
}
```

以下配置将 `bash` 替换为 `powershell` 并启用 `grep`：`["-bash", "+powershell", "+grep"]`。项目设置会叠加在用户设置之上：仅包含 `+name` 和 `-name` 条目的项目列表会修改用户的选择，而包含纯名称的项目列表会替换它。在同一个列表中，纯名称构成选择，然后 `+name` 和 `-name` 按顺序应用。

`/reload` 会启用新添加到 `defaultTools` 中的工具。它不会禁用已从其中移除的工具，也不会重新启用你关闭但未更改的工具。`--tools`、`--no-tools` 和 `--no-builtin-tools` 会覆盖 `defaultTools`，在重新加载时同样生效。

CLI 工具选项会在单次调用中覆盖此设置；`--tools` 不接受 `+name` 或 `-name`。参见 [命令行](cli.md#tools)。

## 会话与上下文

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sessionDir` | 字符串 | 代理会话目录 | 会话存储目录。相对路径从工作目录解析。`PI_CODING_AGENT_SESSION_DIR` 和 `--session-dir` 可覆盖此设置。 |

### 压缩

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `compaction.enabled` | 布尔值 | `true` | 启用自动压缩。 |
| `compaction.reserveTokens` | 数字 | `16384` | 为模型响应预留的令牌数。 |
| `compaction.keepRecentTokens` | 数字 | `20000` | 保留的近期令牌数（不进行摘要）。 |
| `compaction.modelOverrides` | 对象 | 无 | 按精确 `provider/modelId` 键控的按模型令牌设置。 |

<a id="per-model-compaction-overrides"></a>

压缩令牌值必须是非负安全整数。每个值独立解析：先从匹配的模型覆盖设置获取，然后从常规压缩设置获取，最后使用内置默认值。项目和用户对象在模型查找前合并。

关于触发、摘要和验证行为，请参阅 [压缩参考](/docs/compaction/)。

### 分支摘要

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `branchSummary.reserveTokens` | number | `16384` | 总结分支历史时预留的令牌数。 |
| `branchSummary.skipPrompt` | boolean | `false` | 跳过分支摘要提示，默认不生成摘要。 |

## 终端与显示

| 设置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `theme` | string | `"system"` | 内置或自定义主题名称。`system` 从终端主题中派生颜色。 |
| `quietStartup` | boolean \| `"header"` | `false` | `true` 隐藏启动头部和已加载资源列表。`"header"` 保留头部（版本和按键提示），但隐藏模型作用域行和已加载资源列表。 |
| `tuiMode` | `"regular" \| "fullscreen"` | `"fullscreen"` | 交互式终端 UI 模式。 |
| `fullscreenExitOutput` | `"transcript" \| "resume-hint"` | `"transcript"` | 退出全屏模式时输出的内容。 |
| `fullscreenScrollbar` | `"auto" \| "always" \| "hidden"` | `"auto"` | 全屏转录滚动条行为。 |
| `fullscreenCopyOnSelect` | boolean | `true` | 在全屏模式下自动复制选中的文本。 |
| `fullscreenWheelScrollLines` | `"auto"` \| number | `"auto"` | 全屏模式下每次鼠标滚轮事件滚动的行数，范围从 1 到 100。`"auto"` 在本地 macOS 终端中每次事件滚动一行，这些终端已加速滚轮和触控板输入；在其他环境及通过 SSH 连接时，它会将快速滚轮旋转加速至每次事件最多 6 行。Alt+滚轮滚动距离为五倍。 |
| `editorPaddingX` | number | `0` | 编辑器水平内边距，范围从 0 到 3 个单元格。 |
| `outputPad` | `0 \| 1` | `1` | 转录水平内边距。 |
| `autocompleteMaxVisible` | number | `5` | 可见的自动补全条目数，范围从 3 到 20。 |
| `showHardwareCursor` | boolean | `false` | 当 Pi 为输入法定位时显示终端光标。 |
| `terminal.showImages` | boolean | `true` | 在支持时显示内联图像。 |
| `terminal.imageWidthCells` | number | `60` | 内联图像在终端单元格中的首选宽度。 |
| `terminal.clearOnShrink` | boolean | `false` | 当渲染内容缩小时清除空行。 |
| `terminal.showTerminalProgress` | boolean | `false` | 在终端标签页中显示 OSC 9;4 进度。 |
| `terminal.hyperlinks` | `boolean \| "auto"` | `"auto"` | 覆盖 OSC 8 超链接检测。 |
| `terminal.images` | `"kitty" \| "iterm2" \| "auto" \| false` | `"auto"` | 覆盖内联图像协议检测。 |
| `terminal.trueColor` | `boolean \| "auto"` | `"auto"` | 覆盖真彩色检测。 |
| `images.autoResize` | boolean | `true` | 在将图像发送给模型之前，将其调整为最大 2000 x 2000 像素。 |
| `images.blockImages` | boolean | `false` | 阻止将图像发送给模型。 |
| `markdown.codeBlockIndent` | string | `"  "` | 用于缩进渲染代码块的前缀。 |
| `markdown.mermaid` | `"off" \| "final" \| "streaming"` | `"streaming"` | Mermaid 渲染模式。 |

有关格式和平台详细信息，请参阅 [主题](/docs/themes/) 和 [终端设置](/docs/terminal-setup/)。

## 网络和重试

| 设置 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `transport` | `"auto" \| "sse" \| "websocket" \| "websocket-cached"` | `"auto"` | 支持多种传输方式的 AI 提供商的首选传输方式。 |
| `httpProxy` | string | 无 | 用于 Pi 管理的 HTTP 客户端的代理 URL，作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用。**只能在 agent 目录设置中设置。** |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头和正文空闲超时（毫秒）。设置为 `0` 以禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | WebSocket 连接超时（毫秒）。设置为 `0` 以禁用。 |
| `retry.enabled` | boolean | `true` | 为瞬时故障启用自动 agent 级别重试。 |
| `retry.maxRetries` | number | `3` | 最大 agent 级别重试尝试次数。 |
| `retry.baseDelayMs` | number | `2000` | 初始指数退避延迟（毫秒）。 |
| `retry.maxAgentDelayMs` | number | `60000` | 最大 agent 级别重试延迟（毫秒）。 |
| `retry.provider.timeoutMs` | number | `httpIdleTimeoutMs` | 提供商请求超时（毫秒）。 |
| `retry.provider.maxRetries` | number | `0` | 提供商级别重试尝试次数。 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 服务器请求的最大延迟（毫秒）。设置为 `0` 以禁用限制。 |

除非需要提供商级别重试，否则将 `retry.provider.maxRetries` 保持为 `0`。提供商重试会延迟 Pi 自行处理配额和使用限制错误。

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
| `packages` | array | `[]` | npm、git 或本地 Pi 软件包源。参见 [Pi 软件包](/docs/packages/)。 |
| `extensions` | `string[]` | `[]` | 扩展文件或目录。 |
| `skills` | `string[]` | `[]` | 技能文件或目录。 |
| `prompts` | `string[]` | `[]` | 提示词模板文件或目录。 |
| `themes` | `string[]` | `[]` | 主题文件或目录。 |
| `enableSkillCommands` | boolean | `true` | 注册技能为 `/skill:name` 命令。 |

资源数组支持使用 `!pattern` 进行 glob 排除、`+path` 精确包含，以及 `-path` 精确排除。Pi 会加载用户级和项目设置中列出的资源。

内置扩展在 `extensions` 中命名为 `builtin:mcp`、`builtin:llama.cpp`、`builtin:codemode` 和 `builtin:tool-search`。它们默认加载；`-builtin:mcp` 会禁用一个。项目设置中的 `+builtin:<name>` 或 `-builtin:<name>` 条目会覆盖用户设置。`pi config` 在 Built-in 下列出它们。`--no-extensions` 也会禁用它们，而 `-e builtin:<name>` 会显式加载一个。

## 更新、遥测与警告

| 设置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `collapseChangelog` | 布尔型 | `false` | 更新后显示简明扼要的更新日志。 |
| `enableInstallTelemetry` | 布尔型 | `true` | 启用匿名的安装/更新报告及所选提供商的归属头部信息。此设置不控制更新检查。 |
| `enableAnalytics` | 布尔型 | `false` | 选择加入分析数据共享。当前仅用于实验性的首次运行设置。 |
| `warnings.anthropicExtraUsage` | 布尔型 | `true` | 当Anthropic订阅认证可能产生额外付费使用时发出警告。 |
