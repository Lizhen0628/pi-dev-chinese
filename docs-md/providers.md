# 提供商

Pi 通过 OAuth 支持订阅类提供商，通过环境变量或认证文件支持 API Key 类提供商。内置模型目录随 Pi 发布；已配置的提供商可以刷新更新的目录，并缓存在 `~/.pi/agent/models-store.json` 中供离线使用。

## 目录

- [订阅](#订阅)
- [API Key](#api-key)
- [认证文件](#认证文件)
- [云提供商](#云提供商)
- [llama.cpp](#llamacpp)
- [自定义提供商](#自定义提供商)
- [解析顺序](#解析顺序)

## 订阅

在交互模式中运行 `/login`，然后选择提供商：

- ChatGPT Plus/Pro（Codex）
- Claude Pro/Max
- GitHub Copilot
- xAI（Grok/X 订阅）
- OpenRouter（OAuth 签发的 API Key，从 OpenRouter 余额计费）
- Radius

用 `/logout` 清除凭据。令牌保存在 `~/.pi/agent/auth.json`，过期时自动刷新。OpenRouter 例外：它签发的是用户自管的 API Key，不会自动过期。

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 已获 OpenAI 官方认可：[Codex for OSS](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic 订阅认证对 Claude Pro/Max 账户开放。第三方外壳的用量计入[额外用量](https://claude.ai/settings/usage)，按 token 计费，不占用 Claude 套餐额度。

### GitHub Copilot

- 提示按 Enter 时选 github.com，或输入你的 GitHub Enterprise Server 域名
- 如果提示"model not supported"，在 VS Code 里启用：Copilot Chat → 模型选择器 → 选中模型 → "Enable"

### xAI（Grok/X 订阅）

- 运行 `/login xai`，然后选择 **Use a subscription**
- `XAI_API_KEY` 仍可通过 **Use an API key** 使用

### OpenRouter

- 运行 `/login openrouter`，选择 **Sign in with OpenRouter** 打开 OpenRouter PKCE 授权流程
- 授权会创建一个用户自管的 OpenRouter API Key，从你的 OpenRouter 余额计费
- 在远程/无头机器上（如通过 SSH），浏览器无法访问回环回调地址；把最终的重定向 URL（或授权码）粘贴进登录提示即可
- `OPENROUTER_API_KEY` 仍可通过 **Use an API key** 使用

### Radius

Radius 是一个动态的 `pi-messages` 网关。`/login radius` 把 OAuth 令牌存进 `auth.json`；网关目录独立刷新并缓存在 `models-store.json`。自定义 Radius 网关可在 `models.json` 中声明，使用 `"oauth": "radius"` 加网关 `baseUrl`。

## API Key

### 环境变量或认证文件

在交互模式中运行 `/login` 并选择提供商，把 API Key 存进 `auth.json`；或者用环境变量设置凭据：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| 提供商 | 环境变量 | `auth.json` 键 |
|--------|----------|----------------|
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
| ZAI Coding Plan（国际） | `ZAI_API_KEY` | `zai` |
| ZAI Coding Plan（中国） | `ZAI_CODING_CN_API_KEY` | `zai-coding-cn` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Radius | `RADIUS_API_KEY` | `radius` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Fireworks | `FIREWORKS_API_KEY` | `fireworks` |
| Together AI | `TOGETHER_API_KEY` | `together` |
| Baseten | `BASETEN_API_KEY` | `baseten` |
| Kimi For Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` | `minimax-cn` |
| Qwen Token Plan（现有目录） | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan` |
| Qwen Token Plan（个人版） | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan-individual` |
| Qwen Token Plan（中国） | `QWEN_TOKEN_PLAN_CN_API_KEY` | `qwen-token-plan-cn` |
| Xiaomi MiMo | `XIAOMI_API_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` | `xiaomi-token-plan-sgp` |

环境变量与 `auth.json` 键的权威参考：[`packages/ai/src/env-api-keys.ts`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts) 中的 [`const envMap`](https://github.com/earendil-works/pi/blob/main/packages/ai/src/env-api-keys.ts)。

#### 认证文件

把凭据存到 `~/.pi/agent/auth.json`：

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

`qwen-token-plan-individual` 与 `qwen-token-plan` 使用相同的国际端点和 `QWEN_TOKEN_PLAN_API_KEY`，只是选择器里只列出个人版订阅文档中的模型；现有提供商保留更全的目录以保持兼容。使用 `auth.json` 时，把凭据存到你选择的那个提供商键下；环境变量则是两个国际提供商共用的。

该文件以 `0600` 权限创建（仅文件主可读写）。认证文件中的凭据优先于环境变量。

API Key 凭据还可以携带提供商专属的环境变量值。解析凭据键、提供商/模型请求头以及提供商配置（如 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/区域、Bedrock 设置、`PI_CACHE_RETENTION`、`HTTP_PROXY`/`HTTPS_PROXY`）时，这些值优先于进程环境变量。

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

适用于让 Pi 使用与项目 shell 环境不同的提供商配置。

### Key 解析

`key` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 以 `"!command"` 开头时，整个值作为命令执行并取 stdout（进程生命周期内缓存）
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 取对应变量的值；也可以嵌入更大的字面量中。
  ```json
  { "type": "api_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "api_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；若 `BAR` 是字面文本，写成 `${FOO}_BAR`。环境变量缺失时该值视为未解析。
- **转义：** `"$$"` 输出字面量 `"$"`；`"$!"` 输出字面量 `"!"` 而不触发命令执行。
  ```json
  { "type": "api_key", "key": "$$literal-dollar-prefix" }
  { "type": "api_key", "key": "$!literal-bang-prefix" }
  ```
- **字面量：** 直接使用。`MY_API_KEY` 这类纯大写字符串是字面量；要引用环境变量请写 `$MY_API_KEY`。
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  { "type": "api_key", "key": "public" }
  ```

`/login` 得到的 OAuth 凭据也存在这里，并自动管理。

## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# 同样支持：https://your-resource.cognitiveservices.azure.com
# 同样支持：https://your-resource.openai.azure.com
# 根端点会自动规范化为 /openai/v1
# 也可以用资源名代替 base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# 可选
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

用 `/login amazon-bedrock` 保存 Bedrock API Key，或配置以下任意一种 AWS 凭据来源：

```bash
# 方式一：AWS Profile
export AWS_PROFILE=your-profile

# 方式二：IAM 密钥
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# 方式三：Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# 可选区域（默认 us-east-1）
export AWS_REGION=us-west-2
```

同时支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对 ID 中含可识别模型名的 Claude 模型（基础模型和系统定义的推理配置文件），提示词缓存会自动启用。对应用级推理配置文件（ARN 中不含模型名），设置 `AWS_BEDROCK_FORCE_CACHE=1` 启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果连接的是 Bedrock API 代理，可用以下环境变量：

```bash
# 设置 Bedrock 代理地址（标准 AWS SDK 环境变量）
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# 代理无需认证时设置
export AWS_BEDROCK_SKIP_AUTH=1

# 代理只支持 HTTP/1.1 时设置
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI Gateway

`CLOUDFLARE_API_KEY` 可通过 `/login` 设置。账户 ID 和网关 slug 可用环境变量设置，或写在 `auth.json` 中 API Key 凭据的 `env` 对象里。

```bash
export CLOUDFLARE_API_KEY=...           # 或用 /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # 在 dash.cloudflare.com → AI → AI Gateway 创建
pi --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

经由 Cloudflare AI Gateway 路由到 OpenAI、Anthropic 与 Workers AI。Workers AI 走统一 API（`/compat`）并使用带前缀的模型 ID（`workers-ai/@cf/...`）；OpenAI 走透传路由（`/openai`），用原生 OpenAI 模型 ID（如 `gpt-5.1`）；Anthropic 走透传路由（`/anthropic`），用原生 Anthropic 模型 ID（如 `claude-sonnet-4-5`）。

AI Gateway 认证把 `CLOUDFLARE_API_KEY` 作为 `cf-aig-authorization`。上游认证可以是以下任一模式：

| 模式 | 请求认证 | 上游认证 |
|------|----------|----------|
| Workers AI | 仅 Cloudflare 令牌 | Cloudflare 原生 |
| 统一计费 | 仅 Cloudflare 令牌 | Cloudflare 处理上游认证并扣除余额 |
| 存储式 BYOK | 仅 Cloudflare 令牌 | Cloudflare 注入存于 AI Gateway 控制台的提供商密钥 |
| 内联 BYOK | Cloudflare 令牌 + 上游 `Authorization` 头 | 请求自带上游提供商密钥 |

日常使用建议统一计费或存储式 BYOK。内联 BYOK 需要为 Cloudflare AI Gateway 提供商额外配置上游 `Authorization` 头，例如通过 `models.json` 的提供商/模型覆盖。

### Cloudflare Workers AI

`CLOUDFLARE_API_KEY` 可通过 `/login` 设置。`CLOUDFLARE_ACCOUNT_ID` 可用环境变量设置，或写在 `auth.json` 中 API Key 凭据的 `env` 对象里。

```bash
export CLOUDFLARE_API_KEY=...           # 或用 /login
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

或把 `GOOGLE_APPLICATION_CREDENTIALS` 指向服务账号密钥文件。

## llama.cpp

Pi 支持 llama.cpp 路由服务器。用 `/login llama.cpp` 配置，用 `/llama` 管理已加载模型，用 `/model` 选择模型。

服务器搭建、模型目录布局、环境变量与命令用法见 [llama.cpp](/docs/llama-cpp/)。

## 自定义提供商

**通过 models.json：** 添加 Ollama、LM Studio、vLLM，或任何讲受支持 API 协议（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的提供商。见[自定义模型](/docs/models/)。

**通过扩展：** 需要自定义 API 实现或 OAuth 流程的提供商，写一个扩展即可。见[自定义提供商](/docs/custom-provider/)。

## 解析顺序

解析某个提供商的凭据时，顺序为：

1. CLI `--api-key` 参数
2. `auth.json` 条目（API Key 或 OAuth 令牌）
3. 环境变量
4. `models.json` 中的自定义提供商密钥
