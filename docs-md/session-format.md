# 会话文件格式

会话以 JSONL（JSON Lines）文件存储。每行一个带 `type` 字段的 JSON 对象。会话条目通过 `id`/`parentId` 构成树结构，支持在不新建文件的情况下原地分支。

## 文件位置

```
~/.pi/agent/sessions/--<路径>--/<时间戳>_<会话id>.jsonl
```

默认 `<会话id>` 是 UUID；调用方可通过 SDK 或 `--session-id` 提供自定义 ID。`<路径>` 会去掉开头的路径分隔符，并把 `/`、`\`、`:` 替换为 `-`。

## 删除会话

直接删除 `~/.pi/agent/sessions/` 下对应的 `.jsonl` 文件即可。

Pi 也支持在 `/resume` 中交互删除（选中会话按 `Ctrl+D` 后确认）。可用时 Pi 会用 `trash` CLI，避免永久删除。

## 会话版本

会话头部带版本字段：

- **版本 1**：线性条目序列（旧格式，加载时自动迁移）
- **版本 2**：以 `id`/`parentId` 链接的树结构
- **版本 3**：`hookMessage` 角色更名为 `custom`（扩展统一）

已有会话在加载时自动迁移到当前版本（v3）。

## 源码位置

GitHub 源码（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) —— 会话条目类型与 SessionManager
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) —— 扩展消息类型（BashExecutionMessage、CustomMessage 等）
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) —— 基础消息类型（UserMessage、AssistantMessage、ToolResultMessage）
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) —— AgentMessage 联合类型

项目内的 TypeScript 定义查看 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

## 消息类型

会话条目包含 `AgentMessage` 对象。理解这些类型是解析会话和编写扩展的基础。

### 内容块

消息包含类型化的内容块数组：

```typescript
interface TextContent {
  type: "text";
  text: string;
  textSignature?: string;
}

interface ImageContent {
  type: "image";
  data: string;      // base64 编码
  mimeType: string;  // 如 "image/jpeg"、"image/png"
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

### 基础消息类型（pi-ai）

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;  // Unix 毫秒
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
  details?: any;      // 工具专属元数据
  usage?: Usage;      // 工具内部执行的嵌套 LLM 工作
  addedToolNames?: string[];
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

`"pending"` 只用于流式事件中的不完整消息；终态事件在 Pi 持久化助手消息前会替换为完成原因，因此会话 JSONL 中不应出现 `"pending"`。`"deferred"` 是"稍后完成"的提供商响应的终态原因，其 `deferred` 句柄包含取回该响应所需的提供商数据。

### 扩展消息类型（pi-coding-agent）

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;  // `!!` 前缀命令为 true
  timestamp: number;
}

interface CustomMessage {
  role: "custom";
  customType: string;            // 扩展标识
  content: string | (TextContent | ImageContent)[];
  display: boolean;              // 是否在 TUI 中显示
  details?: any;                 // 扩展专属元数据
  timestamp: number;
}

interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string | null;         // 被摘要路径的原叶子节点
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
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

## 条目基类

除 `SessionHeader` 外，所有条目都扩展 `SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // 通常是 8 位十六进制 ID；可能退化为完整 UUID
  parentId: string | null;  // 父条目 ID（根条目为 null）
  timestamp: string;    // ISO 时间戳
}
```

## 条目类型

### SessionHeader

文件第一行。只有元数据，不属于树（没有 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

有父会话的会话（经 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### SessionMessageEntry

对话中的一条消息。`message` 字段是 `AgentMessage`。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```

### ModelChangeEntry

用户在会话中切换模型时产生。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

### ThinkingLevelChangeEntry

用户更改思考/推理等级时产生。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### CompactionEntry

上下文被压缩时创建，保存较早消息的摘要。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000}
```

`firstKeptEntryId` 必填，标识压缩条目之前保留的第一条。重建上下文时，Pi 用压缩摘要替换更早的被摘要条目，并保留从该条目开始的范围。

可选字段：
- `usage`：生成摘要的 LLM 用量；计入会话 token 与费用总量
- `details`：实现相关数据（默认压缩为 `{ readFiles: string[], modifiedFiles: string[] }`，扩展可用自定义数据）
- `fromHook`：`true` 表示扩展生成；`false`/`undefined` 表示 Pi 生成（旧字段名）

### BranchSummaryEntry

经 `/tree` 切换分支时创建，包含对被离开路径（直到公共祖先）的 LLM 摘要，承接被放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

`parentId` 是新分支的续接条目；`fromId` 是被摘要路径的原叶子节点。

可选字段：
- `usage`：生成摘要的 LLM 用量；计入会话总量
- `details`：默认为文件跟踪数据（`{ readFiles: string[], modifiedFiles: string[] }`），扩展可用自定义数据
- `fromHook`：`true` 表示扩展生成；`false`/`undefined` 表示 Pi 生成（旧字段名）

### CustomEntry

扩展状态持久化。**不**进入 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

`/reload` 时用 `customType` 识别自己扩展的条目。交互模式可通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍不进入 LLM 上下文。

### CustomMessageEntry

