# 压缩参考

本参考描述了自动压缩、分支摘要、持久化条目以及扩展钩子。关于用户工作流程，请参阅[会话与上下文](sessions.md#manage-conversation-context)。

**源文件**（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

关于项目中的 TypeScript 定义，请检查 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 有两种摘要机制：

| 机制 | 触发条件 | 目的 |
|------|----------|------|
| 压缩 | 上下文超过阈值，或 `/compact` | 总结旧消息以释放上下文空间 |
| 分支摘要 | `/tree` 导航 | 切换分支时保留上下文 |

两者都使用紧密相关的结构化格式，并累计跟踪文件操作。摘要请求禁用提示词缓存写入，因为这些一次性提示词不大可能被复用。

## 压缩

### 触发时机

自动压缩在以下条件满足时触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 个令牌（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。它仅决定压缩何时开始。摘要请求使用模型的输出限制，并在需要时减少，以确保输入和输出能适配上下文窗口。

在多轮代理运行期间，Pi 会在工具执行完毕且其结果被追加后、开始下一条助手响应之前，检查规范化的预计上下文。若超过阈值，Pi 会在 `prepareNextTurn` 阶段进行压缩，然后在 `turn_start` 之前执行现有的追赶式引导轮询。当完成的工具批次终止运行且没有排队消息需要进一步响应时，它会跳过此轮间检查。Pi 还会在新用户提示之前进行检查，并在底层运行结束后执行最终尝试的溢出恢复。

提供商上下文溢出错误或提前出现的最终 `stopReason: "length"` 可能触发一次压缩并重试的恢复尝试。带有工具调用的长度响应会保留其合成的失败工具结果，并遵循常规的工具/队列调度器，而非强制结束运行。

你也可以通过 `/compact [instructions]` 手动触发，其中可选指令用于聚焦摘要内容。

### 工作原理

1. **寻找截断点**：从最终会话投影中向后遍历，累计令牌估算，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置）
2. **提取消息**：从上一个保留边界（或会话开始）收集投影消息，直到截断点
3. **生成摘要**：调用 LLM 以结构化格式进行总结，若存在先前摘要，则将其作为迭代上下文传入
4. **追加条目**：保存包含摘要和 `firstKeptEntryId` 的 `CompactionEntry`
5. **重建上下文**：会话为下一个请求重建上下文，使用摘要及从 `firstKeptEntryId` 开始的消息

```
压缩前：

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

压缩后（追加新条目）：

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

LLM 所见：

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

在重复压缩时，摘要范围从上次压缩的保留边界（`firstKeptEntryId`）开始，而非从压缩条目本身开始；若该保留条目在路径中找不到，则回退到上次压缩之后的条目。保留无内容的压缩会将其自身 ID 记录为 `firstKeptEntryId`；重复压缩从该条目之后开始。这样，通过将先前压缩中幸存的消息纳入下一次摘要过程，得以保留这些消息。Pi 还会在写入新的 `CompactionEntry` 之前，根据重建的、经过上下文编辑的会话投影重新计算 `tokensBefore`，从而确保令牌计数反映实际被替换的压缩前上下文。被省略的原始条目仍会存储，但不会影响截断选择、摘要、检查点或令牌估算。

### 溢出与长度恢复顺序

恢复过程保留现有生命周期和队列顺序。已完成的尝试仍然对 `turn_end` 和 `agent_end` 可见；运行后恢复会在新的重试之前修复持久化的模型上下文：

```text
persist final assistant response
→ extension/public turn_end
→ extension/public agent_end
→ append context_edit omissions for the selected attempt
→ for overflow/length: run session_before_compact and append compaction on success
→ start the retry as a fresh run
```

如果恢复压缩失败或取消，Pi 会保留遗漏编辑，不附加压缩，也不安排内部重试。现有排队工作仍受普通引导和追问规则支配。`agent_before_settle` 在恢复处理后看到修复后的投影。原始转录历史、导出、计费总数和历史搜索扩展仍可检查被遗漏的尝试。

### 分割用户消息跨度

用户消息跨度始于一条用户消息，并包含直到下一条用户消息为止的所有轮次。通常，压缩会在用户消息边界处进行切割。

当某个用户消息跨度超过 `keepRecentTokens` 时，切割点会落在该跨度内的某条助手消息处。这就是分割的用户消息跨度：

```
分割的用户消息跨度（一个跨度超出预算）：

  入口：  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  （没有更早的用户消息跨度）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割的用户消息跨度，Pi 会生成两份摘要并合并它们：
1. **历史摘要**：之前的上下文（如果有）
2. **用户消息跨度前缀摘要**：分割的用户消息跨度的早期部分

### 切点规则

有效的切点为：
- 用户消息
- 助手消息
- Bash 执行消息
- 自定义消息（custom_message、branch_summary）

绝不能在工具结果处切割（它们必须与工具调用保持在一起）。

准备阶段仅在保留边界推进到上下文不可见后缀时，且该后缀包含一个被省略的助手尝试且没有未被省略的上下文产生条目时，才允许推进。恢复`context_edit`省略满足此规则；本质上上下文不可见的元数据可与它们共存。仅元数据和新增的自定义消息不会移动切点。影响候选输入或摘要前缀的替换编辑也会阻止推进，因为被省略的助手回答了编辑前的输入；最终被省略的后缀条目的替换仍然安全。这允许将超预算恢复的输入进行摘要，同时保留使被放弃尝试保持省略的编辑，而不改变关于新模型输入是否逐字保留的记账处理。

### CompactionEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // 生成摘要所消耗的 LLM 用量
  fromHook?: boolean;  // 若由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定的数据
}

