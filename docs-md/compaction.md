# 压缩参考

本参考描述了自动压缩、分支摘要、持久化条目以及扩展钩子。有关用户工作流程，请参阅[会话与上下文](sessions.md#manage-conversation-context)。

**源文件** ([pi](https://github.com/earendil-works/pi)):
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

如需项目中的 TypeScript 定义，请检查 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概述

Pi 有两种摘要机制：

| 机制 | 触发 | 目的 |
|-----------|---------|---------|
| 压缩 | 上下文超出阈值，或 `/compact` | 总结旧消息以释放上下文 |
| 分支摘要 | `/tree` 导航 | 切换分支时保留上下文 |

两者使用紧密相关的结构化格式，并累积跟踪文件操作。摘要请求会禁用提示词缓存写入，因为这些一次性提示词不太可能被重复使用。

## 压缩</think>## 会话压缩

### 触发时机

自动压缩在以下条件满足时触发：

```
contextTokens > contextWindow - reserveTokens
```

默认情况下，`reserveTokens` 为 16384 个令牌（可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置）。这为 LLM 的响应预留了空间。

在多轮智能体运行过程中，Pi 会在工具执行完毕且其结果追加之后、开始下一个助手响应之前，检查规范化预测上下文。若超过阈值，Pi 会在 `prepareNextTurn` 阶段进行压缩，并在 `turn_start` 之前执行既有的追赶式引导轮询。当完成的工具批次终止运行且没有排队消息需要另一次响应时，Pi 会跳过此次回合间检查。Pi 还会在收到新用户提示前进行检查，并在底层运行结束后尝试最终溢出恢复。

提供商上下文溢出错误或提前出现的最终 `stopReason: "length"` 可触发一次压缩并重试的恢复尝试。带有工具调用的长度响应会保留其合成的失败工具结果，并遵循常规工具/队列调度器，而非强制结束运行。

你也可以通过 `/compact [指令]` 手动触发压缩，可选的指令用于聚焦摘要内容。

### 工作原理

1. **寻找截断点**：从最终会话投影中向后遍历，累计令牌估算，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置）
2. **提取消息**：收集从上一个保留边界（或会话开始）到截断点之间的投影消息
3. **生成摘要**：调用 LLM 以结构化格式进行总结，若存在之前的摘要，则将其作为迭代上下文传入
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

在重复压缩时，摘要跨度从上次压缩的保留边界（`firstKeptEntryId`）开始，而非从压缩条目本身开始；若在路径中找不到该保留条目，则回退到上次压缩之后的条目。保留无内容的压缩会将其自身 ID 记录为 `firstKeptEntryId`；重复压缩从该条目之后开始。这样，在后续的摘要过程中，之前压缩中幸存的早期消息也会被纳入，从而得以保留。Pi 还会在写入新的 `CompactionEntry` 之前，根据重建且经过上下文编辑的会话投影重新计算 `tokensBefore`，确保令牌计数反映实际被替换的压缩前上下文。被省略的原始条目仍会存储，但不会影响截断选择、摘要、检查点或令牌估算。

### 溢出与长度恢复的顺序

恢复过程保持既有的生命周期与队列顺序。已完成的尝试在`turn_end`与`agent_end`事件中仍可见；运行后的恢复操作会在重新尝试前，先修复持久化的模型上下文：

```text
持久化最终的助手响应
→ 扩展/公共 turn_end
→ 扩展/公共 agent_end
→ 为所选尝试追加 context_edit 遗漏项
→ 若溢出/超长：运行 session_before_compact，并在成功后追加压缩
→ 以全新运行开始重试
```

若恢复性压缩失败或被取消，Pi会保留遗漏编辑，不追加压缩，也不调度内部重试。已有的排队工作仍遵循常规引导与追问规则。`agent_before_settle` 在恢复处理后能够看到修复后的投影。原始转录历史、导出文件、计费总计及历史搜索扩展仍可检查被遗漏的尝试。

### 分割用户消息跨度

用户消息跨度以用户消息开始，并包含直到下一条用户消息的所有轮次。通常，压缩会在用户消息边界处进行切割。

当一个用户消息跨度超过 `keepRecentTokens` 时，切割点会落在该跨度内的某条助手消息处。这就是分割的用户消息跨度：

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

仅当后缀包含被省略的助手尝试且没有未省略的上下文生成条目时，准备阶段才会将保留边界推进到上下文不可见的后缀中。恢复的 `context_edit` 省略满足此规则；本质上上下文不可见的元数据可与它们共存。仅元数据和新附加的自定义消息不会移动切割点。影响候选输入或摘要前缀的替换编辑也会阻止推进，因为被省略的助手回答了编辑前的输入；对最终被省略的后缀条目的替换保持安全。这允许将超出预算的恢复输入进行摘要，同时保留使放弃尝试保持省略的编辑，而无需更改是否逐字保留新模型输入的簿记。

### 压缩条目结构

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
  usage?: Usage;       // 生成摘要的 LLM 使用情况
  fromHook?: boolean;  // 如果由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定数据
}

// 默认压缩使用此内容作为 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以将任何 JSON 可序列化数据存储在 `details` 中。默认压缩跟踪文件操作，但自定义扩展实现可以使用自己的结构。生成的和扩展提供的摘要会在可用时存储其 LLM 使用情况，以便会话总计包括摘要工作。

参见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 了解实现。对于直接编程式摘要，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

# pi 项目中文文档

## 项目简介

pi 是一个开源项目，遵循 MIT 协议。本文档为官方英文文档的中文翻译。

## 核心概念

- **外壳（Harness）**：pi 的运行外壳，负责管理会话和工具调用。
- **扩展（Extension）**：可通过扩展机制为 pi 增加自定义功能。
- **技能（Skill）**：一组预定义的指令或流程，供模型调用。
- **提示词模板（Prompt Template）**：定义模型输入的结构化模板。
- **主题（Theme）**：控制外壳的视觉样式。
- **软件包（Package）**：以软件包形式分发扩展或技能。
- **会话（Session）**：一次交互的上下文状态。
- **压缩（Compaction）**：在会话过长时，对历史进行摘要压缩。
- **引导（Steering）**：通过提示或参数引导模型的输出方向。
- **追问（Follow-up）**：在模型响应后继续提问。
- **提供商（Provider）**：提供模型服务的后端（如 OpenAI、Anthropic）。
- **模型（Model）**：被调用的语言模型。
- **工具（Tool）**：模型可调用的外部函数或接口。
- **命令（Command）**：在 pi 外壳中执行的指令。

## 安装

请参考官方文档中的安装说明。安装完成后，可通过 `pi` 命令启动外壳。

## 使用

### 启动外壳

```bash
pi
```

### 选择模型

使用 `/model` 命令或在启动时指定模型。

### 快捷键

- `Ctrl+L`：清屏。

## 配置

配置文件位于用户目录下，可通过 `pi config` 命令查看或修改。

## 常见问题

更多信息请参阅项目仓库的 README 文档。

它内是,不要跨出当前小，不要跨出别的它本身的范围，别的代码文件自身。扩展为内部;不要动其它。

当, 未声明内声明自己的变量和原始标记，从内部自身 内部声明自身的，内部自身；不要跨，不要外-1-23; 不跨行; 不跨代码; 不跨字符串; 不跨注释.

### 工作原理

1. **查找共同祖先**：新旧位置共享的最深节点
2. **收集条目**：从旧叶节点回溯到共同祖先
3. **按预算准备**：包含达到令牌预算的消息（最新优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
Tree before navigation:

         ┌─ B ─ C ─ D (old leaf, being abandoned)
    A ───┤
         └─ E ─ F (target)

Common ancestor: A
Entries to summarize: B, C, D

After navigation with summary:

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [summary of B,C,D] (new leaf)
```

### 累积文件追踪

默认压缩与分支摘要均以累积方式追踪文件。两者均从被摘要消息中的工具调用提取文件操作。压缩还会沿用先前由 Pi 生成的压缩中的文件列表。分支摘要则在其所摘要的条目中，沿用 Pi 生成的分支摘要中的文件列表。

因此，文件追踪会跨默认压缩及嵌套的默认分支摘要进行累积。Pi 不会自动沿用扩展生成的摘要中的文件列表，这些摘要的 `fromHook` 字段为 `true`；扩展自行管理其 `details` 格式。

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
  usage?: Usage;       // 生成摘要所消耗的 LLM 用量
  fromHook?: boolean;  // 若由扩展提供则为 true（旧字段名）
  details?: T;         // 实现特定的数据
}

// 默认分支摘要使用此结构作为 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩类似，扩展可以在 `details` 中存储自定义数据。

实现细节参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

两种格式均包含目标、约束与偏好、进展、关键决策和后续步骤。压缩摘要还包含关键上下文。分支摘要到后续步骤为止。Pi 在相关时会将文件列表附加到任一格式中。

压缩摘要使用以下格式：

```markdown
## 目标
[用户试图完成的事项]

## 约束与偏好
- [用户提到的要求]

## 进展
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

在压缩之前，消息通过 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

这可以防止模型将其视为要继续的对话。

思考块被省略。提供商返回真实推理的摘要，而重放的思考通常不在模型的实时上下文中，因此包含它可能会使压缩请求比其压缩的上下文更大。

在序列化过程中，工具结果被截断为 2000 个字符。超出该限制的内容将被替换为一个标记，指示被截断了多少字符。这使压缩请求保持在合理的 token 预算内，因为工具结果（尤其是来自 `read` 和 `bash` 的）通常是上下文大小的最大贡献者。

## 通过扩展自定义摘要

扩展可以拦截并自定义压缩和分支摘要。参见 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) 获取事件类型定义。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消或提供自定义摘要。参见类型文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 要总结的消息
  // preparation.turnPrefixMessages - 用户消息跨度前缀（如果是分割回合）
  // preparation.previousSummary - 之前的压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩之前的上下文令牌
  // preparation.firstKeptEntryId - 保留消息开始的位置
  // preparation.settings - 应用模型覆盖后的有效设置

  // branchEntries - 当前分支上的所有条目（用于自定义状态）
  // reason - "手动"（/compact）、"阈值"或"溢出"
  // willRetry - 压缩后是否重试被中止的回合（溢出恢复）
  // signal - 中止信号（传递给LLM调用）

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
  // [User]: 消息文本
  // [Assistant]: 响应文本
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: 输出文本

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
  // errorMessage - 非中止失败时存在
  // aborted - 对于已取消/中止的压缩为 true
  // willRetry - 被中止的轮次是否会在压缩后重试
  // fromExtension - 是否正在使用扩展提供的压缩内容
});
```

### session_before_tree

在 `/tree` 导航之前触发。无论用户是否选择总结，此事件始终触发。可以取消导航或提供自定义总结。

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

| 设置项 | 默认值 | 描述 |
|---------|---------|-------------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 响应预留的令牌数 |
| `keepRecentTokens` | `20000` | 保留的最近令牌数（不进行摘要） |

使用 `"enabled": false` 可禁用自动压缩。你仍可通过 `/compact` 手动压缩。

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

对于具有 1M 上下文窗口的模型，此覆盖会在超过 600K 令牌时触发压缩，并保留通常的 20000 个最近令牌。其他模型保留通常的 16384 令牌储备。`reserveTokens` 也影响摘要输出限制，受模型最大输出令牌数限制；它不仅仅是触发阈值。

键是精确、区分大小写的 `provider/modelId` 值，包括模型 ID 中的任何斜杠。每个 `reserveTokens` 和 `keepRecentTokens` 值独立地从模型覆盖回退到普通设置，再到内置默认值。值必须是非负安全整数。匹配的模型覆盖中的无效值在读取时会产生错误；只有省略的字段回退到普通设置。模型覆盖条目必须是对象。无效的普通令牌设置在读取时会产生错误，即使活动模型具有有效的覆盖。只有省略的普通值使用内置默认值。`enabled` 保持全局性，不针对特定模型。

这些解析后的值用于手动压缩、所有自动阈值检查、溢出恢复以及扩展可见的 `preparation.settings`。模型切换会影响后续检查和压缩，而不会改变普通设置。已在进行中的压缩使用该操作捕获的模型和设置。分支摘要设置不受影响。

覆盖在全局和项目设置中均有效。文件在查找前递归合并，因此全局模型特定值胜过项目级回退；项目必须覆盖该模型条目才能更改它。有关详细信息，请参阅 [设置](settings.md#per-model-compaction-overrides)。
