# 选择模型

对于内置提供商，先从 `/login` 开始，然后使用 `/model` 选择模型。仅在 Pi 未包含您所需的提供商或端点时，才使用自定义模型配置。

## 选择连接

| 你拥有什么 | 推荐配置 |
|---|---|
| 支持的订阅 | 通过 `/login` 登录 |
| 提供商 API 密钥 | 通过 `/login` 存储或设置其环境变量 |
| 本地 GGUF 模型 | 将 Pi 连接到 llama.cpp 路由器 |
| OpenAI、Anthropic 或 Google 兼容端点 | 将其添加到 `models.json` |
| 具有自定义协议或身份验证流程的提供商 | 构建或安装提供商扩展 |

浏览[模型目录](https://pi.dev/models)以获取当前提供商、模型 ID、功能、上下文限制和定价。Pi 会使用其内置目录启动，并可以叠加来自 pi.dev 的新目录数据。缓存目录数据保持离线可用；运行 `pi update --models` 强制刷新。

## 身份验证

运行 `/login` 并选择一个提供商。Pi 将凭据存储在 [`auth.json`](configuration.md#agent-directory) 中。运行 `/logout` 可移除指定提供商的已存凭据。

您也可以通过提供商的环境变量来提供 API 密钥。这在 CI 及 Pi 不应写入凭据的其他环境中尤为有用。[提供商](/docs/providers/) 列出了相关变量及提供商特定的设置。

当配置了多个凭据来源时，Pi 会优先使用运行时的 `--api-key`，然后是已存储的 `auth.json` 凭据，`models.json` 中的 `apiKey`，最后是提供商的环境变量或即时的云凭据。提供商扩展可自定义其认证行为。

请确保 `auth.json` 及任何凭据命令保持私密。项目设置和扩展在您信任项目后，可在 Pi 进程内执行。在从未受信任的目录加载配置前，请查阅[安全](/docs/security/)文档。

## 选择模型

运行 `/model` 搜索可用模型。选择器会显示提供商具有可用认证的模型。在模型上按 `Ctrl+S` 可将其保存为新会话的默认模型。

运行 `/thinking` 为当前模型选择思考级别。在那里按 `Ctrl+S` 可保存启动级别。Pi 会将选项限制为所选模型支持的级别。

`Ctrl+P` 循环切换可用模型。使用 `/scoped-models` 控制该循环并保存选择，或通过 [设置](settings.md#model-cycling) 配置模型模式。

会话会记录模型和思考级别的更改。恢复会话时会恢复这些设置，而不会更改新会话的默认值。

## 连接本地模型

Pi 直接与 llama.cpp 路由器集成。路由器发现 GGUF 文件并按需加载模型。Pi 的 `/llama` 命令管理路由器，而 `/model` 则选择其中一个已加载的模型。

关于服务器启动、模型布局、下载及连接故障排查，请参阅 [使用 llama.cpp 的本地模型](/docs/llama-cpp/)。

对于 Ollama、LM Studio、vLLM、SGLang 及其他兼容服务器，请在 `models.json` 中 [配置兼容端点](#configure-a-compatible-endpoint)。

## 配置兼容的端点

当端点使用 Pi 已支持的 API 时，可使用 [`models.json`](configuration.md#agent-directory)。这包括大多数 Ollama、LM Studio、vLLM、SGLang 及代理部署。

```json
{
  "$schema": "https://pi.dev/schemas/models.schema.json",
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

哑密钥用于让模型对 Pi 可用；Ollama 会忽略它。对于需要认证的端点，`apiKey` 和头值可以使用 `$NAME` 或 `${NAME}` 环境变量插值、字面值，或前导 `!command`。`$$` 和 `$!` 分别生成字面量的 `$` 和 `!`。`models.json` 中的命令在请求时执行，Pi 不会缓存它们。

打开 `/model` 会重新加载该文件。`models` 条目会添加或替换该提供商上具有相同 ID 的模型。使用 `modelOverrides` 可以更改现有内置或扩展提供模型的元数据，而无需替换提供商的模型列表。未知的覆盖 ID 会被忽略。

若要路由内置提供商通过代理，只需设置其 `baseUrl`。其模型和认证保持不变：

```json
{
  "providers": {
    "anthropic": { "baseUrl": "https://proxy.example.com/v1" }
  }
}
```

[模型配置](/docs/models-configuration/) 列出了所有字段。

### 描述模型输入与缓存

使用 `inputLimits.resize` 控制 Pi 在将新的图片附件、读取结果以及工具结果图片存入会话历史之前的编码方式：

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

`maxBytes` 限制了 base64 编码后的负载大小。未指定的调整大小字段采用保守默认值：2000×2000 像素、编码后 4.5 MiB、JPEG 质量 80。图片只编码一次；更换模型不会重写历史图片。目录还可以通过 `inputLimits.maxRequestBytes`、`images.maxPerMessage` 和 `images.maxPerRequest` 描述硬性请求限制，但 Pi 目前不会基于这些限制重写或拒绝历史内容。

<a id="prompt-cache-lifetimes"></a>

使用 `promptCache` 声明提供商在 `short` 或 `long` 保留层级下的尽力缓存生命周期（以秒为单位）：

```json
{ "id": "claude-sonnet-5", "promptCache": { "short": 300, "long": 3600 } }
```

选择已发布范围内的保守端值。当前层级没有生命周期的模型不具备缓存预热资格。`modelOverrides` 条目可以为内置或扩展模型（包括通过验证代理访问的模型）设置 `inputLimits` 或 `promptCache`。参见 [`cacheWarming`](settings.md#model-and-thinking)。

### 按思考级别配置采样

兼容 OpenAI 的 API 支持自由格式的 `samplingParams` 模型默认值以及 `samplingParamsByThinkingLevel` 覆盖项。后者使用 Pi 的思考级别键（`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 和 `max`），而非来自 `thinkingLevelMap` 的提供商值：

```json
{
  "id": "qwen-thinking-model",
  "reasoning": true,
  "samplingParams": {
    "temperature": 1.0,
    "top_p": 0.95
  },
  "samplingParamsByThinkingLevel": {
    "off": {
      "temperature": 0.7,
      "top_p": 0.8
    },
    "high": {
      "top_k": 20
    }
  }
}
```

Pi 首先限制不支持的思考级别，然后按顺序合并模型 `samplingParams`、有效级别的覆盖项以及请求级别的 `samplingParams`。每个键以后出现的值优先。缺失的级别继承模型默认值。`modelOverrides` 将每个级别的条目按键与基础模型合并。这些字段仅适用于 `openai-completions`、`openai-responses` 和 `azure-openai-responses`；其他 API 会忽略它们。

兼容性设置应描述端点请求或响应行为中已验证的差异。不要仅基于端点宣称兼容 OpenAI 或 Anthropic 就启用这些设置。

## 使用分类器模型

分类器模型不进行对话。它们回答关于 JSON 状态的键入问题：从几个选项中选择一个，回答是或否，或给出评分，每个都带有概率。Pi 包含来自这些提供商的 TypeSafe Jev 模型、来自 Workers AI 和 OpenRouter 的 Cloudflare Clef、Clef Flash 和 Clef Omni 模型，以及通过 [Decisions API](https://developers.openai.com/api/docs/guides/decisions) 提供的 OpenAI GPT-6 Luna：

| 提供商 | 模型 ID | 身份验证 |
|---|---|---|
| `typesafe` | `jev-latest` | `TYPESAFE_API_KEY` |
| `openrouter` | `typesafe/jev-1.13`、`typesafe/jev-1.14`、`~typesafe/jev-latest`、`cloudflare/clef`、`cloudflare/clef-flash`、`cloudflare/clef-omni` | `OPENROUTER_API_KEY` 或 `/login` |
| `cloudflare-workers-ai` | `typesafe/jev`、`typesafe/jev-1.14.0`、`@cf/cloudflare/clef`、`@cf/cloudflare/clef-flash`、`@cf/cloudflare/clef-omni` | `CLOUDFLARE_API_KEY` 和 `CLOUDFLARE_ACCOUNT_ID` |
| `vercel-ai-gateway` | `typesafe-ai/jev` | `AI_GATEWAY_API_KEY` |
| `opencode` | `jev-1.13`、`jev-1.13-free` | `OPENCODE_API_KEY` |
| `openai` | `gpt-6-luna` | `OPENAI_API_KEY` |

[llama.cpp 路由器](llama-cpp.md#classification) 上的对话模型也列为分类器模型。

OpenAI 的 Decisions API 需要 API 密钥。使用 ChatGPT 凭据登录不适用于它，因此当 `openai` 通过 `/login` 登录时，`gpt-6-luna` 不会列为可用，即使设置了 `OPENAI_API_KEY` 也是如此；请退出 `openai` 以使用密钥。该 API 拒绝超过 922K 令牌的输入，但运行时间长于大约五秒的请求（目前大致超过 600K 输入令牌）会因网关超时而失败。

分类器模型不会出现在 `/model` 中。模型通过 [`codemode`](cli.md#enable-codemode) 工具访问它们，除非 MCP 服务器开启，否则该工具处于关闭状态。在[设置](settings.md#tools)中使用 `"defaultTools": ["+codemode"]` 启用它。之后，脚本使用 `models.getAvailableOfType("classifier")` 列出分类器模型，并使用 `models.classify(model, { state, questions })` 调用它们：

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const result = await models.classify(jev, {
  state: { message: "The change works, thanks." },
  questions: {
    approved: {
      type: "bool",
      instructions: "Does the user approve of the result?",
      criteria: { true: "Approval", false: "No approval" },
    },
  },
});
return result.answers;
```

[Codemode](codemode.md#classify) 描述了问题和答案的类型。

其 `input` 包含 `"image"` 的分类器模型也会评判在 `images` 中传递的图像；其他分类器模型会对它们返回错误。图像输入适用于 GPT-6 Luna、来自 `typesafe` 和 `cloudflare-workers-ai` 的 Jev、来自 `cloudflare-workers-ai` 的 Clef，以及目录中列出图像输入的 OpenRouter 模型。Jev 接受 PNG 和 JPEG 图像，图像输入在 TypeSafe 自己的 API 上为实验性功能。Clef 接受 PNG、JPEG 和 WebP 图像，每个请求最多四张。来自 `vercel-ai-gateway` 和 `opencode` 的 Jev 仅接受文本。

每个 System One 服务都以自己的请求格式接收图像，该格式由模型的 `compat.imageInput` 设置。内置模型会设置它，因此覆盖提供商的 `baseUrl` 会保留它。代理其他服务分类器的自定义提供商在 `models.json` 中的提供商级 `compat` 中设置它（参见 [System One 兼容性](models-configuration.md#typesafe-system-one)）。尤其是 OpenRouter，以 TypeSafe 的格式回答请求而不报错，但会丢弃图像。

当服务报告令牌数时（正如所有 System One 服务所做的那样），`result.usage` 会携带它们及其成本。Pi 将脚本的分类器调用使用量添加到 `codemode` 工具结果中，因此它计入页脚和 `/session` 中的会话成本。成本使用模型的目录价格；没有价格的模型（例如 TypeSafe 直接的 `jev-latest`）报告令牌时不计成本。

扩展通过 `ctx.modelRegistry.classify()` 调用分类器，无需 codemode。[虚拟模型](virtual-models.md#route-requests) 可以使用它们来路由请求；参见 `jev-router.ts` 示例。

## 使用图像模型

图像模型根据提示词和可选的输入图像生成图像。Pi 将 OpenRouter 的图像模型（如 `google/gemini-2.5-flash-image` 和 `black-forest-labs/flux.2-pro`）列在 `openrouter` 提供商下；它们使用与聊天模型相同的 `OPENROUTER_API_KEY` 或 `/login` 凭据。

与分类模型类似，图像模型不会出现在 `/model` 中；模型通过 [`codemode`](cli.md#enable-codemode) 工具访问它们。脚本使用 `models.getAvailableOfType("image")` 列出它们，并调用 `models.generateImages(model, { input })`。结果的 `output` 包含 base64 图像块，`image()` 将它们附加到 `codemode` 结果中，以便模型看到它们：

```js
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "A red fox in the snow, watercolor" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) if (block.type === "image") image(block);
```

`input` 还可以包含 `{ type: "image", data, mimeType }` 块，用于编辑或作为参考。Pi 会将脚本的图像调用使用情况添加到 `codemode` 工具结果中，类似于分类调用。生成的图像不会保存到磁盘。[Codemode](codemode.md#generate-images) 描述了完整的 API。

扩展通过 `ctx.modelRegistry.generateImages()` 生成图像，无需 codemode。

## 添加自定义提供商

当提供商需要自定义流式处理、模型发现或认证行为时，请使用扩展。有关扩展工作流程，请参阅[自定义提供商](/docs/custom-provider/)。

## 故障排查

### 模型未出现

请确认其提供商具有可用的认证信息。自定义模型可以从 `models.json` 加载，但在 Pi 能够解析凭据之前，它们不会出现在 `/model` 中。对于 llama.cpp，只有路由器当前加载的模型才会显示。

### 认证仅在一个 shell 中有效

检查密钥是来自环境变量还是 `auth.json`。环境变量必须存在于启动 Pi 的进程中。

### 在远程机器上登录会打开浏览器

当提供商支持无头认证流程时，请完成该流程。某些提供商允许你将最终的跳转 URL 或授权码粘贴回 Pi。参见[交互式认证](providers.md#authenticate-interactively)。

### 兼容端点拒绝请求

在 `models.json` 中检查其 API 类型和兼容性设置。上游服务器必须支持相应的请求字段和行为。
