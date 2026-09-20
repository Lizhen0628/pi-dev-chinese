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

在交互模式中使用 `/login`，然后选择一个提供商：

- ChatGPT Plus/Pro (Codex)
- Claude Pro/Max
- GitHub Copilot
- xAI (Grok/X 订阅)
- Meta (Muse 订阅)
- OpenRouter (通过 OpenRouter 积分计费的 OAuth 铸造 API 密钥)
- Radius

使用 `/logout` 清除凭据。令牌存储在 `~/.pi/agent/auth.json` 中，过期时自动刷新。OpenRouter 则生成一个用户控制的 API 密钥，不会自动过期。

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 得到 OpenAI 官方认可：[Codex for OSS](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic 订阅认证适用于 Claude Pro/Max 账户。第三方外壳的使用将计入[额外用量](https://claude.ai/settings/usage)，按令牌计费，不计入 Claude 套餐限额。

### GitHub Copilot

- 按回车键使用github.com，或输入你的GitHub Enterprise Server域名
- 如果遇到“model not supported”提示，请在VS Code中启用：Copilot Chat → 模型选择器 → 选择模型 → “启用”

### xAI (Grok/X 订阅)

- 运行 `/login xai`，然后选择 **使用订阅**
- `XAI_API_KEY` 仍可通过 **使用 API 密钥** 获取

### Meta（Muse 订阅）

- 运行 `/login meta`，然后选择 **使用 Meta 登录** 以打开设备授权流程
- 登录会生成一个模型 API 密钥，该密钥大约每天自动重新生成一次
- 通过 **使用 API 密钥** 仍可使用 `META_API_KEY`

### OpenRouter

- 运行 `/login openrouter`，然后选择**使用 OpenRouter 登录**以打开 OpenRouter PKCE 授权流程
- 授权会创建一个由用户控制的 OpenRouter API 密钥，并从您的 OpenRouter 额度中计费
- 在远程/无头机器（例如通过 SSH）上，浏览器无法访问回环回调；请将最终的重定向 URL（或授权代码）粘贴到登录提示中
- 通过**使用 API 密钥**，`OPENROUTER_API_KEY` 仍然可用

### Radius

Radius 是一个 `pi-messages` 网关。Pi 内置了公共的 Radius 模型目录，便于即时离线查找模型，并在认证后将该目录与有效的网关目录叠加。`/login radius` 命令会将 OAuth 令牌存储在 `auth.json` 中；刷新后的目录缓存于 `models-store.json`。可以通过在 `models.json` 中声明 `"oauth": "radius"` 和网关的 `baseUrl` 来定义自定义 Radius 网关；这些网关不继承公共的 `radius.pi.dev` 目录。

## API 密钥</think>## API 密钥

### 环境变量或认证文件

在交互模式下使用 `/login` 并选择一个提供商，将 API 密钥存储在 `auth.json` 中，或通过环境变量设置凭据：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| 提供商 | 环境变量 | `auth.json` 键 |
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
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY` (+ `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`) | `cloudflare-ai-gateway` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` (+ `CLOUDFLARE_ACCOUNT_ID`) | `cloudflare-workers-ai` |
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
| Meta | `META_API_KEY` | `meta` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` | `minimax-cn` |
| Qwen Token Plan (existing catalog) | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan` |
| Qwen Token Plan (Individual) | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan-individual` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` | `qwen-token-plan-cn` |
| Xiaomi MiMo | `XIAOMI_API_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` | `xiaomi-token-plan-sgp` |

环境变量和 `auth.json` 键的参考：[`const envMap`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts) 位于 [`packages/ai/src/env-api-keys.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts)。

#### 认证文件

将凭据存储在 `~/.pi/agent/auth.json`：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "ant-ling": { "type": "api_key", "key": "..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "deepseek": { "type": "api_key", "key": "sk-..." },
  "nvidia": { "type": "api_key", "key": "nvapi-..." },
  "google": { "type": "api_key", "key": "..." },
  "opencode": { "type": "api_key", "key": "..." },
  "opencode-go": { "type": "api_key", "key": "..." },
  "together": { "type": "api_key", "key": "..." },
  "qwen-token-plan":  { "type": "api_key", "key": "sk-sp-..." },
  "qwen-token-plan-individual": { "type": "api_key", "key": "sk-sp-..." },
  "qwen-token-plan-cn": { "type": "api_key", "key": "sk-sp-..." },
  "xiaomi": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-cn":  { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-ams": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-sgp": { "type": "api_key", "key": "..." }
}
```

`qwen-token-plan-individual` 与 `qwen-token-plan` 使用相同的国际端点和 `QWEN_TOKEN_PLAN_API_KEY`，但将选择器限制为个人订阅文档中列出的模型。现有提供商保留其更广泛的目录以实现向后兼容。使用 `auth.json` 时，请将凭据存储在你选择的提供商下；环境变量由两个国际提供商共享。

该文件以 `0600` 权限创建（仅用户读写）。认证文件中的凭据优先于环境变量。

API 密钥凭据还可以包含提供商范围内的环境值。在解析凭据密钥、提供商/模型标头以及提供配置（如 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/位置、Bedrock 设置、`PI_CACHE_RETENTION` 和 `HTTP_PROXY`/`HTTPS_PROXY`）时，这些值会在进程环境变量之前使用。

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

当 pi 需要使用与项目 shell 环境不同的提供商设置时，请使用此配置。

### 凭证解析

凭证中的 `key` 和 `token` 字段支持以下解析规则：

- **命令替换：** 格式为 `!command` 或 `!(command arg1 arg2 ...)`。shell 会在环境中执行该命令，并将标准输出的第一行作为值。`!(...)` 形式支持带引号的任意 shell 命令。若命令退出码非零或未输出内容，则值无法解析。
  ```json
  { "type": "api_key", "key": "!cmd" }
  { "type": "api_key", "key": "!(uname -m)" }
  ```

- **环境变量插值：** 格式为 `$ENV_VAR` 或 `${ENV_VAR}`，使用命名变量的值。插值可在大段文本中生效。
  ```json
  { "type": "api_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "api_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` 表示变量 `FOO_BAR`；当 `BAR` 是字面文本时，使用 `${FOO}_BAR`。未设置的环境变量会导致值无法解析。
- **转义：** `"$$"` 输出一个字面量 `"$"`；`"$!"` 输出一个字面量 `"!"`，不触发命令执行。
  ```json
  { "type": "api_key", "key": "$$literal-dollar-prefix" }
  { "type": "api_key", "key": "$!literal-bang-prefix" }
  ```
- **字面值：** 直接使用。纯大写字符串（如 `MY_API_KEY`）视为字面量；如需环境变量，请使用 `$MY_API_KEY`。
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  { "type": "api_key", "key": "public" }
  ```

OAuth 凭证在执行 `/login` 后也会存储在这里，并由系统自动管理。

## 云提供商</think>## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# 也支持：https://your-resource.cognitiveservices.azure.com
# 也支持：https://your-resource.openai.azure.com
# 根端点会自动规范化为 /openai/v1
# 或者使用资源名称代替基础 URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# 可选
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

使用 `/login amazon-bedrock` 存储 Bedrock API 密钥，或配置以下任一环境 AWS 凭据来源：

```bash
# 选项 1：AWS 配置文件
export AWS_PROFILE=your-profile

# 选项 2：IAM 密钥
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# 选项 3：Bearer 令牌
export AWS_BEARER_TOKEN_BEDROCK=...

# 可选区域（默认为 us-east-1）
export AWS_REGION=us-west-2
```

还支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对于 ID 包含可识别模型名称的 Claude 模型（基础模型和系统定义的推理配置文件），提示词缓存会自动启用。对于应用程序推理配置文件（其 ARN 不包含模型名称），设置 `AWS_BEDROCK_FORCE_CACHE=1` 以启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果您连接到 Bedrock API 代理，可以使用以下环境变量：

```bash
# 设置 Bedrock 代理的 URL（标准 AWS SDK 环境变量）
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# 如果您的代理不需要身份验证，请设置此项
export AWS_BEDROCK_SKIP_AUTH=1

# 如果您的代理仅支持 HTTP/1.1，请设置此项
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI 网关

`CLOUDFLARE_API_KEY` 可通过 `/login` 设置。账户 ID 和网关标识可通过环境变量或 `auth.json` 中 API 密钥凭据的 `env` 对象进行设置。

```bash
export CLOUDFLARE_API_KEY=...           # 或使用 /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # 在 dash.cloudflare.com → AI → AI 网关 创建
pi --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

通过 Cloudflare AI 网关路由到 OpenAI、Anthropic 和 Workers AI。Workers AI 使用统一 API（`/compat`）和带前缀的模型 ID（`workers-ai/@cf/...`）。OpenAI 使用 OpenAI 透传路由（`/openai`），采用原生 OpenAI 模型 ID，如 `gpt-5.1`。Anthropic 使用 Anthropic 透传路由（`/anthropic`），采用原生 Anthropic 模型 ID，如 `claude-sonnet-4-5`。

AI 网关认证使用 `CLOUDFLARE_API_KEY` 作为 `cf-aig-authorization`。上游认证可以是以下之一：

| 模式 | 请求认证 | 上游认证 |
|------|----------|----------|
| Workers AI | 仅 Cloudflare 令牌 | Cloudflare 原生 |
| 统一计费 | 仅 Cloudflare 令牌 | Cloudflare 处理上游认证并扣除积分 |
| 存储的 BYOK | 仅 Cloudflare 令牌 | Cloudflare 注入存储在 AI 网关仪表板中的提供商密钥 |
| 内联 BYOK | Cloudflare 令牌加上上游 `Authorization` 头 | 请求提供上游提供商密钥 |

对于常规 pi 使用，建议优先选择统一计费或存储的 BYOK。内联 BYOK 需要为 Cloudflare AI 网关提供商配置额外的上游 `Authorization` 头，例如通过 `models.json` 提供商/模型覆盖进行配置。

### Cloudflare Workers AI

`CLOUDFLARE_API_KEY` 可通过 `/login` 设置。`CLOUDFLARE_ACCOUNT_ID` 可设置为环境变量，或通过 `auth.json` 中 API 密钥凭据的 `env` 对象设置。

```bash
export CLOUDFLARE_API_KEY=...           # 或使用 /login
export CLOUDFLARE_ACCOUNT_ID=...
pi --provider cloudflare-workers-ai --model "@cf/moonshotai/kimi-k2.6"
```

Pi 会自动设置 `x-session-affinity` 以享受[前缀缓存](https://developers.cloudflare.com/workers-ai/features/prompt-caching/)折扣。

### Google Vertex AI

使用应用默认凭据：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

或者将 `GOOGLE_APPLICATION_CREDENTIALS` 设置为服务账号密钥文件。

## llama.cpp

Pi 支持 llama.cpp 路由器服务器。通过 `/login llama.cpp` 进行配置，使用 `/llama` 管理已加载的模型，并使用 `/model` 选择已加载的模型。

有关服务器设置、模型目录结构、环境变量及命令用法，请参阅 [llama.cpp](/docs/llama-cpp/)。

## 自定义提供商

**通过 models.json：** 添加 Ollama、LM Studio、vLLM，或任何支持兼容 API（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的提供商。参见 [models.md](/docs/models/)。

**通过扩展：** 对于需要自定义 API 实现或 OAuth 流程的提供商，创建扩展。参见 [custom-provider.md](/docs/custom-provider/) 和 [examples/extensions/custom-provider-gitlab-duo](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/)。

## 解析顺序

为提供商解析凭据时：

1. CLI `--api-key` 标志
2. `auth.json` 条目（API 密钥或 OAuth 令牌）
3. 环境变量
4. 来自 `models.json` 的自定义提供商密钥
