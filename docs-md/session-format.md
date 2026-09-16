# 会话文件格式

会话以JSONL（JSON Lines）文件形式存储。每一行是一个带有`type`字段的JSON对象。会话条目通过`id`/`parentId`字段构成树形结构，支持原地分支操作，无需创建新文件。

## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl
```

默认情况下，`<session-id>` 是一个 UUID。调用者可以通过 SDK 或 `--session-id` 提供自定义 ID。对于 `<path>`，Pi 会移除开头的路径分隔符，并将 `/`、`\\` 和 `:` 替换为 `-`。

## 删除会话

通过删除 `~/.pi/agent/sessions/` 下的 `.jsonl` 文件，可以移除对应的会话。

Pi 也支持在 `/resume` 中交互式删除会话（选中会话后按 `Ctrl+D`，然后确认删除）。当可用时，pi 会使用 `trash` CLI 来避免永久性删除。

## 会话版本

会话在头部包含一个版本字段：

- **版本1**：线性条目序列（旧版，加载时自动迁移）
- **版本2**：采用`id`/`parentId`链接的树状结构
- **版本3**：将`hookMessage`角色重命名为`custom`（扩展统一）

现有会话在加载时会自动迁移至当前版本（v3）。

## 源文件

GitHub 上的源代码 ([pi](https://github.com/earendil-works/pi)):
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话入口类型和 SessionManager
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型（BashExecutionMessage、CustomMessage 等）
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) - 基础消息类型（UserMessage、AssistantMessage、ToolResultMessage）
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) - AgentMessage 联合类型

对于你项目中的 TypeScript 定义，请检查 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

## 消息类型

会话条目包含 `AgentMessage` 对象。理解这些类型对于解析会话和编写扩展至关重要。

### 内容块

消息包含类型化内容块的数组：

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}

interface ImageContent {
  type: "image";
  data: string;      // base64 编码
  mimeType: string;  // 例如："image/jpeg"、"image/png"
}

interface ThinkingContent {
  type: "thinking";
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}

interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
  thoughtSignature?: string;
  namespace?: string;
}
```

### 基础消息类型（来自pi-ai）

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  toolsAdded?: Tool[];
  toolsRemoved?: Array<{ name: string }>;
  replace?: boolean;  // 丢弃更早的系统消息；这条是完整的提示词和工具状态
  timestamp: number;  // Unix毫秒
}

interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;  // Unix毫秒
}

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

interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: any;      // 工具特定的元数据
  usage?: Usage;      // 工具执行的嵌套LLM工作
  isError: boolean;
  timestamp: number;
}

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

"`pending`" 保留用于流式事件中的部分消息。终端事件在Pi持久化助手消息之前用完成原因替换它，因此"`pending`"不应出现在会话JSONL中。"`deferred`"是提供商响应完成后的终端原因，其`deferred`句柄包含检索该响应所需的提供商数据。

### 扩展消息类型（来自 pi-coding-agent）

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;  // 对于 !! 前缀命令为 true
  timestamp: number;
}

interface CustomMessage {
  role: "custom";
  customType: string;            // 扩展标识符
  content: string | (TextContent | ImageContent)[];
  display: boolean;              // 在 TUI 中显示
  details?: any;                 // 扩展特定的元数据
  timestamp: number;
}

interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string | null;         // 之前被汇总的废弃路径的叶子
  timestamp: number;
}

interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

### AgentMessage 联合类型

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

## 条目基类

所有条目（`SessionHeader` 除外）都继承自 `SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // 通常为 8 字符的十六进制 ID；可能回退为完整的 UUID
  parentId: string | null;  // 父条目的 ID（根条目的 parentId 为 null）
  timestamp: string;    // ISO 格式的时间戳
}
```

## 条目类型</think>## 条目类型

### 会话头

文件的第一行。仅包含元数据，不属于树结构的一部分（无 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于具有父会话的会话（通过 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### 会话消息条目

