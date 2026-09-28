# 会话文件格式

会话以 JSONL（JSON Lines）文件形式存储。每一行是一个包含 `type` 字段的 JSON 对象。会话条目通过 `id`/`parentId` 字段形成树状结构，支持就地分支而无需创建新文件。

关于编程式创建、持久化及树形导航，请参阅 [`SessionManager` API](sdk.md#sessionmanager-api)。

## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl
```

默认情况下，`<session-id>` 是一个 UUID。调用者可以通过 SDK 或 `--session-id` 提供自定义 ID。对于 `<path>`，Pi 会移除前导路径分隔符，并将 `/`、`\\` 和 `:` 替换为 `-`。

## 删除会话

会话可通过删除 `~/.pi/agent/sessions/` 下对应的 `.jsonl` 文件来移除。

Pi 也支持在 `/resume` 中交互式删除会话（选择一个会话后按下 `Ctrl+D`，然后确认）。在可用时，Pi 会使用 `trash` 命令以避免永久删除。

## 会话版本

会话在头部包含一个版本字段：

- **版本 1**：线性条目序列（旧版，加载时自动迁移）
- **版本 2**：采用 `id`/`parentId` 链接的树状结构
- **版本 3**：将 `hookMessage` 角色重命名为 `custom`（扩展统一）

现有会话在加载时会自动迁移至当前版本（v3）。

## 源文件

GitHub 上的源代码（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话入口类型与 SessionManager
- [消息类型](/docs/message-types/) - 共享消息与内容块参考
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) - 基础消息与内容块类型
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) - 可扩展的 `AgentMessage` 联合类型

如需项目中的 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

## 消息

`message` 条目存储一个 [`AgentMessage`](/docs/message-types/)。消息内容块、角色、使用情况以及消息时间戳在 [消息类型](/docs/message-types/) 中定义。

会话条目的时间戳为 ISO 8601 字符串。嵌套的消息时间戳是以毫秒为单位的 Unix 时间戳。

## 条目基类

所有条目（除 `SessionHeader` 外）均继承自 `SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // 通常为 8 字符十六进制 ID；可能回退为完整 UUID
  parentId: string | null;  // 父条目 ID（根条目为 null）
  timestamp: string;    // ISO 时间戳
}
```

## 条目类型

### 会话头部

文件的第一行。仅包含元数据，不属于树结构的一部分（无 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于具有父会话的会话（通过 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### SessionMessageEntry

会话中的一条消息。`message` 字段包含一个 `AgentMessage`。系统消息携带提示词和工具配置：会话的首次请求会持久化一条包含每个提示词部分和工具声明的消息，后续更改则持久化为系统消息，按名称修补 `sections`（`null` 移除一个）并列出 `toolsAdded`/`toolsRemoved`。按顺序重放这些消息即可得到当前的提示词和工具；没有单独的提示词状态条目。

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"You are an expert coding assistant...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```

在系统消息出现之前创建的会话没有前置系统消息；首次请求会将当前提示词声明为后续的系统消息，其重放方式相同。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```

助手消息会指明生成它们的模型。较新的消息还会记录 `thinkingLevel`，即该响应所请求的 Pi 思考级别。

### ModelChangeEntry

当用户在会话中途切换模型时发出。最新条目为所选模型，可能是[虚拟模型](/docs/virtual-models/)；随后助手消息会指明实际应答的物理模型。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

### ThinkingLevelChangeEntry

当用户更改思考/推理级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### 使用条目

记录模型属性使用情况，这些情况不属于助手消息，也不参与 LLM 上下文。`kind` 是标识操作的任意字符串；例如，缓存预热使用 `"cache_warm"`。

```json
{"type":"usage","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:08:00.000Z","kind":"cache_warm","provider":"anthropic","model":"claude-sonnet-4-5","usage":{"input":0,"output":0,"cacheRead":50000,"cacheWrite":0,"totalTokens":50000,"cost":{"input":0,"output":0,"cacheRead":0.015,"cacheWrite":0,"total":0.015}}}
```

使用条目计入会话令牌和成本总计。Pi 将其从对话树中隐藏。消费者应将未知的 `kind` 值视为正常使用，而不是拒绝它们。

### CompactionEntry

当上下文被压缩时创建。存储早期消息的摘要以及完整的系统提示词/工具检查点。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId` 为必填项。它标识压缩条目之前保留的第一个条目。重建上下文时，Pi 会用压缩摘要替换较早的摘要条目，并保留从该条目开始的区间。不保留任何内容的压缩会在此字段中存储自身的 ID，因此不会保留任何前置条目。

可选字段：
- `systemMessage`：压缩边界处重放的提示词部分和工具声明；它成为压缩后上下文的引导系统消息，保留条目中的系统消息会被其取代。旧会话条目中不存在此字段。
- `usage`：生成摘要时的 LLM 使用量；计入会话令牌和成本总计
- `details`：实现特定的数据（例如，默认情况下为 `{ readFiles: string[], modifiedFiles: string[] }`，或扩展的自定义数据）
- `fromHook`：如果由扩展生成则为 `true`，如果由 pi 生成则为 `false`/`undefined`（旧字段名）

