# 环境变量

Pi 通过三种方式使用环境变量：

- 诸如 `PI_OFFLINE` 之类的变量用于配置 Pi 进程。
- Pi 设置进程标记，以便子进程能够识别 Pi 为启动代理。
- 由 LLM 可调用 shell 工具运行的命令会接收描述当前会话的 `PI_*` 变量。

提供商 API 密钥变量在 [提供商认证](providers.md#use-an-api-key-from-the-environment) 中单独记录。

## 进程标记

命令行接口和RPC入口点会设置两个进程标记：

- `AI_AGENT=pi` 是一个通用标记，让工具能够识别Pi是启动该进程的代理。
- `PI_CODING_AGENT=true` 是Pi特有的标记，让子进程能够检测到自己运行在Pi内部。

子进程会继承这两个标记。它们不与特定会话绑定，当Pi通过SDK嵌入时也不会自动设置。

## 外壳工具会话环境

`bash` 和 `powershell` 工具执行的命令会接收当前 Pi 会话状态：

| 变量 | 描述 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 当前会话 JSONL 文件的绝对路径；对于临时会话未设置 |
| `PI_PROVIDER` | 当前选定的模型提供商 |
| `PI_MODEL` | 当前选定的模型 ID |
| `PI_REASONING_LEVEL` | 当前有效的推理级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

这些值在每条命令启动时解析。因此，切换模型或更改推理级别会影响下一条外壳命令，而无需重启 Pi。`PI_PROVIDER` 和 `PI_MODEL` 标识选定的 Pi 模型，而非路由器可能在内部选择的不同上游模型。

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

这些变量被注入到可调用 LLM 的 `bash` 和 `powershell` 工具中。它们不会被注入到用户输入的 `!` 或 `!!` 命令中。

### 自定义Shell工具

使用`createBashTool()`或`createPowerShellTool()`创建的工具，在注册到Pi后默认会暴露会话环境。注入过程发生在`spawnHook`之前，因此钩子函数能够在`ctx.env`中接收到这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

可以独立于生成钩子禁用会话元数据：

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

当禁用时，Pi会移除这些变量的继承值，从而避免嵌套的Pi进程暴露过期的父会话元数据。

## Pi 进程配置

以下变量由 Pi 自身读取：

| 变量 | 描述 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认值为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储位置；被 `--session-dir` 覆盖 |
| `PI_PACKAGE_DIR` | 覆盖软件包目录，适用于 Nix/Guix 存储路径 |
| `PI_OFFLINE` | 禁用自动网络活动，包括模型目录刷新 |
| `PI_SKIP_VERSION_CHECK` | 禁用 `pi.dev` 最新版本请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测和提供商归属标头：`1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | 设置为 `long` 以在支持的情况下延长提供商提示词缓存 |
| `PI_SHARE_VIEWER_URL` | 覆盖 `/share` 使用的基础 URL |
| `PI_RADIUS_GATEWAY` | 覆盖 `/bug` 上传和 Radius 中继连接使用的 Radius 网关源 |
| `PI_HARDWARE_CURSOR` | 设置为 `1` 以显示硬件光标；参见 [终端设置](/docs/terminal-setup/) |
| `PI_HYPERLINKS` | 用 `1`、`0` 或 `auto` 覆盖 OSC 8 超链接检测 |
| `PI_IMAGE_PROTOCOL` | 用 `kitty`、`iterm2`、`none` 或 `auto` 覆盖内联图像检测 |
| `PI_TRUE_COLOR` | 用 `1`、`0` 或 `auto` 覆盖真彩色检测 |
| `PI_TUI_ESC_TIMEOUT` | 在将单独的 ESC 视为 Escape 之前等待的时间，以毫秒为单位；通过 SSH 默认值为 `100`，否则为 `10`。如果 Alt 键输入被误读为 Escape，则增加此值 |
| `VISUAL`、`EDITOR` | 当 `externalEditor` 未设置时的外部编辑器回退 |
| `HTTP_PROXY`、`HTTPS_PROXY` | 代理出站 HTTP 请求 |

提供商凭据（如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 和云提供商配置）列在 [提供商身份验证](providers.md#use-an-api-key-from-the-environment) 中。
