# 消息类型

Pi 在 SDK 状态、生命周期事件、RPC 响应以及持久化的会话消息条目中使用 `AgentMessage` 值。本页定义了这些共享消息及其内容块。

消息时间戳是 Unix 毫秒时间戳。它们不同于[会话条目](session-format.md#entry-base)上的 ISO 8601 时间戳。

源定义：

- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) 定义了面向提供商的消息和内容块。
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) 定义了可扩展的 `AgentMessage` 联合类型。
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) 添加了编码代理消息角色。

## 内容块

### 文本内容

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}
```

`textSignature` 包含提供商特定的消息元数据。请将其视为不透明数据。

### 图像内容

```typescript
interface ImageContent {
  type: "image";
  data: string;
  mimeType: string;
}
```

`data` 是经过 base64 编码的图像数据。`mimeType` 标识其媒体类型，例如 `image/png` 或 `image/jpeg`。

### 思维内容

```typescript
interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}
```

思维签名包含提供商特定的重放数据，应将其视为不透明数据。脱敏块可以没有可见的思维文本，但仍在 `thinkingSignature` 中保留加密载荷。

### ToolCall

```typescript
interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
  namespace?: string;
}
```

`thoughtSignature` 是提供商特定的。`namespace` 标识用于动态加载或命名空间化工具的 OpenAI Responses 命名空间。

## 用法

助手消息始终包含用量信息。当工具执行了嵌套模型工作时，工具结果中也可能包含用量信息。

```typescript
interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cacheWrite1h?: number;
  reasoning?: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

当存在时，`reasoning` 已包含在 `output` 中；请勿重复添加。`cacheWrite1h` 是 `cacheWrite` 中保留一小时写入的子集。

## 基础消息

### SystemMessage

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  sections?: Record<string, string | null>;
  toolsAdded?: Tool[];
  toolsRemoved?: ToolReference[];
  replace?: boolean;
  timestamp: number;
}
```

开头的系统消息声明了初始提示词和工具。后续的系统消息可以追加指令、替换或移除指定的提示词部分，以及添加或移除工具。按顺序重放这些消息即可得到当前状态。带有 `replace: true` 的消息会丢弃先前的状态，并建立全新的基线。

### 用户消息

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;
}
```

### AssistantMessage

```typescript
interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string;
  provider: string;
  model: string;
  responseModel?: string;
  responseId?: string;
  providerThinkingLevel?: string;
  diagnostics?: AssistantMessageDiagnostic[];
  usage: Usage;
  stopReason: "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
  deferred?: DeferredHandle;
  errorMessage?: string;
  rawStopReason?: string;
  endTurn?: boolean;
  timestamp: number;
}
```

`responseModel` 记录具体的提供商响应模型，当它与请求的模型不同时使用。`responseId`、`providerThinkingLevel`、`diagnostics` 和 `rawStopReason` 保留提供商或运行时细节。

`"pending"` 用于流式传输过程中的部分助手消息。`message_end` 中完成的消息具有终止停止原因，Pi 不会在会话 JSONL 中持久化 `"pending"` 助手消息。

`"deferred"` 响应具有 `DeferredHandle`，其中包含检索它所需的提供商数据：

```typescript
interface DeferredHandle {
  provider: string;
  modelId: string;
  api: string;
  id: string;
  expiresAt?: number;
  pollAfterMs?: number;
  data?: JsonValue;
}
```

### 工具结果消息

```typescript
interface ToolResultMessage<TDetails = any> {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: TDetails;
  usage?: Usage;
  isError: boolean;
  timestamp: number;
}
```

`details` 字段是工具特有的。可选的 `usage` 字段报告工具执行的嵌套模型工作，并计入全会话统计，但它不属于主模型调用用量的一部分。

## 编码代理消息

编码代理软件包通过四种角色扩展了 `AgentMessage`。

### BashExecutionMessage

由直接 shell 命令创建，包括 RPC [`bash`](rpc-commands.md#bash) 命令。它不是 LLM 工具结果。

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;
  timestamp: number;
}
```

除非 `excludeFromContext` 为 true，否则 Pi 会在下一次模型请求之前将此消息转换为用户角色文本。

### CustomMessage

当扩展发送上下文消息时创建。

```typescript
interface CustomMessage<T = unknown> {
  role: "custom";
  customType: string;
  content: string | (TextContent | ImageContent)[];
  display: boolean;
  details?: T;
  timestamp: number;
}
```

Pi 将其内容转换为用户消息以用于模型请求。`display` 控制终端渲染；`details` 不会发送给模型。

### BranchSummaryMessage（分支摘要消息）

```typescript
interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string | null;
  timestamp: number;
}
```

Pi 根据持久化的 `branch_summary` 条目创建此上下文消息。

### 压缩摘要消息

```typescript
interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

Pi 会从一个持久化的 `compaction` 条目中创建此上下文消息。

## AgentMessage 联合类型

在编码代理中，该联合类型等价于：

```typescript
type AgentMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

在底层代理软件包中，`AgentMessage` 为 `Message | CustomAgentMessages[keyof CustomAgentMessages]`。应用程序可以通过 TypeScript 声明合并添加角色，因此当消费者从增强的主机接收消息时，应容忍未知的自定义角色。
