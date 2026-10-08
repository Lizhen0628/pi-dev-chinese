# 使用主题自定义 Pi

主题控制 Pi 在交互模式和 HTML 导出中使用的颜色。Pi 内置了 `system`、`dark` 和 `light` 主题。您可以选择一个主题，跟随终端的浅色或深色外观，或创建自己的调色板。

## 使用终端的颜色

`system` 主题是默认主题。它根据终端的主题构建 Pi 的颜色，因此 Pi 与终端匹配，而不是自带调色板：

- Pi 查询终端的默认前景色和背景色及其 16 种 ANSI 颜色。
- 每种 Pi 颜色从一种 ANSI 颜色中取色相，例如错误取自红色，链接取自蓝色。
- Pi 设置每种颜色的亮度，使其与背景保持最小对比度。正文文本在背景和每个面板上至少保持 4.5:1 的 WCAG 对比度。
- 当终端在浅色和深色之间切换时，Pi 会再次查询颜色并重建主题。

主题会根据终端报告的内容进行调整：

| 终端报告 | 结果 |
|---|---|
| 背景色和 ANSI 颜色 | 来自终端调色板的颜色，根据实际背景放置。 |
| 仅背景色 | Pi 自身的色相，根据实际背景放置。 |
| 无 | ANSI 颜色索引和终端默认颜色，由终端自行渲染。次要文本为淡色，面板无背景色。 |

Pi 在启动时向终端请求其颜色。终端通常会在几毫秒内响应，Pi 在显示启动标题前最多等待 100 毫秒。如果终端未及时响应，Pi 使用 ANSI 颜色回退方案，并且如果颜色稍后到达（例如通过慢速 SSH 连接），仍会应用这些颜色。`system` 是保留名称：使用该名称的自定义主题将被忽略。

<a id="selecting-a-theme"></a>

## 选择主题

打开 `/settings` 并选择 **主题**。你可以为所有终端外观使用一个主题，或为浅色和深色终端分别选择不同的主题。

