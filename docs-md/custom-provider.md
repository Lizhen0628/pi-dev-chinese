# 自定义提供商

提供商扩展将 Pi 连接到需要自定义认证、模型发现、请求处理或流式传输的模型服务。如果服务已经支持某种 API，请在 `models.json` 中配置它。

提供商扩展在 Pi 内部运行，可以检查凭据、提示词、工具定义、模型响应和使用情况。将其视为可信代码，避免记录秘密或提供商负载。

## 选择最小的集成方式

| 需求 | 使用方式 |
|---|---|
| 在受支持的 API 后添加模型 | [`models.json`](models.md#configure-a-compatible-endpoint) |
| 更改现有提供商端点或请求头 | `models.json` 或小型提供商扩展 |
| 动态发现模型 | 带 `refreshModels` 的提供商 |
| 添加 `/login` 流程 | 带原生或旧版 OAuth 配置的提供商 |
| 实现不受支持的线上协议 | 带 `stream` 或 `streamSimple` 的提供商 |

提供商扩展是一种[扩展](/docs/extensions/)，因此它遵循相同的加载、信任、重载和错误行为。

## 注册提供商

在扩展工厂中调用 `pi.registerProvider()`。Pi 在启动继续之前会等待异步工厂，因此在此注册的提供商可供启动模型选择和 `pi --list-models` 使用。

注册有两种形式：

- 注册来自 `@earendil-works/pi-ai` 的完整 `Provider`，以获得原生认证、过滤、发现、刷新和流式行为。
- 使用 `ProviderConfig` 注册提供商名称，以供现有扩展使用的旧版配置形式。

对于拥有静态端点和模型元数据以外更多内容的新集成，优先使用完整提供商。Pi 在已注册的原生提供商之上组合 `models.json` 覆盖。

仅注册现有提供商的 `baseUrl` 或 `headers` 会保留其内置模型。在旧版形式中提供 `models` 会替换该提供商在聊天、图像和分类器操作中的模型。省略 `type` 表示 `"chat"`；图像和分类器模型需要通过 `images` 和 `classifiers` 字段显式区分，并按其 `api` 值键控实现。

### 重定向现有提供商

仅注册需要变更的字段。这样可以保留提供商的内置目录、身份验证、API 实现和兼容性设置：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("anthropic", {
    baseUrl: "https://gateway.example.com/anthropic",
    headers: {
      "X-Gateway-Key": "$GATEWAY_API_KEY",
    },
  });
}
```

对于保持上游协议的代理或网关，请使用此形式。不要将内置模型列表复制到扩展中，因为这样做会将一个小的端点覆盖变成可能发生漂移的目录替换。

### 注册兼容端点

当服务实现了受支持的协议但拥有自己的模型目录时，注册端点及服务实际暴露的模型：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("acme", {
    name: "Acme AI",
    baseUrl: "https://api.acme.example/v1",
    apiKey: "$ACME_API_KEY",
    api: "openai-completions",
    models: [
      {
        type: "chat",
        id: "acme-chat",
        name: "Acme Chat",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  });
}
```

在此情况下，若无需可执行扩展行为，优先使用 `models.json`。当注册依赖运行时发现、自定义认证或与其他扩展功能共享代码时，请使用扩展。

### 混合注册提供商

混合提供商通过 `pi.registerProvider()` 扩展实现，用于注册自定义模型提供商及其自有端点配置。

此类提供商可注册由内置提供商 API 实现支持的自定义模型，也可注册自定义 API 实现，或两者兼有。与静态扩展声明的提供商不同，混合提供商在会话期间动态注册，并能即时生效与移除。

注册后，已注册的模型可作为标准 pi 模型使用，并支持自定义模型专属配置（如自定义头部信息）。此机制可用于注册与内置提供商使用相同端点格式的第三方模型，或开发需借助内置模型基础设施的完全定制模型生态。

下面的示例注册了一个混合提供商，混合了内置 API 实现与自定义 API 实现：

