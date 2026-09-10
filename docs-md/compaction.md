# 压缩与分支摘要

LLM 的上下文窗口有限。当对话过长时，Pi 会使用压缩来总结较旧的内容，同时保留最近的工作。本页面涵盖自动压缩和分支摘要。

**源文件** ([pi](https://github.com/earendil-works/pi)):
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

对于你项目中的 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

pi 拥有两种摘要机制：

| 机制 | 触发条件 | 目的 |
|-----------|---------|---------|
| 压缩 | 上下文超出阈值，或使用 `/compact` 命令 | 总结旧消息以释放上下文空间 |
| 分支摘要 | 通过 `/tree` 命令导航 | 在切换分支时保留上下文的连续性 |

两者均采用相同的结构化摘要格式，并持续跟踪文件操作记录。压缩与分支摘要请求均使用全新的会话 ID，在提供商支持的情况下，禁用提示词缓存写入，因为这些一次性提示不太可能被复用。

## 压缩</think>## 压缩

### 触发时机

自动压缩发生在 token 数量超过上下文窗口时，在回合结束之后、新提示开始之前。

默认情况下，Pi 在连续多轮会话中自动压缩，当：
- 当前会话中的总 token 数超过上下文窗口。
- 即将到来的响应的 token 数预计将超过上下文窗口。

上下文窗口和保留 token 在 Pi 设置中配置：

```
context_window > reserve_tokens
```

默认情况下，`reserve_tokens` 是 `16384` tokens。这为 LLM 的响应留出空间。

在多轮智能体运行期间，Pi 在工具完成且其结果被附加后，在开始下一个助手响应之前检查此阈值。如果超过阈值，Pi 会在同一个智能体运行内压缩，并以摘要和保留的消息继续。当完成的工具批次终止运行且没有排队消息需要另一个响应时，它会跳过此回合间检查。Pi 还会在新的用户提示之前和低级智能体运行结束之后检查阈值。

您还可以通过 `/compact [instructions]`手动触发，其中可选指令用于聚焦摘要。

### 工作原理

1. **找到切分点**：从最新消息向前回溯，累计 token 估算，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）
2. **提取消息**：收集从上一个保留边界（或会话开始）到切分点的消息
3. **生成摘要**：调用 LLM 以结构化格式总结，并在存在时传递上一个摘要作为迭代上下文
4. **追加条目**：保存带有摘要和 `firstKeptEntryId` 的 `CompactionEntry`
5. **重建上下文**：会话为下一个请求重建上下文，使用摘要及从 `firstKeptEntryId` 开始的消息

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

After compaction (new entry appended):

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

What the LLM sees:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

在重复压缩时，摘要跨度从前一次压缩的保留边界（`firstKeptEntryId`）开始，而不是从压缩条目本身开始；如果路径中找不到该保留条目，则回退到前一次压缩之后的条目。这将早期压缩中保留下来的消息也包含在下一次摘要过程中，从而保留这些消息。Pi 还会在写入新的 `CompactionEntry` 之前，从重建的会话上下文重新计算 `tokensBefore`，因此 token 数量反映的是被替换的实际压缩前上下文。

### 分割轮次

一个“轮次”从用户消息开始，包含所有助手响应和工具调用，直到下一条用户消息为止。通常，压缩在轮次边界处进行。

当单个轮次超过 `keepRecentTokens` 时，切断点会落在轮次中间的某条助手消息处。这就是“分割轮次”：

```
分割轮次（单个巨大轮次超出预算）：

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  （之前没有完整轮次）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割轮次，Pi 会生成两份摘要并将其合并：
1. **历史摘要**：先前上下文（如果有）
2. **轮次前缀摘要**：分割轮次的早期部分

### 截断点规则

有效的截断点包括：
- 用户消息
- 助手消息
- Bash执行消息
- 自定义消息（`custom_message`、`branch_summary`）

切勿在工具结果处截断（它们必须与其对应的工具调用保持在一起）。

### CompactionEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts):

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // 生成摘要所消耗的 LLM 用量
  fromHook?: boolean;  // 若由扩展提供，则为 true（旧字段名）
  details?: T;         // 实现相关的数据
}

// 默认压缩使用此结构作为 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可在 `details` 中存储任意可序列化为 JSON 的数据。默认压缩会跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的摘要和扩展提供的摘要会在可用时记录其 LLM `usage`，以便会话总账包含汇总工作的消耗。

实现细节请参阅 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。如需以编程方式直接生成摘要，`generateSummary()` 返回摘要文本，而 `generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支摘要

### 触发的时机

当您使用 `/tree` 命令切换到另一个分支时，Pi 会主动提供对您即将离开的工作内容的总结。这一操作会将左侧分支的上下文注入到新的分支中。

### 工作原理

1. **查找共同祖先**：旧位置与新位置共享的最深节点
2. **收集条目**：从旧叶节点回溯至共同祖先
3. **按预算准备**：按令牌预算包含消息（最新优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树形结构：

         ┌─ B ─ C ─ D (旧叶节点，即将弃用)
    A ───┤
         └─ E ─ F (目标)

共同祖先：A
需摘要的条目：B、C、D

带摘要导航后的结构：

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [B、C、D的摘要] (新叶节点)
```

### 累计文件追踪

压缩与分支摘要均以累计方式追踪文件。生成摘要时，pi 会从以下来源提取文件操作：
- 被摘要消息中的工具调用
- 之前的压缩或分支摘要 `details`（如有）

这意味着文件追踪会跨多次压缩或嵌套的分支摘要不断累积，完整保留读取和修改文件的历史记录。

### BranchSummaryEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // 我们导航来源的条目
  usage?: Usage;       // 生成摘要所用的 LLM 用量
  fromHook?: boolean;  // 如果由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定数据
}

// 默认分支摘要使用此结构作为 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩（compaction）一样，扩展可以在 `details` 中存储自定义数据。

实现可见于 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

压缩与分支摘要均采用相同的结构化格式：

```markdown
## 目标
[用户试图实现的内容]

## 约束与偏好
- [用户提出的要求]

## 进展
### 已完成
- [x] [已完成的任务]

### 进行中
- [ ] [当前工作]

### 受阻
- [问题，如有]

## 关键决策
- **[决策]**: [理由]

## 后续步骤
1. [接下来应该做什么]

## 关键上下文
- [继续所需的数据]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

在摘要之前，消息通过 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这可以防止模型将其视为需要继续的对话。

工具结果在序列化期间被截断为 2000 个字符。超过该限制的内容将被替换为一个标记，指示被截断了多少字符。这使摘要请求保持在合理的 token 预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的结果）通常是上下文大小的最大贡献者。

## 通过扩展自定义摘要

扩展可以拦截并自定义压缩和分支摘要功能。事件类型定义请参阅 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 需要摘要的消息
  // preparation.turnPrefixMessages - 回合前缀拆分（如果是拆分回合）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文令牌数
  // preparation.firstKeptEntryId - 保留消息的起点
  // preparation.settings - 应用模型覆盖后的有效设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "manual"（/compact）、"threshold"（阈值）或"overflow"（溢出）
  // willRetry - 被中止的回合是否在压缩后重试（溢出恢复）
  // signal - AbortSignal（传给 LLM 调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "您的摘要...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；计入会话统计
      details: { /* 自定义数据 */ },
    }
  };
});
```

#### 将消息转换为文本

要使用您自己的模型生成摘要，请通过 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // 将 AgentMessage[] 转换为 Message[]，然后序列化为文本
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // 返回：
  // [用户]: 消息文本
  // [助手思考]: 思考内容
  // [助手]: 响应文本
  // [助手工具调用]: read(path="..."); bash(command="...")
  // [工具结果]: 输出文本

  // 现在发送给您自己的模型进行摘要生成
  const { summary, usage } = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      usage,
    }
  };
});
```

