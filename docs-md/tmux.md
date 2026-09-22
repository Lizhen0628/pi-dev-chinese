# 在 tmux 中运行 Pi

Pi 可以在 tmux 中运行，但 tmux 可能会将 `Shift+Enter`、`Ctrl+Enter` 和普通 `Enter` 报告为相同的按键。启用扩展键，以便 Pi 能够区分它们。

## 检查你的 tmux 版本

```bash
tmux -V
```

对于 tmux 3.5 或更新版本，请使用下方推荐的 CSI-u 配置。对于 tmux 3.2 至 3.4 版本，请使用旧版本配置。

## 在 tmux 3.5 或更新版本中启用扩展键

将以下行添加到 `~/.tmux.conf`：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

当终端不直接提供 Kitty 键盘协议时，Pi 会请求扩展键报告。CSI-u 是通过 tmux 转发修改键最可靠的格式。

## 重启 tmux

配置适用于 tmux 服务器。为确保其生效，请关闭您的 tmux 会话并启动新的服务器。

如果您选择从命令行停止服务器，请先保存您的工作。此命令会终止该服务器管理的所有会话：

```bash
tmux kill-server
tmux
```

## 验证修改后的按键

在新 tmux 会话中启动 Pi，并检查以下内容：

1. `Shift+Enter` 在编辑器中插入新行。
2. `Enter` 提交提示词。
3. `Alt+Enter` 在 macOS 和 Linux 上排队追问。Windows 和 WSL 默认使用 `Ctrl+Q`。

如果这些按键仍像普通 `Enter` 一样工作，请验证 tmux 外部的终端能否报告修改后的按键。参见 [配置你的终端](/docs/terminal-setup/)。

## 使用 tmux 3.2 至 3.4 版本

这些版本支持扩展键，但不支持 `extended-keys-format csi-u`。仅需添加：

```tmux
set -g extended-keys on
```

Pi 支持这些版本所使用的 xterm `modifyOtherKeys` 格式。重启 tmux 并重复验证步骤。

对于更旧的版本，请升级 tmux 或在 tmux 之外使用 Pi，而不要依赖修改过的 Enter 快捷键。
