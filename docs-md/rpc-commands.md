# RPC 命令

本参考列出了在 [RPC 模式](/docs/rpc/) 下通过标准输入接受的命令。每条命令和响应都是一个 JSON 对象。共享消息值使用 [消息类型](/docs/message-types/)。

## 提示词

### 提示

向代理发送用户提示。命令响应在提示被接受、排队或处理后发出。接受后，事件会继续异步流式传输。

```json
{"id": "req-1", "type": "prompt", "message": "Hello, world!"}
```

带图片：
```json
{"type": "prompt", "message": "What's in this image?", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

**流式传输期间**：如果代理正在流式传输，您必须指定 `streamingBehavior` 来排队消息：

```json
{"type": "prompt", "message": "New instruction", "streamingBehavior": "steer"}
```

- `"steer"`：在代理运行时排队消息。它会在当前助手回合完成工具调用后、下一次 LLM 调用前传递。
- `"followUp"`：等待代理完成。消息仅在代理停止时传递。

如果代理正在流式传输且未指定 `streamingBehavior`，命令将返回错误。

**扩展命令**：如果消息是扩展命令（例如 `/mycommand`），即使在流式传输期间也会立即执行。扩展命令通过 `pi.sendMessage()` 管理自己的 LLM 交互。

**输入扩展**：技能命令（`/skill:name`）和提示词模板（`/template`）在发送/排队前进行扩展。

响应：
```json
{"id": "req-1", "type": "response", "command": "prompt", "success": true}
```

`success: true` 表示提示已被立即接受、排队或处理。`success: false` 表示提示在接受前被拒绝。接受后的失败通过正常的事件和消息流报告，而不是作为同一请求 ID 的第二次 `response`。

`images` 字段是可选的。每个图片使用 `ImageContent` 格式：`{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}`。

### steer

在代理运行期间排队一条引导消息。该消息会在当前助手回合完成其工具调用之后、下一次 LLM 调用之前被传递。技能命令和提示词模板会被展开。不允许使用扩展命令（请改用 `prompt`）。

```json
{"type": "steer", "message": "Stop and do this instead"}
```

带图片时：
```json
{"type": "steer", "message": "Look at this instead", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段是可选的。每张图片使用 `ImageContent` 格式（与 `prompt` 相同）。

响应：
```json
{"type": "response", "command": "steer", "success": true}
```

参见 [set_steering_mode](#set_steering_mode) 以了解如何控制引导消息的处理方式。

### 追问

排队一个追问消息，在代理完成后进行处理。仅在代理没有更多工具调用或引导消息时发送。技能命令和提示词模板会被扩展。扩展命令不允许（改用 `prompt`）。

```json
{"type": "follow_up", "message": "After you're done, also do this"}
```

带图片：
```json
{"type": "follow_up", "message": "Also check this image", "images": [{"type": "image", "data": "base64-encoded-data", "mimeType": "image/png"}]}
```

`images` 字段是可选的。每个图片使用 `ImageContent` 格式（与 `prompt` 相同）。

响应：
```json
{"type": "response", "command": "follow_up", "success": true}
```

参见[设置追问模式](#set_follow_up_mode)以控制追问消息的处理方式。

### 中止

中止当前操作，并等待会话变为空闲状态后再进行响应。

```json
{"type": "abort"}
```

响应：
```json
{"type": "response", "command": "abort", "success": true}
```

### clear_queue

移除队列中的引导和追问消息，并返回其文本。

```json
{"type": "clear_queue"}
```

响应：
```json
{
  "type": "response",
  "command": "clear_queue",
  "success": true,
  "data": {
    "steering": ["Change direction"],
    "followUp": ["Summarize when finished"]
  }
}
```

要实现交互式 Esc 行为，请在 `abort` 之前发送 `clear_queue`，然后在客户端编辑器中恢复返回的文本。当队列消息仍保留在会话中时，`abort` 会继续处理它们。

### new_session

开始一个新会话。可由 `session_before_switch` 扩展事件处理器取消。

```json
{"type": "new_session"}
```

带可选的父会话跟踪：
```json
{"type": "new_session", "parentSession": "/path/to/parent-session.jsonl"}
```

响应：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": false}}
```

如果扩展取消了：
```json
{"type": "response", "command": "new_session", "success": true, "data": {"cancelled": true}}
```

## 状态

### get_state

获取当前会话状态。

```json
{"type": "get_state"}
```

响应：
```json
{
  "type": "response",
  "command": "get_state",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isStreaming": false,
    "isCompacting": false,
    "steeringMode": "all",
    "followUpMode": "one-at-a-time",
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "sessionName": "my-feature-work",
    "autoCompactionEnabled": true,
    "messageCount": 5,
    "pendingMessageCount": 0
  }
}
```

`model` 字段是一个完整的 [模型](#model-object) 对象，当未选择模型时省略。`sessionName` 字段是通过 `set_session_name` 设置的显示名称，若未设置则省略。

### get_messages

获取会话中的所有消息。

```json
{"type": "get_messages"}
```

响应：
```json
{
  "type": "response",
  "command": "get_messages",
  "success": true,
  "data": {"messages": [...]}
}
```

消息为 `AgentMessage` 对象（参见 [消息类型](/docs/message-types/)）。

## 模型

### set_model

切换到指定模型。

```json
{"type": "set_model", "provider": "anthropic", "modelId": "claude-sonnet-4-20250514"}
```

响应包含完整的 [模型](#model-object) 对象：
```json
{
  "type": "response",
  "command": "set_model",
  "success": true,
  "data": {...}
}
```

### cycle_model

循环切换到下一个可用模型。如果只有一个模型可用，则返回 `null` 数据。

```json
{"type": "cycle_model"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_model",
  "success": true,
  "data": {
    "model": {...},
    "thinkingLevel": "medium",
    "isScoped": false
  }
}
```

`model` 字段是一个完整的 [模型](#model-object) 对象。

### get_available_models

列出所有已配置的模型。

```json
{"type": "get_available_models"}
```

响应包含一个完整的[模型](#model-object)对象数组：
```json
{
  "type": "response",
  "command": "get_available_models",
  "success": true,
  "data": {
    "models": [...]
  }
}
```

## 思考

### set_thinking_level

为支持推理/思考级别的模型设置该级别。

```json
{"type": "set_thinking_level", "level": "high"}
```

级别：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"`

`"xhigh"` 和 `"max"` 仅在所选模型支持时暴露。某些模型（包括 GPT-5.6）两者均支持。

响应：
```json
{"type": "response", "command": "set_thinking_level", "success": true}
```

### cycle_thinking_level

循环切换可用的思考级别。如果模型不支持思考，则返回 `null` 数据。

```json
{"type": "cycle_thinking_level"}
```

响应：
```json
{
  "type": "response",
  "command": "cycle_thinking_level",
  "success": true,
  "data": {"level": "high"}
}
```

### get_available_thinking_levels

列出当前模型支持的思考级别。对于不支持推理的模型，返回 `["off"]`。

```json
{"type": "get_available_thinking_levels"}
```

响应：
```json
{
  "type": "response",
  "command": "get_available_thinking_levels",
  "success": true,
  "data": {
    "levels": ["off", "minimal", "low", "medium", "high"]
  }
}
```

## 队列模式</think>## 队列模式

### set_steering_mode

控制引导消息（来自 `steer`）的传递方式。

```json
{"type": "set_steering_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：在当前助手回合完成其工具调用后，传递所有引导消息。
- `"one-at-a-time"`：每个完成的助手回合传递一条引导消息（默认）。

响应：
```json
{"type": "response", "command": "set_steering_mode", "success": true}
```

### set_follow_up_mode

控制来自 `follow_up` 的追问消息的传递方式。

```json
{"type": "set_follow_up_mode", "mode": "one-at-a-time"}
```

模式：
- `"all"`：当代理完成时传递所有追问消息
- `"one-at-a-time"`：每次代理完成时传递一条追问消息（默认）

响应：
```json
{"type": "response", "command": "set_follow_up_mode", "success": true}
```

## 压缩

### compact

手动压缩会话上下文以减少 token 用量。

```json
{"type": "compact"}
```

带自定义指令：
```json
{"type": "compact", "customInstructions": "聚焦代码变更"}
```

响应：
```json
{
  "type": "response",
  "command": "compact",
  "success": true,
  "data": {
    "summary": "对话摘要...",
    "firstKeptEntryId": "abc123",
    "tokensBefore": 150000,
    "estimatedTokensAfter": 32000,
    "usage": {
      "input": 32000,
      "output": 1200,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 33200,
      "cost": {"input": 0.01, "output": 0.02, "cacheRead": 0, "cacheWrite": 0, "total": 0.03}
    },
    "details": {}
  }
}
```

`estimatedTokensAfter` 是对压缩后重建消息上下文的启发式估算（紧接压缩后的即时状态），并非提供商精确计数的 token 数。`usage` 报告的是生成摘要所用的一次或多次 LLM 调用的用量，自定义压缩处理器可能会省略该字段。

### set_auto_compaction

当上下文接近满载时，启用或禁用自动压缩。

```json
{"type": "set_auto_compaction", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_compaction", "success": true}
```

## 重试

### set_auto_retry

启用或禁用对瞬时错误（过载、速率限制、5xx）的自动重试。

```json
{"type": "set_auto_retry", "enabled": true}
```

响应：
```json
{"type": "response", "command": "set_auto_retry", "success": true}
```

### abort_retry

中止进行中的重试（取消延迟并停止重试）。

```json
{"type": "abort_retry"}
```

响应：
```json
{"type": "response", "command": "abort_retry", "success": true}
```

## Bash

### bash

执行 shell 命令并将输出添加到会话上下文。命令运行时，输出以 `bash_execution_update` 事件流形式传输；响应包含最终结果。

```json
{"id": "req-1", "type": "bash", "command": "ls -la"}
```

当命令输出应存储在会话中，但在下一次 prompt 中从模型上下文省略时，将 `excludeFromContext` 设置为 `true`。

包含一个 `id` 以将此命令的流式 `bash_execution_update` 事件关联起来。

响应：
```json
{
  "id": "req-1",
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "total 48\ndrwxr-xr-x ...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": false
  }
}
```

如果输出被截断，则包含 `fullOutputPath`：
```json
{
  "type": "response",
  "command": "bash",
  "success": true,
  "data": {
    "output": "truncated output...",
    "exitCode": 0,
    "cancelled": false,
    "truncated": true,
    "fullOutputPath": "/tmp/pi-bash-abc123.log"
  }
}
```

**bash 结果如何到达 LLM：**

`bash` 命令立即执行并返回一个 `BashResult`。内部会创建一个 `BashExecutionMessage` 并存储在代理的消息状态中。

当下一次发送 `prompt` 命令时，Pi 在将上下文消息发送到模型之前对其进行转换。除非 `excludeFromContext` 为 true，否则 `BashExecutionMessage` 将成为具有以下格式的 `UserMessage`：

````
Ran `ls -la`
```
total 48
drwxr-xr-x ...
```
````

这意味着：
1. 包含的 bash 输出在**下一次 prompt**时到达模型，而不是立即。
2. 可以在 prompt 之前运行多个 bash 命令；Pi 会包含每个未设置 `excludeFromContext` 的输出。

### abort_bash

中止正在运行的 bash 命令。

```json
{"type": "abort_bash"}
```

响应：
```json
{"type": "response", "command": "abort_bash", "success": true}
```

## 会话</think>## 会话

### get_session_stats

获取 token 使用量、成本统计和当前上下文窗口使用情况。

```json
{"type": "get_session_stats"}
```

响应：
```json
{
  "type": "response",
  "command": "get_session_stats",
  "success": true,
  "data": {
    "sessionFile": "/path/to/session.jsonl",
    "sessionId": "abc123",
    "userMessages": 5,
    "assistantMessages": 5,
    "toolCalls": 12,
    "toolResults": 12,
    "totalMessages": 22,
    "tokens": {
      "input": 50000,
      "output": 10000,
      "cacheRead": 40000,
      "cacheWrite": 5000,
      "total": 105000
    },
    "cost": 0.45,
    "contextUsage": {
      "tokens": 60000,
      "contextWindow": 200000,
      "percent": 30
    }
  }
}
```

`tokens` 和 `cost` 包含助手消息、工具报告的使用情况以及跨整个会话的压缩/分支摘要生成。`contextUsage` 包含用于压缩和页脚显示的实际当前上下文窗口预估。

当没有模型或上下文窗口可用时，会省略 `contextUsage`。在压缩后直到新的压缩后助手响应提供有效使用数据之前，`contextUsage.tokens` 和 `contextUsage.percent` 为 `null`。

### export_html

将会话导出为 HTML 文件。

```json
{"type": "export_html"}
```

自定义路径：
```json
{"type": "export_html", "outputPath": "/tmp/session.html"}
```

响应：
```json
{
  "type": "response",
  "command": "export_html",
  "success": true,
  "data": {"path": "/tmp/session.html"}
}
```

### switch_session

加载不同的会话文件。可通过 `session_before_switch` 扩展事件处理器取消。

```json
{"type": "switch_session", "sessionPath": "/path/to/session.jsonl"}
```

响应：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": false}}
```

如果扩展取消了切换：
```json
{"type": "response", "command": "switch_session", "success": true, "data": {"cancelled": true}}
```

### fork

在活动分支上从先前的用户消息创建新的 fork。可由 `session_before_fork` 扩展事件处理器取消。返回被 fork 来源消息的文本。

```json
{"type": "fork", "entryId": "abc123"}
```

响应：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"text": "The original prompt text...", "cancelled": false}
}
```

如果扩展取消了 fork：
```json
{
  "type": "response",
  "command": "fork",
  "success": true,
  "data": {"cancelled": true}
}
```

### clone

将当前活动分支复制到新会话的当前位置。可通过 `session_before_fork` 扩展事件处理器取消。

```json
{"type": "clone"}
```

响应：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": false}
}
```

