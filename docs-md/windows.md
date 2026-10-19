# 在 Windows 上运行 Pi

以原生 Windows 进程或 Windows 子系统 Linux（WSL）的方式运行 Pi。原生 Windows 默认使用 Git Bash 执行 Bash 命令，并可选择将 PowerShell 暴露给模型。WSL 中的 Pi 使用 Linux 环境及其 Bash 安装。

按照主[快速入门](/docs/quickstart/)指南安装并验证 Pi。使用本页选择并配置其命令环境。

## 选择原生 Windows 或 WSL

| 环境 | 命令环境 | 在何时使用它 |
|---|---|---|
| 带 Git Bash 的原生 Windows | 用于内置 `bash` 工具和 `!` 命令的 Git Bash | 你的文件和开发工具主要位于 Windows 上 |
| 带 `powershell` 工具的原生 Windows | 用于模型工具调用的 PowerShell；Bash 仍可用于 `!` 命令 | 任务依赖于 PowerShell 模块或 Windows 本机命令 |
| WSL | 所选 WSL 发行版中的 Linux Bash 和工具 | 你的文件和工具链已位于 Linux 或 WSL 中 |

## 在原生 Windows 上使用 Git Bash

对于大多数原生 Windows 用户，安装 [Git for Windows](https://git-scm.com/download/win) 即可。

Pi 按以下顺序解析 Bash：

1. `~/.pi/agent/settings.json` 中的 `shellPath`
2. `%ProgramFiles%\Git\bin\bash.exe` 处的 Git Bash
3. `%ProgramFiles(x86)%\Git\bin\bash.exe` 处的 Git Bash
4. `PATH` 上的 `bash.exe`，包括 Cygwin、MSYS2 或旧版 WSL Bash

启动 Pi 并输入以下命令以验证 shell：

```text
!printf 'Bash is working\n'
```

如果 Pi 找不到 Bash，它会报告它检查过的位置。安装 Git for Windows，将另一个 Bash 可执行文件放入 `PATH`，或配置 `shellPath`。

## 让模型使用 PowerShell

可选的 `powershell` 工具在可用时通过 `pwsh.exe` 运行命令，然后回退到 Windows PowerShell。它使用 `-NoProfile -NonInteractive -ExecutionPolicy Bypass` 启动 PowerShell。管理员强制执行的执行策略仍可能优先。

PowerShell 发现按以下顺序检查这些位置：

1. `PATH` 上的 `pwsh.exe`
2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
3. `PATH` 上的 `powershell.exe`
4. `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`

要用 `powershell` 替换面向模型的 `bash` 工具，请将此内容添加到 `~/.pi/agent/settings.json`：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

`["-bash", "+powershell"]` 在保留你配置的其他默认工具的同时执行相同操作。

重启 Pi，然后让它运行一个无害的 PowerShell 命令。`!` 和 `!!` 编辑器命令继续使用 Bash。`powershell` 工具仅在 Pi 作为原生 Windows 进程运行时可用。

有关其他工具组合，请参阅 [设置](settings.md#tools)。

## WSL

在 Windows 上的 WSL 路径转换以及 WSL 中的额外 Git 分支轮询识别 `/mnt/<drive>`，而不是自定义挂载根目录。

使用 Windows 上旧的 WSL `bash.exe` 启动器时，Pi 通过 stdin 发送命令，以避免命令行引用问题。

## 使用自定义Bash可执行文件

当Bash安装在Pi无法自动发现的路径时，设置`shellPath`：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON使用反斜杠作为转义序列。当您编写带有反斜杠的Windows路径时，请像上面所示那样，将每个反斜杠写两次。

关于命令前缀、别名以及完整的shell解析行为，请参阅[配置shell命令](/docs/shell-aliases/)。

## 配置 Windows 终端

Windows终端保留或重写了一些修改过的按键。参见[Windows终端](terminal-setup.md#windows-terminal)来配置`Shift+Enter`和`Alt+Enter`，以及[按键绑定](/docs/keybindings/)以了解Pi在Windows和WSL的默认快捷键。
