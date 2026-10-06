# JSON 事件流

JSON 模式为单次调用输出结构化进度：

```bash
pi --mode json "Review this repository"
```

Pi 会先写入一个会话头，随后输出会话事件，并在提供的提示词完成后退出。RPC 模式输出相同的会话事件结构，但由于它是双向、长连接的协议，因此没有会话头。参见 [RPC 模式](/docs/rpc/)。

本页是 JSON 与 RPC 模式共享事件的权威参考。消息值使用 [共享消息类型](/docs/message-types/)。

## 框架与进程 I/O

该流采用严格的 JSONL 框架。每条记录是一个以 LF（`\n`）结尾的 JSON 对象。仅按 LF 分割记录，并去除可选的前置回车符。Unicode 行分隔符和段落分隔符在 JSON 字符串内有效，但不作为记录边界。

Node.js 的 `readline` 不适合此流，因为它也会识别这些 Unicode 分隔符。请使用字节或 UTF-8 流解码器，并按 LF 分割。

持续读取 stdout。如果读取器停止消费记录，当管道缓冲区填满时，Pi 可能会停滞。Stdout 专用于 JSONL；诊断信息和应用程序日志应输出到 stderr。

## 会话头

第一条 JSON 模式记录是当前的[会话头](session-format.md#sessionheader)：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path"}
```

RPC 模式不输出此记录。请使用 [`get_state`](rpc-commands.md#get_state) 获取其当前会话 ID 和文件。

## 事件序列

一次基本的运行会产生如下记录：

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_end","message":{"role":"user","content":"Review this repository","timestamp":1733234401000}}
{"type":"message_start","message":{"role":"assistant","content":[],"stopReason":"pending","...":"..."}}
{"type":"message_update","usage":{"...":"..."},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello"}}
{"type":"message_end","message":{"role":"assistant","...":"..."}}
{"type":"turn_end","message":{"role":"assistant","...":"..."},"toolResults":[]}
{"type":"agent_end","messages":[{"...":"..."}],"willRetry":false}
{"type":"agent_settled"}
```

`agent_end` 结束一次底层 agent 运行。自动重试、溢出恢复、压缩重试、引导或追问工作仍可继续。`agent_settled` 表示 Pi 在该会话级运行中不再有自动工作。

## 代理与回合事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `agent_start` | 无 | 一个底层代理运行已开始。 |
| `agent_end` | `messages`、`willRetry` | 该底层运行已结束。`messages` 包含该运行生成的消息。 |
| `agent_settled` | 无 | Pi 不会通过重试、压缩恢复或排队消息自动继续。 |
| `turn_start` | 无 | 一个助手回合已开始。 |
| `turn_end` | `message`、`toolResults` | 一个助手响应及其产生的工具调用已完成。 |

一个回合是指一个助手响应，加上该响应产生的所有工具调用和工具结果。

## 消息事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `message_start` | `message` | 消息已开始。 |
| `message_update` | `usage`, `assistantMessageEvent` | 助手消息发出了内容块更新。 |
| `message_end` | `message` | 消息已完成。这是权威的最终消息。 |

### 重构流式消息

线上的 `message_update` 记录仅包含增量信息。它们省略了 SDK 事件的累积 `message` 字段及每个 `assistantMessageEvent.partial` 快照，以确保流大小保持线性。

嵌套事件类型如下：

| 类型 | 除 `type` 外的字段 | 含义 |
|---|---|---|
| `start` | 无 | 提供商流已开始；其累积的 `partial` 字段在线上被移除。 |
| `text_start` | `contentIndex` | 文本块开始。 |
| `text_delta` | `contentIndex`, `delta` | 向块中追加文本。 |
| `text_end` | `contentIndex`, `content` | 文本块结束，包含权威内容。 |
| `thinking_start` | `contentIndex` | 思考块开始。 |
| `thinking_delta` | `contentIndex`, `delta` | 向块中追加思考文本。 |
| `thinking_end` | `contentIndex`, `content` | 思考块结束，包含权威内容。 |
| `toolcall_start` | `contentIndex`, `id`, `toolName` | 工具调用块开始。 |
| `toolcall_delta` | `contentIndex`, `delta` | 追加序列化参数数据。 |
| `toolcall_end` | `contentIndex`, `toolCall` | 工具调用结束，包含完整的 `ToolCall`。 |
| `done` | `reason`, `message` | 提供商流成功完成。 |
| `error` | `reason`, `error` | 提供商流以错误或中止消息结束。 |

正常的代理循环将提供商的 `start`、`done` 和 `error` 事件转换为 `message_start` 和 `message_end` 会话事件，而不是作为 `message_update` 发出。它们仍被导出的 `JsonAgentSessionEvent` 转换所接受，供构造匹配会话事件的调用者使用。

使用 `contentIndex` 来标识内容块。为实时显示缓冲 `delta` 字段，但在 `text_end`、`thinking_end` 或 `toolcall_end` 中用完成的内容替换重构的数据。当 `message_end.message` 到达时，用其替换整个部分消息。

顶层 `usage` 是提供商报告的最新累积使用量，用于助手响应。如果提供商在流式传输期间不报告使用量，它可能保持为零直到完成。

```json
{"type":"message_update","usage":{"input":100,"output":1,"cacheRead":0,"cacheWrite":0,"totalTokens":101,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello "}}
```

## 工具执行事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `tool_execution_start` | `toolCallId`, `toolName`, `args` | 工具执行开始。 |
| `tool_execution_update` | `toolCallId`, `toolName`, `args`, `partialResult` | 工具报告了部分结果。 |
| `tool_execution_end` | `toolCallId`, `toolName`, `result`, `isError`, `durationMs` | 工具执行结束。`durationMs` 是工具 `execute()` 所花费的时间，使用单调时钟测量；当工具未运行时缺失。 |

使用 `toolCallId` 来关联生命周期。`partialResult` 是工具提供的最新部分结果。它是否替换或扩展先前的更新取决于该工具的结果契约。

```json
{"type":"tool_execution_start","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"}}
{"type":"tool_execution_update","toolCallId":"call_abc123","toolName":"bash","args":{"command":"ls -la"},"partialResult":{"content":[{"type":"text","text":"partial output"}],"details":{}}}
{"type":"tool_execution_end","toolCallId":"call_abc123","toolName":"bash","result":{"content":[{"type":"text","text":"complete output"}],"details":{}},"isError":false}
```

## 队列和状态事件

| 事件 | 字段 | 含义 |
|---|---|---|
| `queue_update` | `steering`, `followUp` | 待处理的引导或追问队列发生变化。两个字段均包含完整的当前队列。 |
| `entry_appended` | `entry` | 扩展通过 `pi.appendEntry()` 追加了自定义会话条目。 |
| `session_info_changed` | `name` | 会话显示名称发生变化。`name` 字段缺失表示名称已清除。 |
| `thinking_level_changed` | `level` | 当前思考级别发生变化。 |

`entry` 值使用持久化的 [会话条目类型](session-format.md#entry-types)。

## 压缩事件

`compaction_start` 报告压缩开始的原因：

```json
{"type":"compaction_start","reason":"threshold"}
```

`reason` 的值为 `"manual"`、`"threshold"` 或 `"overflow"`。

`compaction_end` 在压缩成功时包含结果：

```json
{
  "type": "compaction_end",
  "reason": "threshold",
  "result": {
    "summary": "对话摘要...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {"...": "..."},
    "details": {}
  },
  "aborted": false,
  "willRetry": false
}
```

如果压缩被中止，`result` 字段不存在且 `aborted` 为 `true`。如果压缩失败，`result` 字段不存在，`aborted` 为 `false`，且 `errorMessage` 描述失败原因。成功的溢出恢复会在 Pi 重试提示词之前将 `willRetry` 设为 `true`。

有关结果语义，请参阅 [压缩与分支摘要](/docs/compaction/)。

## 重试事件

助手轮次重试发出：

```json
{"type":"auto_retry_start","attempt":1,"maxAttempts":3,"delayMs":2000}
{"type":"auto_retry_end","success":true,"attempt":2}
```

在最终失败时，`auto_retry_end` 具有 `success: false` 和一个 `finalError` 字符串。

压缩和分支摘要重试发出：

```json
{"type":"summarization_retry_scheduled","attempt":1,"maxAttempts":3,"delayMs":2000,"errorMessage":"terminated"}
{"type":"summarization_retry_attempt_start","source":"compaction","reason":"threshold"}
{"type":"summarization_retry_finished"}
```

对于分支摘要，`source` 是 `"branchSummary"`，`reason` 不存在。压缩重试上的 `reason` 是 `"manual"`、`"threshold"` 或 `"overflow"`。

## 仅限 RPC 的事件

直接 RPC [`bash`](rpc-commands.md#bash) 命令会为每个输出块发出一个 `bash_execution_update` 事件。其可选的 `id` 与命令 ID 匹配。最终的命令响应可能包含截断的输出，但这些事件会流式传输所有输出：

```json
{"type":"bash_execution_update","id":"req-1","delta":"total 48\n"}
```

当扩展处理器抛出异常时，RPC 还会添加 `extension_error` 事件：

```json
{"type":"extension_error","extensionPath":"/path/to/extension.ts","event":"tool_call","error":"Error message"}
```

扩展 UI 记录是独立的 RPC 子协议，不属于 `AgentSessionEvent` 值。参见 [RPC 扩展 UI](/docs/rpc-extension-ui/)。

## TypeScript 类型

SDK 的 `AgentSessionEvent` 包含供进程内消费者使用的累积流式快照。JSON 和 RPC 仅转换 `message_update`：

```typescript
type WithoutPartial<T> = T extends { partial: unknown } ? Omit<T, "partial"> : T;

type JsonAssistantMessageEvent<T> = T extends { type: "toolcall_start"; partial: unknown }
  ? WithoutPartial<T> & { id: string; toolName: string }
  : WithoutPartial<T>;

type JsonAgentSessionEvent =
  | Exclude<AgentSessionEvent, { type: "message_update" }>
  | {
      type: "message_update";
      usage: Usage;
      assistantMessageEvent: JsonAssistantMessageEvent<AssistantMessageEvent>;
    };
```

使用 `@earendil-works/pi-coding-agent` 导出的 `JsonAgentSessionEvent` 类型。其实现位于 [`json-event.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/json-event.ts) 中。

## 示例

打印一次性运行中完成的消息：

```bash
pi --mode json "列出文件" 2>/dev/null | jq -c 'select(.type == "message_end")'
```