会话中的一条消息。`message` 字段包含一个 `AgentMessage`。系统消息携带提示词和工具加载配置：会话的首次请求会持久化包含完整提示词部分和工具声明的系统消息，后续的更改则持久化为系统消息，按名称修补 `sections`（`null` 表示移除某个部分），并列出 `toolsAdded`/`toolsRemoved`。按顺序重放这些消息即可获得当前的提示词和工具；不需要单独的提示词状态条目。一个强制整个提示词的 `before_agent_start` 处理器会持久化一条 `replace: true` 的系统消息，在 `content` 中保存强制文本和完整工具集，而保留强制提示词则会持久化另一条包含结构化部分的消息。

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"你是一位专家编码助手...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```

在系统消息存在之前创建的会话没有前置系统消息；首次请求将当前提示词以后续系统消息的形式声明，其重放方式相同。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"你好","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"嗨！"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"输出"}],"isError":false,"timestamp":1733234403000}}
```

### 模型变更条目

当用户在会话中途切换模型时发出。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

### 思考级别变更条目

当用户更改思考/推理级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### 压缩条目

在上下文被压缩时创建。存储早期消息的摘要和完整的系统提示词/工具检查点。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId` 是必需的。它标识从压缩条目之前保留的第一个条目。重建上下文时，Pi 用压缩摘要替换较早的摘要条目，并保留从该条目开始的区间。

可选字段：
- `systemMessage`: 压缩边界处重放的提示词部分和工具声明；它成为压缩后上下文的前导系统消息，被保留条目中的系统消息会被其取代。在较早的会话条目中不存在此字段。
- `usage`: 生成摘要时的 LLM 用量；包含在会话令牌和费用总计中
- `details`: 实现特定的数据（例如，默认情况下为 `{ readFiles: string[], modifiedFiles: string[] }`，或扩展的自定义数据）
- `fromHook`: 如果由扩展生成，为 `true`；如果由 Pi 生成，为 `false`/`undefined`（旧版字段名）

### BranchSummaryEntry（分支摘要条目）

当通过 `/tree` 切换分支时，由 LLM 生成左侧分支直至共同祖先的摘要并创建此条目，用以捕获已放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"分支探索了方法A..."}
```

`parentId` 是新分支继续的起点条目。`fromId` 是之前的叶节点，其已放弃的路径被摘要化。

可选字段：
- `usage`：生成摘要时的 LLM 使用量；计入会话令牌与成本总计
- `details`：默认情况下为文件追踪数据（`{ readFiles: string[], modifiedFiles: string[] }`），或供扩展使用的自定义数据
- `fromHook`：若由扩展生成则为 `true`，若由 pi 生成则为 `false`/`undefined`（旧字段名）。

### 自定义条目

扩展状态持久化。不参与 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用 `customType` 在重新加载时识别扩展的条目。交互模式可以通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍然不参与 LLM 上下文。

### CustomMessageEntry（自定义消息条目）

由扩展注入且参与 LLM 上下文的消息。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段说明：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与 UserMessage 相同）
- `display`：`true` = 在 TUI 中以独特样式显示，`false` = 隐藏
- `details`：可选的扩展特定元数据（不发送给 LLM）

### LabelEntry

条目上的用户自定义书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设置为 `undefined` 以清除标签。

### SessionInfoEntry

会话元数据（例如，用户定义的显示名称）。通过 `/name`、`--name` / `-n` 或扩展中的 `pi.setSessionName()` 设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话名称显示在会话选择器（`/resume`）中，而不是第一条消息。

## 树结构

条目通常构成一棵树，但导航API可以创建多个根：
- 根条目的 `parentId` 为 `null`；第一个条目最初为根
- 每个非根条目通过 `parentId` 指向其父条目
- 分支从较早的条目创建新的子条目
- “叶子”是树中的当前位置
- 调用 `resetLeaf()` 或 `branchWithSummary(null, ...)` 可以让后面的条目成为另一个根

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← 当前叶子
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← 备用分支
```

## 上下文构建

`buildContextEntries()` 从当前叶节点回溯到根节点，生成活动条目列表，同时遵循压缩规则：

1. 收集路径上的所有条目
2. 如果路径上有一个或多个 `CompactionEntry` 值，则使用最新的一个：
   - 首先包含压缩条目
   - 包含从 `firstKeptEntryId` 到压缩条目之间（不含压缩条目）的非系统条目
   - 包含压缩条目之后的条目
