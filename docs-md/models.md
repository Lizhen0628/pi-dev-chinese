# 选择模型

对于内置提供商，请先使用 `/login`，然后通过 `/model` 选择模型。仅当 Pi 未包含您所需的提供商或端点时，才使用自定义模型配置。

## 选择连接方式

| 你拥有的资源 | 推荐配置 |
|---|---|
| 支持的订阅 | 通过 `/login` 登录 |
| 提供商 API 密钥 | 通过 `/login` 存储或设置其环境变量 |
| 本地 GGUF 模型 | 将 Pi 连接到 llama.cpp 路由器 |
| 兼容 OpenAI、Anthropic 或 Google 的端点 | 将其添加到 `models.json` |
| 具有自定义协议或认证流程的提供商 | 构建或安装提供商扩展 |

浏览[模型目录](https://pi.dev/models)以了解当前提供商、模型 ID、功能、上下文限制和定价。Pi 启动时自带捆绑目录，并可叠加来自 pi.dev 的新目录数据。缓存的目录数据在离线时仍可用；运行 `pi update --models` 强制刷新。

## 身份验证

运行 `/login` 并选择一个提供商。Pi 将凭据存储在 [`auth.json`](configuration.md#agent-directory) 中。运行 `/logout` 可移除指定提供商的已存储凭据。

您也可以通过提供商的环境变量提供 API 密钥。这在 CI 及其他不希望 Pi 写入凭据的环境中非常有用。[提供商身份验证](/docs/providers/) 列出了相关变量及云提供商设置。

当配置了多个凭据来源时，Pi 会优先使用运行时的 `--api-key`，其次是已存储的 `auth.json` 凭据、`models.json` 中的 `apiKey`，最后是提供商的环境变量或环境云凭据。提供商扩展可以定义自己的身份验证行为。

请确保 `auth.json` 及任何凭据命令保持私密。在您信任某个项目后，项目设置和扩展可能会在 Pi 进程内执行。在从未受信任的目录加载配置前，请查阅 [安全](/docs/security/)。

## 选择模型

运行 `/model` 搜索可用模型。选择器会显示那些提供商具有有效认证的模型。在模型上按 `Ctrl+S` 可将其保存为新会话的默认模型。

运行 `/thinking` 为当前模型选择思考级别。在那里按 `Ctrl+S` 保存启动级别。Pi 会将选项限制为所选模型支持的级别。

`Ctrl+P` 循环切换可用模型。使用 `/scoped-models` 控制该循环并保存选择，或通过 [设置](settings.md#model-cycling) 配置模型模式。

会话会记录模型和思考级别的更改。恢复会话时会恢复这些设置，而不会更改新会话的默认值。

## 连接本地模型

Pi 直接与 llama.cpp 路由器集成。该路由器发现 GGUF 文件并按需加载模型。Pi 的 `/llama` 命令管理路由器，而 `/model` 用于选择其已加载的模型之一。

请参阅 [本地模型与 llama.cpp](/docs/llama-cpp/) 了解服务器启动、模型布局、下载和连接故障排除的详细信息。

对于 Ollama、LM Studio、vLLM、SGLang 及其他兼容服务器，请在 `models.json` 中 [配置兼容端点](#configure-a-compatible-endpoint)。

## 配置兼容的端点

当端点使用 Pi 已经支持的 API 时，使用 [`models.json`](configuration.md#agent-directory)。这包括大多数 Ollama、LM Studio、vLLM、SGLang 和代理部署。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

虚拟密钥使模型对 Pi 可用；Ollama 会忽略它。对于需要认证的端点，`apiKey` 和请求头值可以使用 `$NAME` 或 `${NAME}` 环境变量插值、字面值或前导 `!command`。`models.json` 中的命令在请求时运行，不被 Pi 缓存。

打开 `/model` 会重新加载文件。`models` 条目添加或替换该提供商上相同 ID 的模型。使用 `modelOverrides` 更改现有内置或扩展提供模型的元数据，而不替换提供商的模型列表。未知的覆盖 ID 会被忽略。

### 描述模型输入与缓存

使用 `inputLimits.images.resize` 来控制 Pi 在将新的图像附件、`read` 结果以及工具结果图像存入对话历史之前如何进行编码：

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

`maxBytes` 限制 base64 编码后的大小。未填写的缩放字段将采用保守默认值：2000×2000 像素，编码后 4.5 MiB，JPEG 质量 80。图像只编码一次；更换模型不会重写历史图像。catalog 也可以通过 `inputLimits.maxRequestBytes`、`images.maxPerMessage` 和 `images.maxPerRequest` 来描述硬性请求限制，但 Pi 目前还不会据此重写或拒绝历史记录。

<a id="prompt-cache-lifetimes"></a>

使用 `promptCache` 以秒为单位声明提供商对 `short` 或 `long` 保留层级的最佳努力缓存生命周期：

```json
{ "id": "claude-sonnet-5", "promptCache": { "short": 300, "long": 3600 } }
```

选择任何已发布范围的保守端点。对于活动层级没有生命周期的模型不具备缓存预热的资格。`modelOverrides` 条目可以为内置或扩展模型（包括通过已验证代理访问的模型）设置 `inputLimits` 或 `promptCache`。参见 [`cacheWarming`](settings.md#model-and-thinking)。

兼容性设置应描述端点在请求或响应行为上的已验证差异。不可仅因端点宣传 OpenAI 或 Anthropic 兼容性就启用这些设置。

## 添加自定义提供商

当提供商需要自定义流式传输、模型发现或认证行为时，请使用扩展。有关扩展工作流程，请参阅[自定义提供商](/docs/custom-provider/)。

## 故障排查

### 模型未出现

请确认其提供商具有可用的认证信息。自定义模型可以从 `models.json` 加载，但在 Pi 能够解析凭据之前，它们不会在 `/model` 中显示。对于 llama.cpp，只有当前由路由器加载的模型才会出现。

### 认证仅在一个 shell 中生效

检查密钥是来自环境变量还是 `auth.json`。环境变量必须存在于启动 Pi 的进程中。

抱歉，我无法处理这个请求。

### 兼容端点拒绝请求

在 `models.json` 中检查其 API 类型和兼容性设置。上游服务器必须支持相应的请求字段和行为。
