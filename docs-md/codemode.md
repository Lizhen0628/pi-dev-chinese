# 代码模式

`codemode` 工具允许模型编写一个 JavaScript 脚本，该脚本调用 pi 的其他工具并运行非 LLM 模型，如分类器和图像模型。只有脚本的输出会到达模型，因此脚本可以并行运行调用，并在模型看到结果之前过滤大量结果。要启用它，请参阅 [启用代码模式](cli.md#enable-codemode)。

## 脚本

工具输入是原始 JavaScript 源码，不是 JSON，也不是 markdown 代码围栏。它作为 QuickJS 沙箱中一个 async 函数体运行，所以顶层 `await` 和 `return` 可用。沙箱没有 Node API、文件系统、网络或定时器；脚本只能通过工具和 `models` 与外界交互。

脚本可以以选项行开头：

```js
// @options: {"max_output_tokens": 2000, "timeout_ms": 60000}
```

- `max_output_tokens`（默认 10000）限制输出。较长的输出保留其开头和结尾，全文写入一个临时文件，其路径包含在结果中。
- `timeout_ms` 是整个脚本的硬性截止时间。默认未设置。图像生成可能需要数分钟，因此不要为生成图像的脚本设置过短的截止时间。

结果以 `Script completed` 或 `Script failed` 开头，然后是实际时间和输出。失败的脚本保留其部分输出，后跟 `Script error:` 和错误。工具调用是真实的：失败之前的调用不会撤销。脚本结束时仍在运行的调用将被取消，未等待的 promise 被丢弃。

## 全局变量

| 全局变量 | 用途 |
|---|---|
| `tools.<name>(args)` | 调用工具。参见[调用工具](#call-tools)。 |
| `text(value)` | 向输出中添加文本项。字符串按原样添加，其他值以 JSON 格式添加。 |
| `image(value)` | 向输出中添加图像：一个 base64 `data:` URL、一个 `{ image_url }` 对象，或一个图像块 `{ type: "image", data, mimeType }`，例如 MCP 工具和 `models.generateImages()` 返回的图像块。不支持远程 URL。接受 PNG、JPEG、GIF 和 WebP 格式。 |
| `console.log(...)` | 与 `text()` 类似；`info`、`warn`、`error` 和 `debug` 功能相同。 |
| `return value` | 顶层 `return` 会像 `text()` 一样添加值。 |
| `exit()` | 成功结束脚本。 |
| `store(key, value)` / `load(key)` | 在 `codemode` 调用之间保留小的 JSON 值。参见[存储值](#store-values)。 |
| `ALL_TOOLS` | 所有可调用工具，以 `{ name, description }` 形式呈现，包括描述中未列出的工具。 |
| `searchTools(query, { limit?, namespace? })` | 按相关性（BM25，默认限制 8）对可调用工具进行排序。解析为 `{ name, description }[]`。 |
| `describeTool(name)` | 解析为工具的描述和 TypeScript 声明，或 `undefined`。 |
| `describeNamespace(name)` | 解析为命名空间（如 MCP 服务器）的 `{ name, description?, instructions?, tools }`，或 `undefined`。 |
| `models` | 列出并运行非 LLM 模型。参见[模型](#models)。 |

## 调用工具

会话可调用的每个工具都是 `tools` 的一个方法，以其标识符命名：JavaScript 标识符中无效的字符会变为 `_`，因此 MCP 工具 `mcp__dev-radius__search` 即为 `tools.mcp__dev_radius__search`。每个方法接受一个包含工具参数的对象。

调用的解析结果取决于工具类型：

- 具有输出模式的工具解析为结构化值。`bash` 解析为 `{ output, truncated, full_output_path?, exit_code, wall_time_seconds }`，即使退出码非零也是如此。其 `output` 不限于模型可见的 2000 行或 50KB：它最多可容纳 1 MiB，更长的输出会在省略标记前后保留首尾各 512 KiB，并设置 `truncated`，完整输出位于 `full_output_path` 中。
- MCP 工具解析为其 `CallToolResult`，包括 `isError` 和 `structuredContent`。
- 其他工具，如 `read`、`edit` 和 `write`，解析为其文本输出。

调用失败、被阻止或参数无效时，会以携带工具错误文本的 `Error` 拒绝。使用 `Promise.allSettled()` 可保留成功调用的结果。

`codemode` 描述中列出了带有 TypeScript 声明的工具，按命名空间分组（例如一个 MCP 服务器）。具有 `deferred` 暴露的工具（包括默认 `codemode` 暴露的 MCP 工具）不会列出，因此在 MCP 服务器连接时描述保持不变。列出的声明共享 3000 个估算令牌的预算（[设置](settings.md#tools) 中的 `codemode.inlineBudget`）。脚本可通过 `searchTools()`、`describeTool()`、`describeNamespace()` 或过滤 `ALL_TOOLS` 找到其他工具。

当 `codemode` 激活时，[设置](settings.md#tools) 中的 `codemode.mode` 决定其他工具的呈现方式。使用 `on`（默认）时，声明的工具保持声明状态，其描述说明如何从脚本调用它们。使用 `only` 时，它们对模型隐藏，而是列在 `codemode` 描述中，因此模型通过脚本调用它们。

## 存储值

`store(key, value)` 将 JSON 值保存在字符串键下，供后续 `codemode` 调用使用；存储 `undefined` 会删除该键。`load(key)` 返回该值，若不存在则返回 `undefined`。写入仅在脚本成功时保留：每次成功存储值的脚本都会向会话追加一条 `codemode-store` 自定义条目，因此恢复的会话会保留这些值，且每个分支仅能看到其路径上写入的值。

存储适用于小型状态，如 ID、游标或摘要。单个值最多可包含 262144 个字符的 JSON，所有值合计最多 1048576 个字符。请勿存储图像数据；使用 `image()` 显示图像，或使用工具将其写入文件。

## 模型

`models` 可访问模型目录，并使用会话的凭据运行非 LLM 模型：分类器（回答关于 JSON 状态的键入问题）和图像模型（生成图像）。聊天模型会被列出，但无法从脚本中运行。存在哪些分类器和图像模型，请参阅[使用分类器模型](models.md#use-classifier-models)和[使用图像模型](models.md#use-image-models)。

```ts
type ModelType = "chat" | "image" | "classifier";

/** 目录条目。`provider` 和 `id` 用于标识；其他字段取决于类型。 */
interface ModelInfo {
  type?: ModelType;
  provider: string;
  id: string;
  name: string;
  api: string;
  input: ("text" | "image")[];
  contextWindow?: number;
  [key: string]: unknown;
}

declare const models: {
  /** 某类型的所有已知模型，可选指定提供商。 */
  getModelsOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** 提供商具有有效凭据的某类型模型。 */
  getAvailableOfType(type: ModelType, provider?: string): Promise<ModelInfo[]>;
  /** 单个目录条目，或 undefined。 */
  getModelOfType(type: ModelType, provider: string, id: string): Promise<ModelInfo | undefined>;
  /** 回答 `context.questions` 中关于 `context.state` 的问题；答案按问题 ID 存放在 `result.answers` 中。 */
  classify(model: ModelInfo, context: ClassifierContext): Promise<ClassifierResult>;
  /** 根据 `context.input` 中的文本和图像块生成图像；使用 image() 显示 `result.output` 块。可能需要数分钟。 */
  generateImages(model: ModelInfo, context: ImagesContext): Promise<ImagesResult>;
};
```

`classify()` 和 `generateImages()` 仅使用 `model` 的 `provider` 和 `id`，因此 `{ provider, id }` 同样有效。它们不会因提供商错误而抛出异常：请检查 `stopReason` 和 `errorMessage`。每个脚本最多同时运行四个此类调用；更多调用会等待空闲槽位，因此对多个项目使用 `Promise.all()` 是可行的。它们的使用会计入 `codemode` 工具结果，并计入会话成本。

模型 ID 因提供商而异，例如 `typesafe/jev-latest` 和 `openrouter/typesafe/jev-1.13`。使用 `models.getAvailableOfType(type)` 查找适用于当前凭据的 ID。

### 分类

```ts
interface ClassifierContext {
  /** 要分类的数据。 */
  state: Record<string, unknown>;
  /** 按 ID 区分的问题。一次调用回答所有问题。 */
  questions: Record<string, ClassifierQuestion>;
}

type ClassifierQuestion =
  /** 选择一个标签。`criteria` 将每个标签映射到其含义。 */
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  /** 在有序量表上打分。`criteria` 描述每个级别，从低到高。 */
  | { type: "score"; instructions: string; criteria: string[] }
  /** 是或否。 */
  | { type: "bool"; instructions: string; criteria: { true: string; false: string } };

interface ClassifierResult {
  provider: string;
  model: string;
  /** 按问题 ID 区分的答案。 */
  answers: Record<string, ClassifierAnswer>;
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type ClassifierAnswer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  /** `score` 是预期的级别索引，从 0 到 `criteria.length - 1`。 */
  | { type: "score"; score: number; confidence: number }
  /** `true` 的概率。 */
  | { type: "bool"; probability: number };

/** 服务报告时的令牌计数和美元成本。 */
type ModelUsage = { input: number; output: number; totalTokens: number; cost: { total: number } };
```

通过为每个项目调用一次 `classify()` 来对多个项目进行分类。此脚本对反馈消息进行排序，例如脚本中工具先前返回的消息：

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const results = await Promise.all(
  messages.map((message) =>
    models.classify(jev, {
      state: { message },
      questions: {
        sentiment: {
          type: "choice",
          instructions: "用户对产品感觉如何？",
          criteria: { positive: "满意或高兴", negative: "不满意或沮丧", neutral: "中立" },
        },
        urgency: {
          type: "score",
          instructions: "这需要多紧急的回复？",
          criteria: ["无需回复", "本周内回复", "今天回复"],
        },
      },
    }),
  ),
);
return results.map((result, i) =>
  result.stopReason === "stop"
    ? { message: messages[i], sentiment: result.answers.sentiment.choice, urgency: result.answers.urgency.score }
    : { message: messages[i], error: result.errorMessage },
);
```

### 生成图像

```ts
interface ImagesContext {
  /** 提示词以文本块形式呈现，同时包含用于编辑或作为参考的图像块。 */
  input: (TextBlock | ImageBlock)[];
}

interface ImagesResult {
  provider: string;
  model: string;
  /** 生成的图像，以及对于同时返回文本的模型，还包括文本块。 */
  output: (TextBlock | ImageBlock)[];
  usage?: ModelUsage;
  stopReason: "stop" | "error" | "aborted";
  errorMessage?: string;
}

type TextBlock = { type: "text"; text: string };
/** `data` 为 base64 编码。 */
type ImageBlock = { type: "image"; data: string; mimeType: string };
```

使用 `image(block)` 显示生成的图像。不要用 `text()`、`console` 或 `return` 打印 `data`：它体积较大，且模型无法将其作为文本读取。生成的图像不会保存到磁盘；如需保留，请使用工具将其写入文件。

```js
// @options: {"timeout_ms": 300000}
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "雪地中的红狐，水彩画" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) {
  if (block.type === "image") image(block);
  else text(block.text);
}
```

## 限制

- 脚本的虚拟机拥有 256 MB 内存。内存耗尽时会抛出 `InternalError: out of memory`；请过滤或聚合大数据，而不是将其累积起来。
- 等待永远不会完成的 Promise（没有待处理的工具调用）的脚本会立即失败，因为没有定时器。
- 脚本无法启动其他 `codemode` 脚本。
