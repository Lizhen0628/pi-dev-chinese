# 在 Windows 上运行 Pi

可以以原生 Windows 进程或 Windows 子系统 Linux（WSL）的方式运行 Pi。原生 Windows 默认使用 Git Bash 执行 Bash 命令，并可选择将 PowerShell 暴露给模型。WSL 中的 Pi 使用 Linux 环境及其 Bash 安装。

按照主要 [快速入门](/docs/quickstart/) 安装并认证 Pi。使用本页选择并配置其命令环境。

## 选择原生 Windows 或 WSL

| 环境 | 命令环境 | 适用场景 |
|---|---|---|
| 使用 Git Bash 的原生 Windows | 内置 `bash` 工具和 `!` 命令使用 Git Bash | 文件和开发工具主要位于 Windows 上 |
| 使用 `powershell` 工具的原生 Windows | 模型工具调用使用 PowerShell；`!` 命令仍可使用 Bash | 任务依赖于 PowerShell 模块或 Windows 原生命令 |
| WSL | 所选 WSL 发行版内的 Linux Bash 和工具 | 文件和工具链已位于 Linux 或 WSL 中 |

## 在原生 Windows 上使用 Git Bash

对于大多数原生 Windows 用户，安装 [Git for Windows](https://git-scm.com/download/win) 即可满足需求。

Pi 按以下顺序查找 Bash：

1. `~/.pi/agent/settings.json` 中的 `shellPath`
2. `Program Files` 或 `Program Files (x86)` 下的 Git Bash
3. `PATH` 中的 `bash.exe`，包括 Cygwin、MSYS2 或旧版 WSL Bash

启动 Pi 并输入以下命令验证外壳：

```text
!printf 'Bash is working\n'
```

如果 Pi 找不到 Bash，它会报告其检查过的位置。请安装 Git for Windows，或将另一个 Bash 可执行文件加入 `PATH`，或配置 `shellPath`。

## 让模型使用 PowerShell

可选的 `powershell` 工具在可用时通过 `pwsh.exe` 运行命令，否则回退到 Windows PowerShell。它使用 `-NoProfile -NonInteractive -ExecutionPolicy Bypass` 启动 PowerShell。管理员强制执行的执行策略仍可优先。

要将模型面向的 `bash` 工具替换为 `powershell`，请将此添加到 `~/.pi/agent/settings.json`：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

`["-bash", "+powershell"]` 在保留你配置的其他默认工具的同时，执行相同的操作。

重启 Pi，然后要求它运行一个无害的 PowerShell 命令。`!` 和 `!!` 编辑器命令继续使用 Bash。仅当 Pi 作为原生 Windows 进程运行时，`powershell` 工具才可用。

有关其他工具组合，请参阅[设置](settings.md#tools)。

## 使用自定义 Bash 可执行文件

当 Bash 安装在 Pi 无法自动发现的位置时，设置 `shellPath`：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON 使用反斜杠作为转义序列。当您使用反斜杠编写 Windows 路径时，请像上面所示那样，将每个反斜杠写两次。

有关命令前缀、别名以及完整的 shell 解析行为，请参阅 [配置 shell 命令](/docs/shell-aliases/)。

## 配置 Windows Terminal

Windows Terminal 会保留或重写某些修改键。请参阅 [Windows Terminal](terminal-setup.md#windows-terminal) 配置 `Shift+Enter` 和 `Alt+Enter`，以及 [按键绑定](/docs/keybindings/) 了解 Pi 在 Windows 和 WSL 中的默认快捷键。