3. 保留所选范围内的非消息条目，以便交互模式可以渲染它们

`buildSessionContext()` 基于该条目列表生成用于 LLM 的消息列表：

1. 从完整路径中提取当前模型和思考级别设置
2. 将所选条目转换为消息：
   - `message` -> 存储的 `AgentMessage`
   - `compaction` -> 完整的系统检查点后跟 `compactionSummary`
   - `branch_summary` -> `branchSummary`
   - `custom_message` -> `CustomMessage`
   - `custom` -> 无上下文消息

压缩摘要替换 `firstKeptEntryId` 之前的条目。压缩前的系统消息被折叠到完整的检查点中，而不是从保留范围内重放。保留的非系统条目以及压缩之后的所有条目仍然可供 LLM 使用。

## 解析示例

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`Session v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] Branch from ${entry.fromId}`);
      break;
    case "custom":
      console.log(`[${entry.id}] Custom (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] Extension message (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] Label "${entry.label}" on ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] Model: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] Thinking: ${entry.thinkingLevel}`);
      break;
  }
}
```

## 会话管理器 API

用于以编程方式操作会话的关键方法。

### 静态创建方法
- `SessionManager.create(cwd, sessionDir?, options?)` - 创建新会话；`options` 可设置 `id` 和 `parentSession`
- `SessionManager.open(path, sessionDir?, cwdOverride?)` - 打开现有会话文件
- `SessionManager.continueRecent(cwd, sessionDir?)` - 继续最近的会话或创建新会话
- `SessionManager.inMemory(cwd?, options?, entries?)` - 无文件持久化，可选地从 entries 初始化
- `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?, options?)` - 从另一项目派生出会话

### 静态列举方法
- `SessionManager.list(cwd, sessionDir?, onProgress?)` - 列出某个目录下的会话
- `SessionManager.listAll(onProgress?)` - 列出所有项目中的所有会话
- `SessionManager.listAll(sessionDir?, onProgress?)` - 从自定义会话根目录列出会话

### 实例方法 - 会话管理
- `newSession(options?)` - 启动新会话（选项：`{ id?: string, parentSession?: string }`）
- `setSessionFile(path)` - 切换到不同的会话文件
- `createBranchedSession(leafId)` - 将分支提取到新会话文件中

### 实例方法 - 追加（均返回条目ID）
- `appendMessage(message)` - 添加消息
- `appendThinkingLevelChange(level)` - 记录思考级别变化
- `appendModelChange(provider, modelId)` - 记录模型变更
- `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?, usage?)` - 添加压缩记录
- `appendCustomEntry(customType, data?)` - 扩展状态（不在上下文中）
- `appendSessionInfo(name)` - 设置会话显示名称
- `appendCustomMessageEntry(customType, content, display, details?)` - 扩展消息（在上下文中）
- `appendLabelChange(targetId, label)` - 设置/清除标签

### 实例方法 - 树导航
- `getLeafId()` - 当前位置
- `getLeafEntry()` - 获取当前叶子条目
- `getEntry(id)` - 按ID获取条目
- `getBranch(fromId?)` - 从条目遍历到根
- `getTree()` - 获取完整树结构
- `getChildren(parentId)` - 获取直接子节点
- `getLabel(id)` - 获取条目的标签
- `branch(entryId)` - 将叶子移动到较早的条目
- `resetLeaf()` - 将叶子重置为null（在任何条目之前）
- `branchWithSummary(entryId, summary, details?, fromHook?, usage?)` - 使用上下文摘要分支；`entryId` 可以为 `null` 以从根分支

### 实例方法 - 上下文与信息
- `buildContextEntries()` - 获取应用压缩后的活动分支条目
- `buildSessionContext()` - 获取供 LLM 使用的消息、思考级别和模型
- `getEntries()` - 所有条目（不包括头部）
- `getHeader()` - 会话头部元数据
- `getSessionName()` - 从最新的会话信息条目中获取显示名称
- `getCwd()` - 工作目录
- `getSessionDir()` - 会话存储目录
- `getSessionId()` - 会话 UUID
- `getSessionFile()` - 会话文件路径（内存会话时为 undefined）
- `isPersisted()` - 会话是否已保存到磁盘