如果扩展取消了克隆：
```json
{
  "type": "response",
  "command": "clone",
  "success": true,
  "data": {"cancelled": true}
}
```

### get_fork_messages

获取可用于分叉的用户消息。

```json
{"type": "get_fork_messages"}
```

响应：
```json
{
  "type": "response",
  "command": "get_fork_messages",
  "success": true,
  "data": {
    "messages": [
      {"entryId": "abc123", "text": "第一个提示词..."},
      {"entryId": "def456", "text": "第二个提示词..."}
    ]
  }
}
```

### get_entries

按追加顺序获取所有会话条目（不包括会话头）。会话是一个仅追加的条目树，具有稳定的 ID，因此条目 ID 可作为持久游标使用：将您已见过的最后条目 ID 作为 `since` 传入，即可仅获取其后的条目，即使在客户端重启后也是如此。与 `get_messages` 不同，此操作包含压缩前历史和废弃分支。

```json
{"type": "get_entries"}
```

带游标：
```json
{"type": "get_entries", "since": "abc123"}
```

响应：
```json
{
  "type": "response",
  "command": "get_entries",
  "success": true,
  "data": {
    "entries": [
      {"type": "message", "id": "def456", "parentId": "abc123", "timestamp": "...", "message": {"role": "user", "...": "..."}}
    ],
    "leafId": "def456"
  }
}
```

