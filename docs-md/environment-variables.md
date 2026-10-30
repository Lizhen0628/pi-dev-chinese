# 环境变量

Pi 通过三种方式使用环境变量：

- 诸如 `PI_OFFLINE` 之类的变量用于配置 Pi 进程。
- Pi 设置进程标记，以便子进程能够识别 Pi 为启动代理。
- 由 LLM 可调用的 shell 工具运行的命令会接收到描述当前会话的 `PI_*` 变量。

提供商 API 密钥变量在 [提供商](providers.md#use-an-api-key-from-the-environment) 中单独记录。

## 进程标记

CLI 和 RPC 入口点设置两个进程标记：

- `AI_AGENT=pi` 是一个通用标记，让工具能够识别 Pi 是启动该进程的代理。
- `PI_CODING_AGENT=true` 是 Pi 特有的标记，让子进程能够检测到它们运行在 Pi 内部。

子进程会继承这两个标记。它们不特定于会话，并且当 Pi 通过 SDK 嵌入时不会自动设置。

## Shell 工具会话环境

`bash` 和 `powershell` 工具执行的命令会接收当前 Pi 会话状态：

| 变量 | 描述 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 当前会话 JSONL 文件的绝对路径；临时会话中未设置 |
| `PI_PROVIDER` | 当前选定的模型提供商 |
| `PI_MODEL` | 当前选定的模型 ID |
| `PI_REASONING_LEVEL` | 当前生效的推理级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

这些值在每条命令启动时解析。因此，切换模型或更改推理级别会影响下一条 shell 命令，而无需重启 Pi。`PI_PROVIDER` 和 `PI_MODEL` 标识选定的 Pi 模型，而非路由器可能在内部选择的其他上游模型。

当被问及正在运行的模型或提供商时，请检查这些变量，而不是从系统提示词中推断答案：

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

当会话为持久会话时，可以直接检查会话文件：

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

这些变量被注入到可被 LLM 调用的 `bash` 和 `powershell` 工具中。它们不会被注入到用户输入的 `!` 或 `!!` 命令中。

### 自定义 Shell 工具

使用 `createBashTool()` 或 `createPowerShellTool()` 创建的工具在注册到 Pi 时默认暴露会话环境。注入发生在 `spawnHook` 之前，因此挂钩在 `ctx.env` 中接收这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

独立于生成挂钩禁用会话元数据：

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

禁用后，Pi 会移除这些变量的继承值，从而避免嵌套的 Pi 进程暴露过时的父会话元数据。

## Pi 进程配置

以下变量由 Pi 自身读取：

| 变量 | 描述 |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储；可通过 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖软件包目录，适用于 Nix/Guix 存储路径 |
| `PI_OFFLINE` | 禁用自动网络活动，包括模型目录刷新 |
| `PI_SKIP_VERSION_CHECK` | 禁用 `pi.dev` 的最新版本请求 |
| `PI_SELF_UPDATE_COMMAND` | `pi update` 用于更新 Pi 自身的命令，按空白字符分割，支持 `{packageName}`、`{version}` 和 `{installSpec}` 占位符。优先于 `selfUpdateCommand` 设置。参见 [自定义更新命令](cli.md#custom-update-command) |
| `PI_TELEMETRY` | 覆盖安装/更新遥测和提供商归属标头：`1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CODEMODE_MAX_WORKERS` | 进程中所有会话同时存活的代码模式工作线程的最大数量；默认为 `2`。每个工作线程的脚本最多可使用 256 MB。当单个进程运行多个会话（如进程内子代理）时可调高此值。后续脚本会等待空闲工作线程。参见 [代码模式](/docs/codemode/) |
| `PI_CACHE_RETENTION` | 设置为 `long` 可延长支持的提供商提示词缓存时间 |
| `PI_SHARE_VIEWER_URL` | 覆盖 `/share` 使用的基础 URL |
| `PI_RADIUS_GATEWAY` | 覆盖 `/bug` 上传使用的 Radius 网关源 |
| `PI_CLEAR_ON_SHRINK` | 设置为 `1` 可在渲染内容缩小时清除空行；`terminal.clearOnShrink` 设置优先。参见 [设置](/docs/settings/) |
| `PI_HARDWARE_CURSOR` | 设置为 `1` 可显示硬件光标；参见 [终端设置](/docs/terminal-setup/) |
| `PI_CLIPBOARD_OSC52` | 设置为 `1` 可在本地剪贴板写入后，也通过 OSC 52 将复制文本发送到终端，如同 Pi 通过 SSH 所做。当远程客户端在没有 SSH 变量的情况下连接 Pi 时（如从另一台机器附加的多路复用器或远程 IDE 守护进程），可使用此选项 |
| `PI_HYPERLINKS` | 用 `1`、`0` 或 `auto` 覆盖 OSC 8 超链接检测 |
| `PI_PROGRAM_STATUS` | 覆盖 OSC 7501 程序状态检测：`1` 始终报告，`0` 从不报告；否则 Pi 仅在终端确认支持后报告。参见 [终端设置](terminal-setup.md#program-status) |
| `PI_IMAGE_PROTOCOL` | 用 `kitty`、`iterm2`、`none` 或 `auto` 覆盖内联图像检测 |
| `PI_TRUE_COLOR` | 用 `1`、`0` 或 `auto` 覆盖真彩色检测 |
| `PI_TUI_ESC_TIMEOUT` | 在孤立的 ESC 后将等待多久再将其视为 Escape，单位为毫秒；SSH 下默认为 `100`，其他情况为 `10`。如果 Alt 键输入被误读为 Escape，可增大此值 |
| `VISUAL`、`EDITOR` | 当 `externalEditor` 未设置时的外部编辑器回退 |
| `HTTP_PROXY`、`HTTPS_PROXY` | 代理出站 HTTP 请求 |

提供商凭据（如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`）以及提供商特定配置，请参见 [提供商](providers.md#use-an-api-key-from-the-environment)。
