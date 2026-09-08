# SDK

> Pi 可以帮你使用 SDK——把你的集成用例告诉它。

SDK 提供对 Pi 智能体能力的编程访问：把 Pi 嵌入其他应用、构建自定义界面或接入自动化工作流。

**典型用例：**
- 构建自定义 UI（Web、桌面、移动）
- 把智能体能力集成进现有应用
- 用智能体推理搭建自动化流水线
- 构建派生子智能体的自定义工具
- 以编程方式测试智能体行为

从最小示例到完全控制的可运行代码见 [examples/sdk/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk/)。

> 本文为结构化中文编译版；完整选项与类型签名见[英文原文](https://pi.dev/docs/latest/sdk)。

## 快速上手

SDK 包含在主包中，无需单独安装：

```bash
npm install @earendil-works/pi-coding-agent
```

```typescript
import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();
await session.prompt("总结一下这个目录");
for await (const event of session.events) {
  // 处理事件流
}
```

## 核心概念

### createAgentSession()

创建单个 `AgentSession` 的主工厂函数。它内部使用 `ResourceLoader` 提供扩展、技能、提示词模板、主题和上下文文件；不提供时使用按标准发现规则工作的 `DefaultResourceLoader`。

### AgentSession

会话对象管理智能体生命周期、消息历史、模型状态、压缩与事件流。

注意：`session.navigateTree()` 在智能体回复中、手动/自动压缩中或其他树导航进行中时会直接拒绝（即使 `summarize: false`），不会排队，也不返回 `{ cancelled: true }`。请先等待活动操作结束（如 `await session.waitForIdle()`）再重试；拒绝不会改变活动分支。

### createAgentSessionRuntime() 与 AgentSessionRuntime

需要替换活动会话并重建绑定 cwd 的运行时状态时，用运行时 API——这正是内置交互、print、RPC 模式使用的层。

`createAgentSessionRuntime()` 接收运行时工厂和初始 cwd/会话目标。工厂捕获进程级固定输入，为生效 cwd 重建绑定服务，解析会话选项并返回完整运行时结果。

`AgentSessionRuntime` 负责替换活动运行时的操作：

- `newSession()`
- `switchSession()`
- `fork()`
- 经 `fork(entryId, { position: "at" })` 的克隆流程
- `importFromJsonl()`

重要行为：

- 这些操作之后 `runtime.session` 会变化
- 事件订阅绑定在特定 `AgentSession` 上，替换后需要重新订阅
- 使用扩展时，对新会话再次调用 `runtime.session.bindExtensions(...)`
- 创建过程的诊断在 `runtime.diagnostics` 上返回
- 运行时创建或替换失败时方法抛错，由调用方决定处理方式

### 提示与消息排队

`PromptOptions` 控制提示词展开、流式期间的排队行为和提示词预检通知：

- `preflightResult` 每次 `prompt()` 调用触发一次：`true` 表示提示词被接受、排队或立即处理；`false` 表示预检拒绝
- `prompt()` 在完整运行（含重试）结束后才 resolve；接受之后的失败通过正常的事件与消息流报告，而不是 `preflightResult(false)`

`prompt()` 会处理提示词模板、扩展命令和消息发送：

- **扩展命令**（如 `/mycommand`）：立即执行，流式期间也一样；它们经 `pi.sendMessage()` 自己管理 LLM 交互
- **文件式提示词模板**（`.md` 文件）：发送或排队前展开为内容
- **流式期间未指定 `streamingBehavior`**：抛错；请直接用 `steer()` / `followUp()`，或指定该选项

## 选项参考

`createAgentSession()` 的选项覆盖：

- **目录** —— cwd、会话目录等
- **模型** —— provider/model/thinkingLevel 或从设置解析
- **API Key 与 OAuth** —— 环境变量、auth.json 或显式传入
- **系统提示** —— 替换或追加
- **工具** —— 启用/禁用内置工具、注册自定义工具
- **扩展/技能/上下文文件** —— 显式加载或禁用发现
- **斜杠命令** —— 自定义命令注册
- **会话管理** —— 会话文件、目录与持久化策略
- **设置管理** —— 读写全局/项目设置

完整表格见英文原文。

## ResourceLoader 与返回值

`ResourceLoader` 决定扩展、技能、模板、主题与上下文文件从哪来；自定义实现可以完全接管资源发现。`createAgentSession()` 返回 `{ session, runtime? }` 形式的结果（视选项而定）。

## 运行模式

SDK 同时暴露 Pi 各内置模式使用的入口：

- **InteractiveMode** —— 完整终端 UI
- **runPrintMode** —— 一次性执行
- **runRpcMode** —— 基于 stdin/stdout 的 [RPC 协议](/docs/rpc/)

## 导出

`@earendil-works/pi-coding-agent` 同时导出消息类型、会话管理器、压缩工具（`convertToLlm`、`serializeConversation`）等，详见英文原文的 Exports 列表。
