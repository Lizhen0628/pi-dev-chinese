# 会话文件格式

会话以 JSONL（JSON 行）格式的文件存储。每行是一个包含 `type` 字段的 JSON 对象。会话条目通过 `id`/`parentId` 字段形成树状结构，从而无需创建新文件即可就地分支。

## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl
```

默认情况下，`<session-id>` 是一个 UUID。调用者可以通过 SDK 或 `--session-id` 提供自定义 ID。对于 `<path>`，Pi 会移除路径开头的分隔符，并将 `/`、`\\` 和 `:` 替换为 `-`。

## 删除会话

通过删除 `~/.pi/agent/sessions/` 目录下的 `.jsonl` 文件，即可移除会话。

Pi 还支持从 `/resume` 中交互式删除会话（选择会话后按 `Ctrl+D`，然后确认）。在可用的情况下，pi 会使用 `trash` 命令行工具来避免永久删除。

## 会话版本

会话在头部包含一个版本字段：

- **版本1**：线性条目序列（旧版，加载时自动迁移）
- **版本2**：具有 `id`/`parentId` 链接的树形结构
- **版本3**：将 `hookMessage` 角色重命名为 `custom`（扩展统一）

现有会话在加载时会自动迁移至当前版本（v3）。

## 源文件

GitHub 上的源代码（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话入口类型及 SessionManager
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型（BashExecutionMessage、CustomMessage 等）
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) - 基础消息类型（UserMessage、AssistantMessage、ToolResultMessage）
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) - AgentMessage 联合类型

如需项目中的 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

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
  mimeType: string;  // 例如 "image/jpeg"、"image/png"
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

### 基础消息类型（来自 pi-ai）

```typescript
interface SystemMessage {
  role: "system";
  content: string | TextContent[];
  toolsAdded?: Tool[];
  toolsRemoved?: Array<{ name: string }>;
  timestamp: number;  // Unix 毫秒
}

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
  details?: any;      // 工具特定的元数据
  usage?: Usage;      // 工具执行的嵌套 LLM 工作
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

`"pending"` 保留用于流式事件中的部分消息。在 Pi 持久化助手消息之前，终止事件会将其替换为完成原因，因此 `"pending"` 不应出现在会话 JSONL 中。`"deferred"` 是提供商响应的终止原因，表示该响应将在稍后完成；其 `deferred` 句柄包含检索该响应所需的提供商数据。

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
  excludeFromContext?: boolean;  // 对于以 !! 为前缀的命令为 true
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
  fromId: string | null;         // 被汇总的已放弃路径的前一个叶子节点
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
  id: string;           // 通常为 8 字符十六进制 ID；可能回退为完整 UUID
  parentId: string | null;  // 父条目 ID（根条目为 null）
  timestamp: string;    // ISO 时间戳
}
```

## 条目类型

### 会话头

文件的第一行。仅包含元数据，不属于树结构的一部分（没有 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于有父会话的会话（通过 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### 会话消息条目

对话中的一条消息。`message` 字段包含一个 `AgentMessage`。系统消息携带提示词和工具配置：会话的首次请求会持久化包含每个提示词部分和工具声明的消息，后续更改则作为系统消息持久化，通过名称修补 `sections`（`null` 表示移除一个），并列出 `toolsAdded`/`toolsRemoved`。按顺序重放这些消息即可得到当前的提示词和工具；没有单独的提示词状态条目。

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"You are an expert coding assistant...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```

在系统消息出现之前创建的会话没有前置系统消息；首次请求会将当前提示词声明为后续的系统消息，并以相同方式重放。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```

### ModelChangeEntry

当用户在会话中途切换模型时发出。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

### 思考级别变更条目

当用户更改思考/推理级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### 使用条目

记录模型属性使用情况，这些使用不属于助手消息，也不参与LLM上下文。`kind` 是一个任意字符串，用于标识操作；例如，缓存预热使用 `"cache_warm"`。

```json
{"type":"usage","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:08:00.000Z","kind":"cache_warm","provider":"anthropic","model":"claude-sonnet-4-5","usage":{"input":0,"output":0,"cacheRead":50000,"cacheWrite":0,"totalTokens":50000,"cost":{"input":0,"output":0,"cacheRead":0.015,"cacheWrite":0,"total":0.015}}}
```

使用条目计入会话令牌和成本总计。Pi 将其从对话树中隐藏。消费者应将未知的 `kind` 值视为正常使用，而不是拒绝它们。

### CompactionEntry

当上下文被压缩时创建。存储早期消息的摘要以及完整的系统提示词/工具检查点。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId` 为必填项。它标识压缩条目之前保留的第一个条目。重建上下文时，Pi 会用压缩摘要替换较早的已汇总条目，并保留从此条目开始的区间。不保留任何内容的压缩会将自己的 ID 存储在此字段中，因此不会保留任何前置条目。

