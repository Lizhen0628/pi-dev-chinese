# 在Windows上运行Pi

你可以将Pi作为原生Windows进程运行，或在Windows子系统 for Linux（WSL）中运行。原生Windows默认使用Git Bash执行Bash命令，并可选地将PowerShell暴露给模型。在WSL中运行的Pi则使用Linux环境及其自带的Bash安装。

参照主要[快速入门](/docs/quickstart/)指南安装并认证Pi。使用本页面来选择并配置其命令环境。

## 选择原生 Windows 或 WSL

| 环境 | 命令环境 | 适用场景 |
|---|---|---|
| 使用 Git Bash 的原生 Windows | 内置 `bash` 工具和 `!` 命令使用 Git Bash | 文件和开发工具主要位于 Windows 上 |
| 使用 `powershell` 工具的原生 Windows | 模型工具调用使用 PowerShell；`!` 命令仍可使用 Bash | 任务依赖 PowerShell 模块或 Windows 原生命令 |
| WSL | 所选 WSL 发行版内的 Linux Bash 和工具 | 文件和工具链已位于 Linux 或 WSL 中 |

## 在原生 Windows 上使用 Git Bash

对于大多数原生 Windows 用户而言，安装 [Git for Windows](https://git-scm.com/download/win) 即可满足需求。

Pi 按以下顺序解析 Bash：

1. 从 `~/.pi/agent/settings.json` 中的 `shellPath` 配置
2. 位于 `Program Files` 或 `Program Files (x86)` 下的 Git Bash
3. `PATH` 中的 `bash.exe`，包括 Cygwin、MSYS2 或旧版 WSL Bash

启动 Pi 并输入以下命令验证外壳：

```text
!printf 'Bash is working\n'
```

如果 Pi 无法找到 Bash，它会报告其检查过的位置。安装 Git for Windows、将另一个 Bash 可执行文件添加到 `PATH`，或配置 `shellPath`。

## 让模型使用 PowerShell

可选的 `powershell` 工具在可用时通过 `pwsh.exe` 运行命令，否则回退到 Windows PowerShell。它使用 `-NoProfile -NonInteractive -ExecutionPolicy Bypass` 参数启动 PowerShell。管理员强制执行的执行策略仍可能优先。

要将面向模型的 `bash` 工具替换为 `powershell`，请在 `~/.pi/agent/settings.json` 中添加以下内容：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

重启 Pi，然后让它运行一个无害的 PowerShell 命令。`!` 和 `!!` 编辑器命令继续使用 Bash。`powershell` 工具仅在 Pi 作为原生 Windows 进程运行时可用。

有关其他工具组合，请参阅 [设置](settings.md#tools)。

## 使用自定义Bash可执行文件

当Bash安装在Pi无法自动发现的位置时，设置`shellPath`：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON使用反斜杠作为转义字符。当您使用反斜杠书写Windows路径时，每个反斜杠都应写两次，如上所示。

有关命令前缀、别名以及完整的Shell解析行为，请参阅[配置Shell命令](/docs/shell-aliases/)。

## 配置 Windows Terminal

Windows Terminal 会保留或重写某些修改过的按键。参见 [Windows Terminal](terminal-setup.md#windows-terminal) 配置 `Shift+Enter` 和 `Alt+Enter`，以及 [按键绑定](/docs/keybindings/) 了解 Pi 在 Windows 和 WSL 下的快捷键默认值。
