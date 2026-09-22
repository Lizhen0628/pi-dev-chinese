# 提供商认证

大多数托管提供商支持以下一种或两种认证方法：

- 通过由 OAuth 支持的浏览器或设备流程登录。
- 提供 API 密钥。

使用 `/login [provider]` 查看提供商支持的方法。Amazon Bedrock 和 Google Vertex AI 也可以使用环境云凭证。

## 交互式认证

运行 `/login` 并选择一个提供商。Pi 会引导你完成其 OAuth 或 API 密钥流程，并将生成的凭据保存到 [`auth.json`](configuration.md#agent-directory) 中。

在远程或无头机器上，OAuth 回调可能无法到达本地进程。当提示时，将最终的重定向 URL 或授权码粘贴回 Pi。

运行 `/logout` 并选择一个提供商以移除其存储的凭据。这不会取消设置环境变量、从 `models.json` 中移除认证，也不会在提供商处撤销该凭据。

`auth.json` 可能包含 API 密钥和 OAuth 令牌。请保持其私密，不要将其提交到版本控制。

Radius 认证使用其网关目录，并缓存刷新后的模型元数据以供后续离线启动。在 `models.json` 中配置的自定义 Radius 网关使用其自己的目录，而非继承公共的 `radius.pi.dev` 目录。

## 从环境变量使用 API 密钥

环境变量在 CI 以及任何不应让 Pi 存储密钥的场景中非常有用。在启动 Pi 之前设置变量：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

此表格涵盖具有单一主 API 密钥变量的提供商。需要额外配置或支持环境凭据的提供商在[云提供商](#cloud-providers)中讨论。

| 提供商 | 环境变量 |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| xAI | `XAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI 编码计划（全球） | `ZAI_API_KEY` |
| ZAI 编码计划（中国） | `ZAI_CODING_CN_API_KEY` |
| OpenCode Zen and Go | `OPENCODE_API_KEY` |
| Radius | `RADIUS_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Meta | `META_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` |
| Moonshot AI（全球和中国） | `MOONSHOT_API_KEY` |
| Qwen 令牌计划和单独使用 | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen 令牌计划（中国） | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo | `XIAOMI_API_KEY` |
| Xiaomi MiMo 令牌计划（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo 令牌计划（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| Xiaomi MiMo 令牌计划（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |

Anthropic 也识别 `ANTHROPIC_OAUTH_TOKEN` 作为 API 凭据，以及 `ANTHROPIC_AUTH_TOKEN` 作为承载认证。

## 从命令加载 API 密钥

如需使用密钥管理器而不将解析后的密钥写入磁盘，可在 `auth.json` 中将提供商的 `key` 设置为以 `!` 为前缀的命令：

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "!security find-generic-password -ws 'anthropic'"
  }
}
```

Pi 在首次需要密钥时运行该命令，并在进程生命周期内缓存其标准输出。若输出为空、超时或退出码非零，则密钥将保持未解析状态，直至 Pi 重启。

## 云提供商

以下提供商需要额外设置，或可使用其云平台提供的凭据。

存储的 API 密钥凭据可包含一个 `env` 对象。其值优先于该提供商的进程环境：

```json
{
  "cloudflare-workers-ai": {
    "type": "api_key",
    "key": "...",
    "env": {
      "CLOUDFLARE_ACCOUNT_ID": "account-id"
    }
  }
}
```

### Azure OpenAI

设置 API 密钥以及基础 URL 或资源名称：

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# 或者：
export AZURE_OPENAI_RESOURCE_NAME=your-resource
```

位于 `ai.azure.com`、`cognitiveservices.azure.com` 和 `openai.azure.com` 下的资源根 URL 会被规范化为 OpenAI API 路径。

### Amazon Bedrock

Bedrock 可以使用持有者令牌或环境 AWS 凭据源：

```bash
# 命名配置文件
export AWS_PROFILE=your-profile

# IAM 密钥
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# 临时凭据必填
export AWS_SESSION_TOKEN=...

# Bedrock 持有者令牌
export AWS_BEARER_TOKEN_BEDROCK=...

# 区域，当配置文件或 AWS SDK 配置未提供时
export AWS_REGION=us-west-2
# 也支持 AWS_DEFAULT_REGION
```

Pi 也支持通过标准的 `AWS_CONTAINER_CREDENTIALS_*` 和 `AWS_WEB_IDENTITY_TOKEN_FILE` 变量使用 ECS 任务凭据和 IRSA。

### Cloudflare AI 网关

该网关需要令牌、账户 ID 和网关 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
```

账户和网关 ID 可以来自进程环境或 `auth.json` 中凭据的 `env` 对象。

`CLOUDFLARE_API_KEY` 用于 Pi 向网关进行身份验证。上游访问可以使用 Cloudflare 统一计费、存储在网关中的凭据，或在 `models.json` 中为提供商配置的 `Authorization` 头。

### Cloudflare Workers AI

Workers AI 需要令牌和账户 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
```

账户 ID 也可以存储在凭据的 `env` 对象中。

### Google Vertex AI

使用 Google Cloud API 密钥：

```bash
export GOOGLE_CLOUD_API_KEY=...
```

要使用应用默认凭据，请配置项目和位置：

```bash
export GOOGLE_CLOUD_PROJECT=your-project
# 也支持 GCLOUD_PROJECT
export GOOGLE_CLOUD_LOCATION=us-central1
```

然后进行身份验证：

```bash
gcloud auth application-default login
```

若要改用服务账户密钥文件，请设置 `GOOGLE_APPLICATION_CREDENTIALS` 以及项目和位置。
