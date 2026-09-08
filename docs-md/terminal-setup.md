# 终端设置

Pi 使用 [Kitty 键盘协议](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)可靠地检测修饰键。大多数现代终端支持该协议，少数需要配置。

## 能力覆盖

Pi 自动检测 OSC 8 超链接、内联图片协议和真彩。在终端代理或多路复用器后检测失败时，可用以下高级覆盖：

| 能力 | 环境变量 | JSON 设置 |
|------|----------|-----------|
| OSC 8 超链接 | `PI_HYPERLINKS=1\|0\|auto` | `terminal.hyperlinks: true\|false\|"auto"` |
| 内联图片 | `PI_IMAGE_PROTOCOL=kitty\|iterm2\|none\|auto` | `terminal.images: "kitty"\|"iterm2"\|false\|"auto"` |
| 真彩 | `PI_TRUE_COLOR=1\|0\|auto` | `terminal.trueColor: true\|false\|"auto"` |

设置优先于环境变量；不设或 `auto` 保持自动检测。只强制整条终端链路都支持的能力——不支持的转义序列会破坏渲染。

## Kitty

开箱即用。

## iTerm2

### 普通 TUI 模式

开箱即用。

### 全屏 TUI 模式

全屏下 Pi 接管视口，iTerm2 改发滚轮上报而不是滚动原生回滚缓冲。iTerm2 默认的快速触控板行为会丢掉大部分加速滚轮增量，导致全屏滚动比普通模式慢得多。

如果全屏模式下快速滚轮每次只动一行：

1. 打开 **iTerm2 → Settings → Advanced**
2. 搜索 **Trackpad scrolls fast?**，设为 **No**

这是 iTerm2 全局性的变通，也会影响原生触控板滚动。底层行为见 [iTerm2 issue 9619](https://gitlab.com/gnachman/iterm2/-/work_items/9619)。

## Apple Terminal

可用时 Pi 会启用增强按键上报。如果 Terminal.app 仍对 `Shift+Enter` 发送普通 Return，Pi 会用本地 macOS 修饰键回退，把它当作 `Shift+Enter`。

该回退只在 Pi 与 Terminal.app 运行在同一台 Mac 上时有效；远程 SSH 无法检测本地键盘。

## Ghostty

在 Ghostty 配置中添加（macOS：`~/Library/Application Support/com.mitchellh.ghostty/config`；Linux：`~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

旧版 Claude Code 可能加过这条映射：

```
keybind = shift+enter=text:\n
```

它发送的是原始换行字节，Pi 中与 `Ctrl+J` 无法区分，tmux 和 Pi 就收不到真正的 `shift+enter` 按键事件。

如果你加这条映射只是为了 Claude Code 2.x+，可以移除它——除非你要在 tmux 里用 Claude Code（那种情况仍然需要）。

Pi 默认把 `Ctrl+J` 绑定为换行别名，所以在 tmux 里 `Shift+Enter` 经由该重映射依然可用，无需额外配置。

### 全屏 TUI 模式

全屏下链接仍可点击，但 Pi 捕获鼠标输入时 Ghostty 不显示悬停下划线和左下角 URL 预览。按住 `Shift+Command`（macOS）或 `Shift+Ctrl`（Linux）可使用 Ghostty 原生链接处理。

## WezTerm

WezTerm 经 xterm modifyOtherKeys 通常开箱即用支持 `Shift+Enter`。想显式启用 Kitty 键盘协议，创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

macOS 上 WezTerm 默认把 `Option+Enter` 绑定为全屏。想把 `Option+Enter` 用于 Pi 的追问排队，加这条按键覆盖：

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

已有 `config.keys` 表的话，把条目加进去即可。

WSL 上 WezTerm 可能需要可见硬件光标才能定位 IME 候选窗。中日韩输入法候选窗不跟随文本光标时，运行 pi 前设 `PI_HARDWARE_CURSOR=1`，或在设置里把 `showHardwareCursor` 设为 `true`。

## Alacritty

`Shift+Enter` 通常开箱即用。macOS 上 `Option+Enter` 可能以普通 `Enter` 到达。想用于 Pi 追问排队，在 `~/.config/alacritty/alacritty.toml` 添加：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

改完配置重启 Alacritty。

## VS Code（集成终端）

VS Code 1.109.5 及以上默认在集成终端启用 Kitty 键盘协议，`Shift+Enter` 开箱即用。

更早版本需要显式的终端键位绑定。`keybindings.json` 位置：

- macOS：`~/Library/Application Support/Code/User/keybindings.json`
- Linux：`~/.config/Code/User/keybindings.json`
- Windows：`%APPDATA%\\Code\\User\\keybindings.json`

添加：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Zed（集成终端）

在 Zed 的 `keymap.json` 添加：

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

在 Windows 原生或 WSL 中运行时，Pi 使用 Windows 风格键位：

- `Alt+V` 粘贴图片或剪贴板文本
- `Ctrl+F` 在全屏模式搜索记录；`Ctrl+Up`/`Ctrl+Down` 在标记消息间跳转
- `Alt+P` 轮换到上一个模型
- `Ctrl+Z` 在原生 Windows 上撤销编辑；WSL 用 `Alt+Z`，把 `Ctrl+Z` 留给挂起
- `Ctrl+Q` 排队追问消息；`Alt+Q` 取回排队消息

在 `settings.json`（Ctrl+Shift+, 或 Settings → Open JSON file）中添加，转发 `Shift+Enter` 用于换行：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    }
  ]
}
```

Windows Terminal 默认把 `Alt+Enter` 绑定为全屏。想用它替代 Pi 默认的 `Ctrl+Q` 做追问排队：配置 Windows Terminal 发送该按键，并在 Pi 中把 `app.message.followUp` 绑定到 `alt+enter`。

已有 `actions` 数组的话把对象加进去。改完设置后完全关闭并重新打开 Windows Terminal。

## xfce4-terminal、terminator

这些终端的转义序列支持有限。`Ctrl+Enter`、`Shift+Enter` 等修饰 Enter 与普通 `Enter` 无法区分，`submit: ["ctrl+enter"]` 之类的自定义键位无法工作。

为了最佳体验，请使用支持 Kitty 键盘协议的终端：
- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty)（需以 Kitty 协议支持编译）

## IntelliJ IDEA（集成终端）

内置终端转义序列支持有限，Shift+Enter 与 Enter 无法区分。

想让硬件光标可见，运行 pi 前设 `PI_HARDWARE_CURSOR=1`（默认关闭以保证兼容）。

为了最佳体验，建议使用专用终端模拟器。