// 默认压缩使用此结构作为 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 中存储任何可 JSON 序列化的数据。默认压缩会跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的摘要和扩展提供的摘要会在可用时存储其 LLM `usage`，以便会话总计包含摘要工作。

实现细节参见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。对于直接编程式摘要，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支摘要

### 触发时机

当您使用 `/tree` 导航至其他分支时，Pi 会主动总结您即将离开的工作内容。此操作会将原分支的上下文注入至新分支之中。

### 工作原理

1. **寻找共同祖先**：旧位置与新位置共享的最深节点
2. **收集条目**：从旧叶子节点回溯至共同祖先
3. **按预算准备**：包含至令牌预算上限的消息（最新优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树结构：

         ┌─ B ─ C ─ D (旧叶子节点，即将被弃用)
    A ───┤
         └─ E ─ F (目标)

共同祖先：A
需要摘要的条目：B, C, D

带摘要导航后的树结构：

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [B,C,D 的摘要] (新叶子节点)
```

### 累积文件追踪

默认压缩与分支摘要均以累积方式追踪文件。两者均从被摘要消息中的工具调用提取文件操作。压缩还会继承先前由 Pi 生成的压缩中的文件列表。分支摘要则在其所摘要的条目中，继承 Pi 生成的分支摘要中的文件列表。

因此，文件追踪会在默认压缩及嵌套的默认分支摘要中不断累积。Pi 不会自动继承由扩展生成的摘要中的文件列表，这些摘要的 `fromHook` 字段为 `true`；扩展需自行管理其 `details` 格式。

### BranchSummaryEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  fromId: string;      // 我们导航自的条目
  usage?: Usage;       // 生成摘要所使用的 LLM 用量
  fromHook?: boolean;  // 若由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定的数据
}

// 默认分支摘要使用此结构作为 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可以在 `details` 中存储自定义数据。

实现细节参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

这两种格式均包含目标、约束与偏好、进度、关键决策和后续步骤。压缩摘要还包含关键上下文。分支摘要到后续步骤为止。当相关时，pi 会向任一格式附加文件列表。

压缩摘要使用以下格式：

```markdown
## 目标
[用户试图完成的目标]

## 约束与偏好
- [用户提到的要求]

## 进度
### 已完成
- [x] [已完成任务]

### 进行中
- [ ] [当前工作]

### 受阻
- [问题（如有）]

## 关键决策
- **[决策]**: [理由]

## 后续步骤
1. [下一步应进行的操作]

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

