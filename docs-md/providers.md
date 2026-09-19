# 提供商

Pi 通过 OAuth 支持基于订阅的提供商，并通过环境变量或认证文件支持 API 密钥提供商。内置目录随 Pi 一同发布；配置的提供商可刷新更新的目录，并将其缓存于 `~/.pi/agent/models-store.json` 以供离线使用。

## 目录

- [订阅](#subscriptions)
- [API 密钥](#api-keys)
- [认证文件](#auth-file)
- [云提供商](#cloud-providers)
- [llama.cpp](#llamacpp)
- [自定义提供商](#custom-providers)
- [解析顺序](#resolution-order)

## 订阅

在交互模式中使用 `/login` 命令，然后选择提供商：

- ChatGPT Plus/Pro (Codex)
- Claude Pro/Max
- GitHub Copilot
- xAI (Grok/X 订阅)
- OpenRouter（通过 OAuth 生成的 API 密钥，费用从 OpenRouter 积分中扣除）
- Radius

使用 `/logout` 命令清除凭证。令牌存储在 `~/.pi/agent/auth.json` 中，并在过期时自动刷新。OpenRouter 则会生成一个由用户控制的 API 密钥，该密钥不会自动过期。

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 获得 OpenAI 官方认可：[面向开源软件的 Codex](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic 订阅认证对 Claude Pro/Max 账户有效。第三方外壳的使用将计入[额外用量](https://claude.ai/settings/usage)，并按 token 计费，不属于 Claude 套餐限制范围。

### GitHub Copilot

- 按 Enter 键访问 github.com，或输入您的 GitHub Enterprise Server 域名
- 如果您遇到“模型不受支持”的提示，请在 VS Code 中启用它：Copilot Chat → 模型选择器 → 选择模型 → “启用”

### xAI (Grok/X 订阅)

- 运行 `/login xai`，然后选择 **使用订阅**
- `XAI_API_KEY` 仍可通过 **使用 API 密钥** 获取

### OpenRouter

- 运行 `/login openrouter`，然后选择**使用 OpenRouter 登录**，以打开 OpenRouter PKCE 授权流程
- 授权会创建一个由用户控制的 OpenRouter API 密钥，费用从你的 OpenRouter 积分中扣除
- 在远程/无头机器（例如通过 SSH）上，浏览器无法访问回环回调；请将最终的跳转 URL（或授权代码）粘贴到登录提示中
- 通过**使用 API 密钥**，`OPENROUTER_API_KEY` 仍然可用

### Radius

Radius 是 `pi-messages` 网关。Pi 自带公共 Radius 模型目录，支持即时且离线进行模型查找，并在认证后以有效网关目录覆盖之。通过 `/login radius` 命令将 OAuth 令牌存储于 `auth.json`；刷新后的目录缓存于 `models-store.json`。自定义 Radius 网关可在 `models.json` 中以 `"oauth": "radius"` 及网关 `baseUrl` 进行声明；它们不继承公共的 `radius.pi.dev` 目录。

## API 密钥

### 环境变量或认证文件

在交互模式下使用 `/login` 并选择一个提供商，将 API 密钥存储到 `auth.json` 中，或者通过环境变量设置凭据：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| 提供商 | 环境变量 | `auth.json` 键名 |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| Ant Ling | `ANT_LING_API_KEY` | `ant-ling` |
| Azure OpenAI Responses | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek` |
| NVIDIA NIM | `NVIDIA_API_KEY` | `nvidia` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` | `amazon-bedrock` |
| Mistral | `MISTRAL_API_KEY` | `mistral` |
| Groq | `GROQ_API_KEY` | `groq` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY`（另需 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_GATEWAY_ID`） | `cloudflare-ai-gateway` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY`（另需 `CLOUDFLARE_ACCOUNT_ID`） | `cloudflare-workers-ai` |
| xAI | `XAI_API_KEY` | `xai` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| ZAI Coding Plan (Global) | `ZAI_API_KEY` | `zai` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_API_KEY` | `zai-coding-cn` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Radius | `RADIUS_API_KEY` | `radius` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Fireworks | `FIREWORKS_API_KEY` | `fireworks` |
| Together AI | `TOGETHER_API_KEY` | `together` |
| Baseten | `BASETEN_API_KEY` | `baseten` |
| Kimi For Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` | `minimax-cn` |
| Qwen Token Plan (existing catalog) | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan` |
| Qwen Token Plan (Individual) | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan-individual` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` | `qwen-token-plan-cn` |
| Xiaomi MiMo | `XIAOMI_API_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` | `xiaomi-token-plan-sgp` |

环境变量和 `auth.json` 键名的参考：位于 [`packages/ai/src/env-api-keys.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts) 中的 [`const envMap`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts)。

# 认证文件配置

pi 支持通过 JSON 文件（默认路径为 `~/.pi/auth.json`）存储认证凭据。此文件用于存储 API 密钥和其他敏感配置。

文件格式为 JSON，每个提供商对应一个条目。以下为示例：

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "sk-ant-..."
  },
  "openai": {
    "type": "api_key",
    "key": "sk-..."
  },
  "deepseek": {
    "type": "api_key",
    "key": "sk-..."
  },
  "nvidia": {
    "type": "api_key",
    "key": "nvapi-..."
  },
  "google": {
    "type": "api_key",
    "key": "..."
  },
  "opencode": {
    "type": "api_key",
    "key": "..."
  },
  "opencode-go": {
    "type": "api_key",
    "key": "..."
  },
  "together": {
    "type": "api_key",
    "key": "..."
  },
  "qwen-token-plan": {
    "type": "api_key",
    "key": "sk-sp-..."
  },
  "qwen-token-plan-individual": {
    "type": "api_key",
    "key": "sk-sp-..."
  },
  "qwen-token-plan-cn": {
    "type": "api_key",
    "key": "sk-sp-..."
  },
  "xiaomi": {
    "type": "api_key",
    "key": "..."
  },
  "xiaomi-token-plan-cn": {
    "type": "api_key",
    "key": "..."
  },
  "xiaomi-token-plan-ams": {
    "type": "api_key",
    "key": "..."
  },
  "xiaomi-token-plan-sgp": {
    "type": "api_key",
    "key": "..."
  }
}
```

`qwen-token-plan-individual` 使用与 `qwen-token-plan` 相同的国际端点和 `QWEN_TOKEN_PLAN_API_KEY`，但将选择器限制为个人订阅所记录的模型。现有提供商保留其更广泛的目录以实现向后兼容。使用 `auth.json` 时，将凭据存储在你选择的提供商下；环境变量由两个国际提供商共享。

该文件以 `0600` 权限（仅用户可读写）创建。认证文件的凭据优先于环境变量。

API 密钥凭据还可以包含提供商范围的环境变量值。在解析凭据密钥、提供商/模型标头以及提供商配置（如 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/位置、Bedrock 设置、`PI_CACHE_RETENTION` 和 `HTTP_PROXY`/`HTTPS_PROXY`）时，这些值优先于进程环境变量。

```json
{
  "cloudflare-ai-gateway": {
    "type": "api_key",
    "key": "$CLOUDFLARE_API_KEY",
    "env": {
      "CLOUDFLARE_API_KEY": "...",
      "CLOUDFLARE_ACCOUNT_ID": "account-id",
      "CLOUDFLARE_GATEWAY_ID": "gateway-id"
    }
  }
}
```

当 pi 需要使用与项目外壳环境不同的提供商设置时，使用此配置。
```

### 关键解析

`key` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 开头的 `"!command"` 会将整个值作为命令执行，并使用标准输出（在进程生命周期内缓存）
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用指定变量的值。插值也适用于更大的字面量中。
  ```json
  { "type": "api_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "api_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` 指的是变量 `FOO_BAR`；当 `BAR` 是字面文本时，请使用 `${FOO}_BAR`。缺失的环境变量会导致值无法解析。
- **转义：** `"$$"` 输出字面量的 `"$"`；`"$!"` 输出字面量的 `"!"`，不会触发命令执行。
  ```json
  { "type": "api_key", "key": "$$literal-dollar-prefix" }
  { "type": "api_key", "key": "$!literal-bang-prefix" }
  ```
- **字面量值：** 直接使用。普通的全大写字符串如 `MY_API_KEY` 被视为字面量；如需使用环境变量，请使用 `$MY_API_KEY`。
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  { "type": "api_key", "key": "public" }
  ```

OAuth 凭据在 `/login` 后也会存储于此，并自动管理。

## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# 也支持：https://your-resource.cognitiveservices.azure.com
# 也支持：https://your-resource.openai.azure.com
# 根端点自动规范化为 /openai/v1
# 或使用资源名称代替基础 URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# 可选
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

使用 `/login amazon-bedrock` 命令存储 Bedrock API 密钥，或配置以下任一 AWS 环境凭据源：

```bash
# 选项 1：AWS Profile
export AWS_PROFILE=your-profile

# 选项 2：IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# 选项 3：Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# 可选区域（默认为 us-east-1）
export AWS_REGION=us-west-2
```

同样支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对于 ID 中包含可识别模型名称的 Claude 模型（基础模型和系统定义的推理配置文件），自动启用提示词缓存。对于应用推理配置文件（其 ARN 不包含模型名称），设置 `AWS_BEDROCK_FORCE_CACHE=1` 以启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果你要连接到 Bedrock API 代理，可以使用以下环境变量：

```bash
# 设置 Bedrock 代理的 URL（标准 AWS SDK 环境变量）
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# 如果你的代理不需要身份验证，请设置此项
export AWS_BEDROCK_SKIP_AUTH=1

# 如果你的代理仅支持 HTTP/1.1，请设置此项
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI Gateway

`CLOUDFLARE_API_KEY` 可以通过 `/login` 设置。账户 ID 和网关 slug 可以设置为环境变量，或设置在 `auth.json` 中 API 密钥凭据的 `env` 对象中。

```bash
export CLOUDFLARE_API_KEY=...           # 或使用 /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # 在 dash.cloudflare.com → AI → AI Gateway 创建
pi --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

通过 Cloudflare AI Gateway 路由到 OpenAI、Anthropic 和 Workers AI。Workers AI 使用统一 API（`/compat`）和带前缀的模型 ID（`workers-ai/@cf/...`）。OpenAI 使用 OpenAI 直通路由（`/openai`），支持原生 OpenAI 模型 ID，如 `gpt-5.1`。Anthropic 使用 Anthropic 直通路由（`/anthropic`），支持原生 Anthropic 模型 ID，如 `claude-sonnet-4-5`。

AI Gateway 认证使用 `CLOUDFLARE_API_KEY` 作为 `cf-aig-authorization`。上游认证可以是以下之一：

| 模式 | 请求认证 | 上游认证 |
|------|--------------|---------------|
| Workers AI | 仅 Cloudflare 令牌 | Cloudflare 原生 |
| 统一计费 | 仅 Cloudflare 令牌 | Cloudflare 处理上游认证并扣除积分 |
| 存储的 BYOK | 仅 Cloudflare 令牌 | Cloudflare 注入 AI Gateway 仪表板中存储的提供商密钥 |
| 内联 BYOK | Cloudflare 令牌加上上游 `Authorization` 头 | 请求提供上游提供商密钥 |

对于正常的 pi 使用，建议使用统一计费或存储的 BYOK。内联 BYOK 需要为 Cloudflare AI Gateway 提供商配置额外的上游 `Authorization` 头，例如通过 `models.json` 提供商/模型覆盖。

### Cloudflare Workers AI

`CLOUDFLARE_API_KEY` 可通过 `/login` 设置。`CLOUDFLARE_ACCOUNT_ID` 可设置为环境变量，或设置在 `auth.json` 中 API 密钥凭据的 `env` 对象内。

```bash
export CLOUDFLARE_API_KEY=...           # 或使用 /login
export CLOUDFLARE_ACCOUNT_ID=...
pi --provider cloudflare-workers-ai --model "@cf/moonshotai/kimi-k2.6"
```

Pi 会自动为 [前缀缓存](https://developers.cloudflare.com/workers-ai/features/prompt-caching/) 折扣设置 `x-session-affinity`。

### Google Vertex AI

使用应用默认凭据：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

或者，将 `GOOGLE_APPLICATION_CREDENTIALS` 设置为服务账号密钥文件的路径。

## llama.cpp

Pi 支持 llama.cpp 路由服务器。使用 `/login llama.cpp` 配置它，使用 `/llama` 管理已加载的模型，并使用 `/model` 选择已加载的模型。

参见 [llama.cpp](/docs/llama-cpp/) 了解服务器设置、模型目录布局、环境变量和命令用法。

## 自定义提供商

**通过 models.json：** 添加 Ollama、LM Studio、vLLM，或任何支持兼容 API（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的提供商。参见 [models.md](/docs/models/)。

**通过扩展：** 对于需要自定义 API 实现或 OAuth 流程的提供商，可创建扩展。参见 [custom-provider.md](/docs/custom-provider/) 和 [examples/extensions/custom-provider-gitlab-duo](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/)。

## 解析顺序

为提供商解析凭证时，按以下顺序：

1. 命令行界面 `--api-key` 标志
2. `auth.json` 条目（API 密钥或 OAuth 令牌）
3. 环境变量
4. 来自 `models.json` 的自定义提供商密钥
