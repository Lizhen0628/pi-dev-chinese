# 自定义提供商

提供商扩展将 Pi 连接到需要自定义认证、模型发现、请求处理或流式传输的模型服务。如果该服务已支持某种受支持的 API，请在 `models.json` 中配置即可。

提供商扩展在 Pi 内部运行，可以检查凭据、提示词、工具定义、模型响应和使用情况。请将其视为受信任的代码，避免记录机密信息或提供商负载。

## 选择最小的集成

| 需求 | 使用 |
|---|---|
| 在支持的 API 后添加模型 | [`models.json`](models.md#configure-a-compatible-endpoint) |
| 更改现有提供商的端点或头部 | `models.json` 或一个小型提供商扩展 |
| 动态发现模型 | 具有 `refreshModels` 的提供商 |
| 添加一个 `/login` 流程 | 具有原生或遗留 OAuth 配置的提供商 |
| 实现不支持的线路协议 | 具有 `stream` 或 `streamSimple` 的提供商 |

提供商扩展是一个 [扩展](/docs/extensions/)，因此它遵循相同的加载、信任、重新加载和错误行为。

## 注册提供商

在扩展工厂中调用 `pi.registerProvider()`。Pi 在启动继续之前会等待异步工厂完成，因此在此注册的提供商可用于启动模型选择和 `pi --list-models`。

有两种注册形式：

- 从 `@earendil-works/pi-ai` 注册完整的 `Provider`，以获得原生认证、过滤、发现、刷新和流式行为。
- 使用 `ProviderConfig` 注册提供商名称，用于现有扩展使用的旧配置形式。

对于拥有不仅仅是静态端点和模型元数据的新集成，优先使用完整提供商。Pi 会在已注册的原生提供商之上组合 `models.json` 覆盖。

仅为现有提供商注册 `baseUrl` 或 `headers` 会保留其内置模型。在旧形式中提供 `models` 会替换该提供商在聊天、图像和分类器操作中的模型。省略 `type` 表示 `"chat"`；图像和分类器模型需要通过 `images` 和 `classifiers` 字段，以显式判别符和按其 `api` 值键控的实现来提供。

例如，混合操作提供商可以同时注册非聊天模型及其实现：

```typescript
pi.registerProvider("media-tools", {
  apiKey: "$MEDIA_TOOLS_API_KEY",
  models: [
    {
      type: "image",
      id: "image-v1",
      name: "Image V1",
      api: "media-images",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      output: ["image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
    {
      type: "classifier",
      id: "classifier-v1",
      name: "Classifier V1",
      api: "media-classifier",
      baseUrl: "https://media.example.com/v1",
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 64000,
    },
  ],
  images: {
    "media-images": { generateImages: async (model, context, options) => result },
  },
  classifiers: {
    "media-classifier": { classify: async (model, context, options) => result },
  },
});
```

模型级别的 `baseUrl` 值优先于提供商端点。如果未提供 `models` 列表，则所有操作的内置模型保持注册状态。不同操作中相同的模型 ID 保持独立，包括其模型特定的标头。

初始扩展加载后进行的调用会立即生效。使用 `pi.unregisterProvider()` 移除动态提供商并恢复其替换的内置行为。

参见已检查的 [GitLab Duo 提供商](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/) 以获取将流式委托给内置 API 实现的完整注册示例。

## 提供认证

静态提供商可以从字面值、环境变量插值或命令中解析 API 密钥。这些值与 `models.json` 使用相同的语法：

- `$NAME` 和 `${NAME}` 读取环境变量。
- 以 `!command` 开头使用命令输出。
- `$$` 输出字面量 `$`。
- `$!` 输出开头的字面量 `!`。

当集成需要存储的凭据、自定义解析、提供商特定的环境变量或多个登录方法时，请使用提供商自带的认证方式。

OAuth 提供商提供显示名称、登录流程、令牌刷新和访问令牌解析。注册后，它会出现在 `/login` 中，Pi 将返回的凭据存储在 `~/.pi/agent/auth.json` 中。

OAuth 回调与界面无关。它们可以打开授权 URL、显示设备码、报告进度、请求输入或要求用户选择登录方式。在请求期间应尊重取消操作及提供的中止信号。

切勿将访问令牌、刷新令牌、授权标头或完整的提供商响应写入普通日志。

# 供应与刷新模型

每个模型都需要有标识、显示名称、输入能力与成本信息。分类器模型还需要上下文窗口；聊天模型需要输出限制与推理支持；图像模型则需声明其输出模态。除非某一模型需要特殊覆盖，否则应在提供商层面选择API实现方式。

当Pi需要保持空闲提示词缓存活跃时，可将`promptCache.short`或`promptCache.long`设置为提供商尽力而为的缓存存活时间（以秒为单位）。若希望禁用该保留层级的缓存预热，则不设置这些字段。

兼容性标志用于描述原本受支持的API中已验证的差异。请勿仅凭端点声称的兼容性就启用这些标志。

请对照实际服务器，确认请求字段与响应行为。

当可用目录来自实时服务时，请使用`refreshModels`。将`context.signal`传递给阻塞I/O操作，以便调用方能够取消刷新。

两种注册形式的刷新合约有所不同：

- 完整的`Provider`不返回任何内容，而是调用`context.publish({ update })`来安装提供商拥有的模型状态，随后其同步方法`getModels()`会暴露最新列表。
- 传统的`ProviderConfig.refreshModels`返回混合操作的模型定义。Pi会用返回的列表替换该注册中的实时模型，并应用任何请求的持久化设置。

仅当持久化的目录数据应跨运行存活时，才发布这些数据。例如llama.cpp等实时服务可以更新其内存中的列表而不进行持久化；而远程目录则可以保留快照以供离线启动。

## 复用受支持的流式 API

当提供商协议匹配时，使用 Pi AI 的一个 API 实现。

受支持的实现包括 Anthropic Messages、OpenAI Chat Completions 和 Responses、Google Generative AI 和 Vertex、Azure OpenAI Responses、Mistral Conversations 以及 Bedrock Converse。

提供商仍然可以自定义身份验证、基础 URL、头部、模型过滤和发现，同时将请求转换和流式传输委托给现有的 API 实现。

这比复制流实现更安全，因为它保留了 Pi 的消息转换、工具处理、用量统计、取消和兼容性行为。

## 实现自定义流式传输

仅当现有 API 实现无法表示该服务时，才实现 `streamSimple`。请先研究 [`packages/ai/src/api`](https://github.com/earendil-works/pi/tree/main/packages/ai/src/api) 下的实现。

流接收规范化的 `TranscriptContext`。系统提示词和工具声明位于转录系统消息中，因此请使用 `getCurrentSystemPrompt(context.messages)` 和 `getCurrentTools(context.messages)` 读取它们，而不是依赖 `context.systemPrompt` 或 `context.tools`。支持对话中途系统消息的模型可以直接接收这些消息；否则，调用 `collapseSystemMessages(context)` 将后续系统消息合并到首条系统消息中。

自定义流必须：

1. 创建一条助手消息，包含提供商、模型、时间戳、待定停止原因、内容以及清零的使用量。
2. 请求设置成功后，在内容事件之前发出一个 `start` 事件。
3. 在发出平衡的文本、思考和工具调用事件时更新消息。
4. 最终确定使用量、成本、内容和停止原因。
5. 恰好发出一个终止性的 `done` 或 `error` 事件，并关闭流。
6. 将取消转换为中止结果。

请求设置可能在 `start` 之前失败；在这种情况下，流可以直接以 `error` 终止。缺少请求身份验证也可能在返回流之前同步抛出异常。

内容索引引用助手消息中的块。在发出其 `partial` 字段暴露该状态的事件之前，更新每个块。工具调用参数必须在 `toolcall_end` 时包含有效的解析输入。

流还必须遵循通过 `SimpleStreamOptions` 提供的请求插桩：

- 在发送提供商请求之前调用 `options.onPayload`，并使用它返回的任何替换负载。
- 在收到响应之后、消费其主体之前调用 `options.onResponse`。
- 在规范化每个解析的提供商事件之前，等待 `options.onProviderStreamEvent?.(providerEvent, model)`。
- 传递中止信号和提供商作用域的环境。

这些钩子支持扩展请求检查、响应头事件和提供商流观察。省略它们会使提供商的行为与 Pi 内置提供商不同。

## 报告失败与使用情况

设置具体的终端停止原因。错误和中止消息需要包含 `errorMessage`；成功消息则需要准确的输入、输出、缓存、总令牌数及成本数值。

Pi 在识别到上下文溢出错误后，可进行压缩并重试。若服务返回未知消息，仅在受保护的 `message_end` 处理器中，将该提供商的溢出响应规范化为 `context_length_exceeded`。

请勿将速率限制或提供商的临时故障改写为上下文溢出。此类失败应使用 Pi 的正常重试行为处理。

## 测试集成

至少测试以下内容：

- 普通文本响应与空文本响应
- 工具调用及工具结果
- 支持时的图像输入与图像工具结果
- 用量与成本核算
- 中止行为
- 上下文溢出
- 格式错误或部分流
- Unicode 边界
- 跨提供商会话交接
- 认证刷新与取消

[`packages/ai/test`](https://github.com/earendil-works/pi/tree/main/packages/ai/test) 下的提供商测试定义了内置提供商应具备的行为。应适配相关测试套件，而非仅依赖手动提示。

开发时直接运行扩展，然后将其移至已发现的扩展位置，或通过 [Pi 软件包](/docs/packages/) 分发。在活动会话中更改已发现的提供商扩展后，使用 `/reload` 重新加载。
