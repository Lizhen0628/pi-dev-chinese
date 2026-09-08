# TUI 组件

> Pi 可以创建 TUI 组件——把你的界面需求告诉它。

扩展和自定义工具可以渲染自定义 TUI 组件构建交互界面。本页介绍组件系统与可用的积木。

**源码：** [`@earendil-works/pi-tui`](https://github.com/earendil-works/pi/tree/main/packages/tui)

> 本文为结构化中文编译版；完整接口与示例代码见[英文原文](https://pi.dev/docs/latest/tui)。

## 组件接口

所有组件实现同一接口：

| 方法 | 说明 |
|------|------|
| `render(width)` | 返回字符串数组（每行一个）。每行**不得超过 `width`** |
| `handleInput?(data)` | 组件持有焦点时接收键盘输入 |
| `handleMouse?(event)` | 全屏模式下接收归一化的指针输入 |
| `wantsKeyRelease?` | 为 true 时接收按键释放事件（Kitty 协议）。默认 false |
| `invalidate()` | 清除缓存的渲染状态；主题变化时被调用 |

TUI 会在每行渲染结果末尾追加完整的 SGR 重置与 OSC 8 重置——样式不跨行。多行文本如需统一样式，请逐行重新应用，或使用 `wrapTextWithAnsi()` 让换行后的每行都保留样式。

## Focusable 接口（输入法支持）

显示文本光标、需要 IME（输入法）支持的组件应实现 `Focusable` 接口。组件获得焦点时，TUI 会：

1. 在组件上设置 `focused = true`
2. 在渲染输出中扫描 `CURSOR_MARKER`（零宽 APC 转义序列）
3. 把硬件终端光标定位到该位置
4. 仅在 `showHardwareCursor` 开启时显示硬件光标

光标默认隐藏：既保留"假光标"渲染，又能为用隐藏光标跟踪 IME 候选窗的终端定位硬件光标。部分终端需要可见的硬件光标才能定位 IME——用渲染器的 `showHardwareCursor` 构造参数或 `setShowHardwareCursor(true)` 开启；Pi 也会把 `PI_HARDWARE_CURSOR=1` 映射到该设置。内置的 `Editor` 和 `Input` 已实现此接口。

### 内嵌输入框的容器组件

容器组件（对话框、选择器等）内含 `Input` 或 `Editor` 子组件时，容器必须实现 `Focusable` 并把焦点状态传播给子组件，否则 IME 输入的硬件光标定位会错位——不传播的话，用中文、日文、韩文等输入法打字时候选窗会出现在错误位置。

## 使用组件

- **扩展中**：经 `ctx.ui.custom()` 挂载
- **自定义工具中**：同样经 `ctx.ui.custom()` 挂载

## 覆盖层（Overlay）

覆盖层在现有内容之上渲染组件而不清屏。`ctx.ui.custom()` 传 `{ overlay: true }` 即可。覆盖层有自己的焦点规则与生命周期（挂载、焦点进出、关闭回调），详见英文原文。

## 内置组件

| 组件 | 用途 |
|------|------|
| `Text` | 静态文本（支持 ANSI 样式与自动换行） |
| `Box` | 带边框容器 |
| `Container` | 纵向堆叠子组件的容器 |
| `Spacer` | 弹性空白 |
| `Markdown` | Markdown 渲染 |
| `Image` | 内联图片（终端支持时） |

另有 `SelectList`、`SettingsList`、`BorderedLoader`、`Input`、`Editor` 等高阶组件，覆盖常见交互。

## 键盘与鼠标输入

键盘输入经 `handleInput` 接收原始字节序列；鼠标输入在全屏模式下经 `handleMouse` 接收归一化事件（点击、拖动、滚轮）。行宽处理与文本测量工具见英文原文。

## 创建自定义组件

实现 `render(width)` 即可参与渲染循环；需要交互再加 `handleInput`/`handleMouse`。渲染是即时模式：每次失效后重新 `render`。

## 主题化

组件颜色从主题令牌解析（见[主题](/docs/themes/)）；主题切换时 TUI 调用所有组件的 `invalidate()` 并触发重渲染。

## 调试与性能

- **调试日志**：组件渲染问题可通过 TUI 的调试日志排查（环境变量见[环境变量](/docs/environment-variables/)）
- **性能**：高耗渲染（大列表、语法高亮）应缓存结果并在 `invalidate()` 时清除
- **失效与主题切换**：常见陷阱是缓存了带颜色的渲染结果；正确模式是"失效时重建"——主题切换后重新生成带样式的行。何时需要这一模式见英文原文

## 常见模式

官方文档覆盖了这些可直接套用的模式：

1. **选择对话框**（SelectList）
2. **可取消的异步操作**（BorderedLoader）
3. **设置/开关列表**（SettingsList）
4. **持久状态指示器**（含工作指示器自定义）
5. **编辑器上下的挂件**（widgets）
6. **自定义页脚**
7. **自定义编辑器**（vim 模式等）

## 关键规则

- 每行渲染输出不得超过给定 `width`
- 样式不跨行，多行文本逐行应用
- 含输入框的容器必须传播 `Focusable` 状态
- 缓存渲染结果时，务必在 `invalidate()` 中清除

## 示例

官方示例见 [examples/](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/)，其中 `snake.ts` 是完整的游戏 UI 示例。
