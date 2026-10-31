# 在 tmux 中运行 Pi

Pi 可以在 tmux 中运行，但 tmux 可能会将 `Shift+Enter`、`Ctrl+Enter` 和普通的 `Enter` 报告为相同的按键。启用扩展按键，以便 Pi 能够区分它们。

## 检查你的 tmux 版本

```bash
tmux -V
```

对于 tmux 3.5 或更高版本，请使用下面推荐的 CSI-u 配置。对于 tmux 3.2 到 3.4 版本，请使用旧版本配置。

## 在 tmux 3.5 或更新版本中启用扩展键

将以下行添加到 `~/.tmux.conf`：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

当终端未直接提供 Kitty 键盘协议时，Pi 会请求扩展键报告。CSI-u 是通过 tmux 转发修改后的按键最可靠的形式。

## 重启 tmux

配置适用于 tmux 服务器。为确保其生效，请关闭你的 tmux 会话并启动一个新服务器。

如果你选择从命令行停止服务器，请先保存你的工作。此命令会终止该服务器管理的所有会话：

```bash
tmux kill-server
tmux
```

## 验证修改键

在新的 tmux 会话中启动 Pi，并检查以下各项：

1. `Shift+Enter` 在编辑器中插入新行。
2. `Enter` 提交提示词。
3. `Alt+Enter` 在 macOS 和 Linux 上加入追问。Windows 和 WSL 默认使用 `Ctrl+Q`。

如果这些键仍像普通的 `Enter` 一样工作，请验证 tmux 外部的终端是否能报告修改键。参见[配置终端](/docs/terminal-setup/)。

## 使用 tmux 3.2 至 3.4 版本

这些版本支持扩展键，但不支持 `extended-keys-format csi-u`。仅需添加：

```tmux
set -g extended-keys on
```

Pi 支持这些版本所使用的 xterm `modifyOtherKeys` 格式。请重启 tmux 并重复验证步骤。

对于更旧的版本，请升级 tmux，或在 tmux 之外使用 Pi，而不要依赖修改后的 Enter 快捷键。

# 已知问题

| 问题 | 影响 | 补救措施 |
|---|---|---|
| 类似 `c0c/0c0c/0c0c` 的文本在启动时出现在编辑器中 ([tmux#4749](https://github.com/tmux/tmux/issues/4749)) | tmux 3.6 | 升级 tmux。更改 Pi 的主题没有帮助。 |
```