### ContextEditEntry（上下文编辑条目）

对早期某个产生上下文的条目的追加式编辑。它仅影响未来的模型上下文；目标条目及其元数据在原始历史、界面、导出及会话记录中保持不变。

```json
{"type":"context_edit","id":"g6h7i8j9","parentId":"f6g7h8i9","timestamp":"2024-12-03T14:11:00.000Z","targetId":"c3d4e5f6","replacement":null}
```

目标可以是用户、助手、工具结果或自定义消息条目。`replacement: null` 表示从模型上下文中省略该目标。非空的 `replacement` 仅替换目标消息内容。针对助手和工具结果条目的字符串替换会被规范化为一个文本块，因为这类角色要求内容为数组形式。若多个编辑指向同一条目，则活动分支上最新的编辑生效。编辑具有分支相对性：导航到编辑之前的节点会再次显示目标条目的原始内容。

### BranchSummaryEntry（分支摘要条目）

当通过 `/tree` 切换分支时创建，包含 LLM 生成的左侧分支直至共同祖先的摘要。捕获被放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

`parentId` 是新分支继续的条目。`fromId` 是先前叶子节点，其被放弃的路径已被摘要化。

可选字段：
- `usage`：生成摘要时的 LLM 使用情况；包含在会话令牌和成本总计中
- `details`：默认的文件跟踪数据（`{ readFiles: string[], modifiedFiles: string[] }`），或扩展的自定义数据
- `fromHook`：如果由扩展生成则为 `true`，如果由 pi 生成则为 `false`/`undefined`（旧字段名）

### 自定义条目

扩展状态持久化。不参与 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用 `customType` 在重载时识别你的扩展条目。交互模式可以通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍然不参与 LLM 上下文。

Pi 将[虚拟模型](/docs/virtual-models/)路由状态存储为自定义条目，其 `customType` 为 `pi.virtual-model-state`，`data` 为 `{ provider, modelId, state }`。

### CustomMessageEntry

扩展注入的消息，**会**参与 LLM 上下文。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与 UserMessage 相同）
- `display`：`true` = 在 TUI 中以独特样式显示，`false` = 隐藏
- `details`：可选的扩展特定元数据（不发送给 LLM）

### LabelEntry

用户在条目上自定义的书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设置为 `undefined` 以清除标签。

### SessionInfoEntry

会话元数据（例如，用户定义的显示名称）。通过`/name`、`--name`/`-n`或在扩展中使用`pi.setSessionName()`设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话名称会显示在会话选择器（`/resume`）中，而不是显示第一条消息。

## 树结构

条目通常形成一棵树，但导航 API 可以创建多个根：
- 根条目具有 `parentId: null`；第一个条目最初是根
- 每个非根条目通过 `parentId` 指向其父条目
- 分支从较早的条目创建新子项
- "叶节点"是树中的当前位置
- 调用 `resetLeaf()` 或 `branchWithSummary(null, ...)` 允许后来的条目成为另一个根

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← 当前叶节点
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← 替代分支
```

## 上下文构建

`buildContextEntries()` 从当前叶子节点向根节点遍历，生成活动条目列表，同时遵循压缩规则：

1. 收集路径上的所有条目
2. 若路径上存在一个或多个 `CompactionEntry`，则取最新的一条：
   - 首先包含该压缩条目
   - 包含从 `firstKeptEntryId` 起至压缩条目之前（不含压缩条目）的非系统条目
   - 包含压缩条目之后的条目
3. 保留选定范围内的非消息条目，以便交互模式能够渲染它们

随后，`buildSessionProjection()` 为每个选定的目标应用最新的 `context_edit`。它返回模型可见的消息及其对应的源条目。被省略的目标不产生任何消息；替换操作保留源条目的角色和元数据，仅更改内容。原始选定的条目不会被修改。

`buildSessionContext()` 在此基础上构建生成 LLM 所用的消息列表：

1. 从完整路径中提取当前的模型和思考级别设置
2. 将选定条目转换为消息：
   - `message` → 存储的 `AgentMessage`
   - `compaction` → 完整的系统检查点，后接 `compactionSummary`
   - `branch_summary` → `branchSummary`
   - `custom_message` → `CustomMessage`
   - `context_edit` → 不生成独立的上下文消息
   - `usage` 和 `custom` → 不生成上下文消息

压缩摘要会替换 `firstKeptEntryId` 之前的条目。压缩前的系统消息被整合到完整的检查点中，而非从保留范围内重放。保留的非系统条目以及压缩之后的所有条目对 LLM 仍然可用。

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
      console.log(`[${entry.id}] 压缩：${entry.tokensBefore} 个标记已汇总`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] 分支来自 ${entry.fromId}`);
      break;
    case "usage":
      console.log(`[${entry.id}] 用量（${entry.kind}）：${entry.usage.totalTokens} 个标记`);
      break;
    case "custom":
      console.log(`[${entry.id}] 自定义（${entry.customType}）：${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] 扩展消息（${entry.customType}）：${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] 标签“${entry.label}”位于 ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] 模型：${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] 思考：${entry.thinkingLevel}`);
      break;
  }
}
```
