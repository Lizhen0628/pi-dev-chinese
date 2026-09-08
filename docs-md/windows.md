# Windows 设置

Pi 在 Windows 上默认使用 Git Bash。检查顺序：

1. `~/.pi/agent/settings.json` 中的自定义路径
2. Git Bash（`C:\Program Files\Git\bin\bash.exe`）
3. PATH 上的 `bash.exe`（Cygwin、MSYS2、WSL）

对多数用户来说，装 [Git for Windows](https://git-scm.com/download/win) 就够了。

## PowerShell 工具

可选的 `powershell` 工具优先通过 `pwsh.exe` 运行命令，没有则用 Windows PowerShell。它以 `-NoProfile -NonInteractive -ExecutionPolicy Bypass` 启动。管理员强制的执行策略仍可能优先。

用 `defaultTools` 把面向模型的 `bash` 工具换成 PowerShell：

```json
{
  "defaultTools": ["read", "powershell", "edit", "write"]
}
```

比较两者行为时也可以同时启用：

```json
{
  "defaultTools": ["read", "bash", "powershell", "edit", "write"]
}
```

编辑器中的 `!` 和 `!!` 命令仍然使用 Bash。

## 自定义 Bash 路径

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```
