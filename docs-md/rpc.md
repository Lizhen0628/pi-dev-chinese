# RPC 模式

RPC 模式将 Pi 作为长期运行的子进程，通过 stdin 和 stdout 上的 JSON 记录进行控制。它适用于语言无关的集成、进程隔离、IDE 和自定义用户界面。

对于进程内的 Node.js 或 Bun 集成，请优先使用 [SDK](/docs/sdk/)。对于基于子进程的 TypeScript 集成，请优先使用导出的 `RpcClient`，它会启动 Pi、关联响应、提供类型化的命令方法，并将事件传递给监听器。

| 接口 | 进程边界 | 控制模型 | 最佳适用场景 |
|---|---|---|---|
| [SDK](/docs/sdk/) | 进程内 | 直接的 TypeScript 方法和事件 | 需要完整 API 访问权限的 Node.js 或 Bun 宿主 |
| RPC | 子进程 | JSONL 命令、响应和事件 | 其他语言、隔离进程、IDE 或自定义客户端 |

## 启动 RPC 模式

```bash
pi --mode rpc --no-session
```

常规 CLI 选项仍用于选择工作文件夹、模型、工具、资源和会话行为。常用选项包括 `--provider`、`--model`、`--name`、`--no-session` 和 `--session-dir`。完整且针对特定版本的接口请参阅 [命令行](/docs/cli/)；对于已安装版本，`pi --help` 为权威参考。