可选字段：
- `systemMessage`：压缩边界处重放的提示词部分和工具声明；它成为压缩后上下文的起始系统消息，保留条目中的系统消息将被丢弃以支持它。旧会话条目中不存在此字段。
- `usage`：生成摘要时的 LLM 使用情况；计入会话令牌和成本总计
- `details`：实现特定的数据（例如，默认情况下为 `{ readFiles: string[], modifiedFiles: string[] }`，或扩展的自定义数据）
- `fromHook`：如果由扩展生成则为 `true`，如果由 pi 生成则为 `false`/`undefined`（旧字段名）

### ContextEditEntry

对早期生成上下文条目的追加式编辑。它仅改变未来的模型上下文；目标条目及其元数据在原始历史、界面、导出和会话记录中保持不变。

```json
{"type":"context_edit","id":"g6h7i8j9","parentId":"f6g7h8i9","timestamp":"2024-12-03T14:11:00.000Z","targetId":"c3d4e5f6","replacement":null}
```

目标可以是用户、助手、工具结果或自定义消息条目。`replacement: null` 表示从模型上下文中省略该目标。非空的 `replacement` 仅替换目标消息内容。对于助手和工具结果条目，字符串替换会被规范化为一个文本块，因为这些角色要求内容为数组。如果多个编辑指向同一条目，则活动分支上的最新编辑生效。编辑是分支相对的：导航到编辑之前的点会再次显示目标的原始贡献。

### BranchSummaryEntry

通过 `/tree` 切换分支时创建，包含 LLM 生成的左侧分支直至共同祖先的摘要。捕获已放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

`parentId` 是新分支继续的起始条目。`fromId` 是先前叶子节点，其放弃的路径被摘要化。

可选字段：
- `usage`：生成摘要时的 LLM 使用量；计入会话令牌和成本总计
- `details`：默认的文件跟踪数据（`{ readFiles: string[], modifiedFiles: string[] }`），或扩展的自定义数据
- `fromHook`：若由扩展生成则为 `true`，若由 pi 生成则为 `false`/`undefined`（旧字段名）

### CustomEntry

扩展状态持久化。不参与 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用 `customType` 在重新加载时识别扩展的条目。交互模式可以通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍然不参与 LLM 上下文。

### CustomMessageEntry

参与 LLM 上下文的扩展注入消息。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与 UserMessage 相同）
- `display`：`true` = 在 TUI 中以独特样式显示，`false` = 隐藏
- `details`：可选的扩展特定元数据（不发送到 LLM）

### 标签条目

条目上的用户自定义书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设为 `undefined` 以清除标签。

### 会话信息条目（SessionInfoEntry）

会话元数据（例如，用户定义的显示名称）。通过 `/name`、`--name` / `-n` 或扩展中的 `pi.setSessionName()` 设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话名称将显示在会话选择器（`/resume`）中，而不是第一条消息。

## 树结构

条目通常形成一棵树，但导航 API 可以创建多个根：
- 根条目的 `parentId` 为 `null`；第一个条目最初是根
- 每个非根条目通过 `parentId` 指向其父条目
- 分支从较早的条目创建新的子条目
- “叶子”是树中的当前位置
- 调用 `resetLeaf()` 或 `branchWithSummary(null, ...)` 允许后续条目成为另一个根

```
[用户消息] ─── [助手] ─── [用户消息] ─── [助手] ─┬─ [用户消息] ← 当前叶子
                                                            │
                                                            └─ [分支摘要] ─── [用户消息] ← 替代分支
```

## 上下文构建

`buildContextEntries()` 从当前叶子节点回溯至根节点，在遵循压缩策略的同时生成活动条目列表：

1. 收集路径上的所有条目
2. 若路径上存在一个或多个 `CompactionEntry`，则采用最新的一项：
   - 首先包含压缩条目
   - 包含从 `firstKeptEntryId` 开始、截至压缩条目之前（不含压缩条目）的非系统条目
   - 包含压缩条目之后的条目
3. 在选定范围内保留非消息条目，使交互模式能够呈现它们

随后，`buildSessionProjection()` 对每个选定目标应用最新的 `context_edit`。它返回模型可见的消息及其源条目。被省略的目标不产生消息；替换操作保留源条目的角色和元数据，仅更改内容。原始选定的条目不会被修改。

