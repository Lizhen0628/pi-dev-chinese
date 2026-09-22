# 终端界面

`@earendil-works/pi-tui` 提供了 Pi 所使用的终端组件系统。当内置对话框、通知、状态文本和小组件不足以满足扩展所需的交互时，扩展可以使用该系统。

从[扩展](extensions.md#interact-with-the-user)的 `ctx.ui` 方法开始。仅当界面需要自己的渲染、键盘或鼠标输入、焦点、布局或生命周期时，才构建自定义组件。

## 选择集成点

| 需求 | 使用方式 |
|---|---|
| 选择、确认、输入或多行编辑器 | `ctx.ui.select()`、`confirm()`、`input()` 或 `editor()` |
| 非阻塞反馈 | `ctx.ui.notify()` 或 `setStatus()` |
| 编辑器附近的持久内容 | `ctx.ui.setWidget()` |
| 替换页眉、页脚或编辑器 | 相应的 `ctx.ui` 组件工厂 |
| 临时交互式屏幕或覆盖层 | `ctx.ui.custom()` |
| 工具或会话条目的自定义渲染 | 扩展渲染器 |

这些 API 在需要时会接收 Pi 的活动主题和按键绑定。不要在扩展内部创建第二个终端渲染器。

## 理解组件模型

组件为可用宽度渲染一系列终端行。它可以选择性地处理键盘和鼠标输入，并且当状态或依赖主题的内容发生变化时，必须使缓存的输出失效。

每个渲染行都必须适合提供的宽度。测量可见终端列数而不是字符串长度，因为 ANSI 转义、宽字符、emoji 和组合字符会改变显示宽度。

使用 `visibleWidth()`、`truncateToWidth()`、`sliceByColumn()` 和 `wrapTextWithAnsi()`，不要自己实现终端宽度处理。Pi 会在每行后重置样式和超链接，因此要在每个渲染行上重新应用样式。

更改组件状态后，使受影响的组件失效，并调用注入的 `tui.requestRender()`。TUI 会合并渲染请求并更新终端。

## 组合内置组件

该软件包包含常用布局和控件的组件：

- `Text`、`Markdown`、`Image` 和 `TruncatedText` 用于渲染内容。
- `Container`、`VStack`、`HStack`、`Box` 和 `Spacer` 用于组合布局。
- `Input` 和 `Editor` 用于接受文本输入。
- `SelectList` 和 `SettingsList` 实现可搜索的选择和设置流程。
- `ScrollView` 提供有边界的可滚动视口。
- `Loader` 和 `CancellableLoader` 用于报告进行中的工作。
- `MouseRegion` 为其他组件添加指针行为。

优先使用这些组件，而不是重新构建选择、滚动、文本编辑或宽度处理功能。扩展示例展示了如何将它们与 Pi 的边框和主题结合使用。

## 处理键盘输入与焦点

使用 `matchesKey()` 和 `Key` 处理终端键盘输入。解析器会考虑受支持的终端协议和按键修饰符。扩展组件应使用注入的 `KeybindingsManager` 来处理可配置的应用程序操作。

显示文本光标的组件应实现 `Focusable`，并将 `CURSOR_MARKER` 紧邻其视觉光标之前放置。TUI 利用该标记定位硬件光标，以配合输入法编辑器使用。

包裹 `Input` 或 `Editor` 的容器必须将其 `focused` 状态传递给子组件。若不传递，中文、日文、韩文及其他 IME 候选窗口可能出现在错误的屏幕位置。

替换主编辑器时，请扩展 Pi 的 `CustomEditor`。它保留了应用程序快捷键和代理控件。

将编辑器不处理的按键转发给基类实现，并通过清除自定义编辑器工厂来恢复默认行为。

## 处理鼠标输入

全屏模式将归一化的鼠标事件路由到组件。处理器可以标记事件已处理、捕获拖拽序列、请求焦点或请求渲染。

未处理的滚轮事件会滚动最近的 `ScrollView`。未处理的主按钮拖拽仍可用于转录选择。OSC 8 链接优先于包含它的点击区域。

常规模式将鼠标输入留给终端，因为终端拥有回滚缓冲区。即使在全屏鼠标输入可用时，也要为每次交互设计键盘路径。

## 使用自定义屏幕和覆盖层

`ctx.ui.custom()` 可临时将一个组件对交互区域的控制权释放，并在该组件调用提供的完成回调时解析。

传入 `overlay: true` 可在现有内容之上绘制。覆盖层选项控制尺寸、锚点、偏移、边距以及响应式可见性。交互仍处于活动状态时，覆盖层句柄可以改变焦点，或通过 `setHidden()` 临时隐藏和显示覆盖层。

聚焦的覆盖层在常规渲染期间保持输入所有权。如果覆盖层保持可见时，其他组件应接收输入，请通过句柄显式释放或重定向焦点。

将每个自定义组件实例视为属于一次交互。再次启动该交互时，创建新实例。

通过提供给组件工厂的完成回调结束交互。它会解析 `ctx.ui.custom()` promise 并释放组件。请勿对由 `ctx.ui.custom()` 创建的覆盖层调用 `OverlayHandle.hide()`。

有关定位、堆叠、焦点、响应式可见性和动画行为的说明，请参阅 [`overlay-qa-tests.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。

## 使用主题

请使用主题（theme）来渲染终端界面中所有带颜色的元素。在应用已注册的皮肤（skin）之上，主题与外壳（harness）协同工作。

利用外壳扩展（extension）提供的 `useTheme()` 钩子，或通过组件回调（callback）访问主题，即可便捷地在整个应用中使用主题样式。

请勿将字符串永久存储为带主题颜色的形式，除非借助 `invalidate()` 来重新构建它们。主题切换时会清除渲染缓存，但无法移除已嵌入应用状态中的旧ANSI颜色。

在渲染期间求值的主题回调（callback）无需特殊重建。无状态组件（Stateless components）也可以在每次渲染时重新计算带主题的输出。

参考主题（Themes）文档来创建终端调色板。当渲染的 Markdown 需要与当前应用主题匹配时，请使用 Pi 的 `getMarkdownTheme()` 方法。

## 保持渲染响应

渲染运行在交互路径上。按宽度和内容缓存开销较大的布局与高亮工作，并在 `invalidate()` 中清除该缓存。

保持默认视图紧凑，通过展开或专用屏幕呈现细节。对于自定义工具渲染，处理部分结果，并在可安全更新时复用之前的组件。

诊断渲染问题时，使用 `PI_TUI_WRITE_LOG` 捕获原始 ANSI 流。测试窄宽度、宽字符、调整大小事件、主题更改、焦点切换，以及常规和全屏两种模式。

## 示例与源码

已检查的扩展示例覆盖了主要模式：

- [`preset.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts) 与 [`tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tools.ts) 使用选择与设置列表。
- [`qna.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/qna.ts) 使用可取消的异步界面。
- [`modal-editor.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/modal-editor.ts) 替换编辑器。
- [`custom-footer.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts) 替换页脚。
- [`widget-placement.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/widget-placement.ts) 在编辑器周围放置固定内容。
- [`doom-overlay/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/doom-overlay/) 演示了连续渲染的覆盖层。

公共导出定义于 [`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts)。参见 [扩展](/docs/extensions/) 了解扩展生命周期、状态、工具、事件与模式行为。
