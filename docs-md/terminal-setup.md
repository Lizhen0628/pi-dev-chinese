# 配置你的终端

大多数现代终端无需额外设置即可与 Pi 配合使用。当修改键、滚动、链接、图像、颜色或输入法编辑器（IME）定位行为不符合预期时，请参考此页面。

Pi 使用扩展键协议，使终端能够区分诸如 `Shift+Enter` 和 `Alt+Enter` 与普通 `Enter` 的组合。终端代理、多路复用器和内置 IDE 终端可能会更改或丢弃这些信息。

## 故障排查

| 症状 | 从这里开始 |
|---|---|
| `Shift+Enter` 提交而非插入新行 | 下方终端章节；若使用 tmux，参见 [在 tmux 中运行 Pi](/docs/tmux/) |
| `Alt+Enter` 未排队追问 | [WezTerm](#wezterm)、[Alacritty](#alacritty) 或 [Windows Terminal](#windows-terminal) |
| 全屏滚动异常缓慢 | [iTerm2](#iterm2) |
| 链接可点击但无悬停预览 | [Ghostty](#ghostty) |
| 未检测到内联图片或颜色 | [覆盖检测能力](#override-detected-capabilities) |
| IME 候选窗口位置错误 | [WezTerm](#wezterm) 或 [IntelliJ IDEA](#intellij-idea-integrated-terminal) |
| 修改键仅在 tmux 内失效 | [在 tmux 中运行 Pi](/docs/tmux/) |

使用 `/hotkeys` 查看 Pi 的当前快捷键。如需更改，请参阅 [键位绑定](/docs/keybindings/)。

## Kitty

Kitty 无需额外配置即可支持所需的键盘协议。

## iTerm2

常规终端模式无需额外配置即可使用。

### 修复全屏滚动缓慢问题

在全屏模式下，Pi 接管了视口，因此 iTerm2 发送鼠标滚轮报告而非滚动原生终端历史记录。快速触控板手势可能每次仅移动约一行。

要更改此行为：

1. 打开 **iTerm2 > 设置 > 高级**。
2. 搜索 **触控板快速滚动？**。
3. 将其设置为 **否**。

这是 iTerm2 的全局设置，也可能改变原生触控板滚动行为。底层行为跟踪见 [iTerm2 问题 9619](https://gitlab.com/gnachman/iterm2/-/work_items/9619)。

## Apple Terminal

Pi 在可用时会启用增强的按键报告功能。如果 Terminal.app 仍对 `Shift+Enter` 发送普通回车，Pi 会使用 macOS 本地的修饰键回退方案，并将其视为 `Shift+Enter`。

此回退方案仅在 Pi 与 Terminal.app 运行于同一台 Mac 上时生效。当 Pi 通过 SSH 在另一台机器上运行时，无法检查本地修饰键状态。

## Ghostty

如果 `Alt+Backspace` 不起作用，请将此映射添加到 Ghostty 的配置中：

```text
keybind = alt+backspace=text:\x1b\x7f
```

配置文件在 macOS 上位于 `~/Library/Application Support/com.mitchellh.ghostty/config`，在 Linux 上位于 `~/.config/ghostty/config`。

较旧的 Claude Code 配置可能包含：

```text
keybind = shift+enter=text:\n
```

这会发送一个原始换行符，Pi 无法将其与 `Ctrl+J` 区分开。如果添加此映射的唯一原因是较旧的 Claude Code 安装，请移除该映射。Pi 已经将 `Ctrl+J` 绑定为换行替代键，因此该映射可能看起来很有效，但仍然会阻止 Pi 和 tmux 接收真正的 `Shift+Enter` 事件。

### 全屏模式下打开链接

在全屏模式下，链接仍然可以点击，但当 Pi 捕获鼠标输入时，Ghostty 不会显示其正常的悬停下划线或 URL 预览。在 macOS 上按住 `Shift+Command`，在 Linux 上按住 `Shift+Ctrl`，即可使用 Ghostty 的原生链接处理功能。

## WezTerm

WezTerm 通常通过 xterm 扩展键报告 `Shift+Enter`。要显式启用 Kitty 键盘协议，请创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

### 在 macOS 上转发 Alt+Enter

WezTerm 在 macOS 上默认将 `Option+Enter` 绑定到全屏。要将其用于 Pi 的追问队列，请在你的 `config.keys` 表中添加此条目：

```lua
{
  key = 'Enter',
  mods = 'ALT',
  action = wezterm.action.SendString('\x1b[13;3u'),
}
```

一个完整的最小配置是：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

### 在 WSL 中定位输入法候选窗口

若在 WSL 中，中日韩输入法候选窗口未跟随 Pi 的文本光标，请显示硬件光标：

```bash
export PI_HARDWARE_CURSOR=1
pi
```

或者，您也可以在 Pi 设置中将 `showHardwareCursor` 设为 `true`。

## Alacritty

Alacritty 默认报告 `Shift+Enter`。在 macOS 上，`Option+Enter` 可能被识别为普通 `Enter`。将以下内容添加到 `~/.config/alacritty/alacritty.toml` 以将其转发给 Pi：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

修改文件后，重启 Alacritty。

## VS Code 集成终端

VS Code 1.109.5 及以上版本默认在集成终端中启用 Kitty 键盘协议。

对于旧版本，需在 `keybindings.json` 中添加 `Shift+Enter` 终端绑定：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

用户的 `keybindings.json` 文件通常位于：

- macOS：`~/Library/Application Support/Code/User/keybindings.json`
- Linux：`~/.config/Code/User/keybindings.json`
- Windows：`%APPDATA%\\Code\\User\\keybindings.json`

## Zed 集成终端

将以下绑定添加到 Zed 的 `keymap.json` 中：

```json
{
  "context": "Terminal",
  "bindings": {
    "shift-enter": ["terminal::SendText", "\u001b[13;2u"],
    "ctrl--": ["terminal::SendText", "\u001b[45;5u"],
    "ctrl-alt-]": ["terminal::SendText", "\u001b[93;7u"]
  }
}
```

## Windows Terminal

Windows Terminal 使用 Pi 的 Windows 和 WSL 快捷键默认值。参见 [键绑定](/docs/keybindings/) 获取完整列表。

### 前移 Shift+Enter

使用 `Ctrl+Shift+,` 或 **设置 > 打开 JSON 文件** 打开 Windows Terminal 的 `settings.json`。将以下对象添加到其 `actions` 数组中：

```json
{
  "command": { "action": "sendInput", "input": "\u001b[13;2u" },
  "keys": "shift+enter"
}
```

完全关闭并重新打开 Windows Terminal，然后验证 `Shift+Enter` 在 Pi 中插入新行。

### 使用 Alt+Enter 进行追问

Windows Terminal 默认将 `Alt+Enter` 绑定为全屏功能。因此，Pi 在 Windows 和 WSL 上使用 `Ctrl+Q` 进行追问。

若要改用 `Alt+Enter`，请配置 Windows Terminal 转发该按键，并在 Pi 的 `keybindings.json` 中将 `app.message.followUp` 绑定到 `alt+enter`。参见 [按键绑定](keybindings.md#assign-keybindings)。

## xfce4-terminal 与 Terminator

这些终端无法可靠地区分修饰后的 Enter 键与普通 `Enter` 键。因此，诸如 `Ctrl+Enter` 或 `Shift+Enter` 的自定义绑定可能无法生效。

当您需要这些快捷键时，请使用支持现代扩展按键的终端，例如 Kitty、Ghostty、WezTerm、iTerm2、Windows Terminal，或兼容的 Alacritty 编译版本。

## IntelliJ IDEA 集成终端

IntelliJ IDEA 内置终端无法可靠地区分 `Shift+Enter` 与普通 `Enter`。如需换行，请使用 `Ctrl+J`，或在支持现代扩展键的终端中运行 Pi。

如果输入法候选窗口未跟随文本光标移动，请显示硬件光标：

```bash
export PI_HARDWARE_CURSOR=1
pi
```

## 覆盖检测到的能力

Pi 会自动检测 OSC 8 超链接、内联图像协议和真彩色支持。终端代理或多路复用器可能导致检测不准确。

| 能力 | 环境变量 | 设置 |
|---|---|---|
| 超链接 | `PI_HYPERLINKS=1\|0\|auto` | `terminal.hyperlinks: true\|false\|"auto"` |
| 内联图像 | `PI_IMAGE_PROTOCOL=kitty\|iterm2\|none\|auto` | `terminal.images: "kitty"\|"iterm2"\|false\|"auto"` |
| 真彩色 | `PI_TRUE_COLOR=1\|0\|auto` | `terminal.trueColor: true\|false\|"auto"` |

设置优先于环境变量。未设置的值或 `auto` 保留自动检测。

仅强制终端完整路径支持的能力。不支持的转义序列可能破坏渲染。参见 [环境变量](environment-variables.md#pi-process-configuration) 和 [设置](/docs/settings/) 获取规范值定义。

## 程序状态

Pi 通过 [程序状态协议 (OSC 7501)](https://www.superlogical.com/rex/docs/build/program-status) 报告其状态，从而让终端和代理仪表盘能够显示它是正在工作、等待您、完成还是失败：

| 状态 | 何时 |
|---|---|
| `working` | 代理运行或压缩正在进行。消息是会话名称。 |
| `blocked` | 扩展对话框或登录等待您。消息是对话框标题。 |
| `done` | 运行完成。消息是会话名称。 |
| `error` | 运行以不重试的错误结束。消息是错误的第一行。 |
| `idle` | Pi 启动，或您取消了运行。 |

报告绝不包含提示词或模型输出。Pi 仅在终端回答协议的支持查询后才发送它们；tmux 和 screen 不会转发它们。设置 `PI_PROGRAM_STATUS=1` 以无需询问即发送报告，或设置 `PI_PROGRAM_STATUS=0` 以关闭它们。
