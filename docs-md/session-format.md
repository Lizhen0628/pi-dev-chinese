# 会话文件格式

会话以JSONL（JSON Lines）文件形式存储。每一行都是一个带有`type`字段的JSON对象。会话条目通过`id`/`parentId`字段形成树形结构，支持原地分支而无需创建新文件。

对于编程式创建、持久化和导航，请参阅[`SessionManager` API](sdk.md#sessionmanager-api)。

## 文件位置

```
~/.pi/agent/sessions/--<路径>--/<时间戳>_<会话ID>.jsonl
```

默认情况下，`<会话ID>` 是一个 UUID。调用者可以通过 SDK 或 `--session-id` 提供自定义 ID。对于 `<路径>`，Pi 会移除路径开头的分隔符，并将 `/`、`\\` 和 `:` 替换为 `-`。

## 删除会话

可以通过删除 `~/.pi/agent/sessions/` 目录下对应的 `.jsonl` 文件来移除会话。

Pi 也支持在 `/resume` 中交互式删除会话（选择一个会话并按 `Ctrl+D`，然后确认）。当可用时，pi 会使用 `trash` 命令行工具以避免永久删除。

## 会话版本

会话在头部包含一个版本字段：

- **版本1**：线性条目序列（旧版，加载时自动迁移）
- **版本2**：具有 `id`/`parentId` 链接的树形结构
- **版本3**：将 `hookMessage` 角色重命名为 `custom`（扩展统一）

现有会话在加载时会自动迁移到当前版本（v3）。

## 源文件

GitHub 上的源代码（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话入口类型与 SessionManager
- [消息类型](/docs/message-types/) - 共享消息与内容块参考
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/types.ts) - 基础消息与内容块类型
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/types.ts) - 可扩展的 `AgentMessage` 联合类型

如需项目中的 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

## 消息

消息条目存储在[消息类型](/docs/message-types/)中。

消息条目按时间戳排序。时间戳为Unix毫秒时间戳。

## 条目基类

所有条目（除 `session` 外）都派生自 `EntryBase`：

```typescript
interface EntryBase {
  type: string;
  id: string;           // 通常为8个字符的十六进制ID；可能回退到完整UUID
  parentId: string | null;  // 父条目ID（根条目为null）
  timestamp: string;    // ISO时间戳
}
```

## 条目类型

### 会话头部

文件的第一行。仅包含元数据，不属于树的一部分（没有 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于有父级会话的会话（通过 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### 会话消息条目

对话中的一条消息。`message` 字段包含一个 `AgentMessage`。系统消息携带提示词和工具配置：会话的首次请求会持久化包含每个提示词部分和工具声明的系统消息，后续更改则作为系统消息持久化，通过名称修补 `sections`（`null` 移除一个），并列出 `toolsAdded`/`toolsRemoved`。按顺序重放它们即可得到当前的提示词和工具；没有单独的提示词状态条目。

```json
{"type":"message","id":"a0b1c2d3","parentId":null,"timestamp":"2024-12-03T14:00:00.000Z","message":{"role":"system","content":"","sections":{"preamble":"You are an expert coding assistant...","tools":"<tools>\n- read: ...\n</tools>","cwd":"/project"},"toolsAdded":[{"name":"read","description":"...","parameters":{}}],"timestamp":1733234400000}}
{"type":"message","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:04:00.000Z","message":{"role":"system","content":"","sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}],"timestamp":1733234640000}}
```

在系统消息存在之前创建的会话没有前导系统消息；首次请求将当前提示词声明为后续的系统消息，其重放方式相同。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello","timestamp":1733234401000}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"api":"anthropic-messages","provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop","timestamp":1733234402000}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false,"timestamp":1733234403000}}
```

### 模型切换条目

触发时机：当用户在会话中途切换模型时发出。

```json
{
  "type": "model_change",
  "id": "4d5f6g7h",
  "parentId": "3c4d5e6f",
  "timestamp": "2024-03-05T14:05:00.000Z",
  "provider": "openai",
  "modelId": "gpt-4o"
}
```

### ThinkingLevelChangeEntry

当用户更改思考/推理级别时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### 使用条目

记录模型属性使用情况，该使用情况既不是助手消息，也不参与 LLM 上下文。`kind` 是一个任意字符串，用于标识操作；例如，缓存预热使用 `"cache_warm"`。

```json
{"type":"usage","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:08:00.000Z","kind":"cache_warm","provider":"anthropic","model":"claude-sonnet-4-5","usage":{"input":0,"output":0,"cacheRead":50000,"cacheWrite":0,"totalTokens":50000,"cost":{"input":0,"output":0,"cacheRead":0.015,"cacheWrite":0,"total":0.015}}}
```

使用条目计入会话 token 和成本总额。Pi 将它们从对话树中隐藏。消费者应将未知 `kind` 值视为正常用法，而不是拒绝它们。

### CompactionEntry

当上下文被压缩时创建。存储早期消息的摘要以及完整的系统提示词/工具检查点。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000,"systemMessage":{"role":"system","content":"You are a coding assistant.","toolsAdded":[],"timestamp":1733235000000}}
```

