# 使用主题定制 Pi

主题控制 Pi 在交互模式和 HTML 导出中使用的颜色。Pi 内置了 `dark` 和 `light` 主题。您可以选择一个主题，跟随终端的浅色或深色外观，或创建自己的调色板。

<a id="selecting-a-theme"></a>

## 选择主题

打开 `/settings` 并选择 **主题**。你可以为所有终端外观使用一个主题，或为浅色和深色终端分别选择不同的主题。

选择结果会保存为 `theme` [设置](settings.md#terminal-and-display)：

```json
{
  "theme": "dark"
}
```

自动模式会先存储浅色主题，再存储深色主题：

```json
{
  "theme": "light/dark"
}
```

当自动模式激活时，Pi 会在终端报告外观变化时切换主题。主题名称不能包含 `/`，因为 Pi 保留该字符用于此设置格式。

使用 `--use-theme` 为单次调用选择初始主题，而不更改已保存的设置：

```bash
pi --use-theme light
pi --use-theme light/dark
```

有关命令行选项，请参阅 [CLI 资源](cli.md#resources)。

## 创建自定义主题

复制一个[内置主题](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/modes/interactive/theme)，或根据[模式](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json)创建新的 JSON 文件。

1. 将文件保存为 `<agent-dir>/themes/my-theme.json`。代理目录默认为 `~/.pi/agent`。
2. 将其 `name` 设置为 `my-theme`。
3. 更改 `vars` 和 `colors` 中的值。
4. 通过 `/settings` 选择 `my-theme`。

使用主题名称作为文件名。Pi 仅从 `<agent-dir>/themes/<name>.json` 热重载当前用户主题。从任何其他来源添加或更改主题后，运行 `/reload`。

## 理解主题文件

| 属性 | 必填 | 职责 |
|---|---|---|
| `$schema` | 否 | 使编辑器能够依据 Pi 发布的 schema 进行校验和补全。 |
| `name` | 是 | 在选择器和设置中标识主题。必须唯一，且不能包含 `/`。 |
| `appearance` | 否 | `"dark"` 或 `"light"`：主题所针对的背景。省略时，Pi 会根据主题颜色自动检测。 |
| `vars` | 否 | 定义可复用的颜色值。变量可以引用其他变量。 |
| `colors` | 是 | 为终端 UI 角色分配颜色。schema 标识了必填和可选的角色。 |
| `export` | 否 | 在 HTML 导出中覆盖页面和面板的背景。 |

颜色可以以五种形式书写：

| 形式 | 示例 | 含义 |
|---|---|---|
| RGB 十六进制 | `"#0af"` 或 `"#00aaff"` | 三或六位 sRGB 颜色。 |
| OKLCH | `"oklch(62% 0.1 200)"` | 感知亮度、饱和度和色调。 |
| 256 色索引 | `39` | 从 `0` 到 `255` 的 ANSI 调色板索引。 |
| 变量引用 | `"primary"` | `vars` 中条目的值。 |
| 终端默认值 | `""` | 终端的默认前景或背景颜色。 |

终端默认颜色会以终端自身的颜色呈现。在 Pi 需要具体值的情况下（如 HTML 导出或扩展颜色计算），它会使用终端报告的默认颜色，或根据主题的外观猜测为黑色或白色。

Pi 会解析链式变量引用。缺失变量或循环引用会使主题无效。Pi 在可用时使用真彩色，将 OKLCH 色域映射到 sRGB，并为 256 色终端近似颜色。如果颜色与源码值不同，请检查终端的真彩色检测和对比度设置。参见 [配置你的终端](terminal-setup.md#override-detected-capabilities)。

使用 [主题 JSON schema](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json) 获取确切的属性、必填颜色和可接受的值类型。

Pi 会在启动和 `/reload` 时报告无效的主题文件。

## 查找要更改的颜色

主题颜色描述的是界面角色而非单个组件。使用这些分组来查找模式中的相关部分：

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

如果省略 `export` 颜色，Pi 会从 `userMessageBg` 推导出 HTML 页面和面板背景。

## 从项目或软件包加载主题

将项目主题放置在 `.pi/themes/` 目录下。项目主题仅在[项目信任](security.md#understand-project-trust)授予后加载。

您还可以通过 `themes` 设置加载主题文件和目录，或在 Pi 软件包中分发它们。参见[配置](/docs/configuration/)、[设置](settings.md#resources)和[Pi 软件包](/docs/packages/)。

每个加载的主题必须具有唯一名称。Pi 会将重复名称报告为资源冲突。