扩展注入、**会**进入 LLM 上下文的消息。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段：
- `content`：字符串或 `(TextContent | ImageContent)[]`（同 UserMessage）
- `display`：`true` = 在 TUI 中以独特样式显示；`false` = 隐藏
- `details`：可选的扩展专属元数据（不发给 LLM）

### LabelEntry

用户在条目上定义的书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

把 `label` 设为 `undefined` 即清除标签。

### SessionInfoEntry

会话元数据（如用户定义的显示名）。经 `/name`、`--name`/`-n` 或扩展中的 `pi.setSessionName()` 设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话选择器（`/resume`）中显示该名称而不是第一条消息。

## 树结构

条目通常构成一棵树，但导航 API 可以创建多个根：
- 根条目的 `parentId: null`；最初的第一个条目即根
- 每个非根条目通过 `parentId` 指向父条目
- 分支从较早的条目创建新子节点
- "叶子"是树中的当前位置
- 调用 `resetLeaf()` 或 `branchWithSummary(null, ...)` 会让之后的条目成为另一个根

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← 当前叶子
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← 另一条分支
```

## 上下文构建

`buildContextEntries()` 从当前叶子走到根，产出活动条目列表并处理压缩：

1. 收集路径上的全部条目
2. 路径上存在一个或多个 `CompactionEntry` 时，取最新一个：
   - 先包含该压缩条目
   - 包含从 `firstKeptEntryId` 到（不含）压缩条目之间的条目
   - 包含压缩条目之后的条目
3. 所选范围内的非消息条目会保留，供交互模式渲染

`buildSessionContext()` 在该条目列表之上构建发给 LLM 的消息列表：

1. 从完整路径提取当前模型与思考等级设置
2. 把选中的条目转换为消息：
   - `message` -> 存储的 `AgentMessage`
   - `compaction` -> `compactionSummary`
   - `branch_summary` -> `branchSummary`
   - `custom_message` -> `CustomMessage`
   - `custom` -> 无上下文消息

压缩摘要替换 `firstKeptEntryId` 之前的条目；保留条目及压缩之后的所有条目对 LLM 可见。

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

## SessionManager API

以编程方式操作会话的关键方法。

### 静态创建方法
- `SessionManager.create(cwd, sessionDir?, options?)` —— 新会话；`options` 可设 `id` 和 `parentSession`
- `SessionManager.open(path, sessionDir?, cwdOverride?)` —— 打开已有会话文件
- `SessionManager.continueRecent(cwd, sessionDir?)` —— 继续最近会话或新建
- `SessionManager.inMemory(cwd?, options?, entries?)` —— 不落盘，可用条目初始化
- `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?, options?)` —— 从另一个项目分叉会话

### 静态列举方法
- `SessionManager.list(cwd, sessionDir?, onProgress?)` —— 列出某目录的会话
- `SessionManager.listAll(onProgress?)` —— 列出所有项目的会话
- `SessionManager.listAll(sessionDir?, onProgress?)` —— 从自定义会话根目录列举

### 实例方法 —— 会话管理
- `newSession(options?)` —— 开始新会话（选项：`{ id?: string, parentSession?: string }`）
- `setSessionFile(path)` —— 切换到另一个会话文件
- `createBranchedSession(leafId)` —— 把分支抽取为新会话文件

### 实例方法 —— 追加（均返回条目 ID）
- `appendMessage(message)` —— 添加消息
- `appendThinkingLevelChange(level)` —— 记录思考等级变更
- `appendModelChange(provider, modelId)` —— 记录模型变更
- `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?, usage?)` —— 添加压缩
- `appendCustomEntry(customType, data?)` —— 扩展状态（不入上下文）
- `appendSessionInfo(name)` —— 设置会话显示名
- `appendCustomMessageEntry(customType, content, display, details?)` —— 扩展消息（入上下文）
- `appendLabelChange(targetId, label)` —— 设置/清除标签

### 实例方法 —— 树导航
- `getLeafId()` —— 当前位置
- `getLeafEntry()` —— 当前叶子条目
- `getEntry(id)` —— 按 ID 取条目
- `getBranch(fromId?)` —— 从某条目走到根
- `getTree()` —— 完整树结构
- `getChildren(parentId)` —— 直接子节点
- `getLabel(id)` —— 条目的标签
- `branch(entryId)` —— 把叶子移到较早条目
- `resetLeaf()` —— 叶子重置为 null（所有条目之前）
- `branchWithSummary(entryId, summary, details?, fromHook?, usage?)` —— 带上下文摘要分支；`entryId` 可为 `null` 表示从根分叉

### 实例方法 —— 上下文与信息
- `buildContextEntries()` —— 应用压缩后的活动分支条目
- `buildSessionContext()` —— 给 LLM 的消息、思考等级与模型
- `getEntries()` —— 全部条目（不含头部）
- `getHeader()` —— 会话头元数据
- `getSessionName()` —— 最新 session_info 条目中的显示名
- `getCwd()` —— 工作目录
- `getSessionDir()` —— 会话存储目录
- `getSessionId()` —— 会话 UUID
- `getSessionFile()` —— 会话文件路径（内存会话为 undefined）
- `isPersisted()` —— 会话是否已保存到磁盘
