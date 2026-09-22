# 压缩参考

本参考文档描述自动压缩、分支摘要、持久化条目以及扩展钩子。有关用户操作流程，请参阅[会话与上下文](sessions.md#manage-conversation-context)。

**源文件**（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

如需获取项目中的 TypeScript 定义，请查阅 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 有两种摘要机制：

| 机制 | 触发条件 | 目的 |
|-----------|---------|---------|
| 压缩 | 上下文超过阈值，或 `/compact` | 总结旧消息以释放上下文 |
| 分支摘要 | `/tree` 导航 | 切换分支时保留上下文 |

这两种机制使用密切相关的结构化格式，并累积地跟踪文件操作。摘要请求会禁用 prompt-cache 写入，因为这些一次性提示词不太可能被重用。

## 压缩

### 触发时机

自动压缩在以下条件满足时触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 个令牌（可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置）。这为 LLM 的响应预留了空间。

在多轮代理运行期间，Pi 会在工具完成且其结果追加后、开始下一个助手响应之前，检查规范化的投影上下文。如果超过阈值，Pi 会在 `prepareNextTurn` 期间进行压缩，然后在 `turn_start` 之前执行现有的追赶式引导轮询。当完成的工具批次终止运行且没有排队的消息需要另一个响应时，它会跳过此轮间检查。Pi 还会在新的用户提示之前进行检查，并在低级运行结束后执行最终尝试的溢出恢复。

提供商上下文溢出错误或早期最终 `stopReason: "length"` 可能触发一次压缩并重试的恢复尝试。带有工具调用的长度响应会保留其合成的失败工具结果，并遵循普通的工具/队列调度器，而不是强制结束运行。

您也可以使用 `/compact [指令]` 手动触发，其中可选指令用于聚焦摘要内容。

### 工作原理

1. **寻找截断点**：在最终会话投影中向后遍历，累计令牌估算，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置）
2. **提取消息**：收集从上一个保留边界（或会话开始）到截断点的投影消息
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

在重复压缩时，摘要范围从上次压缩的保留边界（`firstKeptEntryId`）开始，而非从压缩条目本身开始；若在路径中找不到该保留条目，则回退到上次压缩之后的条目。保留无内容的压缩会将其自身 ID 记录为 `firstKeptEntryId`；重复压缩从该条目之后开始。这样，通过将先前压缩中幸存的消息纳入下一次摘要过程，得以保留这些消息。Pi 还会在写入新的 `CompactionEntry` 之前，根据重建的、经上下文编辑的会话投影重新计算 `tokensBefore`，从而确保令牌计数反映实际被替换的压缩前上下文。被省略的原始条目仍会存储，但不影响截断选择、摘要、检查点或令牌估算。

### 溢出与长度恢复顺序

恢复保留了现有的生命周期与队列顺序。已完成的尝试对 `turn_end` 和 `agent_end` 仍然可见；运行后恢复会在全新重试之前修复持久化的模型上下文：

```text
持久化最终助手响应
→ 扩展/公共 turn_end
→ 扩展/公共 agent_end
→ 为选定的尝试追加 context_edit 遗漏项
→ 若溢出/长度问题：运行 session_before_compact 并在成功时追加压缩内容
→ 以全新运行开始重试
```

若恢复压缩失败或取消，Pi 会保留遗漏编辑项，不追加压缩内容，也不安排内部重试。现有的排队工作仍由常规的引导与追问规则控制。`agent_before_settle` 在恢复处理之后查看修复后的投影。原始转录历史、导出、计费总计和历史搜索扩展仍可检查被遗漏的尝试。

### 分割用户消息跨度

用户消息跨度以一条用户消息开始，并包含直到下一条用户消息之前的所有轮次。通常，压缩会在用户消息边界处进行切割。

当某个用户消息跨度超过 `keepRecentTokens` 时，切割点会落在该跨度内的一条助手消息处。这就是分割的用户消息跨度：

```
分割用户消息跨度（一个跨度超出预算）：

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
  messagesToSummarize = []  （没有更早的用户消息跨度）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

对于分割的用户消息跨度，Pi 会生成两份摘要并合并它们：
1. **历史摘要**：之前的上下文（如果有）
2. **用户消息跨度前缀摘要**：分割的用户消息跨度的早期部分

### 切割点规则

有效的切割点包括：
- 用户消息
- 助手消息
- Bash执行消息
- 自定义消息（custom_message、branch_summary）

切勿在工具结果处切割（它们必须与对应的工具调用保持在一起）。

准备阶段仅在保留边界推进到上下文不可见后缀时，才允许该后缀包含被省略的助手尝试且没有未省略的上下文生成条目。恢复过程中的`context_edit`省略满足此规则；本质上上下文不可见的元数据可以与之共存。仅元数据或新附加的自定义消息不会移动切割点。影响候选输入或摘要前缀的替换编辑也会阻止推进，因为被省略的助手响应的是编辑前的输入；对最终被省略的后缀条目的替换保持安全。这允许超预算的恢复输入被摘要化，同时保留使放弃尝试保持省略的编辑，而无需更改是否逐字保留新模型输入的簿记。

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
  usage?: Usage;       // 生成摘要所用的 LLM 用量
  fromHook?: boolean;  // 如果由扩展提供则为 true（旧字段名称）
  details?: T;         // 实现特定的数据
}

// 默认压缩使用此结构作为 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可在 `details` 中存储任何 JSON 可序列化的数据。默认压缩会跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的摘要和扩展提供的摘要在可用时会存储其 LLM `usage`，以便会话总量包含摘要生成工作。

参见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 了解实现。对于直接编程式摘要生成，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支摘要

### 触发时机

当你使用 `/tree` 导航到另一个分支时，Pi 会主动总结你正在离开的工作。这会将左侧分支的上下文注入到新分支中。

### 工作原理

1. **寻找共同祖先**：旧位置与新位置共享的最深节点
2. **收集条目**：从旧叶子节点回溯至共同祖先
3. **按预算准备**：包含至令牌预算上限的消息（最新优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树结构：

         ┌─ B ─ C ─ D (旧叶子节点，将被放弃)
    A ───┤
         └─ E ─ F (目标)

共同祖先：A
需摘要的条目：B, C, D

带摘要导航后的树结构：

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [B, C, D 的摘要] (新叶子节点)
```

### 累积文件追踪

默认压缩与分支摘要会累积追踪文件。两者均从被摘要的消息中的工具调用提取文件操作。压缩还会继承先前由 Pi 生成的压缩中的文件列表。分支摘要则在其所摘要的条目中，继承 Pi 生成的分支摘要中的文件列表。

因此，文件追踪会在默认压缩及嵌套的默认分支摘要中累积。Pi 不会自动继承由扩展生成的摘要中的文件列表，这些摘要的 `fromHook` 字段为 `true`；扩展需自行管理其 `details` 格式。

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

实现参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

两种格式均包含目标、约束与偏好、进度、关键决策和后续步骤。压缩摘要还包含关键上下文。分支摘要到后续步骤为止。Pi 在相关时会将文件列表附加到任一格式。

压缩摘要使用以下格式：

```markdown
## 目标
[用户试图完成的事项]

## 约束与偏好
- [用户提出的要求]

## 进度
### 已完成
- [x] [已完成的任务]

### 进行中
- [ ] [当前工作]

### 受阻
- [问题（如有）]

## 关键决策
- **[决策]**: [理由]

## 后续步骤
1. [接下来应发生的事项]

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

这可以防止模型将其视为要继续的对话。

工具结果在序列化期间会被截断为 2000 个字符。超出该限制的内容会被替换为一个标记，指示被截断了多少字符。这使摘要请求保持在合理的 token 预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的）通常是上下文大小的最大贡献者。

## 通过扩展实现自定义摘要

扩展可以拦截并自定义压缩和分支摘要。事件类型定义请参阅 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 要摘要的消息
  // preparation.turnPrefixMessages - 用户消息跨度前缀（如果是 isSplitTurn）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文令牌数
  // preparation.firstKeptEntryId - 保留消息的起始位置
  // preparation.settings - 应用模型覆盖后的有效设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "manual" (/compact)、"threshold" 或 "overflow"
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
  // aborted - 对于已取消/中止的压缩为 true
  // willRetry - 中止的轮次是否会在压缩后重试
  // fromExtension - 是否正在使用扩展提供的压缩内容
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择总结，都会触发。可以取消导航或提供自定义总结。

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

参见类型文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

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

通过 `"enabled": false` 禁用自动压缩。您仍可使用 `/compact` 命令手动压缩。

### 按模型覆盖

使用`compaction.modelOverrides`为不同模型调整令牌预算：

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

对于具有1M上下文窗口的模型，此覆盖设置会在令牌数超过600K时触发压缩，并保留常规的20000个近期令牌。其他模型则保留常规的16384令牌预留。`reserveTokens`还影响摘要输出的上限，受限于模型的最大输出令牌数；它不仅仅是一个触发阈值。

键名是精确、区分大小写的`provider/modelId`值，包括模型ID内的任何斜杠。每个`reserveTokens`和`keepRecentTokens`值独立地从模型覆盖回退到常规设置，再到内置默认值。值必须为非负安全整数。匹配的模型覆盖中无效值在读取时会产生错误；只有省略的字段才会回退到常规设置。模型覆盖条目必须是对象。无效的常规令牌设置在读取时会产生错误，即使当前模型有有效的覆盖。只有省略的常规值才会使用内置默认值。`enabled`保持全局性，不区分模型。

这些解析后的值用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的`preparation.settings`。模型切换会影响后续的检查和压缩，而不会更改常规设置。已在进行中的压缩使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖同时适用于全局和项目设置。文件在查找前会递归合并，因此全局模型特定值优先于项目范围的回退；项目必须覆盖该模型条目才能更改它。详见[设置](settings.md#per-model-compaction-overrides)。
