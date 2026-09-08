# 环境变量

Pi 以三种方式使用环境变量：

- `PI_OFFLINE` 之类的变量用于配置 Pi 进程本身。
- Pi 会设置进程标记，让子进程能识别出"启动者"是 Pi。
- LLM 可调用的 shell 工具运行的命令会收到描述当前会话的 `PI_*` 变量。

提供商 API Key 相关变量在[提供商](/docs/providers/)中单独说明。

## 进程标记

CLI 与 RPC 入口会设置两个进程标记：

- `AI_AGENT=pi` 是通用标记，让工具链识别出启动本进程的智能体是 Pi。
- `PI_CODING_AGENT=true` 是 Pi 专属标记，让子进程检测到自己运行在 Pi 内部。

子进程继承这两个标记。它们不携带会话信息；通过 SDK 嵌入 Pi 时不会自动设置。

## Shell 工具的会话环境

`bash` 和 `powershell` 工具运行的命令会收到当前 Pi 会话状态：

| 变量 | 说明 |
|------|------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 当前会话 JSONL 文件的绝对路径；临时会话不设置 |
| `PI_PROVIDER` | 当前选中的模型提供商 |
| `PI_MODEL` | 当前选中的模型 ID |
| `PI_REASONING_LEVEL` | 当前生效的推理等级：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

这些值在每条命令启动时解析。因此切换模型或推理等级会影响下一条 shell 命令，无需重启 Pi。`PI_PROVIDER` 和 `PI_MODEL` 标识 Pi 中选中的模型，而不是路由器内部可能选择的某个上游模型。

被问到当前运行的是哪个模型或提供商时，检查这些变量，而不是从系统提示里推断：

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

会话为持久会话时，可以直接查看会话文件：

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

这些变量注入的是 LLM 可调用的 `bash` 和 `powershell` 工具；用户输入的 `!` 或 `!!` 命令不会注入。

### 自定义 Shell 工具

用 `createBashTool()` 或 `createPowerShellTool()` 创建的工具注册到 Pi 后，默认会暴露会话环境。注入发生在 `spawnHook` 之前，钩子里通过 `ctx.env` 拿到这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

独立于 spawn hook 关闭会话元数据：

```typescript
const powershellTool = createPowerShellTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

关闭后，Pi 会移除继承来的这些变量值，避免嵌套的 Pi 进程暴露过期的父会话元数据。

## Pi 进程配置

这些变量由 Pi 自身读取：

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录；默认 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储；`--session-dir` 优先级更高 |
| `PI_PACKAGE_DIR` | 覆盖软件包目录，适用于 Nix/Guix store 路径 |
| `PI_OFFLINE` | 禁用启动网络操作，包括更新检查、软件包更新和安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 禁用 `pi.dev` 最新版本请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测与提供商署名头：`1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | 设为 `long` 可在提供商支持时使用扩展提示词缓存 |
| `PI_SHARE_VIEWER_URL` | 覆盖 `/share` 使用的基础 URL |
| `PI_HARDWARE_CURSOR` | 设为 `1` 显示硬件光标，见[终端设置](/docs/terminal-setup/) |
| `PI_HYPERLINKS` | 覆盖 OSC 8 超链接检测：`1`、`0` 或 `auto` |
| `PI_IMAGE_PROTOCOL` | 覆盖内联图片检测：`kitty`、`iterm2`、`none` 或 `auto` |
| `PI_TRUE_COLOR` | 覆盖真彩检测：`1`、`0` 或 `auto` |
| `PI_TUI_ESC_TIMEOUT` | 单独的 ESC 被判定为 Escape 键前的等待毫秒数；SSH 下默认 `100`，否则 `10`。Alt 键被误判为 Escape 时调大 |
| `VISUAL`、`EDITOR` | `externalEditor` 未设置时的外部编辑器回退 |
| `HTTP_PROXY`、`HTTPS_PROXY` | 为出站 HTTP 请求设置代理 |

`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等提供商凭据及云提供商配置见[提供商](/docs/providers/)。

`PI_SERVER_DIR` 和 `PI_SERVER_ID` 只用于仅源码提供的[实验性远程外壳](/docs/development/)，分发的构建中不适用。
