# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义提供商和模型（Ollama、vLLM、LM Studio、代理）。

## 目录

- [最小示例](#minimal-example)
- [完整示例](#full-example)
- [支持的API](#supported-apis)
- [提供商配置](#provider-configuration)
- [模型配置](#model-configuration)
- [覆盖内置提供商](#overriding-built-in-providers)
- [按模型覆盖](#per-model-overrides)
- [Anthropic Messages兼容性](#anthropic-messages-compatibility)
- [OpenAI兼容性](#openai-compatibility)

## 最小示例

对于本地模型（Ollama、LM Studio、vLLM），每个模型仅需提供 `id` 字段：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

`apiKey` 的值仅作占位使用，因为 Ollama 会忽略该字段。pi 仍然会将模型视为需要认证后才出现在 `/model` 列表中，因此对于无需密钥的本地服务器，应保留一个虚拟值、通过 `/login` 为该提供商保存密钥，或在选择模型时传递 `--api-key` 参数。

部分兼容 OpenAI 的服务器无法识别用于推理能力模型的 `developer` 角色。对于这些提供商，请将 `compat.supportsDeveloperRole` 设置为 `false`，以便 pi 将系统提示词作为 `system` 消息发送。如果服务器同样不支持 `reasoning_effort` 参数，也请将 `compat.supportsReasoningEffort` 设置为 `false`。

您可以在提供商级别设置 `compat` 以应用到所有模型，或在模型级别设置以覆盖特定模型。这一设置通常适用于 Ollama、vLLM、SGLang 及类似兼容 OpenAI 的服务器。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

## 完整示例

在需要特定值时，覆盖默认配置：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

每次打开 `/model` 时，文件都会重新加载。可在会话期间编辑，无需重启。

## Google AI Studio 示例

使用带有 `baseUrl` 的 `google-generative-ai` 来添加来自 Google AI Studio 的模型，包括自定义 Gemma 4 条目：

```json
{
  "providers": {
    "my-google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "api": "google-generative-ai",
      "apiKey": "$GEMINI_API_KEY",
      "models": [
        {
          "id": "gemma-4-31b-it",
          "name": "Gemma 4 31B",
          "input": ["text", "image"],
          "contextWindow": 262144,
          "reasoning": true
        }
      ]
    }
  }
}
```

当向 `google-generative-ai` API 类型添加自定义模型时，必须提供 `baseUrl`。

## 支持的API

| API | 描述 |
|-----|-------------|
| `openai-completions` | OpenAI 聊天补全（最具兼容性） |
| `openai-responses` | OpenAI 响应API |
| `anthropic-messages` | Anthropic 消息API |
| `google-generative-ai` | Google 生成式AI |

在提供商级别（所有模型的默认设置）或模型级别（按模型覆盖）设置`api`。

## 提供商配置

| 字段 | 描述 |
|-------|-------------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上文） |
| `apiKey` | 可选的 API 密钥配置（见下文值解析）。当认证由 `/login`/`auth.json` 或 CLI `--api-key` 提供时，省略此项。 |
| `oauth` | 动态 OAuth 提供商类型。目前支持 `"radius"`；需要网关 `baseUrl`。 |
| `headers` | 自定义请求头（见下文值解析） |
| `authHeader` | 设置为 `true` 以自动添加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 此提供商上的内置或扩展注册模型的每个模型覆盖 |

对于具有 `models` 的提供商，非内置提供商配置需要在提供商或模型级别提供 `baseUrl` 和 `api` 值。加载文件时不需要 `apiKey`：当通过 `/login`/`auth.json`、CLI `--api-key` 或提供商 `apiKey` 配置认证时，模型变为可用。如果未配置认证，模型会加载但保持不可用，在 `/model` 和 `--list-models` 中。

### 值解析

`apiKey` 和 `headers` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 开头的 `"!command"` 会将整个值作为命令执行，并使用其标准输出（stdout）
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用指定变量的值。插值可在大段字面量中生效。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` 指代变量 `FOO_BAR`；当 `BAR` 为字面文本时，请使用 `${FOO}_BAR`。缺失的环境变量会导致值无法解析。
- **转义：** `"$$"` 输出字面量 `"$"`；`"$!"` 输出字面量 `"!"`，且不会触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **字面量：** 直接使用。纯大写字符串（如 `MY_API_KEY`）被视为字面量；如需引用环境变量，请使用 `$MY_API_KEY`。
  ```json
  "apiKey": "sk-..."
  ```

对于 `models.json`，Shell 命令在请求时执行解析。pi 有意不对任意命令应用内置的 TTL（生存时间）、过期复用或恢复逻辑。不同命令需要不同的缓存和失败策略，pi 无法推断出合适的方案。

如果你的命令执行缓慢、成本高昂、有速率限制，或在临时故障时应继续使用上一次的值，请将其封装到你自己的脚本或命令中，以实现所需的缓存或 TTL 行为。

`/model` 的可用性检查仅依据配置的认证状态，不会执行 Shell 命令。

### 自定义请求头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "$PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## 模型配置

| 字段 | 必需 | 默认值 | 描述 |
|------|------|--------|------|
| `id` | 是 | — | 模型标识符（传递给 API） |
| `name` | 否 | `id` | 人类可读的模型标签。用于匹配（`--model` 模式），并作为次要模型详情文本显示。 |
| `api` | 否 | 提供商的 `api` | 覆盖该模型的提供商 API |
| `reasoning` | 否 | `false` | 支持扩展思考 |
| `thinkingLevelMap` | 否 | 省略 | 将 pi 的思考级别映射到提供商的值，并标记不支持的级别（见下文） |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（以 token 计） |
| `maxTokens` | 否 | `16384` | 最大输出 token 数 |
| `samplingParams` | 否 | 省略 | 采样参数原样合并到每个请求体中（见下文） |
| `cost` | 否 | 全零 | 每百万 token 的费率，以及可选的按请求输入定价层级 |
| `compat` | 否 | 提供商的 `compat` | 提供商兼容性覆盖。当同时设置时，与提供商级别的 `compat` 合并。 |

一个成本层级提供一套完整的替代费率，并且当总输入用量（`input + cacheRead + cacheWrite`）超过 `inputTokensAbove` 时，适用于整个请求。当多个层级匹配时，采用最高的阈值。

```json
{
  "cost": {
    "input": 5,
    "output": 30,
    "cacheRead": 0.5,
    "cacheWrite": 6.25,
    "tiers": [
      {
        "inputTokensAbove": 272000,
        "input": 10,
        "output": 45,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    ]
  }
}
```

当前行为：
- `/model`、`--list-models` 以及交互式页脚按模型 `id` 显示条目。
- 配置的 `name` 用于模型匹配和次要模型详情文本。它不会替换页脚/状态栏的模型 id。

### 采样参数

`samplingParams` 是一个自由格式的对象，它会逐字合并到每个发送给模型的请求体中，且位于 pi 自身设置的字段之后，因此其键值优先。用它来发送 pi 未建模的采样参数——包括特定于服务器的参数，如 llama.cpp 的 `min_p` 或 vLLM 的 `top_k`：

```json
{
  "id": "deepseek-v4-flash",
  "samplingParams": {
    "temperature": 1.0,
    "top_p": 0.95,
    "top_k": 0,
    "min_p": 0.0
  }
}
```

仅 OpenAI 兼容的 API 适用此配置（`openai-completions`、`openai-responses`、`azure-openai-responses`）；其他 API 会忽略它。这些键会覆盖 pi 的命名请求字段（例如，此处 `temperature` 键的优先级高于请求级别的温度），因此建议将其作为模型采样真相的唯一来源。在 `modelOverrides` 中，`samplingParams` 会按键与基础模型的值进行合并。

常量思考令牌上限也可设置于此，但它不会遵循 `thinkingBudgets`，也不会为回答预留空间。对于此目的，优先使用 `compat.thinkingTokenBudgetField`（或其别名 `supportsThinkingTokenBudget`）。

### 思考级别映射

在模型上使用 `thinkingLevelMap` 来描述模型特定的思考控制。键为 pi 思考级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。映射可以有空洞；例如，某个模型可以暴露 `high` 和 `max` 而不暴露 `xhigh`。

值为三态：

| 值 | 含义 |
|-------|---------|
| 省略 | 标准级别至 `high` 使用提供商的默认映射；扩展级别 `xhigh` 和 `max` 不受支持 |
| 字符串 | 该级别受支持，且此值发送给提供商 |
| `null` | 该级别不受支持，并被隐藏/跳过/限制 |

仅支持 off、high 和 max 推理的模型示例：

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": true,
  "thinkingLevelMap": {
    "minimal": null,
    "low": null,
    "medium": null,
    "high": "high",
    "xhigh": null,
    "max": "max"
  }
}
```

思考无法被禁用的模型示例：

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

迁移：旧配置中使用 `compat.reasoningEffortMap` 的，应将此映射移至模型级别的 `thinkingLevelMap`。对于不应出现在界面中的级别，使用 `null`。

## 覆盖内置提供商

通过代理路由内置提供商，而无需重新定义模型：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

所有内置的 Anthropic 模型仍然可用。现有的 OAuth 或 API 密钥认证继续有效。

要将自定义模型合并到内置提供商中，请包含 `models` 数组：

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "$ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

合并语义：

- 内置模型会被保留。
- 自定义模型按 `id` 在提供商内进行更新或插入（upsert）。
- 如果自定义模型的 `id` 与内置模型的 `id` 匹配，则自定义模型将替换该内置模型。
- 如果自定义模型的 `id` 是新出现的，则会与内置模型一同添加。

## 逐模型覆盖

使用 `modelOverrides` 可自定义内置模型及匹配的扩展注册模型，而无需替换提供商的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` 支持每个模型以下字段：`name`、`reasoning`、`thinkingLevelMap`、`input`、`cost`（部分）、`contextWindow`、`maxTokens`、`samplingParams`（按键合并）、`headers`、`compat`。

OpenAI GPT-5.6 Sol、Terra 和 Luna 默认使用 `272000` 上下文窗口，以确保请求保持在 OpenAI 短上下文定价层内。若要使用 OpenAI 的 1.05M 上下文窗口，请为您使用的每个模型增大该值：

```json
{
  "providers": {
    "openai": {
      "modelOverrides": {
        "gpt-5.6-sol": {
          "contextWindow": 1050000
        }
      }
    }
  }
}
```

该覆盖会保留内置的定价元数据。输入令牌总数超过 272K 的请求将按 GPT-5.6 的长上下文费率计费。如需时，请将相同的覆盖应用于 `gpt-5.6-terra` 或 `gpt-5.6-luna`。

行为说明：
- `modelOverrides` 应用于内置提供商模型以及匹配的扩展注册提供商模型。
- 未知的模型 ID 会被忽略。
- 您可以组合使用提供商级别的 `baseUrl`/`headers` 与 `modelOverrides`。
- 覆盖 `name` 仅影响模型匹配和辅助详情文本；页脚和主模型列表仍显示模型 `id`。
- 如果提供商还定义了 `models`，自定义模型会在内置覆盖之后合并。具有相同 `id` 的自定义模型将替换被覆盖的内置模型条目。

## Anthropic 消息兼容性

对于使用 `api: "anthropic-messages"` 的提供商或代理，pi 提供特定于 Anthropic 的兼容性选项。

默认情况下，pi 发送 `tools[].eager_input_streaming: true`。如果代理或 Anthropic 兼容后端拒绝该字段，请将 `supportsEagerToolInputStreaming` 设置为 `false`。Pi 将省略 `tools[].eager_input_streaming`，并在启用工具请求时改为发送旧版细粒度工具流式传输 beta 头。

某些 Anthropic 模型要求自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），而不是基于预算的旧版思考负载。内置模型会自动设置此选项。对于路由到这些模型的自定义提供商或别名，请将 `forceAdaptiveThinking` 设置为 `true`。

支持逐轮努力的 Claude 模型使用 `supportsMidConvoEffort`。然后，Pi 会持久化每个响应的提供商努力，在后续请求中重建仅努力的系统消息，并发送带有 `prefix_mismatch_behavior: "drop_block"` 的思考绑定控件，以避免过期的签名思考前缀导致持续的 400 响应。仅在忠实的 Anthropic Messages 传输上为确切支持的 Claude 模型设置此选项；不要为仅模仿 Messages 形状的 API 启用它。

某些 Anthropic 兼容提供商发出的思考块带有空签名，并且仍然希望在重放时保留这些签名。仅为这些提供商将 `allowEmptySignature` 设置为 `true`；真正的 Anthropic 会拒绝空思考签名。

内置 Anthropic 模型在其模型元数据中启用了 `supportsStrictTools`。自定义 Anthropic 兼容模型在其端点接受严格 JSON-schema 工具定义时，必须将其设置为 `true`。

```json
{
  "providers": {
    "anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "$ANTHROPIC_PROXY_KEY",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsLongCacheRetention": true,
        "forceAdaptiveThinking": true,
        "allowEmptySignature": true
      },
      "models": [
        {
          "id": "claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

| 字段 | 描述 |
|-------|-------------|
| `supportsEagerToolInputStreaming` | 提供商是否接受每个工具的 `eager_input_streaming`。默认：`true`。设置为 `false` 以省略该字段，并在启用工具请求时使用旧版细粒度工具流式传输 beta 头。 |
| `supportsLongCacheRetention` | 当缓存保留为 `long` 时，提供商是否接受 Anthropic 长缓存保留（`cache_control.ttl: "1h"`）。默认：`true`。 |
| `sendSessionAffinityHeaders` | 启用缓存时，是否从会话 id 发送 `x-session-affinity`。默认：对于已知提供商自动检测。 |
| `supportsCacheControlOnTools` | 提供商是否接受工具定义上的 Anthropic 风格 `cache_control` 标记。默认：`true`。 |
| `forceAdaptiveThinking` | 是否为此模型发送自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`）。内置自适应模型会自动设置此选项。默认：`false`。 |
| `supportsMidConvoEffort` | 确切的 Claude 模型传输是否支持逐轮努力系统消息和思考绑定控件。Pi 会持久化原生努力级别，并在启用时始终发送 `drop_block`。默认：`false`。 |
| `allowEmptySignature` | 是否将空思考签名重放为 `signature: ""`，而不是将思考转换为文本。默认：`false`。 |
| `supportsStrictTools` | 提供商是否接受严格 JSON-schema 工具定义。默认：`false`；内置 Anthropic 模型会在生成的元数据中启用该选项。 |
| `allowedFallbackModels` | 最多三个服务器端回退模型，每个都具有 `provider`、`model` 和完整的 `cost` 元数据。空数组将禁用回退。 |

## OpenAI 兼容性

对于部分兼容 OpenAI 的提供商，请使用 `compat` 字段。

- 提供商级别的 `compat` 为该提供商下的所有模型应用默认值。
- 模型级别的 `compat` 会覆盖该模型的提供商级别值。

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| 字段 | 描述 |
|-------|-------------|
| `supportsStore` | 提供商支持 `store` 字段 |
| `supportsDeveloperRole` | 使用 `developer` 而非 `system` 角色 |
| `supportsReasoningEffort` | 支持 `reasoning_effort` 参数 |
| `supportsUsageInStreaming` | 支持 `stream_options: { include_usage: true }`（默认值：`true`） |
| `supportsFinishReason` | 流式响应是否包含 `finish_reason`。当为 `false`，pi 在流结束时推断 `stop` 或 `toolUse`。默认值：`true`。 |
| `maxTokensField` | 使用 `max_completion_tokens` 或 `max_tokens` |
| `requiresToolResultName` | 在工具结果消息中包含 `name` |
| `requiresAssistantAfterToolResult` | 在工具结果之后、用户消息之前插入一条助手消息 |
| `requiresThinkingAsText` | 将思考块转换为纯文本 |
| `requiresReasoningContentOnAssistantMessages` | 启用推理时，在所有重放的助手消息中包含空的 `reasoning_content` |
| `thinkingFormat` | 使用 `reasoning_effort`、`openrouter`、`deepseek`、`together`、`baseten`、`zai`、`qwen`、`chat-template` 或 `qwen-chat-template` 思考参数 |
| `chatTemplateKwargs` | `thinkingFormat: "chat-template"` 时的 `chat_template_kwargs` 值；使用 `{ "$var": "thinking.enabled" }`、`{ "$var": "thinking.effort" }` 或 `{ "$var": "thinking.budget" }` 表示 pi 控制的思考值 |
| `chatTemplateArgs` | `thinkingFormat: "baseten"` 时的 `chat_template_args` 值；使用 `{ "$var": "thinking.enabled" }`、`{ "$var": "thinking.effort" }` 或 `{ "$var": "thinking.budget" }` 表示 pi 控制的思考值 |
| `thinkingTokenBudgetField` | 用于限制 `thinkingBudgets` 中推理令牌的顶层请求字段，会被限制以确保至少保留 1024 个令牌用于回答。`"thinking_token_budget"`（vLLM）、`"thinking_budget"`（Qwen/DashScope/SGLang）、`"thinking_budget_tokens"`（llama.cpp）。默认关闭；不会在生成的目录中设置。 |
| `supportsThinkingTokenBudget` | `thinkingTokenBudgetField: "thinking_token_budget"`（vLLM）的别名。优先使用 `thinkingTokenBudgetField`。默认值：`false`。 |
| `cacheControlFormat` | 在系统提示、最后一个工具定义以及最后一个用户、助手或工具结果文本内容上使用 Anthropic 风格的 `cache_control` 标记。目前仅支持 `anthropic`。 |
| `sendSessionAffinityHeaders` | 对于 `openai-completions`，在启用缓存时从会话 ID 发送会话亲和性头部。默认值：`false`。 |
| `sessionAffinityFormat` | 对于 `openai-completions` 和 `openai-responses`，会话亲和性头部格式：`openai` 发送 `session_id`/`x-client-request-id`（completions 还发送 `x-session-affinity`），`openai-nosession` 省略包含下划线的 `session_id` 头部，`openrouter` 发送 `x-session-id`。不影响 `prompt_cache_key` 主体参数。默认值：自动检测。 |
| `supportsStrictMode` | 提供商是否接受严格的 JSON schema 函数工具定义。默认值取决于 API；内置 OpenAI 模型携带显式的能力元数据。 |
| `supportsOpenAIGrammarTools` | OpenAI 兼容 API 是否生成自定义 Lark/regex 语法工具。当为 `false`，受语法约束的工具回退为普通函数工具。默认值：`false`；内置模型目录为 OpenAI、OpenAI Codex、Azure OpenAI、GitHub Copilot、opencode 和 Cloudflare AI Gateway 上的 GPT-5+ 模型启用此功能。 |
| `supportsLongCacheRetention` | 当缓存保留策略为 `long` 时，提供商是否接受长期缓存保留：GPT-5.6+ Responses 模型的 `prompt_cache_options.ttl: "30m"`、早期 OpenAI 模型的 `prompt_cache_retention: "24h"`，或当 `cacheControlFormat` 为 `anthropic` 时的 `cache_control.ttl: "1h"`。默认值：`true`。 |
| `openRouterRouting` | OpenRouter 提供商路由偏好。此对象按原样发送到 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection) 的 `provider` 字段中。 |
| `vercelGatewayRouting` | Vercel AI Gateway 路由配置，用于提供商选择（`only`、`order`） |

`openrouter` 使用 `reasoning: { effort }`。`together` 使用 `reasoning: { enabled }`，并且在启用 `supportsReasoningEffort` 时还使用 `reasoning_effort`。`qwen` 使用顶层 `enable_thinking`。对于需要 `chat_template_kwargs.enable_thinking` 和 `preserve_thinking` 的本地 Qwen 兼容服务器，请使用 `qwen-chat-template`。对于需要可配置 `chat_template_kwargs` 的 vLLM/Hugging Face 聊天模板，请使用 `chat-template`，例如 DeepSeek V3.x 模板的 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。对于通过 `chat_template_args` 暴露切换控件并可选支持顶层 `reasoning_effort` 的提供商，请使用 `thinkingFormat: "baseten"` 配合 `chatTemplateArgs`。

`thinkingTokenBudgetField` 独立于 `thinkingFormat`。不要在生成的 Qwen 目录中启用它：那些模型已经发送 `reasoning_effort`，而 DashScope 拒绝将 `thinking_budget` 与 `reasoning_effort` 一起使用。

`cacheControlFormat: "anthropic"` 适用于通过文本内容上的 `cache_control` 标记暴露 Anthropic 风格提示缓存的 OpenAI 兼容提供商。

示例：

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "$OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "allow_fallbacks": true,
              "require_parameters": false,
              "data_collection": "deny",
              "zdr": true,
              "enforce_distillable_text": false,
              "order": ["anthropic", "amazon-bedrock", "google-vertex"],
              "only": ["anthropic", "amazon-bedrock"],
              "ignore": ["gmicloud", "friendli"],
              "quantizations": ["fp16", "bf16"],
              "sort": {
                "by": "price",
                "partition": "model"
              },
              "max_price": {
                "prompt": 10,
                "completion": 20
              },
              "preferred_min_throughput": {
                "p50": 100,
                "p90": 50
              },
              "preferred_max_latency": {
                "p50": 1,
                "p90": 3,
                "p99": 5
              }
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI Gateway 示例：

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "$AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5（通过 Vercel 提供的 Fireworks 模型）",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
