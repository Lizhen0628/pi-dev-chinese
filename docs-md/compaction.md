# 压缩与分支摘要

大语言模型的上下文窗口有限。当对话过长时，Pi 会使用压缩来总结较早的内容，同时保留最近的工作。本页涵盖自动压缩和分支摘要。

**源文件** ([pi](https://github.com/earendil-works/pi))：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

如需项目中的 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 有两种总结机制：

| 机制 | 触发条件 | 目的 |
|------|----------|------|
| 压缩 | 上下文超过阈值，或 `/compact` | 总结旧消息以释放上下文 |
| 分支总结 | `/tree` 导航 | 切换分支时保留上下文 |

两者使用相同的结构化总结格式，并累积跟踪文件操作。压缩和分支总结请求使用全新的路由会话ID，并且在提供商支持的情况下，禁用提示词缓存写入，因为这些一次性的提示词不太可能被重用。

## 压缩

### 触发时机

自动压缩在以下条件满足时触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 个令牌（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这为 LLM 的响应预留了空间。

在多轮代理运行期间，Pi 会在工具完成且其结果追加后、开始下一个助手响应之前，检查规范的投影上下文。如果超过阈值，Pi 会在 `prepareNextTurn` 期间进行压缩，然后在 `turn_start` 之前执行现有的追赶式引导轮询。当完成的工具批次终止运行且没有排队的消息需要另一个响应时，它会跳过此轮间检查。Pi 还会在新的用户提示之前进行检查，并在底层运行结束后执行最终尝试的溢出恢复。

提供商上下文溢出错误或提前出现的最终 `stopReason: "length"` 可以选择一次压缩并重试的恢复尝试。带有工具调用的长度响应会保留其合成的失败工具结果，并遵循普通的工具/队列调度器，而不是强制结束运行。

您也可以使用 `/compact [instructions]` 手动触发，其中可选指令用于聚焦摘要内容。

### 工作原理

1. **寻找切割点**：从最终会话投影中向前遍历，累加令牌估算值，直至达到`keepRecentTokens`（默认20k，可在`~/.pi/agent/settings.json`或`<项目目录>/.pi/settings.json`中配置）
2. **提取消息**：从上一次保留的边界（或会话开始处）到切割点，收集投射出的消息
3. **生成摘要**：调用LLM，以结构化格式生成摘要；若存在先前的摘要，则将其作为迭代上下文传入
4. **追加条目**：保存包含摘要及`firstKeptEntryId`的`CompactionEntry`
5. **重建上下文**：会话为下一次请求重建上下文，使用摘要及从`firstKeptEntryId`之后的消息

```
压缩前：

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               待摘要消息                          保留消息
                                   ↑
                          firstKeptEntryId（条目4）

压缩后（追加新条目）：

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 不发送给LLM                          发送给LLM
                                                         ↑
                                              从firstKeptEntryId起

LLM所见的上下文：

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    提示词    来自cmp            从firstKeptEntryId起的消息
```

在重复压缩时，摘要的跨度从前一次压缩的保留边界（`firstKeptEntryId`）处开始，而非从压缩条目本身开始；若该保留边界在路径中无法找到，则回退到前一次压缩之后的那个条目。保留为零的压缩会将自己的ID记录为`firstKeptEntryId`；重复压缩从该条目之后开始。这样，之前压缩中幸存下来的消息，在下一轮摘要中也会被包含，得以保留。Pi还会在写入新的`CompactionEntry`之前，根据重建的、经上下文编辑的会话投影重新计算`tokensBefore`，从而确保令牌计数反映实际被替换的压缩前上下文。被省略的原始条目仍会存储，但不影响切割点的选择、摘要生成、检查点或令牌估算。

### 溢出与长度恢复顺序

恢复过程保留现有的生命周期和队列顺序。已完成的尝试对 `turn_end` 和 `agent_end` 保持可见；运行后恢复会在新重试前修复持久化的模型上下文：

```text
持久化最终助手响应
→ 扩展/公开 turn_end
→ 扩展/公开 agent_end
→ 为所选尝试追加 context_edit 遗漏项
→ 对于溢出/长度问题：运行 session_before_compact 并在成功时追加压缩
→ 将重试作为新运行启动
```

如果恢复压缩失败或被取消，Pi 会保留遗漏编辑，不追加压缩，也不安排内部重试。现有排队工作仍受常规引导和追问规则约束。`agent_before_settle` 在恢复处理后看到修复后的投影。原始转录历史、导出、计费总额和历史搜索扩展仍可检查被遗漏的尝试。

### 分割回合

“回合”始于用户消息，包含所有助手响应和工具调用，直至下一条用户消息。通常，压缩在回合边界处进行。

当单个回合超过 `keepRecentTokens` 时，切割点会落在回合中间的助手消息处。这就是“分割回合”：

```
分割回合（单个巨大回合超出预算）：

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
  messagesToSummarize = []  （之前没有完整回合）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割回合，Pi 生成两份摘要并合并它们：
1. **历史摘要**：之前的上下文（如果有）
2. **回合前缀摘要**：分割回合的早期部分

### 切割点规则

有效的切割点包括：
- 用户消息
- 助手消息
- Bash执行消息
- 自定义消息（custom_message、branch_summary）

切勿在工具结果处切割（它们必须与对应的工具调用保持在一起）。

仅当保留的后缀包含被省略的助手尝试且没有未省略的上下文生成条目时，准备阶段才会将保留的边界推进到上下文不可见的后缀中。恢复的 `context_edit` 省略满足此规则；本质上上下文不可见的元数据可以与之共存。仅元数据和新追加的自定义消息不会移动切割点。影响候选输入或摘要前缀的替换编辑也会阻止推进，因为被省略的助手回答了编辑前的输入；对最终被省略的后缀条目的替换保持安全。这允许超预算的恢复输入被摘要化，同时保留使放弃尝试保持省略的编辑，而无需更改新模型输入是否逐字保留的簿记。

### CompactionEntry 结构

定义在 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) 中：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // 生成摘要所用的 LLM 用量
  fromHook?: boolean;  // 如果由扩展提供，则为 true（旧字段名）
  details?: T;         // 实现特定数据
}

// 默认压缩使用此结构作为细节（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 中存储任何可 JSON 序列化的数据。默认压缩会跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的摘要和扩展提供的摘要，在可用时存储其 LLM `usage`，以便会话总量包含摘要工作。

实现请参见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。对于直接编程式摘要，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支摘要

### 触发时机

当您使用 `/tree` 切换到不同分支时，Pi 会提议总结您即将离开的工作。这会将左侧分支的上下文注入到新分支中。

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

带摘要导航后的结构：

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [B, C, D 的摘要] (新叶子节点)
```

### 累积文件追踪

压缩和分支摘要均累积追踪文件。生成摘要时，pi 从以下来源提取文件操作：
- 被摘要消息中的工具调用
- 之前的压缩或分支摘要 `details`（如有）

这意味着文件追踪会在多次压缩或嵌套分支摘要中累积，保留读取和修改文件的完整历史。

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
  usage?: Usage;       // 生成摘要所使用的 LLM 用量
  fromHook?: boolean;  // 如果由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定的数据
}

// 默认分支摘要使用此结构作为 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩相同，扩展可以在 `details` 中存储自定义数据。

实现细节请参阅 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

压缩和分支摘要均采用相同的结构化格式：

```markdown
## 目标
[用户试图达成的目的]

## 约束与偏好
- [用户提出的要求]

## 进度
### 已完成
- [x] [已完成任务]

### 进行中
- [ ] [当前工作]

### 受阻
- [存在的问题（如有）]

## 关键决策
- **[决策事项]**：[决策理由]

## 后续步骤
1. [下一步应进行的操作]

## 关键上下文
- [继续工作所需的数据]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### 消息序列化

在摘要生成之前，消息通过 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[用户]: 他们所说的内容
[助手思考]: 内部推理
[助手]: 回复文本
[助手工具调用]: read(path="foo.ts"); edit(path="bar.ts", ...)
[工具结果]: 工具输出
```

这可以防止模型将其视为需要继续的对话。

序列化过程中，工具结果会被截断至2000个字符。超出该限制的内容将被替换为一个标记，指示被截断的字符数量。这确保了摘要请求保持在合理的令牌预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的）通常是上下文大小的最大贡献者。

## 通过扩展自定义摘要

扩展可以拦截并自定义压缩和分支摘要。事件类型定义请参阅 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 要摘要的消息
  // preparation.turnPrefixMessages - 分割回合前缀（如果 isSplitTurn）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文令牌数
  // preparation.firstKeptEntryId - 保留消息的起始位置
  // preparation.settings - 应用模型覆盖后的有效设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "manual"（/compact）、"threshold" 或 "overflow"
  // willRetry - 压缩后是否重试被中止的回合（溢出恢复）
  // signal - AbortSignal（传递给 LLM 调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "您的摘要...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；包含在会话总计中
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
  // [用户]: 消息文本
  // [助手思考]: 思考内容
  // [助手]: 响应文本
  // [助手工具调用]: read(path="..."); bash(command="...")
  // [工具结果]: 输出文本

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

有关使用不同模型的完整示例，请参阅 [custom-compaction.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts)。

### session_compact_failed

当手动或自动压缩失败或被中止时触发。这对于需要将 `session_before_compact` 尝试与最终结果配对的遥测扩展非常有用。

```typescript
pi.on("session_compact_failed", async (event, ctx) => {
  const { reason, errorMessage, aborted, willRetry, fromExtension } = event;
  // reason - "manual" (/compact)、"threshold" 或 "overflow"
  // errorMessage - 对于非中止失败存在
  // aborted - 对于取消/中止的压缩为 true
  // willRetry - 中止的回合是否会在压缩后重试
  // fromExtension - 是否使用了扩展提供的压缩内容
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择总结，该事件始终触发。可以取消导航或提供自定义总结。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 导航目标位置
  // preparation.oldLeafId - 当前位置（将被放弃）
  // preparation.commonAncestorId - 共同祖先
  // preparation.entriesToSummarize - 将被总结的条目
  // preparation.userWantsSummary - 用户是否选择总结

  // 完全取消导航：
  return { cancel: true };

  // 提供自定义总结（仅在 userWantsSummary 为 true 时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "您的总结...",
        // usage: summaryResponse.usage, // 可选；包含在会话总计中
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

请参阅类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## 设置

在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置压缩：

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
| `reserveTokens` | `16384` | 为 LLM 响应预留的令牌数 |
| `keepRecentTokens` | `20000` | 保留的最近令牌数（不进行摘要） |

通过 `"enabled": false` 禁用自动压缩。您仍可使用 `/compact` 手动压缩。

### 按模型覆盖

使用 `compaction.modelOverrides` 为不同模型调整 token 预算：

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

对于一个具有 1M 上下文窗口的模型，此覆盖会在超过 600K tokens 时触发压缩，并保留通常的 20000 个最近 tokens。其他模型保留通常的 16384-token 预留。`reserveTokens` 也影响摘要输出限制，受模型最大输出 tokens 限制；它不仅仅是触发阈值。

键是精确的、区分大小写的 `provider/modelId` 值，包括模型 ID 内的任何斜杠。每个 `reserveTokens` 和 `keepRecentTokens` 值独立地从模型覆盖回退到普通设置，再回退到内置默认值。值必须是非负安全整数。匹配的模型覆盖中的无效值在读取时产生错误；只有省略的字段才回退到普通设置。模型覆盖条目必须是对象。无效的普通 token 设置即使在活动模型具有有效覆盖时也会在读取时产生错误。只有省略的普通值使用内置默认值。`enabled` 保持全局性，而非模型特定。

这些解析后的值用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的 `preparation.settings`。模型切换影响后续检查和压缩，而不改变普通设置。已经进行中的压缩使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖在全局和项目设置中均有效。文件在查找前递归合并，因此全局的模型特定值胜过项目范围的回退；项目必须覆盖该模型条目才能更改它。详见 [settings.md](settings.md#per-model-compaction-overrides)。
