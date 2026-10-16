# 模型配置

<!-- 此文件由 TypeScript 源码生成。请勿手动编辑；运行 npm run generate:references。 -->

本参考列出了 `models.json` 的字段。示例请参见 [配置兼容端点](models.md#configure-a-compatible-endpoint)，文件位置请参见 [配置](configuration.md#agent-directory)。

在 `models.json` 中添加 `"$schema": "https://pi.dev/schemas/models.schema.json"` 以获得编辑器验证和自动补全。

## 提供商

`providers` 下的每个键都是一个提供商 ID。内置提供商 ID 修改对应提供商；任何其他 ID 则新增一个提供商，需要在提供商或模型级别配置 `baseUrl` 和 `api`。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `name` | 字符串 |  | 显示名称。 |
| `baseUrl` | 字符串 |  | API 基础 URL。同样适用于该提供商的内置模型。 |
| `apiKey` | 字符串 |  | 字面量键、`"$NAME"` 环境变量插值，或 `"!command"` 命令输出。 |
| `api` | 字符串 |  | 提供商模型的 API，例如 `"openai-completions"`、`"openai-responses"`、`"anthropic-messages"` 或 `"google-generative-ai"`。 |
| `oauth` | `"radius"` |  | OAuth 登录流程。需要 `baseUrl`。 |
| `headers` | 对象 |  | 请求头。值解析方式与 `apiKey` 相同。 |
| `compat` | [对象](#compatibility) |  | 提供商和模型兼容性覆盖。 |
| `authHeader` | 布尔值 | `false` | 是否将解析后的 API 密钥以 `Authorization: Bearer` 形式发送。 |
| `models` | [`对象[]`](#models) |  |  |
| `modelOverrides` | [对象](#model-overrides) |  |  |

## 模型

每个 `models` 条目都会向提供商添加一个模型。若条目的 `id` 与现有模型匹配，则会替换该模型。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `id` | string |  | 必填。发送至 API 的模型 ID。 |
| `name` | string |  | 显示名称，也会被 `--model` 模式匹配。 |
| `api` | string |  | 覆盖提供商的 api。 |
| `baseUrl` | string |  | 覆盖提供商的 baseUrl。 |
| `reasoning` | boolean | `false` | 模型是否支持思考。 |
| `thinkingLevelMap` | object |  | 为每个思考级别发送的提供商值。`null` 表示该级别不受支持。模型未映射的级别使用提供商的默认值直至 `high`；`xhigh` 和 `max` 不受支持。 |
| `input` | `("text" \| "image")[]` | `["text"]` |  |
| `inputLimits` | [object](#input-limits) |  |  |
| `cost` | object |  |  |
| `cost.input` | number |  | 必填。输入成本，单位为美元/百万 tokens。 |
| `cost.output` | number |  | 必填。输出成本，单位为美元/百万 tokens。 |
| `cost.cacheRead` | number |  | 必填。缓存读取成本，单位为美元/百万 tokens。 |
| `cost.cacheWrite` | number |  | 必填。缓存写入成本，单位为美元/百万 tokens。 |
| `cost.tiers` | `object[]` |  | 请求级定价层级。匹配的最高输入阈值适用于整个请求。 |
| `cost.tiers[].inputTokensAbove` | number |  | 必填。当请求总输入超过此 token 数量时，使用此层级。 |
| `cost.tiers[].input` | number |  | 必填。输入成本，单位为美元/百万 tokens。 |
| `cost.tiers[].output` | number |  | 必填。输出成本，单位为美元/百万 tokens。 |
| `cost.tiers[].cacheRead` | number |  | 必填。缓存读取成本，单位为美元/百万 tokens。 |
| `cost.tiers[].cacheWrite` | number |  | 必填。缓存写入成本，单位为美元/百万 tokens。 |
| `promptCache` | object |  | 尽力而为的提示词缓存生命周期（秒），适用于短期和长期保留层级。Pi 仅预热已知生命周期的层级。 |
| `contextWindow` | number | `128000` | 上下文窗口，单位为 tokens。 |
| `maxTokens` | number | `16384` | 最大输出 tokens。 |
| `samplingParams` | object |  | 合并到每个请求体中的字段。仅适用于兼容 OpenAI 的 API。 |
| `samplingParamsByThinkingLevel` | object |  | 每个思考级别的 samplingParams，合并于 samplingParams 之上。 |
| `headers` | object |  | 请求头。值的解析方式与 apiKey 相同。 |
| `compat` | [object](#compatibility) |  | 提供商和模型兼容性覆盖。 |

## 模型覆盖

每个 `modelOverrides` 键都是内置或扩展模型的 ID。未知 ID 会被忽略。对象字段（如 `cost`）会与模型的对应字段逐字段合并；其他字段则直接替换。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `name` | string |  | 显示名称，也会被 --model 模式匹配。 |
| `reasoning` | boolean |  | 模型是否支持思考。 |
| `thinkingLevelMap` | object |  | 为每个思考级别发送的提供商值。null 表示该级别不受支持。模型未映射的级别使用提供商的默认值直至 high；xhigh 和 max 不受支持。 |
| `input` | `("text" \| "image")[]` |  |  |
| `inputLimits` | [object](#input-limits) |  |  |
| `cost` | object |  |  |
| `cost.input` | number |  | 输入成本（美元/百万 tokens）。 |
| `cost.output` | number |  | 输出成本（美元/百万 tokens）。 |
| `cost.cacheRead` | number |  | 缓存读取成本（美元/百万 tokens）。 |
| `cost.cacheWrite` | number |  | 缓存写入成本（美元/百万 tokens）。 |
| `cost.tiers` | `object[]` |  | 请求级定价层级。匹配的最高输入阈值适用于整个请求。 |
| `cost.tiers[].inputTokensAbove` | number |  | 必填。当总请求输入超过此 token 数时使用此层级。 |
| `cost.tiers[].input` | number |  | 必填。输入成本（美元/百万 tokens）。 |
| `cost.tiers[].output` | number |  | 必填。输出成本（美元/百万 tokens）。 |
| `cost.tiers[].cacheRead` | number |  | 必填。缓存读取成本（美元/百万 tokens）。 |
| `cost.tiers[].cacheWrite` | number |  | 必填。缓存写入成本（美元/百万 tokens）。 |
| `promptCache` | object |  | 短和长保留层级的尽力而为提示缓存生命周期（秒）。Pi 仅预热已知生命周期的层级。 |
| `contextWindow` | number |  | 上下文窗口（tokens）。 |
| `maxTokens` | number |  | 最大输出 tokens。 |
| `samplingParams` | object |  | 合并到每个请求体中的字段。仅适用于 OpenAI 兼容 API。 |
| `samplingParamsByThinkingLevel` | object |  | 每个思考级别的 samplingParams，覆盖 samplingParams。 |
| `headers` | object |  | 请求头。值解析方式与 apiKey 相同。 |
| `compat` | [object](#compatibility) |  | 提供商和模型兼容性覆盖。 |

## 输入限制

参见[描述模型输入与缓存](models.md#describe-model-input-and-caching)。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `maxRequestBytes` | 整数 |  | 提供商请求的最大序列化大小（字节）。 |
| `images` | 对象 |  |  |
| `images.resize` | 对象 |  | 在新图像进入对话历史之前应用的缓存安全调整大小配置文件。 |
| `images.resize.maxWidth` | 整数 |  |  |
| `images.resize.maxHeight` | 整数 |  |  |
| `images.resize.maxBytes` | 整数 |  | 最大 base64 编码负载大小（字节）。 |
| `images.resize.jpegQuality` | 整数 |  |  |
| `images.maxPerMessage` | 整数 |  | 单条提供商消息中接受的最大图像数量。 |
| `images.maxPerRequest` | 整数 |  | 单个提供商请求中接受的最大图像数量。 |

## 兼容性

`compat` 描述了与API标准请求和响应行为之间经核实的差异。模型值按字段覆盖提供商值。适用的字段取决于模型的`api`。

### `openai-completions`

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `supportsStore` | boolean |  | 提供商是否支持 store 字段。默认值：从 URL 自动检测。 |
| `supportsDeveloperRole` | boolean |  | 提供商是否支持 developer 角色代替 system。默认值：从 URL 自动检测。 |
| `supportsReasoningEffort` | boolean |  | 提供商是否支持 reasoning_effort。默认值：从 URL 自动检测。 |
| `supportsUsageInStreaming` | boolean | `true` | 提供商是否支持 stream_options.include_usage 用于流式响应中的 token 使用。 |
| `supportsFinishReason` | boolean | `true` | 流式响应是否包含 finish_reason。当为 false 时，pi 在流结束时推断 stop 或 toolUse。 |
| `maxTokensField` | `"max_completion_tokens" \| "max_tokens"` |  | 用于最大 token 的字段。默认值：从 URL 自动检测。 |
| `requiresToolResultName` | boolean |  | 工具结果是否要求 name 字段。默认值：从 URL 自动检测。 |
| `requiresAssistantAfterToolResult` | boolean |  | 工具结果后的用户消息是否需要在中间添加 assistant 消息。默认值：从 URL 自动检测。 |
| `requiresThinkingAsText` | boolean |  | 思考块是否必须转换为带有 &lt;thinking> 分隔符的文本块。默认值：从 URL 自动检测。 |
| `requiresReasoningContentOnAssistantMessages` | boolean |  | 当启用推理时，所有重放的 assistant 消息是否必须包含空的 reasoning_content 字段。默认值：从 URL 自动检测。 |
| `thinkingFormat` | `"openai" \| "openrouter" \| "deepseek" \| "together" \| "baseten" \| "zai" \| "qwen" \| "chat-template" \| "qwen-chat-template" \| "string-thinking" \| "ant-ling"` |  | 推理或思考参数的格式。当省略时，Pi 从提供商 URL 自动检测格式。"openai" 使用 reasoning_effort，"openrouter" 使用 reasoning.effort，"deepseek" 使用 thinking.type 并在支持时加上 reasoning_effort，"together" 使用 reasoning.enabled 并在支持时加上 reasoning_effort，"baseten" 使用可配置的 chat_template_args 并在支持时加上 reasoning_effort，"zai" 使用 thinking.type，"qwen" 使用顶层 enable_thinking，"qwen-chat-template" 使用 chat_template_kwargs.enable_thinking 和 preserve_thinking，"chat-template" 使用可配置的 chat_template_kwargs，"string-thinking" 使用顶层 thinking，"ant-ling" 仅在映射的努力非空时使用 reasoning.effort。 |
| `chatTemplateKwargs` | object |  | 当 thinkingFormat 为 "chat-template" 时，作为 chat_template_kwargs 发送的 Kwargs。使用 $var 搭配 "thinking.enabled"、"thinking.effort" 或 "thinking.budget" 作为 pi 控制的值。 |
| `chatTemplateArgs` | object |  | 当 thinkingFormat 为 "baseten" 时，作为 chat_template_args 发送的参数。使用 $var 搭配 "thinking.enabled"、"thinking.effort" 或 "thinking.budget" 作为 pi 控制的值。 |
| `openRouterRouting` | object |  | OpenRouter 提供商的路由偏好。控制 OpenRouter 将请求路由到的上游提供商。作为 OpenRouter API 请求体中的 provider 字段发送。参见 https://openrouter.ai/docs/guides/routing/provider-selection。 |
| `vercelGatewayRouting` | object |  | Vercel AI Gateway 的路由偏好。控制网关将请求路由到的上游提供商。参见 https://vercel.com/docs/ai-gateway/models-and-providers/provider-options。 |
| `zaiToolStream` | boolean | `false` | z.ai 是否支持顶层的 tool_stream 用于流式工具调用增量。 |
| `thinkingTokenBudgetField` | `"thinking_token_budget" \| "thinking_budget" \| "thinking_budget_tokens"` |  | 用于从 thinkingBudgets 限制推理 token 的顶层请求字段。推理和答案在这些端点上共享 max_tokens。"thinking_token_budget" 是 vLLM，"thinking_budget" 是 Qwen、DashScope 或 SGLang，"thinking_budget_tokens" 是 llama.cpp。默认关闭且不会在生成的目录中设置。 |
| `supportsThinkingTokenBudget` | boolean | `false` | 是 thinkingTokenBudgetField 的别名："thinking_token_budget"（vLLM）。优先使用 thinkingTokenBudgetField。 |
| `supportsOpenAIGrammarTools` | boolean | `false` | 提供商是否支持使用 Lark 或 regex 语法格式的 OpenAI 自定义工具。当为 false 时，受语法约束的工具回退到正常函数工具。生成的目录为有能力的模型启用此功能。 |
| `supportsMidConvoSystemMessages` | boolean | `false` | 具体模型是否在对话开始后接受 system 或 developer 消息。当为 false 时，后面的系统消息被合并到初始系统消息中。生成的目录为已验证的模型启用此功能。 |
| `supportsMidConvoToolAdditions` | boolean | `false` | 系统消息是否可以在对话中途引入额外工具。需要 supportsMidConvoSystemMessages。生成的目录为有能力的模型启用此功能。 |
| `supportsStrictMode` | boolean | `false` | 提供商是否支持工具定义中的 strict 字段。生成的有能力模型显式启用它。 |
| `cacheControlFormat` | `"anthropic"` |  | 提示缓存的缓存控制约定。Anthropic 将 cache_control 标记应用于系统提示、最后一个工具定义以及最后一个用户、assistant 或工具结果文本内容。 |
| `sendSessionAffinityHeaders` | boolean |  | 是否从 options.sessionId 发送会话亲和性数据。默认值：OpenRouter 端点为 true，否则为 false。 |
| `sessionAffinityFormat` | `"openai" \| "openai-nosession" \| "openrouter"` |  | 会话亲和性头部格式。openai 发送 session_id、x-client-request-id 和 x-session-affinity；openai-nosession 发送 x-client-request-id 和 x-session-affinity；openrouter 发送 x-session-id。不影响 prompt_cache_key。默认值：自动检测。 |

| `supportsLongCacheRetention` | boolean |  | 提供商是否支持长提示缓存保留（`prompt_cache_retention: "24h"` 或 Anthropic 风格的 `cache_control.ttl: "1h"`，取决于格式）。默认：根据提供商和 URL 自动检测。 |
| `vllmPriority` | number |  | vLLM 调度器优先级，作为顶层优先级请求字段发送。较低的值会较早处理，服务器默认值为 0。仅与 `--scheduling-policy priority` 配合使用才有意义。默认关闭，并且不会在生成的目录中设置。 |

### `openai-responses`

同样适用于 `azure-openai-responses` 和 `openai-codex-responses`。

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `supportsDeveloperRole` | boolean | `true` | 提供商是否支持开发者角色而非系统角色。 |
| `supportsMidConvoSystemMessages` | boolean | `false` | 确切的模型是否在会话开始后接受开发者或系统消息。当为 false 时，后续的系统消息会合并到开头的系统消息中。生成的目录为已验证的模型启用此功能。 |
| `sessionAffinityFormat` | `"openai" \| "openai-nosession" \| "openrouter"` |  | 会话亲和性头部格式。openai 发送 session_id 和 x-client-request-id；openai-nosession 发送 x-client-request-id；openrouter 发送 x-session-id。不影响 prompt_cache_key。默认值：自动检测。 |
| `supportsLongCacheRetention` | boolean | `true` | 提供商是否支持长提示词缓存保留。这使用 prompt_cache_options.ttl: "30m"（在 GPT-5.6+ 上）和 prompt_cache_retention: "24h"（在早期模型上）。 |
| `supportsStrictMode` | boolean |  | 提供商是否支持严格的 JSON-schema 函数工具。默认值因 API 而异；生成的 OpenAI 模型会显式启用它。 |
| `supportsOpenAIGrammarTools` | boolean | `false` | 是否使用 Lark 或正则表达式语法格式发出 OpenAI 自定义工具。当为 false 时，受语法约束的工具会回退到普通函数工具。生成的目录为有能力的模型启用此功能。 |
| `supportsAdditionalTools` | boolean | `false` | 模型是否支持消息锚定的 additional_tools 输入项。 |
| `supportsToolSearch` | boolean | `false` | 模型是否支持客户端执行的工具搜索以进行转录锚定的添加。 |
| `supportsExplicitPromptCacheMode` | boolean | `false` | 模型是否接受 prompt_cache_options。较旧的 OpenAI 模型会拒绝该参数。 |
| `supportsMidConvoEffort` | boolean | `false` | 思考级别更改是否作为 configuration_update 输入项发送，而不是更改 reasoning.effort，以便更改时保持提示词缓存。仅由 openai-responses API 使用，并且在 openai 提供商上使用“使用 ChatGPT 登录”时忽略。 |
| `supportsMaxOutputTokens` | boolean | `true` | 提供商是否接受 max_output_tokens。某些 Codex 协议网关会拒绝它。 |

### `anthropic-messages`

| 字段 | 类型 | 默认 | 描述 |
|---|---|---|---|
| `supportsEagerToolInputStreaming` | boolean | `true` | 提供商是否接受每个工具的 eager_input_streaming。当为 false 时，Anthropic 提供商会省略 tools[].eager_input_streaming，并向启用工具请求发送旧的 fine-grained-tool-streaming-2025-05-14 测试版标头。 |
| `supportsLongCacheRetention` | boolean | `true` | 提供商是否通过 cache_control.ttl 支持 Anthropic 长缓存保留。 |
| `sendSessionAffinityHeaders` | boolean |  | 启用缓存时，是否从 options.sessionId 发送 x-session-affinity。对于使用会话亲和性进行提示词缓存路由的提供商（如 Fireworks）是必需的；请求发送到同一副本时最大化缓存命中。默认：OpenRouter 端点为 true，否则为 false。 |
| `sessionAffinityFormat` | `"openrouter"` |  | 会话亲和性格式。openrouter 发送 x-session-id；未设置时，发送 x-session-affinity。 |
| `supportsCacheControlOnTools` | boolean | `true` | 提供商是否支持在工具定义上使用 Anthropic 风格的 cache_control 标记。当为 false 时，cache_control 会从工具参数中省略。部分兼容 Anthropic 的提供商（如 Fireworks）不支持工具上的此字段，可能会拒绝或忽略它。 |
| `supportsTemperature` | boolean | `true` | 模型是否接受 Anthropic 温度请求字段。Claude Opus 4.7+ 拒绝非默认值。 |
| `forceAdaptiveThinking` | boolean | `false` | 是否无论模型 ID 如何都强制自适应思考（thinking.type: adaptive 加上 output_config.effort）。需要自适应思考的内置模型会在生成的元数据中设置此参数。自定义兼容 Anthropic 的提供商可以为其上游要求自适应格式的任何模型将此设置为 true。对覆盖的内置模型设置为 false 以选择退出。 |
| `allowEmptySignature` | boolean | `false` | 是否重放空思考签名，而不是将思考转换为文本。 |
| `supportsStrictTools` | boolean | `false` | 提供商是否支持 Anthropic 严格工具模式。生成的 Anthropic 模型会显式启用它。 |
| `supportsMidConvoEffort` | boolean | `false` | 精确模型传输是否支持仅努力的系统消息和思考绑定控制。 |
| `supportsMidConvoSystemMessages` | boolean | `false` | 精确模型是否接受会话内的系统角色消息。当为 false 时，后续系统消息会合并到顶层系统提示词中。 |
| `supportsMidConvoToolChanges` | boolean | `false` | 精确模型是否接受会话中的工具添加和移除块。需要 supportsMidConvoSystemMessages。 |
| `allowedFallbackModels` | `object[]` |  | Anthropic 接受用于服务器端拒绝回退的模型，带有返回回退响应的本地定价元数据。当缺失或为空时，调用者必须省略回退；Anthropic 会拒绝无允许回退目标的模型的此字段。 |

### `bedrock-converse-stream`

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `supportsStrictMode` | boolean | `false` | 模型是否支持 Bedrock 严格工具模式。 |

### `mistral-conversations`

| 字段 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `supportsMidConvoSystemMessages` | 布尔值 | `false` | 该确切模型是否在会话开始后接受系统消息。当为 `false` 时，后续的系统消息会合并到开头的系统消息中。 |