`leafId` 是当前叶条目的 ID（空会话时为 `null`），因此客户端可通过一次往返判断活动分支是否移动。如果 `since` 不匹配任何条目 ID，则响应为 `success: false`。

### get_tree

将会话获取为条目的树形结构。每个节点为 `{entry, children, label?, labelTimestamp?}`。结果是一个数组，因为导航 API 可以创建多个根节点；父链断裂的孤立条目也会作为根节点出现。

```json
{"type": "get_tree"}
```

响应：
```json
{
  "type": "response",
  "command": "get_tree",
  "success": true,
  "data": {
    "tree": [
      {
        "entry": {"type": "message", "id": "abc123", "parentId": null, "...": "..."},
        "children": [
          {"entry": {"type": "message", "id": "def456", "parentId": "abc123", "...": "..."}, "children": []}
        ]
      }
    ],
    "leafId": "def456"
  }
}
```

### get_last_assistant_text

获取最后一条助手消息的文本内容。

```json
{"type": "get_last_assistant_text"}
```

响应：
```json
{
  "type": "response",
  "command": "get_last_assistant_text",
  "success": true,
  "data": {"text": "助手的响应..."}
}
```

如果不存在助手文本，`text` 值为 `null`。

### set_session_name

设置当前会话的显示名称。该名称出现在会话列表中，有助于识别会话。

