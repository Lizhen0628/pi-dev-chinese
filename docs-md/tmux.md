# tmux 设置

Pi 可以在 tmux 内使用，但 tmux 默认会剥离某些按键的修饰键信息。不配置的话，`Shift+Enter` 和 `Ctrl+Enter` 通常与普通 `Enter` 无法区分。

## 推荐配置

在 `~/.tmux.conf` 中添加：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

然后彻底重启 tmux：

```bash
tmux kill-server
tmux
```

在没有 Kitty 键盘协议可用时，Pi 会自动请求扩展按键上报。配置 `extended-keys-format csi-u` 后，tmux 以 CSI-u 格式转发修饰键组合，这是最可靠的配置。`extended-keys-format` 选项需要 tmux 3.5 或更高版本。

## 为什么推荐 `csi-u`

只配置：

```tmux
set -g extended-keys on
```

时，tmux 默认使用 `extended-keys-format xterm`。应用请求扩展按键上报后，修饰键组合以 xterm `modifyOtherKeys` 格式转发，例如：

- `Ctrl+C` → `\x1b[27;5;99~`
- `Ctrl+D` → `\x1b[27;5;100~`
- `Ctrl+Enter` → `\x1b[27;5;13~`

使用 `extended-keys-format csi-u` 时，同样的按键转发为：

- `Ctrl+C` → `\x1b[99;5u`
- `Ctrl+D` → `\x1b[100;5u`
- `Ctrl+Enter` → `\x1b[13;5u`

两种格式 Pi 都支持，但 tmux 环境推荐 `csi-u`。

## 能修复什么

没有 tmux 扩展按键时，修饰的 Enter 组合会退化为传统序列：

| 按键 | 无 extkeys | `csi-u` |
|------|------------|---------|
| Enter | `\r` | `\r` |
| Shift+Enter | `\r` | `\x1b[13;2u` |
| Ctrl+Enter | `\r` | `\x1b[13;5u` |
| Alt/Option+Enter | `\x1b\r` | `\x1b[13;3u` |

这影响默认键位（`Enter` 提交、`Shift+Enter` 换行）以及任何使用修饰 Enter 的自定义键位。

## 要求

- `extended-keys-format csi-u` 需要 tmux 3.5+（用 `tmux -V` 查看）
- 一个支持扩展按键的终端模拟器（Ghostty、Kitty、iTerm2、WezTerm、Windows Terminal）

tmux 3.2 到 3.4 请省略 `extended-keys-format csi-u`；Pi 也支持 tmux 默认的 xterm `modifyOtherKeys` 格式。