`buildSessionContext()` 基于该投影为LLM构建消息列表：

1. 从完整路径中提取当前模型和思考级别设置
2. 将选定的条目转换为消息：
   - `message` -> 存储的 `AgentMessage`
   - `compaction` -> 完整的系统检查点后接 `compactionSummary`
   - `branch_summary` -> `branchSummary`
   - `custom_message` -> `CustomMessage`
   - `context_edit` -> 不产生自身的上下文消息
   - `usage` 和 `custom` -> 不产生上下文消息

压缩摘要取代 `firstKeptEntryId` 之前的条目。压缩前的系统消息被合并到完整的检查点中，而不是从保留范围内重放。保留的非系统条目以及压缩之后的所有条目仍可供LLM使用。

## 解析示例

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`会话 v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] 压缩: ${entry.tokensBefore} 个令牌已汇总`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] 分支自 ${entry.fromId}`);
      break;
    case "usage":
      console.log(`[${entry.id}] 用量 (${entry.kind}): ${entry.usage.totalTokens} 个令牌`);
      break;
    case "custom":
      console.log(`[${entry.id}] 自定义 (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] 扩展消息 (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] 标签 "${entry.label}" 位于 ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] 模型: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] 思考: ${entry.thinkingLevel}`);
      break;
  }
}
```

## 会话管理器 API

以编程方式处理会话的关键方法。

### 静态创建方法
- `SessionManager.create(cwd, sessionDir?, options?)` - 新建会话；`options` 可设置 `id` 和 `parentSession`
- `SessionManager.open(path, sessionDir?, cwdOverride?)` - 打开现有会话文件
- `SessionManager.continueRecent(cwd, sessionDir?)` - 继续最近的会话或新建会话
- `SessionManager.inMemory(cwd?, options?, entries?)` - 无文件持久化，可选地从条目初始化
- `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?, options?)` - 从另一个项目派生会话

### 静态列出现在方法
- `SessionManager.list(cwd, sessionDir?, onProgress?)` - 列出某个目录的会话
- `SessionManager.listAll(onProgress?)` - 列出所有项目中的所有会话
- `SessionManager.listAll(sessionDir?, onProgress?)` - 从自定义会话根目录列出会话

### 实例方法 - 会话管理
- `newSession(options?)` - 启动新会话（选项：`{ id?: string, parentSession?: string }`）
- `setSessionFile(path)` - 切换到不同的会话文件
- `createBranchedSession(leafId)` - 将会话分支提取到新会话文件中

### 实例方法 - 追加（均返回条目 ID）
- `appendMessage(message)` - 添加消息
- `appendThinkingLevelChange(level)` - 记录思考级别变化
- `appendModelChange(provider, modelId)` - 记录模型变化
- `appendUsage(kind, provider, model, usage)` - 记录会话外归因于模型的用量
- `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?, usage?)` - 添加压缩
- `appendCustomEntry(customType, data?)` - 扩展状态（不在上下文中）
- `appendSessionInfo(name)` - 设置会话显示名称
- `appendCustomMessageEntry(customType, content, display, details?)` - 扩展消息（在上下文中）
- `appendLabelChange(targetId, label)` - 设置/清除标签

### 实例方法 - 树导航
- `getLeafId()` - 当前位置
- `getLeafEntry()` - 获取当前叶子条目
- `getEntry(id)` - 按 ID 获取条目
- `getBranch(fromId?)` - 从条目向上遍历至根
- `getTree()` - 获取完整树结构
- `getChildren(parentId)` - 获取直接子节点
- `getLabel(id)` - 获取条目的标签
- `branch(entryId)` - 移动叶子到更早的条目
- `resetLeaf()` - 将叶子重置为 null（在任何条目之前）
- `branchWithSummary(entryId, summary, details?, fromHook?, usage?)` - 带上下文摘要分支；`entryId` 可为 `null` 以从根节点分支

### 实例方法 - 上下文与信息
- `buildContextEntries()` - 获取应用了压缩的活动分支条目
- `buildSessionContext()` - 获取消息、思考级别和模型以供LLM使用
- `getEntries()` - 所有条目（不包括头部）
- `getHeader()` - 会话头部元数据
- `getSessionName()` - 从最新的会话信息条目中获取显示名称
- `getCwd()` - 工作目录
- `getSessionDir()` - 会话存储目录
- `getSessionId()` - 会话UUID
- `getSessionFile()` - 会话文件路径（内存中为未定义）
- `isPersisted()` - 会话是否已保存到磁盘
