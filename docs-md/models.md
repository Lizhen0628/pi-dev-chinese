# 自定义模型

通过 `~/.pi/agent/models.json` 添加自定义提供商与模型（Ollama、vLLM、LM Studio、代理网关等）。

> 本文为结构化中文编译版；完整字段示例见[英文原文](https://pi.dev/docs/latest/models)。

## 目录

- [最小示例](#最小示例)
- [完整示例](#完整示例)
- [受支持的 API](#受支持的-api)
- [提供商配置](#提供商配置)
- [模型配置](#模型配置)
- [覆盖内置提供商](#覆盖内置提供商)
- [按模型覆盖](#按模型覆盖)
- [Anthropic Messages 兼容性](#anthropic-messages-兼容性)
- [OpenAI 兼容性](#openai-兼容性)

## 最小示例

本地模型（Ollama、LM Studio、vLLM）每个模型只需 `id`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://127.0.0.1:11434/v1",
      "api": "openai-completions",
      "apiKey": "dummy",
      "models": [
        {
          "id": "qwen3-coder:30b",
          "name": "Qwen3 Coder 30B"
        }
      ]
    }
  }
}
```

`apiKey` 是占位值（Ollama 会忽略它）。但 Pi 把模型视为需要认证才出现在 `/model` 中，因此无密钥的本地服务器应保留占位值、用 `/login` 为该提供商保存一个 Key，或在选择模型时传 `--api-key`。

部分 OpenAI 兼容服务器不认识推理模型使用的 `developer` 角色。对这类提供商，设 `compat.supportsDeveloperRole` 为 `false`，Pi 会改用 `system` 消息发送系统提示；若服务器也不支持 `reasoning_effort`，再把 `compat.supportsReasoningEffort` 设为 `false`。

`compat` 可以设在提供商级（对该提供商所有模型生效），也可以设在模型级覆盖单个模型。Ollama、vLLM、SGLang 等同类 OpenAI 兼容服务器常需要这两项调整。

## 完整示例

需要特定取值时覆盖默认值。文件在你每次打开 `/model` 时重新加载——会话中编辑即可，无需重启。

Google AI Studio 也可以接入：用 `google-generative-ai` API 配 `baseUrl`，即可添加来自 Google AI Studio 的模型（包括自定义 Gemma 条目）。给 `google-generative-ai` 类型添加自定义模型时 `baseUrl` 必填。

## 受支持的 API

| API | 说明 |
|-----|------|
| `openai-completions` | OpenAI Chat Completions（兼容性最好） |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API |
| `google-generative-ai` | Google Generative AI |

`api` 可设在提供商级（全部模型的默认）或模型级（覆盖单个模型）。

## 提供商配置

| 字段 | 说明 |
|------|------|
| `baseUrl` | API 端点 URL |
| `api` | API 类型（见上表） |
| `apiKey` | 可选的 API Key 配置（见下文取值解析）。认证由 `/login`/`auth.json` 或 CLI `--api-key` 提供时省略 |
| `oauth` | 动态 OAuth 提供商类型。目前支持 `"radius"`；需网关 `baseUrl` |
| `headers` | 自定义请求头（支持同样的取值解析） |
| `authHeader` | 设 `true` 自动附加 `Authorization: Bearer <apiKey>` |
| `models` | 模型配置数组 |
| `modelOverrides` | 对该提供商上内置或扩展注册模型的按模型覆盖 |

带 `models` 的非内置提供商配置，需要在提供商级或模型级给出 `baseUrl` 和 `api`。加载文件不要求 `apiKey`：模型在通过 `/login`/`auth.json`、CLI `--api-key` 或提供商 `apiKey` 配置认证后变为可用。没有认证时模型会加载，但在 `/model` 和 `--list-models` 中不可用。

### 取值解析

`apiKey` 和 `headers` 支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 以 `"!command"` 开头时，整个值作为命令执行并取 stdout
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 取对应变量值，也可嵌入更大的字面量
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；`BAR` 是字面文本时写 `${FOO}_BAR`。变量缺失则该值未解析。
- **转义：** `"$$"` 输出字面 `"$"`；`"$!"` 输出字面 `"!"` 而不触发命令执行
- **字面量：** 直接使用。`MY_API_KEY` 这类纯大写是字面量；引用环境变量要写 `$MY_API_KEY`

对 `models.json`，shell 命令在**请求时**解析。Pi 有意不为任意命令套用内置的 TTL、过期复用或恢复逻辑——不同命令需要不同的缓存与失败策略。如果命令慢、贵、有速率限制，或希望瞬时失败时沿用上一次的值，请自行包一层实现缓存/TTL 的脚本。

`/model` 的可用性检查只看已配置的认证，不执行 shell 命令。

## 模型配置

| 字段 | 必需 | 默认 | 说明 |
|------|------|------|------|
| `id` | 是 | — | 模型标识（传给 API） |
| `name` | 否 | `id` | 人类可读名称。用于匹配（`--model` 模式）并作为次要模型信息展示 |
| `api` | 否 | 提供商的 `api` | 为该模型覆盖 API |
| `reasoning` | 否 | `false` | 支持扩展思考 |
| `thinkingLevelMap` | 否 | 省略 | 把 Pi 思考等级映射为提供商取值，并标记不支持的等级 |
| `input` | 否 | `["text"]` | 输入类型：`["text"]` 或 `["text", "image"]` |
| `contextWindow` | 否 | `128000` | 上下文窗口（token） |
| `maxTokens` | 否 | `16384` | 最大输出 token |
| `samplingParams` | 否 | 省略 | 原样合并进每个请求体的采样参数 |
| `cost` | 否 | 全零 | 每百万 token 费率，可带按请求的输入价格分层 |
| `compat` | 否 | 提供商 `compat` | 兼容性覆盖；与提供商级 `compat` 合并 |

价格分层提供一套完整的替代费率，当总输入用量（`input + cacheRead + cacheWrite`）超过 `inputTokensAbove` 时作用于整个请求。多个分层匹配时取阈值最高者。

## 覆盖内置提供商

内置提供商可以在 `models.json` 中扩展：添加模型、修改字段或整体替换。参见英文原文中的完整示例。

## 按模型覆盖

`modelOverrides` 可对内置或扩展注册的模型按 `modelId` 修改任意模型字段（如上下文窗口、价格、thinking 映射），无需重新定义整个模型。

## Anthropic Messages 兼容性

`anthropic-messages` API 类型的兼容端点（如代理）需要正确实现 messages 协议。`compat` 中的相关开关可禁用不支持的特性（如思考块、缓存控制），详见英文原文的兼容性矩阵。

## OpenAI 兼容性

`openai-completions` / `openai-responses` 的常用兼容开关：

- `compat.supportsDeveloperRole`：不支持 `developer` 角色时设 `false`
- `compat.supportsReasoningEffort`：不支持 `reasoning_effort` 时设 `false`
- 其余开关（如思考 token 预算字段、流式选项）见英文原文
