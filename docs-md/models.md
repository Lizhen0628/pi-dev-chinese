# 选择模型

对于内置提供商，从 `/login` 开始，然后用 `/model` 选择模型。仅当 Pi 尚未包含你需要的提供商或端点时，才使用自定义模型配置。

## 选择连接方式

| 你拥有的 | 推荐设置 |
|---|---|
| 支持的订阅 | 通过 `/login` 登录 |
| 提供商 API 密钥 | 通过 `/login` 存储或设置其环境变量 |
| 本地 GGUF 模型 | 将 Pi 连接到 llama.cpp 路由器 |
| 兼容 OpenAI、Anthropic 或 Google 的端点 | 将其添加到 `models.json` |
| 具有自定义协议或认证流程的提供商 | 构建或安装提供商扩展 |

浏览[模型目录](https://pi.dev/models)以了解当前提供商、模型 ID、功能、上下文限制和定价。Pi 启动时自带捆绑目录，并可叠加来自 pi.dev 的新目录数据。缓存的目录数据可离线使用；运行 `pi update --models` 强制刷新。

## 身份验证

运行 `/login` 并选择一个提供商。Pi 将凭据存储在 [`auth.json`](configuration.md#agent-directory) 中。运行 `/logout` 可移除某个提供商的已存储凭据。

你也可以通过提供商的环境变量提供 API 密钥。这在 CI 及其他不希望 Pi 写入凭据的环境中非常有用。[提供商](/docs/providers/) 列出了相关变量及提供商特定的设置。

当配置了多个凭据来源时，Pi 会优先使用运行时 `--api-key`，其次是已存储的 `auth.json` 凭据、`models.json` 中的 `apiKey`，最后是提供商的环境变量或环境云凭据。提供商扩展可以定义自己的身份验证行为。

请确保 `auth.json` 及任何凭据命令保持私密。在你信任某个项目后，项目设置和扩展可以在 Pi 进程内执行。在从未受信任的目录加载配置之前，请查阅 [安全](/docs/security/) 文档。

## 选择模型

运行 `/model` 可搜索可用模型。选择器会显示提供商已具备有效认证的模型。在某个模型上按 `Ctrl+S` 可将其保存为新会话的默认模型。

运行 `/thinking` 可为当前模型选择思考级别。在此处按 `Ctrl+S` 可保存启动级别。Pi 会将可选级别限制为所选模型支持的级别。

`Ctrl+P` 可在可用模型间循环切换。使用 `/scoped-models` 可控制该循环并保存选择，或通过[设置](settings.md#model-cycling)配置模型模式。

会话会记录模型及思考级别的变更。恢复会话时会还原这些设置，但不会改变新会话的默认值。

## 连接本地模型

Pi 直接与 llama.cpp 路由器集成。该路由器发现 GGUF 文件并按需加载模型。Pi 的 `/llama` 命令管理路由器，而 `/model` 则选择其中一个已加载的模型。

关于服务器启动、模型布局、下载及连接故障排查，请参阅 [使用 llama.cpp 的本地模型](/docs/llama-cpp/)。

对于 Ollama、LM Studio、vLLM、SGLang 及其他兼容服务器，请在 `models.json` 中 [配置兼容端点](#configure-a-compatible-endpoint)。

## 配置兼容端点

当端点使用 Pi 已支持的 API 时，可使用 [`models.json`](configuration.md#agent-directory) 进行配置。这涵盖了大多数 Ollama、LM Studio、vLLM、SGLang 及代理部署。

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

虚拟密钥使模型对 Pi 可用；Ollama 会忽略它。对于需要认证的端点，`apiKey` 和头部值可使用 `$NAME` 或 `${NAME}` 环境变量插值、字面值或前缀为 `!command` 的命令。`models.json` 中的命令在请求时执行，Pi 不会缓存它们。

打开 `/model` 会重新加载该文件。`models` 条目会添加或替换该提供商上具有相同 ID 的模型。使用 `modelOverrides` 可修改现有内置或扩展提供模型的元数据，而无需替换提供商的模型列表。未知的覆盖 ID 会被忽略。

### 描述模型输入与缓存

使用 `inputLimits.images.resize` 来控制 Pi 在将新图像附件、`read` 结果及工具结果图像存入对话历史前如何编码：

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

`maxBytes` 限制 base64 编码后的负载大小。未指定的 resize 字段采用保守默认值：2000×2000 像素、编码后 4.5 MiB、JPEG 质量 80。图像仅编码一次；更换模型不会重写历史图像。目录还可通过 `inputLimits.maxRequestBytes`、`images.maxPerMessage` 和 `images.maxPerRequest` 描述硬性请求限制，但 Pi 目前不会基于这些限制重写或拒绝历史记录。

<a id="prompt-cache-lifetimes"></a>

使用 `promptCache` 声明提供商在 `short` 或 `long` 保留层级下的尽力而为缓存生命周期（秒）：

```json
{ "id": "claude-sonnet-5", "promptCache": { "short": 300, "long": 3600 } }
```

选择任何已发布范围的保守端。对于活动层级没有生命周期的模型不具备缓存预热资格。`modelOverrides` 条目可为内置或扩展模型（包括通过已验证代理访问的模型）设置 `inputLimits` 或 `promptCache`。参见 [`cacheWarming`](settings.md#model-and-thinking)。

### 按思考级别配置采样

OpenAI 兼容的 API 支持自由格式的 `samplingParams` 模型默认值及 `samplingParamsByThinkingLevel` 覆盖。后者使用 Pi 的思考级别键（`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 和 `max`），而非 `thinkingLevelMap` 中的提供商值：

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

Pi 首先钳制不支持的思考级别，然后按顺序合并模型 `samplingParams`、生效级别的覆盖以及请求级别的 `samplingParams`。后值按键覆盖前值。缺失级别继承模型默认值。`modelOverrides` 按键将各级别的条目与基础模型合并。这些字段仅适用于 `openai-completions`、`openai-responses` 和 `azure-openai-responses`；其他 API 将忽略它们。

兼容性设置应描述端点请求或响应行为中已验证的差异。不要仅因端点声称支持 OpenAI 或 Anthropic 兼容性就启用这些设置。

## 使用分类器模型

分类器模型不进行对话。它们回答关于 JSON 状态的类型化问题：从几个选项中选择一个、回答是或否、或给出评分，每个都带有概率。Pi 包含来自这些提供商的 TypeSafe 的 Jev 模型，以及来自 Workers AI 的 Cloudflare 的 Clef 和 Clef Flash 模型：

| 提供商 | 模型 ID | 认证 |
|---|---|---|
| `typesafe` | `jev-latest` | `TYPESAFE_API_KEY` |
| `openrouter` | `typesafe/jev-1.13`, `~typesafe/jev-latest` | `OPENROUTER_API_KEY` 或 `/login` |
| `cloudflare-workers-ai` | `typesafe/jev`, `@cf/cloudflare/clef`, `@cf/cloudflare/clef-flash` | `CLOUDFLARE_API_KEY` 和 `CLOUDFLARE_ACCOUNT_ID` |
| `vercel-ai-gateway` | `typesafe-ai/jev` | `AI_GATEWAY_API_KEY` |
| `opencode` | `jev-1.13`, `jev-1.13-free` | `OPENCODE_API_KEY` |

[llama.cpp 路由器](llama-cpp.md#classification) 上的聊天模型也被列为分类器模型。

分类器模型不会出现在 `/model` 中。模型通过 [`codemode`](cli.md#enable-codemode) 工具访问它们，该工具默认关闭，除非 MCP 服务器将其开启。在 [设置](settings.md#tools) 中使用 `"defaultTools": ["+codemode"]` 启用它。然后脚本使用 `models.getAvailableOfType("classifier")` 列出分类器模型，并调用 `models.classify(model, { state, questions })`：

```js
const jev = await models.getModelOfType("classifier", "typesafe", "jev-latest");
const result = await models.classify(jev, {
  state: { message: "更改有效，谢谢。" },
  questions: {
    approved: {
      type: "bool",
      instructions: "用户是否认可结果？",
      criteria: { true: "认可", false: "不认可" },
    },
  },
});
return result.answers;
```

[Codemode](codemode.md#classify) 描述了问题和答案类型。

当服务报告令牌计数时（所有 System One 服务均如此），`result.usage` 会携带这些计数及其成本。Pi 将脚本分类器调用的使用情况添加到 `codemode` 工具结果中，因此它会计入页脚和 `/session` 中的会话成本。成本使用模型的目录价格；没有价格的模型（如 TypeSafe 的直接 `jev-latest`）报告令牌时不计成本。

扩展通过 `ctx.modelRegistry.classify()` 调用分类器，无需 codemode。[虚拟模型](virtual-models.md#route-requests) 可以使用它们来路由请求；参见 `jev-router.ts` 示例。

## 使用图像模型

图像模型根据提示词和可选的输入图像生成图像。Pi 在 `openrouter` 提供商下列出了 OpenRouter 的图像模型，如 `google/gemini-2.5-flash-image` 和 `black-forest-labs/flux.2-pro`；它们使用与聊天模型相同的 `OPENROUTER_API_KEY` 或 `/login` 凭据。

与分类器模型类似，图像模型不会出现在 `/model` 中；模型通过 [`codemode`](cli.md#enable-codemode) 工具访问它们。脚本使用 `models.getAvailableOfType("image")` 列出它们，并通过 `models.generateImages(model, { input })` 调用。结果的 `output` 持有 base64 图像块，`image()` 将这些块附加到 `codemode` 结果上，使模型能够查看它们：

```js
const painter = await models.getModelOfType("image", "openrouter", "google/gemini-2.5-flash-image");
const result = await models.generateImages(painter, {
  input: [{ type: "text", text: "一只在雪地中的红狐，水彩画" }],
});
if (result.stopReason !== "stop") return result.errorMessage;
for (const block of result.output) if (block.type === "image") image(block);
```

`input` 还可以包含 `{ type: "image", data, mimeType }` 块，用于编辑图像或作为参考图像使用。与分类器调用一样，Pi 会将脚本图像调用的使用情况添加到 `codemode` 工具结果中。生成的图像不会保存到磁盘。[Codemode](codemode.md#generate-images) 描述了完整的 API。

扩展通过 `ctx.modelRegistry.generateImages()` 生成图像，无需使用 codemode。

## 添加自定义提供商

当提供商需要自定义流式传输、模型发现或认证行为时，请使用扩展。有关扩展工作流程，请参阅[自定义提供商](/docs/custom-provider/)。

## 故障排查

### 模型未显示

请确认其提供商具备可用的身份验证。自定义模型可从 `models.json` 加载，但在 Pi 能够解析凭据之前，它们不会出现在 `/model` 中。对于 llama.cpp，仅当前由路由器加载的模型可见。

### 认证仅在一个外壳中生效

检查密钥是来自环境变量还是 `auth.json`。环境变量必须存在于启动 Pi 的进程中。

### 在远程机器上登录会打开浏览器

当提供商支持无头认证流程时，请完成该流程。某些提供商允许你将最终的跳转 URL 或授权码粘贴回 Pi。参见[交互式认证](providers.md#authenticate-interactively)。

### 兼容端点拒绝请求

在 `models.json` 中检查其 API 类型和兼容性设置。上游服务器必须支持相应的请求字段和行为。
