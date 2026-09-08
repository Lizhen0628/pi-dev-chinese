# 自定义提供商

扩展可以通过 `pi.registerProvider()` 注册自定义模型提供商。用途包括：

- **代理** —— 经公司代理或 API 网关路由请求
- **自定义端点** —— 接入自托管或私有模型部署
- **OAuth/SSO** —— 为企业提供商添加认证流程
- **自定义 API** —— 为非标准 LLM API 实现流式对接

> 本文为结构化中文编译版；完整代码与类型定义见[英文原文](https://pi.dev/docs/latest/custom-provider)。

## 示例扩展

完整的提供商扩展示例：

- [`examples/extensions/custom-provider-anthropic/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-anthropic/)
- [`examples/extensions/custom-provider-gitlab-duo/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/custom-provider-gitlab-duo/)

## 快速参考

扩展可以注册完整的 pi-ai `Provider`，或使用旧式的提供商配置形式。需要自定义认证、过滤、刷新或流式行为时，优先用完整 Provider。Pi 会把 `models.json` 的覆盖组合在已注册的原生提供商之上。

扩展工厂也可以是 `async`。要动态发现模型时，在工厂里抓取并注册模型（而不是在 `session_start` 里）。Pi 会等待工厂完成后再继续启动，因此提供商在交互启动期间和 `pi --list-models` 中都可用。

## 覆盖现有提供商

最简单的用例：把现有提供商重定向到代理。只提供 `baseUrl` 和/或 `headers`（不给 `models`）时，该提供商的所有现有模型都会保留并指向新端点。

## 注册新提供商

添加全新提供商时，在配置中指定 `models`。模型列表来自远程端点时，用异步扩展工厂；这样抓取到的模型会在启动完成前注册好。

提供 `models` 时会**替换**该提供商的全部现有模型。

`apiKey` 与自定义头的取值语法与 `models.json` 相同：开头的 `!command` 执行命令取整值，`$ENV_VAR` 和 `${ENV_VAR}` 插值环境变量，`$$` 输出字面 `$`，`$!` 输出字面 `!`。

## 注销提供商

用 `pi.unregisterProvider(name)` 移除之前注册的提供商。注销会移除该提供商的动态模型、API Key 回退、OAuth 注册和自定义流式处理器；被覆盖的内置模型与行为会恢复。

初始扩展加载阶段之后的调用立即生效，无需 `/reload`。

### API 类型

`api` 字段决定使用哪种流式实现：

| API | 适用 |
|-----|------|
| `anthropic-messages` | Anthropic Claude API 及兼容端点 |
| `openai-completions` | OpenAI Chat Completions API 及兼容端点 |
| `openai-responses` | OpenAI Responses API |
| `azure-openai-responses` | Azure OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex Responses API |
| `mistral-conversations` | Mistral 原生 Chat Completions 流式 |
| `google-generative-ai` | Google Generative AI API |
| `google-vertex` | Google Vertex AI API |
| `bedrock-converse-stream` | Amazon Bedrock Converse API |

大多数 OpenAI 兼容提供商用 `openai-completions` 即可。模型专属思考等级用模型级 `thinkingLevelMap`；提供商怪癖用 `compat`。`xhigh` 与 `max` 等级需要显式映射条目，中间可以有不支持的空档。

`openrouter` 对应 OpenRouter 风格的 `reasoning: { effort }`；`together` 对应 Together 风格的 `reasoning: { enabled }`（设 `supportsReasoningEffort` 后也会发送 `reasoning_effort`）；`qwen-chat-template` 用于读取 `chat_template_kwargs.enable_thinking` 且需要 `preserve_thinking` 的本地 Qwen 兼容服务器。

暴露 Anthropic 风格提示词缓存（在系统提示、最后一个工具定义和最后一条 user/assistant/tool-result 文本上带 `cache_control`）的 OpenAI 兼容提供商，使用 `cacheControlFormat: "anthropic"`。

对 `api: "anthropic-messages"` 的 Anthropic 兼容提供商，上游模型要求自适应思考（`thinking.type: "adaptive"` 加 `output_config.effort`）时，在模型或提供商上设 `compat.forceAdaptiveThinking: true`；内置的自适应 Claude 模型已自动设置。仅在提供商发出空思考签名并期望重放 `signature: ""` 时设 `compat.allowEmptySignature: true`。

## OAuth 支持

`registerProvider` 支持自定义 OAuth 登录流程：提供 `OAuthLoginCallbacks`（发起授权、等待回调、换取令牌）与 `OAuthCredentials`（令牌、过期与刷新）。`/login` 中会出现你的提供商；令牌存入 `auth.json` 并自动刷新。完整的回调接口与生命周期见英文原文。

## 自定义流式 API

非标准 API 可以注册自定义流式处理器，绕过内置 API 类型。需要实现：

- **流模式** —— 发起请求、解析响应块并产出标准化事件
- **事件类型** —— 文本增量、思考块、工具调用开始/增量/结束
- **内容块** —— 文本、思考、工具调用的组装规则
- **用量与费用** —— 从响应中提取 token 用量与成本
- **上下文溢出错误** —— 识别提供商的上下文超限错误，让 Pi 能触发自动压缩

注册使用 `pi.registerStreamingHandler()`，事件与内容块类型见英文原文的类型参考。

## 测试你的实现

- `pi --list-models` 验证模型发现与注册
- 交互模式用 `/model` 选择后发起简单请求
- 完整示例扩展包含最小测试脚本

## 配置与模型定义参考

`registerProvider` 接受的完整配置（`baseUrl`、`api`、`apiKey`、`headers`、`models`、`modelOverrides` 等）与模型定义字段（`id`、`name`、`reasoning`、`contextWindow`、`maxTokens`、`cost`、`compat`、`thinkingLevelMap` 等）与 [models.json 的字段一致](/docs/models/)，参阅英文原文的 Config Reference 与 Model Definition Reference。