`firstKeptEntryId` 为必填字段。它标识压缩条目之前保留的第一个条目。重建上下文时，Pi 会用压缩摘要替换较早的摘要条目，并保留从此条目开始的区间。不保留任何内容的压缩会在此字段中存储自身的 ID，因此不会保留任何前置条目。

可选字段：
- `systemMessage`：压缩边界处重放的提示词部分和工具声明；它成为压缩后上下文的首条系统消息，保留条目中的系统消息会被其取代。旧会话条目中不存在此字段。
- `usage`：生成摘要时的 LLM 用量；计入会话令牌和成本总计
- `details`：实现特定的数据（例如，默认情况下为 `{ readFiles: string[], modifiedFiles: string[] }`，或扩展的自定义数据）
- `fromHook`：如果由扩展生成则为 `true`，如果由 pi 生成则为 `false`/`undefined`（旧字段名）

### ContextEditEntry

对先前某个生成上下文的条目进行追加式编辑。它仅影响未来的模型上下文；目标条目及其元数据在原始历史记录、界面、导出和会话统计中保持不变。

```json
{"type":"context_edit","id":"g6h7i8j9","parentId":"f6g7h8i9","timestamp":"2024-12-03T14:11:00.000Z","targetId":"c3d4e5f6","replacement":null}
```

目标可以是用户、助手、工具结果或自定义消息条目。`replacement: null` 表示从模型上下文中省略该目标。非空的 `replacement` 仅替换目标消息内容。对于助手和工具结果条目，字符串替换会被规范化为一个文本块，因为这些角色要求内容为数组。如果多个编辑针对同一条目，则活动分支上的最新编辑生效。编辑是分支相对的：导航到编辑之前的某个点，会再次显示目标的原始贡献。

### 分支摘要条目

通过 `/tree` 切换分支时创建，包含 LLM 生成的左侧分支直至共同祖先的摘要。捕获被放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

`parentId` 是新分支继续的条目。`fromId` 是之前叶子节点，其放弃的路径被摘要化。

可选字段：
- `usage`：生成摘要的 LLM 使用情况；计入会话令牌和成本总计
- `details`：默认的文件跟踪数据（`{ readFiles: string[], modifiedFiles: string[] }`），或为扩展提供的自定义数据
- `fromHook`：如果由扩展生成则为 `true`，如果由 pi 生成则为 `false`/`undefined`（遗留字段名）

### CustomEntry

扩展状态持久化。不参与 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

使用 `customType` 来在重新加载时识别你的扩展条目。交互模式可以通过 `pi.registerEntryRenderer(customType, renderer)` 来渲染自定义条目，但它们仍然不参与 LLM 上下文。

### 自定义消息条目

扩展注入的消息，这些消息确实参与LLM上下文。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"注入的上下文...","display":true}
```

字段说明：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与用户消息相同）
- `display`：`true` = 在TUI中以明显样式显示，`false` = 隐藏
- `details`：可选的扩展特定元数据（不发送给LLM）

### LabelEntry

用户定义的条目书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设置为 `undefined` 可清除标签。

### SessionInfoEntry

会话元数据（例如，用户定义的显示名称）。可通过 `/name`、`--name` / `-n` 或扩展中的 `pi.setSessionName()` 设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话名称将显示在会话选择器（`/resume`）中，而不是显示第一条消息。

## 树结构

条目通常构成一个树，但导航 API 可以创建多个根：
- 根条目的 `parentId: null`；第一个条目最初是根
- 每个非根条目通过 `parentId` 指向其父条目
- 分支从较早的条目创建新的子条目
- “叶子”是树中的当前位置
- 调用 `resetLeaf()` 或 `branchWithSummary(null, ...)` 允许后来的条目成为另一个根

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← 当前叶子
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← 替代分支
```

## 上下文构建

`buildContextEntries()` 从当前叶子节点向上遍历至根节点，生成活动条目列表，同时遵循压缩规则：

1. 收集路径上的所有条目
2. 若路径上存在一个或多个 `CompactionEntry` 值，则采用最新的一个：
   - 首先包含压缩条目
   - 包含从 `firstKeptEntryId` 起直至（但不包括）压缩条目的非系统条目
   - 包含压缩条目之后的条目
3. 保留所选范围内的非消息条目，以便交互模式能够渲染它们

随后，`buildSessionProjection()` 对每个选定的目标应用最新的 `context_edit`。它返回模型可见的消息及其对应的源条目。被省略的目标不产生消息；替换操作保留源条目的角色和元数据，仅更改内容。原始选定的条目不会被修改。

`buildSessionContext()` 基于该投影构建发送给 LLM 的消息列表：

1. 从完整路径中提取当前模型和思考级别设置
2. 将选定的条目转换为消息：
   - `message` → 存储的 `AgentMessage`
   - `compaction` → 完整的系统检查点后跟 `compactionSummary`
   - `branch_summary` → `branchSummary`
   - `custom_message` → `CustomMessage`
   - `context_edit` → 不产生自身的上下文消息
   - `usage` 和 `custom` → 不产生上下文消息

压缩摘要替换 `firstKeptEntryId` 之前的条目。压缩前的系统消息被并入完整的检查点，而非从保留范围内重放。保留的非系统条目以及压缩之后的所有条目仍然可供 LLM 使用。

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
      console.log(`[${entry.id}] 从 ${entry.fromId} 分支`);
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