```json
{"type": "set_session_name", "name": "my-feature-work"}
```

响应：
```json
{
  "type": "response",
  "command": "set_session_name",
  "success": true
}
```

当前会话名称可通过 `get_state` 中的 `sessionName` 字段获取。要在启动 RPC 模式时设置初始名称，请向 `pi --mode rpc` 进程传递 `--name <name>` 或 `-n <name>`。

## 可发现的命令

### get_commands

获取可用命令（扩展命令、提示词模板和技能）。通过 `prompt` 命令运行其中一个，方法是在其名称前加上 `/`。

```json
{"type": "get_commands"}
```

响应：
```json
{
  "type": "response",
  "command": "get_commands",
  "success": true,
  "data": {
    "commands": [
      {
        "name": "fix-tests",
        "description": "修复失败的测试",
        "source": "prompt",
        "sourceInfo": {
          "path": "/home/user/myproject/.pi/agent/prompts/fix-tests.md",
          "source": "local",
          "scope": "project",
          "origin": "top-level"
        }
      }
    ]
  }
}
```

每个命令包含：
- `name`：命令名称（使用 `/name`）
- `description`：人类可读的描述（扩展命令可选）
- `source`：命令的类型：
  - `"extension"`：通过扩展中的 `pi.registerCommand()` 注册
  - `"prompt"`：从提示词模板 `.md` 文件加载
  - `"skill"`：从技能目录加载（名称以 `skill:` 为前缀）