选择结果会保存为 `theme` [设置](settings.md#terminal-and-display)：

```json
{
  "theme": "dark"
}
```

如果没有 `theme` 设置，Pi 默认使用 `system`。

自动模式会先存储浅色主题，再存储深色主题：

```json
{
  "theme": "light/dark"
}
```

Pi 根据终端报告的背景和前景颜色来判断终端是浅色还是深色。如果终端未报告其背景颜色，Pi 会依次使用终端的浅色/深色通知、`COLORFGBG` 环境变量，最后默认为深色。同样的判断逻辑用于选择浅色/深色配对中的主题以及 `system` 的外观。当自动模式激活时，Pi 会在终端报告外观变化时切换主题。主题名称不能包含 `/`，因为 Pi 保留该字符用于此设置格式。

使用 `--use-theme` 可在单次调用中指定初始主题，而不更改已保存的设置：

```bash
pi --use-theme light
pi --use-theme light/dark
```

有关命令行选项，请参阅 [CLI 资源](cli.md#resources)。

## 创建自定义主题

复制一个[内置主题](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/modes/interactive/theme)，或创建一个符合[模式](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/schemas/theme.schema.json)的新 JSON 文件。内置主题使用 OKHSL 颜色，并为多个角色共享的颜色提供变量，因此你可以直接调整色相、饱和度或亮度。

1. 将文件保存为 `<agent-dir>/themes/my-theme.json`。代理目录默认为 `~/.pi/agent`。
2. 将其 `name` 设置为 `my-theme`。
3. 更改 `vars` 和 `colors` 中的值。
4. 通过 `/settings` 选择 `my-theme`。

使用主题名称作为文件名。Pi 只会从 `<agent-dir>/themes/<name>.json` 热重载活动的用户主题。从其他源添加或更改主题后，运行 `/reload`。

## 理解主题文件

| 属性 | 必填 | 职责 |
|---|---|---|
| `$schema` | 否 | 启用编辑器对 Pi 发布模式的验证和补全。 |
| `name` | 是 | 在选择器和设置中标识主题。必须唯一，不能包含 `/`，且不能为 `system`。 |
| `appearance` | 否 | `"dark"` 或 `"light"`：主题设计的背景。省略时，Pi 会从主题颜色中检测。 |
| `vars` | 否 | 定义可复用的颜色值。变量可以引用其他变量。 |
| `colors` | 是 | 为终端 UI 角色分配颜色。模式标识了必需和可选角色。 |
| `export` | 否 | 覆盖 HTML 导出中的页面和面板背景。 |

主题对象是严格的：仅接受文档化的顶层字段和颜色令牌。在 `vars` 下定义可复用的自定义颜色；`colors` 或 `export` 下的自定义键以及额外的顶层元数据将被拒绝。

颜色可以用六种形式书写：

| 形式 | 示例 | 含义 |
|---|---|---|
| RGB 十六进制 | `"#0af"` 或 `"#00aaff"` | 三位或六位 sRGB 颜色。 |
| OKLCH | `"oklch(62% 0.1 200)"` | 感知亮度、色度和色调。 |
| OKHSL | `"okhsl(250 60% 55%)"` | 色调、饱和度和亮度。饱和度相对于该色调和亮度下 sRGB 色域允许的最大值，因此每个值都在色域内，相同饱和度看起来同样鲜艳。 |
| 256 色索引 | `39` | 从 `0` 到 `255` 的 ANSI 调色板索引。 |
| 变量引用 | `"primary"` | `vars` 中条目的值。 |
| 终端默认 | `""` | 终端的前景或背景默认颜色。 |

终端默认颜色渲染为终端自身的颜色。当 Pi 需要具体值（如 HTML 导出或扩展颜色计算）时，它使用终端报告的默认颜色，或根据主题外观猜测黑色或白色。

Pi 解析链式变量引用。缺失变量或循环引用会使主题无效。Pi 在可用时使用真彩色，将 OKLCH 映射到 sRGB 色域，并为 256 色终端近似颜色。HTML 导出将 OKHSL 值转换为十六进制，因为 CSS 不支持它们。如果颜色与源值不同，请检查终端的真彩色检测和对比度设置。参见 [配置你的终端](terminal-setup.md#override-detected-capabilities)。

使用 [主题 JSON 模式](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/schemas/theme.schema.json) 获取精确属性、必需颜色和接受的值类型。

Pi 在启动和 `/reload` 时报告无效的主题文件。

## 查找要更改的颜色

主题颜色描述的是界面角色而非单个组件。使用以下分组来定位模式中的相关部分：

| 区域 | 颜色名称 |
|---|---|
| 通用界面 | `accent`、`border*`、`text`、`muted`、`dim`、`success`、`error`、`warning` |
| 选择与全屏 | `selectedBg`、`searchMatch*`、`scrollbar*` |
| 消息 | `userMessage*`、`customMessage*`、`thinkingText` |
| 工具执行 | `toolPendingBg`、`toolSuccessBg`、`toolErrorBg`、`toolTitle`、`toolOutput` |
| Markdown | `md*` |
| 工具差异 | `toolDiff*` |
| 语法高亮 | `syntax*` |
| 编辑器模式 | `thinking*`、`bashMode` |
| HTML 导出 | `export.pageBg`、`export.cardBg`、`export.infoBg` |

模式是格式参考。内置主题提供了完整的值，你可以复制并调整。

五种颜色是可选的，省略时会继承另一种颜色：

| 可选颜色 | 回退颜色 |
|---|---|
| `scrollbarTrack` | `muted` |
| `scrollbarThumb` | `text` |
| `searchMatchBg` | `selectedBg` |
| `searchMatchText` | `text` |
| `thinkingMax` | `thinkingXhigh` |

如果省略 `export` 颜色，Pi 会从 `userMessageBg` 推导 HTML 页面和面板的背景色。

## 从项目或软件包加载主题

将项目主题放置在 `.pi/themes/` 目录下。项目主题仅在[项目信任](security.md#understand-project-trust)授予后加载。

您还可以通过 `themes` 设置加载主题文件和目录，或在 Pi 软件包中分发它们。参见[配置](/docs/configuration/)、[设置](settings.md#resources)和 [Pi 软件包](/docs/packages/)。

每个加载的主题必须具有唯一名称。Pi 会将重复名称报告为资源冲突。