```typescript
pi.registerProvider("media-tools", {
  apiKey: pi.secret("MEDIA_TOOLS_API_KEY"),
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

模型级别的 `baseUrl` 值优先于提供商端点。若未提供 `models` 列表，则保留所有操作的内置模型。不同操作中相同的模型 ID 仍然保持独立，包括其模型专属头部信息。

初始扩展加载后的调用会立即生效。可使用 `pi.unregisterProvider()` 移除动态提供商并恢复其所替代的内置行为。

请参阅已检查的 [GitLab Duo 提供商](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/) 获取完整注册示例，该示例将流式处理委托给内置 API 实现。

## 提供认证

静态提供商可以从字面量、环境变量插值或命令中解析 API 密钥。这些值使用与 `models.json` 相同的语法：

- `$NAME` 和 `${NAME}` 读取环境变量。
- 以 `!` 开头的 `!command` 使用命令输出。
- `$$` 输出字面量 `$`。
- `$!` 输出字面量开头的 `!`。

当集成需要存储的凭据、自定义解析、提供商作用域的环境或多个登录方法时，请使用原生提供商认证。

OAuth 提供商提供显示名称、登录流程、令牌刷新和访问令牌解析。注册后，它会出现在 `/login` 中，Pi 将返回的凭据存储在 `~/.pi/agent/auth.json` 中。

OAuth 回调与 UI 无关。它们可以打开授权 URL、显示设备代码、报告进度、请求输入或让用户选择登录方法。在网络请求期间，请尊重取消操作和提供的中止信号。

按 Enter（`tui.select.confirm`）打开设备登录 URL 并复制代码，或手动登录。提供商可以在 `onDeviceCode` 或原生 `AuthEvent` 通知中通过 `openBrowserOnConfirm: false` 或 `copyCodeOnConfirm: false` 禁用任一操作。

切勿将访问令牌、刷新令牌、授权标头或完整的提供商响应写入普通日志。

## 供应与刷新模型

每个模型都需要 ID、显示名称、输入能力及成本元数据。聊天和分类模型还需要上下文窗口；聊天模型需要输出限制和推理支持；图像模型声明其输出模态。除非某个模型需要覆盖，否则在提供商级别选择 API 实现。

当 Pi 应保持空闲提示缓存温暖时，将 `promptCache.short` 或 `promptCache.long` 设置为提供商尽力而为的缓存生命周期（秒）。若需禁用该保留层的缓存预热，则保持其未设置状态。

兼容性标志描述的是受支持 API 中已验证的差异。不要仅因端点声称兼容就启用它们。

请对照实际服务器确认请求字段和响应行为。

当可用目录来自实时服务时，使用 `refreshModels`。将 `context.signal` 传递给阻塞 I/O，以便调用方可以取消刷新。

两种注册形式的刷新契约不同：

- 完整的 `Provider` 不返回任何内容。它调用 `context.publish({ update })` 来安装提供商拥有的模型状态，之后其同步的 `getModels()` 会暴露最新列表。
- 旧版 `ProviderConfig.refreshModels` 返回混合操作的模型定义。Pi 会用返回的列表替换该注册的实时模型，并应用任何请求的持久化。

仅当持久化目录数据应在多次运行间保留时才发布它。诸如 llama.cpp 之类的实时服务可以更新其内存列表而不持久化；远程目录可以保留快照以供离线启动。

## 复用受支持的流式 API

当提供商协议与 Pi AI 的 API 实现匹配时，使用其中一个实现。

受支持的实现涵盖 Anthropic Messages、OpenAI Chat Completions 与 Responses、Google Generative AI 与 Vertex、Azure OpenAI Responses、Mistral Conversations 以及 Bedrock Converse。

提供商仍可自定义认证、基础 URL、请求头、模型过滤和发现，同时将请求转换和流式处理委托给现有的 API 实现。

这比复制流实现更安全，因为它保留了 Pi 的消息转换、工具处理、用量统计、取消和兼容性行为。

## 实现自定义流式传输

仅当现有 API 实现无法表示服务时，才实现 `streamSimple`。首先研究 [`packages/ai/src/api`](https://github.com/earendil-works/pi/tree/main/packages/ai/src/api) 下的实现。

该流接收一个规范化的 `TranscriptContext`。系统提示词和工具声明位于记录的系统消息中，因此使用 `getCurrentSystemPrompt(context.messages)` 和 `getCurrentTools(context.messages)` 读取它们，而不是期望 `context.systemPrompt` 或 `context.tools`。支持会话中系统消息的模型可以就地接收它们；否则调用 `collapseSystemMessages(context)` 将后续系统消息合并到第一条中。

自定义流必须：

1. 创建带有提供商、模型、时间戳、待处理停止原因、内容和零化用量的助手消息。
2. 请求设置成功后，在内容事件之前发送一个 `start` 事件。
3. 在发送平衡的文本、思考和工具调用事件时更新消息。
4. 完成用量、成本、内容和停止原因的最终化。
5. 恰好发送一个终止性的 `done` 或 `error` 事件，并关闭流。
6. 将取消转换为中止结果。

请求设置可能在 `start` 之前失败；在这种情况下，流可以直接以 `error` 终止。缺少请求认证也可能在返回流之前同步抛出异常。

内容索引指助手消息中的块。在发送其 `partial` 字段暴露该状态的事件之前，更新每个块。工具调用参数在 `toolcall_end` 时必须包含有效的解析输入。

该流还必须遵从通过 `SimpleStreamOptions` 提供的请求检测：

- 在发送提供商请求之前调用 `options.onPayload`，并使用它返回的任何替换载荷。
- 在收到响应后但在使用其主体之前调用 `options.onResponse`。
- 在规范化每个解析的提供商事件之前，等待 `options.onProviderStreamEvent?.(providerEvent, model)`。
- 传递中止信号和提供商范围的环境。

这些钩子支持扩展请求检查、响应头事件和提供商流观察。省略它们会使提供商的行为与 Pi 的内置提供商不同。

## 报告失败与使用情况

设置一个具体的终端停止原因。错误和中止消息必须包含 `errorMessage`；成功消息则需要准确的输入、输出、缓存、总令牌数以及成本数值。

Pi 在识别出上下文溢出错误后，可以进行压缩并重试。如果服务使用了未知消息，则在受保护的 `message_end` 处理器中，仅将该提供商的溢出响应规范化为 `context_length_exceeded`。

不要将速率限制或临时性提供商故障改写为上下文溢出。此类失败应使用 Pi 的正常重试机制进行处理。

## 测试集成

测试至少包括：

- 普通和空文本响应
- 工具调用和工具结果
- 支持的图像输入和图像工具结果
- 使用量和成本核算
- 中止行为
- 上下文溢出
- 格式错误或不完整的流
- Unicode 边界
- 跨提供商会话交接
- 认证刷新和取消

在 [`packages/ai/test`](https://github.com/earendil-works/pi/tree/main/packages/ai/test) 下的提供商测试定义了内置提供商的预期行为。调整相关测试套件，而不是仅依赖手动提示。

开发时直接运行扩展，然后将其移动到已发现的扩展位置或通过 [Pi 软件包](/docs/packages/) 分发。在活动会话中更改已发现的提供商扩展后，使用 `/reload`。