RPC 模式不接受 `@file` 提示词参数。请改用 [`prompt`](rpc-commands.md#prompt) 命令发送提示词。

## 协议记录

该协议包含四个记录族：

| 方向 | 记录 | 用途 |
|---|---|---|
| 标准输入 | 命令 | 请求 Pi 进行提示、检查状态、更改配置或管理会话 |
| 标准输出 | `response` | 报告某条命令是否成功，并返回命令数据 |
| 标准输出 | 会话事件 | 流式传输运行、消息、工具、队列、压缩和重试活动 |
| 双向 | 扩展 UI 记录 | 在 Pi 与客户端之间转发受支持的扩展交互 |

有关规范的记录定义，请参阅 [RPC 命令](/docs/rpc-commands/)、[JSON 事件流](/docs/json/) 和 [RPC 扩展 UI](/docs/rpc-extension-ui/)。

### 关联命令与响应

每个命令均接受一个可选的字符串`id`字段。匹配的响应会重复该字段：

```json
{"id":"req-1","type":"get_state"}
{"id":"req-1","type":"response","command":"get_state","success":true,"data":{"...":"..."}}
```

当可能存在多个待处理命令时，应使用唯一ID。命令处理是异步的，因此客户端应通过ID进行关联，而非依赖响应顺序。

会话事件通常不包含命令ID，因为它们描述的是会话活动。`bash_execution_update`是个例外：当原始的[`bash`](rpc-commands.md#bash)命令带有ID时，其输出事件会重复该ID。

`extension_ui_response`使用其对应的`extension_ui_request`所提供的ID，且不产生常规的命令响应。

## 帧格式

RPC 采用严格的 JSONL 帧格式。每条记录写入一个完整的 JSON 对象，并以 LF（`\n`）结尾。将标准输出作为字节流或 UTF-8 流读取，仅按 LF 分割记录。可选地去除前置的回车符，以接受 CRLF 输入。

不要使用将 Unicode 行分隔符或段落分隔符视为记录边界的通用行读取器。特别是，Node.js 的 `readline` 也会在 `U+2028` 和 `U+2029` 处分割，而这些字符在 JSON 字符串中是合法的。

持续读取标准输出。Pi 会尊重标准输出的背压，但停止读取的客户端可能会阻塞进程。写入命令时，请尊重标准输入的背压。标准输出仅用于协议记录；诊断信息和应用程序日志应写入标准错误。

## 运行生命周期

一次成功的 `prompt` 响应意味着提示词已被接受、排队或处理，并不代表模型工作已完成：

```json
{"id":"req-2","type":"prompt","message":"Review this repository"}
{"id":"req-2","type":"response","command":"prompt","success":true,"data":{"disposition":"started"}}
```

`data.disposition` 报告了提示词的处理情况。如果其值为 `"handled"`，则表示该提示词未启动任何运行，因此无需等待 `agent_settled`。所有可能的取值见 [RPC 命令](rpc-commands.md#prompt)。

收到该响应后，请继续消费[事件](/docs/json/)。`agent_end` 标志着一次底层代理运行的结束，但重试、溢出恢复、压缩、引导或追问等工作仍可能继续。当客户端需要确认 Pi 不会自动继续时，请等待 `agent_settled`。

为避免错过快速完成的响应，请在发送提示词之前订阅事件。`RpcClient.promptAndWait()` 会在内部完成此操作。如果使用单独的 `RpcClient` 调用，应在调用 `prompt()` 之前安装事件监听器，并仅在运行处于活动状态时调用 `waitForIdle()`。

## 错误

命令执行失败时，返回一个包含 `success: false` 的响应：

```json
{"id":"req-3","type":"response","command":"set_model","success":false,"error":"Model not found: invalid/model"}
```

格式错误的 JSON 会产生一个不带请求 ID 的解析响应：

```json
{"type":"response","command":"parse","success":false,"error":"Failed to parse command: Unexpected token..."}
```

成功响应仅涵盖命令处理本身。提示词被接受后出现的提供商故障和中止，会出现在消息和事件流中。

客户端还必须处理子进程启动失败、意外退出、stderr 诊断信息、取消操作以及自身的超时限制。请勿将 stderr 内容解析为协议数据。

## 关闭

关闭子进程的标准输入以请求有序关闭。Pi 在退出前会处理当前活动的运行时。客户端仍应处理进程信号和意外退出。

扩展也可以通过其扩展上下文请求关闭。Pi 会在当前命令执行完毕或当前运行发出 `agent_settled` 后完成关闭。

## 最小客户端

此 Python 示例使用二进制管道读取器，该读取器按 LF（换行符）分割，而不将 Unicode 分隔符视为协议边界：

```python
import json
import subprocess

process = subprocess.Popen(
    ["pi", "--mode", "rpc", "--no-session"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
)

assert process.stdin is not None
assert process.stdout is not None

command = {"id": "prompt-1", "type": "prompt", "message": "Hello"}
process.stdin.write(json.dumps(command).encode("utf-8") + b"\n")
process.stdin.flush()

while line := process.stdout.readline():
    record = json.loads(line)
    if record.get("type") == "message_update":
        update = record["assistantMessageEvent"]
        if update["type"] == "text_delta":
            print(update["delta"], end="", flush=True)
    elif record.get("type") == "agent_settled":
        print()
        break

process.stdin.close()
process.wait()
```

对于受维护的 TypeScript 客户端，请使用已检查的 [RPC 客户端示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/rpc-client.ts)。该示例需要构建好的 Pi CLI，因为仓库中的示例指向 `dist/cli.js`。

## 参考

- [RPC 命令](/docs/rpc-commands/)：标准输入上的每条命令及其响应
- [事件流](/docs/json/)：共享标准输出会话事件与流式重建
- [RPC 扩展 UI](/docs/rpc-extension-ui/)：对话框、通知、响应及限制
- [消息类型](/docs/message-types/)：响应和事件所使用的消息与内容块
- [会话文件格式](/docs/session-format/)：会话命令返回的条目
- [`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts)：导出的 TypeScript 协议定义
- [`RpcClient`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-client.ts)：子进程客户端实现

## 已移动的锚点

本页原有的详细参考内容现已移至独立页面。这些锚点保留现有链接。

<a id="prompt"></a>
<a id="steer"></a>
<a id="follow_up"></a>
<a id="abort"></a>
<a id="clear_queue"></a>
<a id="new_session"></a>
<a id="get_state"></a>
<a id="get_messages"></a>
<a id="set_model"></a>
<a id="cycle_model"></a>
<a id="get_available_models"></a>
<a id="set_thinking_level"></a>
<a id="cycle_thinking_level"></a>
<a id="get_available_thinking_levels"></a>
<a id="set_steering_mode"></a>
<a id="set_follow_up_mode"></a>
<a id="compact"></a>
<a id="set_auto_compaction"></a>
<a id="set_auto_retry"></a>
<a id="abort_retry"></a>
<a id="bash"></a>
<a id="abort_bash"></a>
<a id="get_session_stats"></a>
<a id="export_html"></a>
<a id="switch_session"></a>
<a id="fork"></a>
<a id="clone"></a>
<a id="get_fork_messages"></a>
<a id="get_entries"></a>
<a id="get_tree"></a>
<a id="get_last_assistant_text"></a>
<a id="set_session_name"></a>
<a id="get_commands"></a>

命令详情已移至 [RPC 命令](/docs/rpc-commands/)。

<a id="message_update-streaming"></a>
<a id="bash_execution_update"></a>
<a id="compaction_start--compaction_end"></a>
<a id="summarization_retry_scheduled--summarization_retry_attempt_start--summarization_retry_finished"></a>

事件详情已移至 [JSON 事件流](/docs/json/)。

<a id="extension-ui-protocol"></a>

扩展交互详情已移至 [RPC 扩展界面](/docs/rpc-extension-ui/)。
