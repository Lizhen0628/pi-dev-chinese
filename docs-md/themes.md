# 主题

> Pi 可以创建主题——把你的配色想法告诉它，让它生成。

主题是定义 TUI 配色的 JSON 文件。

## 目录

- [存放位置](#存放位置)
- [选择主题](#选择主题)
- [创建自定义主题](#创建自定义主题)
- [主题格式](#主题格式)
- [颜色令牌](#颜色令牌)
- [颜色取值](#颜色取值)
- [技巧](#技巧)

## 存放位置

Pi 从以下位置加载主题：

- 内置：`dark`、`light`
- 全局：`~/.pi/agent/themes/*.json`
- 项目：`.pi/themes/*.json`（仅在项目被信任后）
- 软件包：`themes/` 目录或 `package.json` 中的 `pi.themes` 条目
- 设置：`themes` 数组（文件或目录）
- CLI：`--theme <路径>`（可重复）

用 `--no-themes` 禁用发现。

## 选择主题

通过 `/settings` 或在 `settings.json` 中选择：

```json
{
  "theme": "my-theme"
}
```

首次运行时，Pi 会检测终端背景色，默认选 `dark` 或 `light`。

### 初始主题

不改已保存的设置，仅本次运行使用某个主题：

```bash
pi --use-theme light
```

想跟随终端外观，用 `亮色主题/暗色主题` 语法：

```bash
pi --use-theme light/dark
```

CLI 值只是本次运行的初始主题。之后在 `/settings` 里选其他主题会立即生效并正常保存。

## 创建自定义主题

1. 创建主题文件：

```bash
mkdir -p ~/.pi/agent/themes
vim ~/.pi/agent/themes/my-theme.json
```

2. 定义主题并包含所有必需颜色（见[颜色令牌](#颜色令牌)）：

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "primary": "#00aaff",
    "secondary": 242
  },
  "colors": {
    "accent": "primary",
    "border": "primary",
    "borderAccent": "#00ffff",
    "borderMuted": "secondary",
    "success": "#00ff00",
    "error": "#ff0000",
    "warning": "#ffff00",
    "muted": "secondary",
    "dim": 240,
    "text": "",
    "thinkingText": "secondary",
    "selectedBg": "#2d2d30",
    "scrollbarTrack": "secondary",
    "scrollbarThumb": "",
    "searchMatchBg": "#2d2d30",
    "searchMatchText": "",
    "userMessageBg": "#2d2d30",
    "userMessageText": "",
    "customMessageBg": "#2d2d30",
    "customMessageText": "",
    "customMessageLabel": "primary",
    "toolPendingBg": "#1e1e2e",
    "toolSuccessBg": "#1e2e1e",
    "toolErrorBg": "#2e1e1e",
    "toolTitle": "primary",
    "toolOutput": "",
    "mdHeading": "#ffaa00",
    "mdLink": "primary",
    "mdLinkUrl": "secondary",
    "mdCode": "#00ffff",
    "mdCodeBlock": "",
    "mdCodeBlockBorder": "secondary",
    "mdQuote": "secondary",
    "mdQuoteBorder": "secondary",
    "mdHr": "secondary",
    "mdListBullet": "#00ffff",
    "toolDiffAdded": "#00ff00",
    "toolDiffRemoved": "#ff0000",
    "toolDiffContext": "secondary",
    "syntaxComment": "secondary",
    "syntaxKeyword": "primary",
    "syntaxFunction": "#00aaff",
    "syntaxVariable": "#ffaa00",
    "syntaxString": "#00ff00",
    "syntaxNumber": "#ff00ff",
    "syntaxType": "#00aaff",
    "syntaxOperator": "primary",
    "syntaxPunctuation": "secondary",
    "thinkingOff": "secondary",
    "thinkingMinimal": "primary",
    "thinkingLow": "#00aaff",
    "thinkingMedium": "#00ffff",
    "thinkingHigh": "#ff00ff",
    "thinkingXhigh": "#ff0000",
    "thinkingMax": "#ff0088",
    "bashMode": "#ffaa00"
  }
}
```

3. 在 `/settings` 中选择该主题。

**热重载：** 编辑当前正在使用的自定义主题文件时，Pi 会自动重载，立刻看到效果。

## 主题格式

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "blue": "#0066cc",
    "gray": 242
  },
  "colors": {
    "accent": "blue",
    "muted": "gray",
    "text": "",
    "..."
  }
}
```

- `name` 必填，必须唯一，不能包含 `/`。
- `vars` 可选。在这里定义可复用的颜色，再在 `colors` 中引用。
- `colors` 必须定义全部 53 个必需令牌。`thinkingMax` 与两个搜索高亮令牌可选，缺省时使用下列回退值。

`$schema` 字段可在编辑器中获得自动补全与校验。

## 颜色令牌

每个主题必须定义全部 53 个必需颜色令牌。可选令牌的存在是为了兼容旧主题：`thinkingMax` 回退到 `thinkingXhigh`，`searchMatchBg` 回退到 `selectedBg`，`searchMatchText` 回退到 `text`。其他搜索匹配用 `searchMatchBg` 底 + `searchMatchText` 字并加下划线；当前匹配则反转该前景/背景对并加粗。

### 核心 UI（13 色）

| 令牌 | 用途 |
|------|------|
| `accent` | 主强调色（logo、选中项、光标） |
| `border` | 普通边框 |
| `borderAccent` | 高亮边框 |
| `borderMuted` | 弱边框（编辑器） |
| `success` | 成功状态 |
| `error` | 错误状态 |
| `warning` | 警告状态 |
| `muted` | 次要文本 |
| `dim` | 三级文本 |
| `text` | 默认文本（通常为 `""`） |
| `thinkingText` | 思考块文本 |
| `scrollbarTrack` | 全屏滚动条轨道前景 |
| `scrollbarThumb` | 全屏滚动条滑块前景（普通与展开状态共用） |

### 背景与内容（11 必需 + 2 可选）

| 令牌 | 用途 |
|------|------|
| `selectedBg` | 选中行背景 |
| `searchMatchBg` | 记录搜索匹配背景与当前匹配文本；可选，回退 `selectedBg` |
| `searchMatchText` | 记录搜索匹配文本与当前匹配背景；可选，回退 `text` |
| `userMessageBg` | 用户消息背景 |
| `userMessageText` | 用户消息文本 |
| `customMessageBg` | 扩展消息背景 |
| `customMessageText` | 扩展消息文本 |
| `customMessageLabel` | 扩展消息标签 |
| `toolPendingBg` | 工具框（执行中） |
| `toolSuccessBg` | 工具框（成功） |
| `toolErrorBg` | 工具框（错误） |
| `toolTitle` | 工具标题 |
| `toolOutput` | 工具输出文本 |

### Markdown（10 色）

| 令牌 | 用途 |
|------|------|
| `mdHeading` | 标题 |
| `mdLink` | 链接文本 |
| `mdLinkUrl` | 链接 URL |
| `mdCode` | 行内代码 |
| `mdCodeBlock` | 代码块内容 |
| `mdCodeBlockBorder` | 代码块围栏 |
| `mdQuote` | 引用文本 |
| `mdQuoteBorder` | 引用边框 |
| `mdHr` | 水平分割线 |
| `mdListBullet` | 列表符号 |

### 工具 Diff（3 色）

| 令牌 | 用途 |
|------|------|
| `toolDiffAdded` | 新增行 |
| `toolDiffRemoved` | 删除行 |
| `toolDiffContext` | 上下文行 |

### 语法高亮（9 色）

| 令牌 | 用途 |
|------|------|
| `syntaxComment` | 注释 |
| `syntaxKeyword` | 关键字 |
| `syntaxFunction` | 函数名 |
| `syntaxVariable` | 变量 |
| `syntaxString` | 字符串 |
| `syntaxNumber` | 数字 |
| `syntaxType` | 类型 |
| `syntaxOperator` | 运算符 |
| `syntaxPunctuation` | 标点 |

### 思考等级边框（6 必需 + 1 可选）

编辑器边框颜色表示思考等级（由弱到强的视觉层级）：

| 令牌 | 用途 |
|------|------|
| `thinkingOff` | 关闭思考 |
| `thinkingMinimal` | minimal |
| `thinkingLow` | low |
| `thinkingMedium` | medium |
| `thinkingHigh` | high |
| `thinkingXhigh` | xhigh |
| `thinkingMax` | max；可选，回退 `thinkingXhigh` |

### Bash 模式（1 色）

| 令牌 | 用途 |
|------|------|
| `bashMode` | bash 模式（`!` 前缀）下的编辑器边框 |

### HTML 导出（可选）

`export` 部分控制 `/export` HTML 输出的配色。缺省时颜色从 `userMessageBg` 推导。

```json
{
  "export": {
    "pageBg": "#18181e",
    "cardBg": "#1e1e24",
    "infoBg": "#3c3728"
  }
}
```

## 颜色取值

支持四种格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| 十六进制 | `"#ff0000"` | 6 位十六进制 RGB |
| 256 色 | `39` | xterm 256 色板索引（0-255） |
| 变量 | `"primary"` | 引用 `vars` 条目 |
| 默认 | `""` | 终端默认色 |

### 256 色板

- `0-15`：基础 ANSI 色（取决于终端）
- `16-231`：6×6×6 RGB 立方（`16 + 36×R + 6×G + B`，R/G/B 取 0-5）
- `232-255`：灰阶

### 终端兼容性

Pi 使用 24 位 RGB 颜色。现代终端大多支持（iTerm2、Kitty、WezTerm、Windows Terminal、VS Code）。只支持 256 色的老终端上，Pi 会回退到最接近的近似色。

检查真彩支持：

```bash
echo $COLORTERM  # 应输出 "truecolor" 或 "24bit"
```

## 技巧

**暗色终端：** 用明亮、饱和、对比度高的颜色。

**亮色终端：** 用更深、柔和、对比度低的颜色。

**配色和谐：** 从一套基础色板（Nord、Gruvbox、Tokyo Night）出发，在 `vars` 中定义并统一引用。

**测试：** 用不同消息类型、工具状态、Markdown 内容和长换行文本检查你的主题。

**VS Code：** 把 `terminal.integrated.minimumContrastRatio` 设为 `1` 以看到真实颜色。

## 示例

参考内置主题：
- [dark.json](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/dark.json)
- [light.json](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/interactive/theme/light.json)
