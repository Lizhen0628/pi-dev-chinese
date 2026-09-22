# 配置 shell 命令

Pi 为每条 Bash 命令都启动一个独立的非交互式 shell 进程。非交互式 Bash 默认不会展开别名，通常也不会加载与交互式终端相同的启动文件。

可通过 `shellPath` 选择要使用的 Bash 可执行文件，并通过 `shellCommandPrefix` 在每条命令前运行相应的初始化命令。

## 了解 Pi 使用哪个外壳

| 命令来源 | 外壳 |
|---|---|
| 模型调用内置的 `bash` 工具 | Pi 解析后的 Bash 可执行文件 |
| 你输入 `!command` 或 `!!command` | 相同的解析后的 Bash 可执行文件 |
| 模型调用可选的 `powershell` 工具 | PowerShell 7 (`pwsh.exe`) 或 Windows PowerShell |
| 扩展提供或替换外壳工具 | 该扩展实现的操作 |

Pi 通常使用 `bash -c` 调用 Bash。在 Unix 系统上，它使用 `/bin/bash`，然后是 `PATH` 上的 `bash`，最后在 Bash 不可用时使用 `sh`。原生 Windows 首先检查配置的路径，然后是 Git Bash，最后是 `PATH` 上的 `bash.exe`。

## 选择 Bash 可执行文件

当 Pi 需要使用特定可执行文件时，在 `~/.pi/agent/settings.json` 中设置 `shellPath`：

```json
{
  "shellPath": "~/.local/bin/bash"
}
```

在 Windows 上，使用正斜杠或转义反斜杠：

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```

更改设置后运行 `/reload`。有关 Windows 原生默认值，请参阅 [在 Windows 上运行 Pi](/docs/windows/)。

## 在每个 Bash 命令前运行设置

将 `shellCommandPrefix` 设置为在内置 `bash` 工具和用户输入的 `!` 或 `!!` 命令前添加 shell 设置：

```json
{
  "shellCommandPrefix": "export CI=1"
}
```

Pi 会将前缀与请求的命令用换行符连接。前缀会在每个命令前再次运行，因此请保持其快速且无交互提示。

## 启用 Bash 别名

将 Pi 所需的别名存储在一个 Bash 兼容的文件中，而不是解析整个交互式 shell 配置。

创建 `~/.bash_aliases`：

```bash
alias ll='ls -la'
alias gs='git status --short'
```

然后配置 Pi 以启用别名扩展并加载该文件：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\nsource ~/.bash_aliases"
}
```

运行 `/reload`，然后通过 Pi 验证别名：

```text
!ll
```

该命令应产生与 `ls -la` 相同的列表输出。

别名必须使用 Bash 兼容的语法。不要将任意的 `.zshrc` 源入 Bash，因为 zsh 选项、函数和插件可能无法在其中正确解析或运行。

## 故障排除

### 前缀对 `!` 有效，但对扩展工具无效

`shellCommandPrefix` 配置的是 Pi 内置的 Bash 执行。替换 `bash` 工具或提供自身 shell 操作的扩展，其设置由其自身控制。请查阅该扩展的文档。

### `shopt` 未找到

Pi 已回退到 `sh`，或 `shellPath` 指向了非 Bash 外壳。请安装 Bash，或将 `shellPath` 设置为 Bash 可执行文件，然后再使用 Bash 特有的设置，如 `shopt`。

### 设置命令等待输入

从 `shellCommandPrefix` 中移除交互式命令。此前缀在每个 Bash 命令之前于非交互进程中运行。

完整的设置定义，请参阅 [外壳设置](settings.md#shell)。
