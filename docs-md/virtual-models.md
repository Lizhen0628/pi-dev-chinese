# 虚拟模型

虚拟模型是一个可选择的模型，它会为每次请求挑选一个物理模型。您可以通过它按任务、成本或对话状态进行路由。例如，一个路由器可以将快速问题发送给小模型，将难题发送给大模型，而用户只需选择一个模型即可。

从[扩展](/docs/extensions/)注册虚拟模型。它们会像其他任何模型一样出现在`/model`、`--model`、作用域模型和设置中。虚拟模型可以列在任何提供商之下，包括包含物理模型的提供商，如`openai-codex/auto`。

## 选择与分发

虚拟模型会选择一个模型和一个思考级别。路由器将该组合映射为每个请求的物理组合：

```
selected (virtual model, virtual level)  ->  dispatched (physical model, physical level)
jev/auto:low                             ->  anthropic/claude-sonnet-4-5:high
```

虚拟思考级别是路由器的输入。其含义由路由器决定；它不必对应推理预算。

Pi 将这两对组合分开管理：

| | 选择 | 分发 |
|---|---|---|
| 记录于 | `model_change` 和 `thinking_level_change` 条目 | 每条助手消息：`provider`、`api`、`model`、`thinkingLevel` |
| 显示为 | `ctx.model`、`ctx.thinkingLevel`、`PI_MODEL`、`PI_REASONING_LEVEL`、`/model` | 每个响应的助手消息 |

提供商仅接收物理模型。助手消息指明物理模型，因此在不同物理模型之间重放对话与手动切换模型后的效果相同。恢复会话时，会从其最新的 `model_change` 条目恢复虚拟选择。如果虚拟模型不再注册，Pi 会回退到最后响应的物理模型。

在交互模式下，页脚会在选择旁边显示路由后的模型，例如 `auto • high → gpt-5.6-luna • medium`。`/session` 列出每个物理模型的成本。

上下文使用量采用生成最新响应的物理模型的限制，即使该响应发生在切换到虚拟模型之前。如果没有此类响应，则使用虚拟模型上声明的限制（如果有）。压缩会检查相同的限制，并再次检查每个请求路由到的模型的限制。如果该模型的上下文窗口对于对话来说太小，Pi 会在发送请求前进行压缩；路由保持路由器选择的结果。

## 注册虚拟模型

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerVirtualModel({
    provider: "router",
    id: "auto",
    name: "自动",
    thinkingLevels: ["low", "high"],
    route(request, ctx) {
      // 工具追问和重试会停留在处理该轮对话的模型上。
      const sticky = request.failed ?? request.previous;
      if (request.reason !== "user" && sticky) {
        return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "medium" };
      }
      const id = request.thinkingLevel === "high" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
      return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium" };
    },
  });
}
```

- `provider` 是该模型所属的提供商。它可以是任何提供商 ID。一个提供商可以在其物理模型旁边列出多个虚拟模型。在物理提供商下，当该提供商具有凭据时，虚拟模型可用。在没有任何提供商使用的 ID 下，它始终可用。
- `id` 不能是该提供商的物理模型 ID。如果之后目录刷新添加了具有相同 ID 的物理模型，虚拟模型会将其隐藏。
- `thinkingLevels` 列出可供选择的思考级别。默认为 `["off"]`。
- `contextWindow` 和 `maxTokens` 在首次响应之前显示。未设置的限制为未知。
- `input` 列出可供选择的输入类型。默认为文本和图像；不支持图像的物理模型会收到占位符。

注册遵循与 `pi.registerProvider()` 相同的排队和重载规则。再次注册相同的提供商和 ID 会替换虚拟模型。`pi.unregisterVirtualModel(provider, id)` 将其移除；`pi.unregisterProvider()` 不会。SDK 代码可以在没有扩展的情况下注册一个：`modelRuntime.registerVirtualModel(definition)`。

## 路由请求

`route(request, ctx)` 在使用虚拟模型发出的每个请求之前运行，并返回 `{ model, thinkingLevel }`。该模型可以是目录中任何提供商拥有凭据的物理模型；可通过 `ctx.modelRegistry` 查找。虚拟模型不能路由到另一个虚拟模型。Pi 会将思考级别限制为返回的模型。

| 字段 | 含义 |
|---|---|
| `model`, `thinkingLevel` | 选定的虚拟模型和级别 |
| `reason` | 发起请求的原因，见下文 |
| `previous` | `messages` 中最近一次成功响应的物理模型和思考级别 |
| `failed` | 对于 `retry`：失败请求的物理模型、思考级别和助手 `message`，`messages` 中不再包含该消息。该消息带有 `stopReason` 和 `errorMessage`。当路由本身失败时，此字段不存在 |
| `state` | 此会话分支上上次返回的路由器状态，见下文 |
| `messages` | 此请求的对话内容，包括系统消息 |
| `signal` | 请求的中止信号 |

| `reason` | 请求 |
|---|---|
| `user` | 用户编写消息后的第一个请求，包括引导和追问消息 |
| `continuation` | 代理循环中的任何其他请求，例如工具结果或扩展消息之后 |
| `retry` | 请求失败后的自动重试，包括上下文溢出压缩后的重试 |
| `direct` | 在代理循环之外发出的请求，例如压缩摘要或扩展调用 `ctx.modelRegistry.streamSimple()` |

为 `continuation` 返回 `previous`、为 `retry` 返回 `failed` 可保持提示缓存和思考签名有效。在轮次之间切换模型是允许的，但会丢失提示缓存。重试也可以切换到另一个模型，例如当 `failed.message.errorMessage` 报告提供商过载或上下文溢出时。

如果 `route()` 抛出异常，或返回虚拟模型或没有凭据的模型，请求将以错误响应结束。

## 保留路由状态

`route()` 可以在模型旁边返回 `state`。Pi 将其存储在会话分支上，并在后续请求中作为 `request.state` 传回。用于转录未记录的决策，例如分类器结果或路由阶段：

```typescript
pi.registerVirtualModel<{ phase: "plan" | "build" }>({
  provider: "router",
  id: "phased",
  name: "Phased",
  route(request, ctx) {
    const state = request.state ?? { phase: "plan" };
    const id = state.phase === "plan" ? "claude-opus-4-5" : "claude-haiku-4-5";
    return { model: ctx.modelRegistry.find("anthropic", id)!, thinkingLevel: "medium", state };
  },
});
```

- 状态必须是 JSON 可序列化的。返回 `undefined` 或 `request.state` 本身会保留当前状态。
- Pi 在发送请求之前将任何其他返回的对象存储为新状态，即使它与当前状态相同也是如此。仅在状态更改时返回新对象。如果请求后续失败，状态仍会存储。
- 状态跟随会话树，因此分支和 `/tree` 导航可以看到其分支的状态。它能在压缩后保留。
- `direct` 请求没有状态，Pi 会忽略它们返回的状态。

转录已经记录了选择和每个派发的模型，`ctx.sessionManager.getBranch()` 暴露了这两者。

路由器可以通过 `ctx.modelRegistry` 调用其他模型，例如使用来自 `ctx.modelRegistry.findOfType("classifier", provider, id)` 的分类器模型调用 `ctx.modelRegistry.classify()`。该调用会在回合的第一个 token 之前增加延迟。

完整的路由器参见 [`jev-router.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/jev-router.ts)。它在由 Jev 分类器选择的强大 OpenAI Codex 模型上规划，让该模型进行第一次编辑，然后切换一次到更便宜的模型，接受一次提示词缓存未命中。它将阶段保持为路由器状态。