参见 [自定义压缩示例](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts) 获取使用不同模型的完整示例。

### 压缩

```typescript
// 会话压缩事件
pi.on("session compaction", (event) => {
  // 压缩原因："手动"、"达到阈值"或"溢出"
  // 错误信息：仅当压缩未失败时显示
  // 是否已中止：对于取消/中止的压缩操作为真
  // 是否将重试：中止后是否会在压缩后重试
  // 是否来自扩展：是否使用了扩展提供的压缩内容
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择总结，都会触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 我们导航到的位置
  // preparation.oldLeafId - 当前位置（将被废弃）
  // preparation.commonAncestorId - 共同的祖先
  // preparation.entriesToSummarize - 将被总结的条目
  // preparation.userWantsSummary - 用户是否选择总结

  // 完全取消导航：
  return { cancel: true };

  // 提供自定义摘要（仅当 userWantsSummary 为 true 时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        // usage: summaryResponse.usage, // 可选；包含在会话总数中
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

请参阅类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## 设置

在 `~/.pi/settings.json` 或 `<project>/.pi/settings.json` 中配置：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应保留的标记 |
| `keepRecentTokens` | `20000` | 保留的最近标记（不进行摘要） |

使用 `"enabled": false` 禁用自动压缩。你仍然可以通过 `/compact` 手动压缩。

### 按模型压缩覆盖

设置文件允许按模型配置 `compaction.reserveTokens` 和 `compaction.keepRecentTokens` 的特定值，通过 `compaction.modelOverrides` 键配置：

```json
{
  "compaction": {
    "reserveTokens": 16384,
    "keepRecentTokens": 20000,
    "modelOverrides": {
      "some-provider/big-model": {
        "reserveTokens": 400000
      }
    }
  }
}
```

对于具有 1M 上下文窗口的模型，此覆盖会触发超过 600K tokens 的压缩，并保留普通的 20000 最近 tokens。其他模型保留普通的 16384-token 预留。`reserveTokens` 也影响摘要输出上限，受模型最大输出 tokens 限制；它不仅仅是触发阈值。

键是精确、区分大小写的 `provider/modelId` 值，包括模型 ID 内的所有斜线。每个 `reserveTokens` 和 `keepRecentTokens` 值独立地从模型覆盖回退到普通设置再到内置默认值。值必须是非负安全整数。匹配的模型覆盖中的无效值在读取时产生错误；只有省略的字段回退到普通设置。模型覆盖条目必须是对象。无效的普通 token 设置在读取时产生错误，即使活动模型具有有效的覆盖。只有省略的普通值使用内置默认值。`enabled` 保持全局性，不特定于模型。

这些解析后的值用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的 `preparation.settings`。模型切换会影响后续检查和压缩，而不会改变普通设置。已在进行的压缩使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖在全局和项目设置中均有效。文件在查找前递归合并，因此全局模型特定值胜过项目范围的回退；项目必须覆盖该模型条目才能更改它。有关详细信息，请参阅 [settings.md](settings.md#per-model-compaction-overrides)。
