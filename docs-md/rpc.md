# RPC 模式

RPC 模式通过 stdin/stdout 上的 JSON 协议无头运行编码智能体，适合把智能体嵌入其他应用、IDE 或自定义 UI。

**Node.js/TypeScript 用户请注意**：如果你在写 Node.js 应用，优先考虑直接使用 `@earendil-works/pi-coding-agent` 的 `AgentSession`，而不是派生子进程。基于子进程的 TypeScript 客户端可参考 [`src/modes/rpc/rpc-client.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-client.ts)。

> 本文为结构化中文编译版；完整命令/事件负载与类型见[英文原文](https://pi.dev/docs/latest/rpc)。

## 启动 RPC 模式

```bash
pi --mode rpc
```

常用选项：

- `--provider <名称>`：设置 LLM 提供商（anthropic、openai、google 等）
- `--model <模式>`：模型模式或 ID（支持 `provider/id` 与可选 `:<思考等级>`）
- `--name <名称>` / `-n <名称>`：启动时设置会话显示名
- `--no-session`：禁用会话持久化
- `--session-dir <路径>`：自定义会话存储目录

## 协议概览

- **命令**：发到 stdin 的 JSON 对象，每行一个
- **响应**：带 `type: "response"` 的 JSON 对象，表示命令成功/失败
- **事件**：以 JSON 行流式输出到 stdout 的智能体事件

所有命令都支持可选 `id` 字段用于请求/响应关联；对应响应会带相同 `id`。`bash_execution_update` 事件也带其来源 `bash` 命令的 `id`。

### 帧

RPC 模式使用严格的 JSONL 语义，只以 LF（`\n`）作为记录分隔符：

- 只按 `\n` 切分记录
- 接受可选的 `\r\n` 输入（去掉行尾 `\r`）
- 不要使用会把 Unicode 分隔符当换行的通用行读取器

特别地，Node 的 `readline` 不符合 RPC 协议——它还会按 `U+2028` 和 `U+2029` 切分，而这两个字符在 JSON 字符串里是合法的。

## 命令

### 提示类

#### prompt

向智能体发送用户提示词。响应在提示词被接受、排队或处理后发出；事件在接受之后继续异步流式输出。可带 `images`（`ImageContent` 格式：`{"type": "image", "data": "base64...", "mimeType": "image/png"}`）。

**流式期间**：智能体正在流式输出时必须指定 `streamingBehavior`：

- `"steer"`：消息排队，在当前助手回合执行完工具调用后、下一次 LLM 调用前投递
- `"followUp"`：等智能体全部结束后才投递

流式期间未指定该选项时命令返回错误。

**扩展命令**（如 `/mycommand`）即使在流式期间也立即执行，其 LLM 交互由扩展经 `pi.sendMessage()` 自行管理。技能命令（`/skill:名称`）与提示词模板在发送/排队前展开。

`success: true` 表示提示词被接受、排队或立即处理；`success: false` 表示接受前被拒绝。接受之后的失败走正常事件与消息流，不会对同一请求 id 再发第二条 `response`。

#### steer / followUp

智能体运行中排队引导消息（steer）或结束后投递的追问消息（followUp）。技能命令与模板会展开；steer 不允许扩展命令（请用 `prompt`）。

### 状态类

- `get_state` —— 读取当前会话状态（模型、思考等级、队列等）
- `get_messages` —— 获取当前消息列表
- `abort` / `abort_all` —— 中止当前运行/全部排队
- `set_queue_modes` —— 设置 steer/followUp 投递模式

### 模型与思考

- `set_model` —— 切换提供商/模型
- `list_models` —— 列出可用模型
- `set_thinking_level` —— 设置思考等级

### 压缩与重试

- `compact` —— 手动触发压缩，可带自定义指令
- 自动重试相关事件见下文事件列表

### Bash

- `bash` —— 执行 shell 命令；其输出更新以 `bash_execution_update` 事件流式返回（带命令 `id`）

### 会话

- `new_session` / `fork_session` / `switch_session` / `import_session` —— 会话生命周期操作
- `get_session_info` —— 会话文件、ID、用量等信息

### 命令枚举

- `get_commands` —— 获取可用斜杠命令/扩展命令列表
- `execute_command` —— 执行指定命令

## 事件

### 事件类型

| 事件 | 说明 |
|------|------|
| `agent_start` / `agent_end` | 智能体运行开始/结束 |
| `agent_settled` | 智能体完全空闲（队列清空） |
| `turn_start` / `turn_end` | 回合开始/结束 |
| `message_start` / `message_end` | 消息开始/结束 |
| `message_update` | 流式增量更新（文本/思考/工具调用增量） |
| `bash_execution_update` | 用户 bash 命令的流式输出 |
| `tool_execution_start` / `tool_execution_update` / `tool_execution_end` | 工具执行生命周期 |
| `queue_update` | 引导/追问队列变化 |
| `compaction_start` / `compaction_end` | 压缩开始/结束 |
| `auto_retry_start` / `auto_retry_end` | 智能体级自动重试开始/结束 |
| `summarization_retry_scheduled` / `summarization_retry_attempt_start` / `summarization_retry_finished` | 摘要重试生命周期 |
| `extension_error` | 扩展错误上报 |

## 扩展 UI 协议

扩展的自定义 UI 在 RPC 模式下经协议转发：stdout 发出扩展 UI 请求（选择、确认、输入等），客户端以对应响应（stdin）回答。请求/响应负载与交互序列见英文原文的 Extension UI Protocol 一节。

## 错误处理

命令失败时响应带 `success: false` 与错误信息；接受后的运行失败经事件流报告。

## 类型

RPC 载荷复用会话消息类型（`Model`、`UserMessage`、`AssistantMessage`、`ToolResultMessage`、`BashExecutionMessage`），与[会话格式](/docs/session-format/)一致；完整 TypeScript 定义见英文原文。