- `sourceInfo`：注册命令的资源的元数据：
  - `path`：资源的绝对路径
  - `source`：Pi 发现它的方式，如 `"local"`、`"auto"` 或 `"cli"`
  - `scope`：`"user"`、`"project"` 或 `"temporary"`
  - `origin`：直接加载的资源为 `"top-level"`，软件包资源为 `"package"`
  - `baseDir`：软件包基础目录（如适用）

**注意**：内置 TUI 命令（`/settings`、`/hotkeys` 等）不包含在内。它们仅在交互模式下处理，通过 `prompt` 发送时不会执行。

## 模型对象

模型命令返回完整的已配置模型定义。费用以每百万令牌的美元计价。

```json
{
  "id": "claude-sonnet-4-20250514",
  "name": "Claude Sonnet 4",
  "api": "anthropic-messages",
  "provider": "anthropic",
  "baseUrl": "https://api.anthropic.com",
  "reasoning": true,
  "input": ["text", "image"],
  "contextWindow": 200000,
  "maxTokens": 16384,
  "cost": {
    "input": 3.0,
    "output": 15.0,
    "cacheRead": 0.3,
    "cacheWrite": 3.75
  }
}
```

关于模型配置，请参阅 [配置兼容端点](models.md#configure-a-compatible-endpoint)。对于 TypeScript，请使用 `@earendil-works/pi-ai` 导出的 `Model` 类型。