在总结之前，消息会通过 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: 他们所说的内容
[Assistant]: 响应文本
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: 工具输出结果
```

这可以防止模型将其视为需要继续的对话。

思考块会被省略。提供商返回的是真实推理的摘要，而重放的思考通常不属于模型的实时上下文，因此将其包含在内可能会使总结请求比它所总结的上下文更大。

序列化过程中，工具结果会被截断至 2000 个字符。超出该限制的内容会被替换为一个标记，指示被截断的字符数量。这使总结请求保持在合理的 token 预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的结果）通常是上下文大小中占比最大的部分。

## 通过扩展实现自定义摘要

扩展可以拦截并自定义压缩和分支摘要。事件类型定义请参阅 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 要总结的消息
  // preparation.turnPrefixMessages - 用户消息跨度前缀（如果是拆分回合）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文令牌数
  // preparation.firstKeptEntryId - 保留消息的起始位置
  // preparation.settings - 应用模型覆盖后的有效设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "manual" (/compact)、"threshold" 或 "overflow"
  // willRetry - 压缩后是否重试被中断的回合（溢出恢复）
  // signal - AbortSignal（传递给LLM调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；包含在会话总和中
      details: { /* 自定义数据 */ },
    }
  };
});
```

#### 将消息转换为文本

要使用您自己的模型生成摘要，请使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // 将 AgentMessage[] 转换为 Message[]，然后序列化为文本
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // 返回：
  // [用户]：消息文本
  // [助手]：响应文本
  // [助手工具调用]：read(path="..."); bash(command="...")
  // [工具结果]：输出文本

  // 现在发送给您的模型进行摘要
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

参见 [custom-compaction.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts) 获取使用不同模型的完整示例。

### session_compact_failed

当手动或自动压缩失败或被中止时触发。这对于需要将 `session_before_compact` 尝试与最终结果配对的遥测扩展非常有用。

```typescript
pi.on("session_compact_failed", async (event, ctx) => {
  const { reason, errorMessage, aborted, willRetry, fromExtension } = event;
  // reason - "manual" (/compact)、"threshold" 或 "overflow"
  // errorMessage - 对于非中止失败存在
  // aborted - 对于已取消/中止的压缩为 true
  // willRetry - 被中止的回合是否会在压缩后重试
  // fromExtension - 是否正在使用扩展提供的压缩内容
});
```

### 会话树前处理

在 `/tree` 导航之前触发。无论用户是否选择概括总结，该事件总会触发。可以取消导航或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 导航目标位置
  // preparation.oldLeafId - 当前位置（即将被放弃）
  // preparation.commonAncestorId - 共同的祖先节点
  // preparation.entriesToSummarize - 将被概括的条目
  // preparation.userWantsSummary - 用户是否选择了概括总结

  // 完全取消导航：
  return { cancel: true };

  // 提供自定义摘要（仅在用户选择概括总结时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "您的摘要...",
        // usage: summaryResponse.usage, // 可选；计入会话总用量
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

更多信息请参阅类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## 设置

在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认值 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 低于此上下文令牌数时启动自动压缩 |
| `keepRecentTokens` | `20000` | 保留的最近令牌数（不进行摘要） |

使用 `"enabled": false` 禁用自动压缩。你仍然可以使用 `/compact` 手动压缩。

### 按模型覆盖

使用 `compaction.modelOverrides` 为不同模型调整令牌预算：

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

对于拥有 100 万上下文窗口的模型，此覆盖将在超过 60 万令牌时触发压缩，并保留常规的 20000 个最近令牌。其他模型则保留常规的 16384 令牌储备。

键是精确的、区分大小写的 `provider/modelId` 值，包括模型 ID 中的任何斜杠。每个 `reserveTokens` 和 `keepRecentTokens` 值都会独立地从模型覆盖回退到常规设置，再回退到内置默认值。值必须是非负安全整数。匹配的模型覆盖中无效值在读取时会产生错误；只有省略的字段才会回退到常规设置。模型覆盖条目必须是对象。无效的常规令牌设置在读取时会产生错误，即使当前模型有有效的覆盖。只有省略的常规值才会使用内置默认值。`enabled` 保持全局性，而非特定于模型。

这些解析后的值用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的 `preparation.settings`。模型切换会影响后续的检查和压缩，而不会改变常规设置。已在进行中的压缩使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖在全局和项目设置中均有效。文件在查找前会递归合并，因此全局模型特定值优先于项目范围内的回退；项目必须覆盖该模型条目才能更改它。详情请参阅 [设置](settings.md#per-model-compaction-overrides)。
