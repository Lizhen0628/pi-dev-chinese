# 在 Windows 上运行 Pi

既可以将 Pi 作为原生 Windows 进程运行，也可以在 Windows 子系统 for Linux (WSL) 中运行。原生 Windows 默认使用 Git Bash 执行 Bash 命令，并可选择将 PowerShell 暴露给模型。WSL 中的 Pi 使用 Linux 环境及其自带的 Bash 安装。

按照主要的[快速入门](/docs/quickstart/)指南安装并认证 Pi。使用本页面来选择并配置其命令环境。

## 选择原生 Windows 或 WSL

| 环境 | 命令环境 | 使用场景 |
|---|---|---|
| 原生 Windows 搭配 Git Bash | 内置 `bash` 工具及 `!` 命令使用 Git Bash | 你的文件和开发工具主要位于 Windows 上 |
| 原生 Windows 搭配 `powershell` 工具 | 模型工具调用使用 PowerShell；`!` 命令仍可使用 Bash | 任务依赖于 PowerShell 模块或 Windows 原生命令 |
| WSL | 所选 WSL 发行版内的 Linux Bash 和工具 | 你的文件和工具链已位于 Linux 或 WSL 中 |

## 在原生 Windows 上使用 Git Bash

对于大多数原生 Windows 用户，安装 [Git for Windows](https://git-scm.com/download/win) 就足够了。

Pi 按以下顺序解析 Bash：

1. 来自 `~/.pi/agent/settings.json` 的 `shellPath`
2. `%ProgramFiles%\Git\bin\bash.exe` 处的 Git Bash
3. `%ProgramFiles(x86)%\Git\bin\bash.exe` 处的 Git Bash
4. `PATH` 上的 `bash.exe`，包括 Cygwin、MSYS2 或旧版 WSL Bash

启动 Pi 并输入此命令以验证 shell：

```text
!printf 'Bash is working\n'
```

如果 Pi 无法找到 Bash，它会报告其检查过的位置。请安装 Git for Windows，将另一个 Bash 可执行文件放入 `PATH`，或配置 `shellPath`。

## 让模型使用 PowerShell

可选的 `powershell` 工具在可用时通过 `pwsh.exe` 运行命令，否则回退到 Windows PowerShell。它通过 `-NoProfile -NonInteractive -ExecutionPolicy Bypass` 参数启动 PowerShell。管理员强制执行的执行策略仍可能优先。

PowerShell 的发现机制按以下顺序检查位置：

1. `PATH` 上的 `pwsh.exe`
2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
3. `PATH` 上的 `powershell.exe`
4. `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`

要用 `powershell` 替换面向模型的 `bash` 工具，请将其添加到 `~/.pi/agent/settings.json`：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

`["-bash", "+powershell"]` 也能达到相同效果，同时保留你配置的任何其他默认工具。

重启 Pi，然后让它运行一个无害的 PowerShell 命令。`!` 和 `!!` 编辑器命令继续使用 Bash。`powershell` 工具仅在 Pi 以原生 Windows 进程运行时可用。

有关其他工具组合，请参阅 [设置](settings.md#tools)。

## 在 WSL 环境中

Pi 在 Windows 上的路径转换以及在 WSL 中对 Git 分支的额外轮询，均识别 `/mnt/<drive>` 格式，而不支持自定义的挂载根目录。

当从 Windows 使用旧版 WSL 的 `bash.exe` 启动器时，Pi 会通过标准输入(stdin)发送命令，以避免命令行中的引号转义问题。

## 使用自定义 Bash 可执行文件

当 Bash 安装在 Pi 未自动发现的位置时，设置 `shellPath`：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

JSON 使用反斜杠作为转义序列。当编写带有反斜杠的 Windows 路径时，每个反斜杠写两次，如上所示。

有关命令前缀、别名以及完整的 shell 解析行为，请参阅 [配置 shell 命令](/docs/shell-aliases/)。

## 选择终端

Windows 终端通过控制台主机（conhost）运行 Pi。有些终端捆绑了最新版本的 conhost；其他终端则使用 Windows 内置的旧版本，该版本存在影响 Pi 的缺陷。

我们推荐使用 [Windows Terminal](https://aka.ms/terminal)。它始终附带最新的 conhost，并且 Pi 在其上测试效果最佳。

最后更新：2026 年 10 月。

| 终端 | Conhost | 状态 |
|---|---|---|
| [Windows Terminal](https://aka.ms/terminal) | 捆绑，最新 | 推荐 |
| [VS Code](https://code.visualstudio.com)、[Tabby](https://tabby.sh)、[WezTerm](https://wezterm.org) 夜间版 | 捆绑，最新 | 可用 |
| [Alacritty](https://alacritty.org) | 内置，除非 `conpty.dll` 和 `OpenConsole.exe`（来自 Windows Terminal）位于 `alacritty.exe` 旁边 | 仅在这些文件存在时可用 |
| WezTerm 20240203 及更早版本 | 捆绑，旧版 | [已知问题](#known-issues) |
| 经典控制台（`cmd.exe` 或未安装 Windows Terminal 的 PowerShell）、mintty（Git Bash）、ConEmu、Cmder、[Hyper](https://hyper.is)、Windows OpenSSH | 内置 | [已知问题](#known-issues) |

## 配置 Windows Terminal

Windows Terminal 会保留或重写一些修改键。请参阅 [Windows Terminal](terminal-setup.md#windows-terminal) 以配置 `Shift+Enter` 和 `Alt+Enter`，以及 Pi 在 Windows 和 WSL 上的快捷键默认设置，详见 [按键绑定](/docs/keybindings/)。

## 已知问题

这些问题源于 conhost。微软已在其源代码中修复，但尚未说明内置 conhost 何时会获得这些修复。

| 问题 | 影响范围 | 解决方法 |
|---|---|---|
| 从全屏切换到常规模式，或在全屏下按 `Ctrl+G`，会导致会话崩溃（[#9186](https://github.com/earendil-works/pi/issues/9186)、[microsoft/terminal#17515](https://github.com/microsoft/terminal/issues/17515)） | 内置 conhost | 使用带有当前 conhost 的终端，或使用 `--tui-mode regular` 启动 Pi |
| 提示符中出现 `;0;rgb:0000/0000/0000` 等文本，且 BEL 会打开外部编辑器（[#10256](https://github.com/earendil-works/pi/issues/10256)） | 位于其他终端之后的内置 conhost：mintty、Windows OpenSSH | 使用带有当前 conhost 的终端 |
| 提示符中出现 `79` 或 `55` 等片段（[#10717](https://github.com/earendil-works/pi/issues/10717)） | WezTerm 20240203 | 使用 WezTerm 夜间版 |
| 在常规模式下，每次按键都会在新行上重绘输入行（[#6300](https://github.com/earendil-works/pi/issues/6300)） | 内置 conhost、经典控制台 | 使用全屏模式（默认），或使用带有当前 conhost 的终端 |
