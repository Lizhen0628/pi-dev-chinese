# 自定义提供商

提供商扩展将 Pi 连接至需要自定义认证、模型发现、请求处理或流的模型服务。如果服务已支持现有 API，则可在 `models.json` 中进行配置。

提供商扩展在 Pi 内部运行，可检查凭证、提示词、工具定义、模型响应和使用量。请将其视为受信任代码，并避免记录机密信息或提供商负载。

## 选择最小的集成方案

| 需求 | 使用方法 |
|---|---|
| 在受支持的 API 后添加模型 | [`models.json`](models.md#configure-a-compatible-endpoint) |
| 更改现有提供商端点或请求头 | `models.json` 或小型提供商扩展 |
| 动态发现模型 | 带有 `refreshModels` 的提供商 |
| 添加 `/login` 流程 | 具有原生或传统 OAuth 配置的提供商 |
| 实现不受支持的有线协议 | 带有 `stream` 或 `streamSimple` 的提供商 |

提供商扩展是一种[扩展](/docs/extensions/)，因此它遵循相同的加载、信任、重新加载和错误处理行为。

## 注册提供商

在扩展工厂中调用 `pi.registerProvider()`。Pi 会等待异步工厂完成后才继续启动，因此在此注册的提供商可用于启动模型选择和 `pi --list-models`。

有两种注册形式：

- 从 `@earendil-works/pi-ai` 注册完整的 `Provider`，以获得原生认证、过滤、发现、刷新和流式行为。
- 使用 `ProviderConfig` 注册提供商名称，采用现有扩展使用的旧配置形式。

对于拥有不止静态端点和模型元数据的新集成，优先使用完整提供商。Pi 会在已注册的原生提供商之上组合 `models.json` 覆盖。

仅为现有提供商注册 `baseUrl` 或 `headers` 会保留其内置模型。在旧形式中提供 `models` 会替换该注册提供的模型。

初始扩展加载后进行的调用会立即生效。使用 `pi.unregisterProvider()` 移除动态提供商并恢复其替换的内置行为。

参见已检查的 [GitLab Duo 提供商](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/) 示例，了解将流式处理委托给内置 API 实现的完整注册。

## 提供认证

静态提供商可以从字面量、环境变量插值或命令中解析 API 密钥。这些值使用与 `models.json` 相同的语法：

- `$NAME` 和 `${NAME}` 读取环境变量。
- 以 `!` 开头的 `!command` 使用命令输出。
- `$$` 输出字面量 `$`。
- `$!` 输出字面量开头的 `!`。

当集成需要存储的凭据、自定义解析、提供商作用域的环境或多个登录方法时，请使用原生提供商认证。

OAuth 提供商提供显示名称、登录流程、令牌刷新和访问令牌解析。注册后，它会出现在 `/login` 中，Pi 将返回的凭据存储在 `~/.pi/agent/auth.json` 中。

OAuth 回调与 UI 无关。它们可以打开授权 URL、显示设备代码、报告进度、请求输入或让用户选择登录方法。在网络请求期间，请尊重取消操作和提供的中止信号。

切勿将访问令牌、刷新令牌、授权标头或完整的提供商响应写入普通日志。

## 供应与刷新模型

每个模型都需要 ID、显示名称、输入能力、上下文窗口、输出限制、推理支持及成本元数据。在提供商层级选择 API 实现，除非某个模型需要单独覆盖。

当 Pi 需要保持空闲提示缓存活跃时，将 `promptCache.short` 或 `promptCache.long` 设置为提供商尽力而为的缓存生命周期（秒）。若禁用该保留层级的缓存预热，则保持其未设置状态。

兼容性标志描述的是受支持 API 中已验证的差异。不要仅凭端点声称兼容就启用它们。

请对照实际服务器确认请求字段和响应行为。

当可用目录来自实时服务时，使用 `refreshModels`。将 `context.signal` 传递给阻塞 I/O，以便调用方可以取消刷新。

两种注册形式的刷新契约不同：

- 完整的 `Provider` 不返回任何内容。它调用 `context.publish({ update })` 来安装提供商拥有的模型状态，之后其同步的 `getModels()` 会暴露最新列表。
- 旧版 `ProviderConfig.refreshModels` 返回模型定义。Pi 会用返回的列表替换该注册的实时模型，并应用任何请求的持久化。

仅当持久化目录数据应在多次运行间保留时才发布它。像 llama.cpp 这样的实时服务可以更新其内存列表而不持久化；远程目录可以保留快照以供离线启动。

## 复用受支持的流式 API

当提供商协议匹配时，使用 Pi AI 的一个 API 实现。

受支持的实现涵盖 Anthropic Messages、OpenAI Chat Completions 和 Responses、Google Generative AI 和 Vertex、Azure OpenAI Responses、Mistral Conversations 以及 Bedrock Converse。

提供商仍可自定义身份验证、基础 URL、请求头、模型过滤和发现，同时将请求转换和流式传输委托给现有的 API 实现。

这比复制流式实现更安全，因为它保留了 Pi 的消息转换、工具处理、使用量核算、取消和兼容性行为。

## 实现自定义流式传输

仅当现有 API 实现无法表示该服务时，才实现 `streamSimple`。请先研究 [`packages/ai/src/api`](https://github.com/earend-wiles/pi/tree/main/packages/ai/src/api) 下的实现。

流接收规范化的 `TranscriptContext`。系统提示词和工具声明位于转录系统消息中，因此请使用 `getCurrentSystemPrompt(context.messages)` 和 `getCurrentTools(context.messages)` 读取它们，而不是期望 `context.systemPrompt` 或 `context.tools`。支持对话中途系统消息的模型可以直接接收这些消息；否则，调用 `collapseSystemMessages(context)` 将后续系统消息折叠到首条系统消息中。

自定义流必须：

1. 创建一条助手消息，包含提供商、模型、时间戳、待定的停止原因、内容和清零的使用量。
2. 请求设置成功后，在内容事件之前发出一个 `start` 事件。
3. 在发出平衡的文本、思考和工具调用事件时更新消息。
4. 完成使用量、成本、内容和停止原因的最终确定。
5. 恰好发出一个终止性的 `done` 或 `error` 事件，并关闭流。
6. 将取消转换为中止结果。

请求设置可能在 `start` 之前失败；在这种情况下，流可以直接以 `error` 终止。缺少请求身份验证也可能在返回流之前同步抛出异常。

内容索引引用助手消息中的块。在发出其 `partial` 字段暴露该状态的事件之前，更新每个块。工具调用参数必须在 `toolcall_end` 时包含有效的解析输入。

流还必须遵循通过 `SimpleStreamOptions` 提供的请求检测：

- 在发送提供商请求之前调用 `options.onPayload`，并使用它返回的任何替换载荷。
- 在收到响应之后、消费其主体之前调用 `options.onResponse`。
- 传递中止信号和提供商作用域的环境。

这些钩子为扩展请求检查和响应头事件提供支持。省略它们会使提供商的行为与 Pi 内置提供商不同。

## 报告失败与使用情况

设定具体的终端停止原因。错误与中止消息需包含 `errorMessage`；成功消息需提供准确的输入、输出、缓存、总令牌数及成本数值。

Pi 在识别到上下文溢出错误后，可进行压缩并重试。若服务返回未知消息，仅在受保护的 `message_end` 处理器中，将该提供商的溢出响应规范化为 `context_length_exceeded`。

请勿将速率限制或提供商的临时故障改写为上下文溢出。此类失败应使用 Pi 的正常重试机制处理。

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

开发时直接运行扩展，然后将其移至已发现的扩展位置，或通过 [Pi 软件包](/docs/packages/) 分发。在活动会话中更改已发现的提供商扩展后，使用 `/reload` 命令。
