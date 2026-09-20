# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义提供商和模型（Ollama、vLLM、LM Studio、代理）。

## 目录

- [最小示例](#minimal-example)
- [完整示例](#full-example)
- [支持的API](#supported-apis)
- [提供商配置](#provider-configuration)
- [模型配置](#model-configuration)
- [提示词缓存生命周期](#prompt-cache-lifetimes)
- [覆盖内置提供商](#overriding-built-in-providers)
- [按模型覆盖](#per-model-overrides)
- [Anthropic消息兼容性](#anthropic-messages-compatibility)
- [OpenAI兼容性](#openai-compatibility)

## 最小示例

对于本地模型（Ollama、LM Studio、vLLM），每个模型只需 `id` 字段：

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

`apiKey` 值是一个占位符，因为 Ollama 会忽略它。pi 在模型出现在 `/model` 中之前仍将其视为需要认证，因此无密钥的本地服务器应保留一个虚拟值，使用 `/login` 为该提供商保存密钥，或在选择模型时传入 `--api-key`。

某些兼容 OpenAI 的服务器无法理解用于具备推理能力模型的 `developer` 角色。对于这些提供商，请将 `compat.supportsDeveloperRole` 设为 `false`，这样 pi 会将系统提示词以 `system` 消息的形式发送。如果服务器也不支持 `reasoning_effort`，请同时将 `compat.supportsReasoningEffort` 设为 `false`。

你可以在提供商级别设置 `compat` 以应用于所有模型，也可以在模型级别设置以覆盖特定模型。这通常适用于 Ollama、vLLM、SGLang 及类似的兼容 OpenAI 的服务器。

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

在需要特定值时覆盖默认设置：

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

每次打开 `/model` 时文件都会重新加载。在会话期间编辑即可，无需重启。

## Google AI Studio 示例

使用 `google-generative-ai` 配合 `baseUrl`，即可添加来自 Google AI Studio 的模型，包括自定义 Gemma 4 条目：

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

向 `google-generative-ai` API 类型添加自定义模型时，`baseUrl` 为必填项。

## 支持的 API

| API | 描述 |
|-----|------|
| `openai-completions` | OpenAI 聊天补全（兼容性最佳） |
| `openai-responses` | OpenAI 响应 API |
| `anthropic-messages` | Anthropic 消息 API |
| `google-generative-ai` | Google 生成式 AI |

在提供商级别（默认应用于所有模型）或模型级别（按模型覆盖）设置 `api`。

## 提供商配置

| 字段 | 描述 |
|------|------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上文） |
| `apiKey` | 可选的 API 密钥配置（见下方的值解析）。当认证由 `/login`/`auth.json` 或 CLI `--api-key` 提供时，可省略此项。 |
| `oauth` | 动态 OAuth 提供商类型。目前支持 `"radius"`；需要网关 `baseUrl`。 |
| `headers` | 自定义请求头（见下方的值解析） |
| `authHeader` | 设置为 `true` 可自动添加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 针对该提供商上内置或扩展注册模型的逐模型覆盖设置 |

对于包含 `models` 的提供商，非内置提供商配置需要在提供商或模型级别提供 `baseUrl` 和 `api` 值。加载文件时并不是必需的：当通过 `/login`/`auth.json`、CLI `--api-key` 或提供商的 `apiKey` 配置认证后，模型即可使用。若未配置认证，模型虽会加载，但在 `/model` 和 `--list-models` 中仍不可用。

### 值解析

`apiKey` 和 `headers` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 以 `"!command"` 开头的值会作为命令执行，并使用其标准输出
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用命名变量的值。插值可在较大的字面量内部使用。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；当 `BAR` 是字面文本时，使用 `${FOO}_BAR`。缺失的环境变量会导致值无法解析。
- **转义：** `"$$"` 输出字面量 `"$"`；`"$!"` 输出字面量 `"!"`，不触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **字面量值：** 直接使用。纯大写字符串如 `MY_API_KEY` 是字面量；环境变量请使用 `$MY_API_KEY`。
  ```json
  "apiKey": "sk-..."
  ```

对于 `models.json`，shell 命令在请求时解析。pi 有意不对任意命令应用内置 TTL、过期复用或恢复逻辑。不同命令需要不同的缓存和失败策略，pi 无法推断出正确的策略。

如果您的命令较慢、昂贵、受速率限制，或希望在临时故障时继续使用先前的值，请将其包装在您自己的脚本或命令中，以实现所需的缓存或 TTL 行为。

`/model` 可用性检查使用配置的认证存在性，不执行 shell 命令。

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

| 字段 | 必填 | 默认值 | 描述 |
|-------|----------|---------|-------------|
| `id` | 是 | — | 模型标识符（传递给 API） |
| `name` | 否 | `id` | 人类可读的模型标签。用于匹配（`--model` 模式），并作为次要模型详情文本显示。 |
| `api` | 否 | 提供商的 `api` | 覆盖此模型的提供商 API |
| `reasoning` | 否 | `false` | 支持扩展思考 |
| `thinkingLevelMap` | 否 | 省略 | 将 pi 思考级别映射到提供商值，并标记不支持的级别（见下文） |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `inputLimits` | 否 | 省略 | 此模型的请求限制和图像预处理（见下文） |
| `contextWindow` | 否 | `128000` | 上下文窗口大小（以 token 计） |
| `maxTokens` | 否 | `16384` | 最大输出 token 数 |
| `samplingParams` | 否 | 省略 | 逐字合并到每个请求体中的采样参数（见下文） |
| `cost` | 否 | 全零 | 每百万 token 费率，可选请求级输入定价层级 |
| `promptCache` | 否 | 省略 | 尽力而为的提示词缓存生命周期（秒），按保留层级划分（见下文） |
| `compat` | 否 | 提供商 `compat` | 提供商兼容性覆盖。当两者都设置时，与提供商级 `compat` 合并。 |

成本层级提供一套完整的替代费率，当总输入用量（`input + cacheRead + cacheWrite`）超过 `inputTokensAbove` 时，适用于整个请求。当多个层级匹配时，以最高阈值为准。

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
- `/model`、`--list-models` 和交互式页脚按模型 `id` 显示条目。
- 配置的 `name` 用于模型匹配和次要模型详情文本。它不会替换页脚/状态栏中的模型 id。

### 图像输入限制

使用 `inputLimits.images.resize` 配置新图像在进入会话历史前的编码方式：

```json
{
  "id": "vision-model",
  "input": ["text", "image"],
  "inputLimits": {
    "images": {
      "resize": {
        "maxWidth": 1568,
        "maxHeight": 1568,
        "maxBytes": 524288,
        "jpegQuality": 75
      }
    }
  }
}
```

`maxBytes` 是最大 base64 编码的载荷大小。未指定的缩放字段使用 pi 的保守默认值：2000×2000，编码后 4.5 MiB，JPEG 质量 80。内置视觉模型明确携带该配置文件，以便未知网关永远不会收到比以前更大的图像。

Pi 将所选模型的缩放配置文件应用于 `@file` 附件、`read` 工具以及工具返回的图像。图像在进入历史前编码一次；更改模型不会重写历史图像或使缓存的会话前缀失效。`images.autoResize` 设置可以全局禁用缩放。

目录还可以记录 `inputLimits.maxRequestBytes`、`images.maxPerMessage` 和 `images.maxPerRequest`。这些字段描述硬性的提供商限制；当前实现尚不会基于这些字段重写或拒绝会话历史。

### 提示词缓存生命周期

`promptCache` 规定了提供商为每个保留层级保留提示词缓存条目的时间，pi 可请求这些层级（`short` 为默认层级；当 `PI_CACHE_RETENTION=long` 时使用 `long`）。数值以秒为单位，且为估算值：提供商公布的是范围，因此请选择保守的一端。

```json
{
  "id": "claude-sonnet-5",
  "promptCache": { "short": 300, "long": 3600 }
}
```

内置目录为直接 Anthropic 提供商填写此值（5 分钟 / 1 小时）。其他提供商，包括直接 OpenAI，在缓存过期和重放行为经过预热验证之前，没有内置生命周期。对于请求所用层级没有数值的模型，永远不会被预热；当底层缓存行为已知时，自定义模型和提供商覆盖可以主动选择启用。参见 [缓存预热](settings.md#cache-warming)。

### 采样参数

`samplingParams` 是一个自由格式对象，会逐字合并到每个模型的请求体中，位于 pi 自身设置的字段之后，因此其键值优先。用它来发送 pi 未建模的采样参数——包括服务器特定的参数，如 llama.cpp 的 `min_p` 或 vLLM 的 `top_k`：

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

仅兼容 OpenAI 的 API 会应用它（`openai-completions`、`openai-responses`、`azure-openai-responses`）；其他 API 会忽略它。键值会覆盖 pi 的命名请求字段（例如，这里的 `temperature` 键会覆盖请求级别的温度），因此建议将其作为模型采样配置的唯一来源。在 `modelOverrides` 中，`samplingParams` 会按键与基础模型的值合并。

此处也可以设置固定的思考令牌上限，但它不会遵循 `thinkingBudgets`，也不会为答案预留空间。对于该需求，建议使用 `compat.thinkingTokenBudgetField`（或 `supportsThinkingTokenBudget` 别名）。

### 思考级别映射

在模型上使用 `thinkingLevelMap` 来描述特定于模型的思考控制。键是 pi 思考级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。映射可以包含空洞；例如，一个模型可以暴露 `high` 和 `max` 而不暴露 `xhigh`。

值为三态：

| 值 | 含义 |
|-------|---------|
| 省略 | 标准级别（至 `high`）使用提供商的默认映射；扩展的 `xhigh` 和 `max` 级别不受支持 |
| 字符串 | 该级别受支持，此值将发送给提供商 |
| `null` | 该级别不受支持，并被隐藏/跳过/钳制掉 |

示例：一个仅支持 off、high 和 max 推理的模型：

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

示例：一个无法禁用思考的模型：

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

迁移：旧配置中使用的 `compat.reasoningEffortMap` 应将该映射移至模型级别的 `thinkingLevelMap`。对于不应出现在 UI 中的级别，使用 `null`。

## 覆盖内置提供商

通过代理路由内置提供商，无需重新定义模型：

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
- 内置模型被保留。
- 自定义模型按 `id` 在提供商内进行更新或插入。
- 如果自定义模型的 `id` 与内置模型的 `id` 匹配，则自定义模型将替换该内置模型。
- 如果自定义模型的 `id` 是新的，则将其与内置模型一起添加。

## 按模型覆盖

使用 `modelOverrides` 来自定义内置模型和匹配的扩展注册模型，而无需替换提供商的完整模型列表。

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

`modelOverrides` 按模型支持以下字段：`name`、`reasoning`、`thinkingLevelMap`、`input`、`inputLimits`（深度合并）、`cost`（部分）、`promptCache`（按层级合并）、`contextWindow`、`maxTokens`、`samplingParams`（按键合并）、`headers`、`compat`。

使用 `promptCache` 覆盖来启用缓存预热，通过一个已知后备缓存的代理，例如路由到 Anthropic 的 OpenRouter：

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "promptCache": { "short": 300 }
        }
      }
    }
  }
}
```

直接 OpenAI GPT-5.6 Sol、Terra 和 Luna 默认使用 `272000` 上下文窗口，以便请求保持在 OpenAI 的短上下文定价层级内。要选择使用 OpenAI 的 1.05M 上下文窗口，请为你使用的每个模型增加该值：

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

覆盖保留内置定价元数据。输入 token 总数超过 272K 的请求将使用 GPT-5.6 的长期上下文费率计算整个请求。如有需要，请对 `gpt-5.6-terra` 或 `gpt-5.6-luna` 应用相同的覆盖。

行为说明：
- `modelOverrides` 应用于内置提供商模型和匹配的扩展注册提供商模型。
- 未知模型 ID 将被忽略。
- 你可以将提供商级别的 `baseUrl`/`headers` 与 `modelOverrides` 结合使用。
- 覆盖 `name` 仅更改模型匹配和次要详细信息文本；页脚和主要模型列表继续显示模型 `id`。
- 如果为提供商定义了 `models`，自定义模型将在内置覆盖后合并。具有相同 `id` 的自定义模型将替换被覆盖的内置模型条目。

## Anthropic Messages 兼容性

对于使用 `api: "anthropic-messages"` 的提供商或代理，可使用 `compat` 来控制 Anthropic 特定的请求兼容性。

默认情况下，pi 会为每个工具发送 `eager_input_streaming: true`。如果代理或兼容 Anthropic 的后端拒绝该字段，请将 `supportsEagerToolInputStreaming` 设置为 `false`。pi 将省略 `tools[].eager_input_streaming`，并在启用工具请求时发送旧的 `fine-grained-tool-streaming-2025-05-14` 测试版标头。

某些 Anthropic 模型需要自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），而不是旧的基于预算的思考载荷。内置模型会自动设置此项。对于路由到这些模型的自定义提供商或别名，请将 `forceAdaptiveThinking` 设置为 `true`。

支持按轮次调整思考力度的 Claude 模型使用 `supportsMidConvoEffort`。pi 随后会持久化每次响应的提供商思考力度，在后续请求中重建仅含思考的系统消息，并发送带有 `prefix_mismatch_behavior: "drop_block"` 的思考绑定控制，以避免过期的签名思考前缀导致持续 400 响应。仅对在忠实 Anthropic Messages 传输上的精确支持的 Claude 模型设置此项；不要为仅模仿 Messages 形状的 API 启用它。

某些兼容 Anthropic 的提供商会发出带有空签名的思考块，并且仍然期望在重放时保留它们。仅对这些提供商将 `allowEmptySignature` 设置为 `true`；真正的 Anthropic 会拒绝空思考签名。

内置 Anthropic 模型在其模型元数据中启用了 `supportsStrictTools`。自定义兼容 Anthropic 的模型在其端点接受严格的 JSON 模式工具定义时，必须将其设置为 `true`。

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
| `supportsEagerToolInputStreaming` | 提供商是否接受每个工具的 `eager_input_streaming`。默认值：`true`。设置为 `false` 可省略该字段，并在启用工具的请求中使用旧的细粒度工具流式传输测试版标头。 |
| `supportsLongCacheRetention` | 当缓存保留为 `long` 时，提供商是否接受 Anthropic 长缓存保留（`cache_control.ttl: "1h"`）。默认值：`true`。 |
| `sendSessionAffinityHeaders` | 启用缓存时，是否从会话 ID 发送 `x-session-affinity`。默认值：对已知提供商自动检测。 |
| `supportsCacheControlOnTools` | 提供商是否接受工具定义上的 Anthropic 风格 `cache_control` 标记。默认值：`true`。 |
| `forceAdaptiveThinking` | 是否为此模型发送自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`）。内置自适应模型会自动设置此项。默认值：`false`。 |
| `supportsMidConvoEffort` | 精确的 Claude 模型传输是否支持按轮次调整思考力度的系统消息和思考绑定控制。启用后，pi 会持久化原生思考力度级别，并始终发送 `drop_block`。默认值：`false`。 |
| `allowEmptySignature` | 是否将空思考签名重放为 `signature: ""`，而不是将思考转换为文本。默认值：`false`。 |
| `supportsStrictTools` | 提供商是否接受严格的 JSON 模式工具定义。默认值：`false`；内置 Anthropic 模型在生成的元数据中会启用它。 |
| `allowedFallbackModels` | 最多三个服务端回退模型，每个都有 `provider`、`model` 和完整的 `cost` 元数据。空数组可禁用回退。 |

## OpenAI 兼容性

对于部分兼容 OpenAI 的提供商，请使用 `compat` 字段。

- 提供商级别的 `compat` 将该提供商下的所有模型应用默认值。
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
| `supportsDeveloperRole` | 使用 `developer` 角色而非 `system` 角色 |
| `supportsReasoningEffort` | 支持 `reasoning_effort` 参数 |
| `supportsUsageInStreaming` | 支持 `stream_options: { include_usage: true }`（默认值：`true`） |
| `supportsFinishReason` | 流式响应是否包含 `finish_reason`。当为 `false` 时，pi 在流结束时推断为 `stop` 或 `toolUse`。默认值：`true`。 |
| `maxTokensField` | 使用 `max_completion_tokens` 或 `max_tokens` |
| `requiresToolResultName` | 在工具结果消息中包含 `name` |
| `requiresAssistantAfterToolResult` | 在工具结果之后、用户消息之前插入一条助手消息 |
| `requiresThinkingAsText` | 将思考块转换为纯文本 |
| `requiresReasoningContentOnAssistantMessages` | 启用推理时，在所有重放的助手消息中包含空的 `reasoning_content` |
| `thinkingFormat` | 使用 `reasoning_effort`、`openrouter`、`deepseek`、`together`、`baseten`、`zai`、`qwen`、`chat-template` 或 `qwen-chat-template` 思考参数 |
| `chatTemplateKwargs` | `thinkingFormat: "chat-template"` 的 `chat_template_kwargs` 值；使用 `{ "$var": "thinking.enabled" }`、`{ "$var": "thinking.effort" }` 或 `{ "$var": "thinking.budget" }` 获取 pi 控制的思考值 |
| `chatTemplateArgs` | `thinkingFormat: "baseten"` 的 `chat_template_args` 值；使用 `{ "$var": "thinking.enabled" }`、`{ "$var": "thinking.effort" }` 或 `{ "$var": "thinking.budget" }` 获取 pi 控制的思考值 |
| `thinkingTokenBudgetField` | 用于限制 `thinkingBudgets` 中推理令牌数的顶层请求字段，会被限制以确保至少保留 1024 个令牌用于回答。`"thinking_token_budget"`（vLLM）、`"thinking_budget"`（Qwen/DashScope/SGLang）、`"thinking_budget_tokens"`（llama.cpp）。默认关闭；不会设置在生成的目录中。 |
| `supportsThinkingTokenBudget` | `thinkingTokenBudgetField: "thinking_token_budget"`（vLLM）的别名。建议优先使用 `thinkingTokenBudgetField`。默认值：`false`。 |
| `cacheControlFormat` | 在系统提示词、最后一个工具定义以及最后一条用户、助手或工具结果文本内容上使用 Anthropic 风格的 `cache_control` 标记。目前仅支持 `anthropic`。 |
| `sendSessionAffinityHeaders` | 对于 `openai-completions`，在启用缓存时从会话 ID 发送会话亲和性标头。默认值：`false`。 |
| `sessionAffinityFormat` | 对于 `openai-completions` 和 `openai-responses`，会话亲和性标头格式：`openai` 发送 `session_id`/`x-client-request-id`（completions 还发送 `x-session-affinity`），`openai-nosession` 省略包含下划线的 `session_id` 标头，`openrouter` 发送 `x-session-id`。不影响 `prompt_cache_key` 主体参数。默认值：自动检测。 |
| `supportsStrictMode` | 提供商是否接受严格的 JSON-schema 函数工具定义。默认值取决于 API；内置 OpenAI 模型带有显式能力元数据。 |
| `supportsOpenAIGrammarTools` | OpenAI 兼容 API 是否发出自定义 Lark/regex 语法工具。当为 `false` 时，受语法约束的工具回退到普通函数工具。默认值：`false`；内置模型目录为 OpenAI、OpenAI Codex、Azure OpenAI、GitHub Copilot、opencode 和 Cloudflare AI Gateway 上的 GPT-5+ 模型启用此功能。 |
| `supportsLongCacheRetention` | 当缓存保留期为 `long` 时，提供商是否接受长缓存保留：GPT-5.6+ Responses 模型的 `prompt_cache_options.ttl: "30m"`、早期 OpenAI 模型的 `prompt_cache_retention: "24h"`，或当 `cacheControlFormat` 为 `anthropic` 时的 `cache_control.ttl: "1h"`。默认值：`true`。 |
| `openRouterRouting` | OpenRouter 提供商路由偏好。此对象按原样发送在 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection) 的 `provider` 字段中。 |
| `vercelGatewayRouting` | Vercel AI Gateway 路由配置，用于提供商选择（`only`、`order`） |

`openrouter` 使用 `reasoning: { effort }`。`together` 使用 `reasoning: { enabled }`，并在启用 `supportsReasoningEffort` 时同时使用 `reasoning_effort`。`qwen` 使用顶层 `enable_thinking`。对于需要 `chat_template_kwargs.enable_thinking` 和 `preserve_thinking` 的本地 Qwen 兼容服务器，请使用 `qwen-chat-template`。对于需要可配置 `chat_template_kwargs` 的 vLLM/Hugging Face 聊天模板，请使用 `chat-template`，例如 DeepSeek V3.x 模板的 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。对于通过 `chat_template_args` 暴露切换控件并可选支持顶层 `reasoning_effort` 的提供商，请使用 `thinkingFormat: "baseten"` 配合 `chatTemplateArgs`。

`thinkingTokenBudgetField` 独立于 `thinkingFormat`。不要在生成的 Qwen 目录中启用它：这些模型已经发送 `reasoning_effort`，而 DashScope 会拒绝同时使用 `thinking_budget` 和 `reasoning_effort`。

`cacheControlFormat: "anthropic"` 适用于通过文本内容和工具定义上的 `cache_control` 标记暴露 Anthropic 风格提示缓存的 OpenAI 兼容提供商。

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
          "name": "Kimi K2.5 (Fireworks via Vercel)",
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
