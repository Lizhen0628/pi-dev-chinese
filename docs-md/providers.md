# 提供商

大多数托管提供商支持以下一种或两种认证方式：

- 通过基于 OAuth 的浏览器或设备流程登录。
- 提供 API 密钥。

使用 `/login [provider]` 查看提供商支持的方式。Amazon Bedrock 和 Google Vertex AI 也可以使用环境云凭证。

## 交互式认证

运行 `/login` 并选择一个提供商。Pi 会引导你完成其 OAuth 或 API 密钥流程，并将生成的凭据保存在 [`auth.json`](configuration.md#agent-directory) 中。

在远程或无头机器上，OAuth 回调可能无法到达本地进程。当提示时，将最终的重定向 URL 或授权代码粘贴回 Pi。

运行 `/logout` 并选择一个提供商以移除其存储的凭据。这不会取消设置环境变量、从 `models.json` 中移除认证，也不会在提供商处撤销该凭据。

`auth.json` 可能包含 API 密钥和 OAuth 令牌。请保持其私密，不要将其提交到版本控制。

## 从环境中使用 API 密钥

环境变量在 CI 和任何 Pi 不应存储密钥的地方都很有用。在启动 Pi 之前设置变量：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

此表格涵盖具有单一主 API 密钥变量的提供商。需要额外配置或支持环境凭据的提供商在 [提供商特定配置](#provider-specific-config) 下介绍。

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
| ZAI 编程计划（全球） | `ZAI_API_KEY` |
| ZAI 编程计划（中国） | `ZAI_CODING_CN_API_KEY` |
| OpenCode Zen 和 Go | `OPENCODE_API_KEY` |
| Radius | `RADIUS_API_KEY` |
| TypeSafe（[分类器模型](models.md#use-classifier-models)） | `TYPESAFE_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Meta | `META_API_KEY` |
| MiniMax | `MINIMAX_API_KEY` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` |
| Moonshot AI（全球和中国） | `MOONSHOT_API_KEY` |
| Qwen 令牌计划和个人 | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen 令牌计划（中国） | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| 小米 MiMo | `XIAOMI_API_KEY` |
| 小米 MiMo 令牌计划（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| 小米 MiMo 令牌计划（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| 小米 MiMo 令牌计划（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |

Anthropic 还识别 `ANTHROPIC_OAUTH_TOKEN` 作为 API 凭据，`ANTHROPIC_AUTH_TOKEN` 作为 bearer 认证。

当未设置密钥或令牌时，当设置了 `ANTHROPIC_FEDERATION_RULE_ID`、`ANTHROPIC_ORGANIZATION_ID` 和 `ANTHROPIC_IDENTITY_TOKEN_FILE` 时，Anthropic 使用工作负载身份联盟：Anthropic SDK 将身份令牌交换为短期访问令牌并自行刷新（重新读取身份令牌文件，因此对于长时间会话，请保持该文件的新鲜）。`ANTHROPIC_SERVICE_ACCOUNT_ID` 和 `ANTHROPIC_WORKSPACE_ID` 在设置时会被传递。

## 从命令加载 API 密钥

如需使用密钥管理器而不将解析后的密钥写入磁盘，可在 `auth.json` 中将提供商的 `key` 设置为以 `!` 前缀开头的命令：

```json
{
  "anthropic": {
    "type": "api_key",
    "key": "!security find-generic-password -ws 'anthropic'"
  }
}
```

Pi 在首次需要密钥时运行该命令，并在进程生命周期内缓存其标准输出。若输出为空、超时或退出码非零，则密钥保持未解析状态，直至 Pi 重启。

## 提供商特定配置

以下提供商需要额外的设置、配置或可使用其平台提供的凭据。

存储的 API 密钥凭据可以包含一个 `env` 对象。其值优先于该提供商的进程环境：

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

### Radius

Radius 是由 Pi 的构建者为 Pi 的构建者打造的一项服务。它提供了一个可定制的 AI 网关，内置组织级控制和数据分析，以及用于分享你用 Pi 创建内容的工件。

要开始使用，请在 Pi 中运行 `/login`。这将添加 Radius 作为提供商，其模型会像其他任何提供商一样出现在 `/model` 中。

Radius 还有一个 MCP 服务器，因此 Pi 可以为你管理 Radius。

Radius 目前处于早期测试阶段，并且发展迅速。更多信息请参见 [radius.earendil.com](https://radius.earendil.com)。

Radius 认证使用其网关目录，并缓存刷新后的模型元数据，以便后期离线启动。在 `models.json` 中配置的自定义 Radius 网关使用自己的目录，而不是继承公共的 `radius.pi.dev` 目录。

### Azure OpenAI API

配置 Azure OpenAI API 的基地 URL 或 API 密钥。

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
```

或者：

```bash
export AZURE_OPENAI_RESOURCE_NAME=your-resource
```

位于 `ai.azure.com`、`cognitiveservices.azure.com` 和 `openai.azure.com` 下的根 URL 会规范化为 OpenAI API 路径。

### Amazon Bedrock

Bedrock 可以使用持有者令牌或环境 AWS 凭证来源：

```bash
# 命名配置文件
export AWS_PROFILE=your-profile

# IAM 密钥
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# 临时凭证必需
export AWS_SESSION_TOKEN=...

# Bedrock 持有者令牌
export AWS_BEARER_TOKEN_BEDROCK=...

# 区域，当配置文件或 AWS SDK 配置未提供时
export AWS_REGION=us-west-2
# 也支持 AWS_DEFAULT_REGION
```

Pi 还通过标准的 `AWS_CONTAINER_CREDENTIALS_*` 和 `AWS_WEB_IDENTITY_TOKEN_FILE` 变量支持 ECS 任务凭证和 IRSA。

### Cloudflare AI 网关

该网关需要令牌、账户 ID 和网关 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...
```

账户和网关 ID 可以来自进程环境或 `auth.json` 中凭据的 `env` 对象。

`CLOUDFLARE_API_KEY` 用于 Pi 对网关进行身份验证。上游访问可以使用 Cloudflare 统一计费、存储在网关中的凭据，或 `models.json` 中为提供商配置的 `Authorization` 头。

### Cloudflare Workers AI

Workers AI 需要一个令牌和账户 ID：

```bash
export CLOUDFLARE_API_KEY=...
export CLOUDFLARE_ACCOUNT_ID=...
```

账户 ID 也可以存储在凭据的 `env` 对象中。

### 谷歌 Vertex AI

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

若要改用服务账户密钥文件，请同时设置 `GOOGLE_APPLICATION_CREDENTIALS` 以及项目和位置。
