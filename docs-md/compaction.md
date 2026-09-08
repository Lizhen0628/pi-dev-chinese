# 压缩与分支摘要

LLM 的上下文窗口有限。对话过长时，Pi 用压缩（compaction）把较早内容摘要化，同时保留最近的工作。本页同时介绍自动压缩与分支摘要。

**源码位置**（[pi](https://github.com/earendil-works/pi)）：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) —— 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) —— 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) —— 共享工具（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts) —— 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts) —— 扩展事件类型

需要项目内的 TypeScript 定义时，查看 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## 概览

Pi 有两种摘要机制：

| 机制 | 触发条件 | 目的 |
|------|----------|------|
| 压缩 | 上下文超过阈值，或 `/compact` | 摘要旧消息以释放上下文 |
| 分支摘要 | `/tree` 导航 | 切换分支时保留上下文 |

两者使用同一结构化摘要格式，并对文件操作做累计跟踪。压缩与分支摘要请求使用全新的路由会话 ID，并且在提供商支持时禁用提示词缓存写入——这类一次性提示词不太可能被复用。

## 压缩

### 触发时机

满足以下条件时触发自动压缩：

```
contextTokens > contextWindow - reserveTokens
```

默认 `reserveTokens` 为 16384 token（可在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 配置），为 LLM 回复留出空间。

在多回合智能体运行中，Pi 在工具执行完毕、结果追加之后、下一轮助手响应开始之前检查阈值。越阈时，Pi 在同一智能体运行内压缩，然后带着摘要和保留消息继续。当完成的工具批次会终止本次运行且没有排队消息需要响应时，会跳过回合间检查。Pi 也会在新的用户提示词之前和低层智能体运行结束后检查阈值。

也可以手动触发：`/compact [指令]`，可选指令用于聚焦摘要。

### 工作流程

1. **找切点**：从最新消息向前累计 token 估算，直到达到 `keepRecentTokens`（默认 20k，可配置）
2. **提取消息**：收集上一个保留边界（或会话开头）到切点之间的消息
3. **生成摘要**：调用 LLM 以结构化格式摘要；存在上一次摘要时作为迭代上下文传入
4. **追加条目**：保存带摘要和 `firstKeptEntryId` 的 `CompactionEntry`
5. **重建上下文**：会话用"摘要 + 从 `firstKeptEntryId` 起的消息"重建下一次请求的上下文

```
压缩前：

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               待摘要消息                      保留消息
                                   ↑
                          firstKeptEntryId（条目 4）

压缩后（新条目已追加）：

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 不发给 LLM                     发给 LLM
                                                         ↑
                                              从 firstKeptEntryId 开始

LLM 看到的：

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    提示词   来自 cmp          firstKeptEntryId 起的消息
```

反复压缩时，摘要范围从上一次压缩的保留边界（`firstKeptEntryId`）开始，而不是从压缩条目本身开始；在路径中找不到该保留条目时，回退到上一次压缩条目之后的那一条。这样，上一次压缩中幸存的消息也会进入下一次摘要，避免丢失。Pi 还会在写入新的 `CompactionEntry` 前根据重建后的会话上下文重新计算 `tokensBefore`，让 token 数反映被替换的真实压缩前上下文。

### 拆分回合

一个"回合"从用户消息开始，到下一条用户消息之前的所有助手响应和工具调用为止。通常压缩在回合边界切割。

当单个回合超过 `keepRecentTokens` 时，切点落在回合中段的助手消息上，即"拆分回合"：

```
拆分回合（一个超大回合超出预算）：

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── 保留 (7-8)

  isSplitTurn = true
  messagesToSummarize = []  （之前没有完整回合）
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

拆分回合会生成两份摘要并合并：
1. **历史摘要**：之前的上下文（如有）
2. **回合前缀摘要**：拆分回合的前段

### 切点规则

合法切点为：
- 用户消息
- 助手消息
- BashExecution 消息
- 自定义消息（custom_message、branch_summary）

绝不在工具结果处切割（工具结果必须与其工具调用留在一起）。

### CompactionEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // 生成摘要的 LLM 用量
  fromHook?: boolean;  // true 表示由扩展提供（旧字段名）
  details?: T;         // 实现相关的数据
}

// 默认压缩的 details（来自 compaction.ts）：
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

扩展可以在 `details` 里存任何可 JSON 序列化的数据。默认压缩跟踪文件操作，自定义扩展实现可用自己的结构。生成式与扩展提供的摘要都会在有 `usage` 时记录 LLM 用量，计入会话总量。

实现见 [`prepareCompaction()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。直接以编程方式摘要时，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## 分支摘要

### 触发时机

用 `/tree` 切换到另一条分支时，Pi 会提议为你正在离开的工作生成摘要，把旧分支的上下文注入新分支。

### 工作流程

1. **找公共祖先**：新旧位置共享的最深节点
2. **收集条目**：从旧叶子回溯到公共祖先
3. **按预算准备**：在 token 预算内包含消息（新的优先）
4. **生成摘要**：以结构化格式调用 LLM
5. **追加条目**：在导航点保存 `BranchSummaryEntry`

```
导航前的树：

         ┌─ B ─ C ─ D （旧叶子，即将离开）
    A ───┤
         └─ E ─ F （目标）

公共祖先：A
待摘要条目：B、C、D

带摘要导航后：

         ┌─ B ─ C ─ D
    A ───┤
         └─ E ─ F ─ [B,C,D 的摘要] （新叶子）
```

### 累计文件跟踪

压缩与分支摘要都对文件做累计跟踪。生成摘要时，Pi 从以下位置提取文件操作：
- 被摘要消息中的工具调用
- 之前的压缩或分支摘要 `details`（如有）

因此文件跟踪会跨多次压缩或嵌套分支摘要累积，完整保留读取与修改过的文件历史。

### BranchSummaryEntry 结构

定义于 [`session-manager.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // 导航起点的条目
  usage?: Usage;       // 生成摘要的 LLM 用量
  fromHook?: boolean;  // true 表示由扩展提供（旧字段名）
  details?: T;         // 实现相关的数据
}

// 默认分支摘要的 details（来自 branch-summarization.ts）：
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

与压缩一样，扩展可在 `details` 存自定义数据。

实现见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 与 [`generateBranchSummary()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## 摘要格式

压缩与分支摘要使用同一结构化格式：

```markdown
## Goal
[用户要完成什么]

## Constraints & Preferences
- [用户提出的要求]

## Progress
### Done
- [x] [已完成任务]

### In Progress
- [ ] [当前工作]

### Blocked
- [问题（如有）]

## Key Decisions
- **[决定]**: [理由]

## Next Steps
1. [接下来做什么]

## Critical Context
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

摘要前，消息经 [`serializeConversation()`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 转为文本：

```
[User]: 用户说的话
[Assistant thinking]: 内部推理
[Assistant]: 回复文本
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: 工具输出
```

这防止模型把它当成一段要继续的对话。

序列化时工具结果截断到 2000 字符，超出部分替换为标注截断字数的标记。工具结果（尤其来自 `read` 和 `bash`）通常是上下文体积的主要来源，这样能把摘要请求控制在合理的 token 预算内。

## 通过扩展自定义摘要

扩展可以拦截并自定义压缩与分支摘要。事件类型定义见 [`extensions/types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

在自动压缩或 `/compact` 之前触发。可以取消，或提供自定义摘要。见类型文件中的 `SessionBeforeCompactEvent` 与 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - 待摘要消息
  // preparation.turnPrefixMessages - 拆分回合前缀（isSplitTurn 时）
  // preparation.previousSummary - 上一次压缩摘要
  // preparation.fileOps - 提取的文件操作
  // preparation.tokensBefore - 压缩前的上下文 token 数
  // preparation.firstKeptEntryId - 保留消息的起点
  // preparation.settings - 压缩设置

  // branchEntries - 当前分支上的全部条目（供自定义状态用）
  // reason - "manual"（/compact）、"threshold" 或 "overflow"
  // willRetry - 压缩后被中止的回合是否重试（溢出恢复）
  // signal - AbortSignal（传给 LLM 调用）

  // 取消：
  return { cancel: true };

  // 自定义摘要：
  return {
    compaction: {
      summary: "你的摘要……",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // 可选；计入会话总量
      details: { /* 自定义数据 */ },
    }
  };
});
```

#### 把消息转成文本

想用自己的模型生成摘要，用 `serializeConversation` 把消息转为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;

  // AgentMessage[] 转 Message[]，再序列化为文本
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );

  // 交给你的模型做摘要
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

用另一个模型实现的完整示例见 [custom-compaction.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-compaction.ts)。

### session_compact_failed

手动或自动压缩失败/被中止时触发。适合需要把 `session_before_compact` 尝试与最终结果配对的遥测扩展。

```typescript
pi.on("session_compact_failed", async (event, ctx) => {
  const { reason, errorMessage, aborted, willRetry, fromExtension } = event;
  // reason - "manual"（/compact）、"threshold" 或 "overflow"
  // errorMessage - 非中止类失败时存在
  // aborted - 取消/中止的压缩为 true
  // willRetry - 被中止的回合压缩后是否本会重试
  // fromExtension - 是否正在使用扩展提供的压缩内容
});
```

### session_before_tree

在 `/tree` 导航前触发。无论用户是否选择摘要都会触发。可以取消导航，或提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - 导航目的地
  // preparation.oldLeafId - 当前位置（即将离开）
  // preparation.commonAncestorId - 公共祖先
  // preparation.entriesToSummarize - 将被摘要的条目
  // preparation.userWantsSummary - 用户是否选择摘要

  // 整体取消导航：
  return { cancel: true };

  // 提供自定义摘要（仅 userWantsSummary 为 true 时使用）：
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "你的摘要……",
        // usage: summaryResponse.usage, // 可选；计入会话总量
        details: { /* 自定义数据 */ },
      }
    };
  }
});
```

见类型文件中的 `SessionBeforeTreeEvent` 与 `TreePreparation`。

## 设置

在 `~/.pi/agent/settings.json` 或 `<项目目录>/.pi/settings.json` 中配置：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| 设置 | 默认 | 说明 |
|------|------|------|
| `enabled` | `true` | 启用自动压缩 |
| `reserveTokens` | `16384` | 为 LLM 回复保留的 token |
| `keepRecentTokens` | `20000` | 保留（不摘要）的近期 token |

`"enabled": false` 关闭自动压缩后，仍可用 `/compact` 手动压缩。
