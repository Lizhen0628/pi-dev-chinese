# 终端界面

`@earendil-works/pi-tui` 提供了 Pi 所使用的终端组件系统。当内置的对话框、通知、状态文本和小组件无法满足扩展所需的交互时，扩展会使用它。

从[扩展](extensions.md#interact-with-the-user)中的 `ctx.ui` 方法开始。仅当界面需要自己的渲染、键盘或鼠标输入、焦点、布局或生命周期时，才构建自定义组件。

## 选择集成点

| 需求 | 使用方式 |
|---|---|
| 选择、确认、输入或多行编辑器 | `ctx.ui.select()`、`confirm()`、`input()` 或 `editor()` |
| 非阻塞反馈 | `ctx.ui.notify()` 或 `setStatus()` |
| 编辑器附近的持久内容 | `ctx.ui.setWidget()` |
| 替换页眉、页脚或编辑器 | 相应的 `ctx.ui` 组件工厂 |
| 临时交互式屏幕或覆盖层 | `ctx.ui.custom()` |
| 工具或会话条目的自定义渲染 | 扩展渲染器 |

这些 API 在需要时会接收 Pi 的活动主题和按键绑定。不要在扩展内创建第二个终端渲染器。

## 理解组件模型

组件针对可用宽度渲染一个终端行数组。它可以选择性地处理键盘和鼠标输入，并且当其状态或依赖主题的内容发生变化时，必须使缓存输出失效。

每一行渲染都必须适配所给的宽度。应测量可见终端列，而不是字符串长度，因为 ANSI 转义、宽字符、表情符号和组合字符会改变显示宽度。

不要自行实现终端宽度处理，请使用 `visibleWidth()`、`truncateToWidth()`、`sliceByColumn()` 和 `wrapTextWithAnsi()`。Pi 会在每行后重置样式和超链接，因此需要在每一渲染行上重新应用样式。

更改组件状态后，使受影响的组件失效，并调用注入的 `tui.requestRender()`。TUI 会合并渲染请求并更新终端。

## 组合内置组件

该软件包包含常见布局和控件的组件：

- `Text`、`Markdown`、`Image` 和 `TruncatedText` 用于渲染内容。
- `Container`、`VStack`、`HStack`、`Box` 和 `Spacer` 用于组合布局。
- `Input` 和 `Editor` 用于接受文本输入。
- `SelectList` 和 `SettingsList` 实现可搜索的选择和设置流程。
- `ScrollView` 提供有边界的可滚动视口。
- `Loader` 和 `CancellableLoader` 用于报告进行中的工作。
- `MouseRegion` 为其他组件添加指针行为。

优先使用这些组件，而不是重新实现选择、滚动、文本编辑或宽度处理。扩展示例展示了如何将它们与 Pi 的边框和主题结合使用。

## 处理键盘输入与焦点

使用 `matchesKey()` 和 `Key` 处理终端键盘输入。解析器会考虑受支持的终端协议和按键修饰符。扩展组件应使用注入的 `KeybindingsManager` 来处理可配置的应用程序操作。

显示文本光标的组件应实现 `Focusable`，并在其视觉光标之前放置 `CURSOR_MARKER`。TUI 使用该标记来定位硬件光标，以配合输入法编辑器。

包裹 `Input` 或 `Editor` 的容器必须将其 `focused` 状态传播给该子组件。若不传播，中文、日文、韩文及其他 IME 候选窗口可能会出现在错误的屏幕位置。

替换主编辑器时，请扩展 Pi 的 `CustomEditor`。它保留了应用程序快捷键和代理控件。

将你的编辑器不处理的按键转发给基类实现，并通过清除自定义编辑器工厂来恢复默认行为。

## 处理鼠标输入

全屏模式将标准化的鼠标事件路由至组件。处理器可以标记事件为已处理、捕获拖动序列、请求焦点或请求渲染。

未处理的滚轮事件会滚动最近的 `ScrollView`。未处理的主要按钮拖动仍可用于转录文本选择。OSC 8 链接优先于包围的点击区域。

常规模式将鼠标输入交给终端，因为终端拥有滚动缓冲区。即使在全屏鼠标输入可用时，也应为每种交互设计键盘路径。

## 使用自定义屏幕和覆盖层

`ctx.ui.custom()` 临时让一个组件控制交互区域，并在该组件调用提供的完成回调时解析。

传入 `overlay: true` 可在现有内容之上绘制。覆盖层选项控制大小、锚点、偏移、边距和响应式可见性。覆盖层句柄可以在交互保持活动期间更改焦点或通过 `setHidden()` 临时隐藏和显示覆盖层。

聚焦的覆盖层在普通渲染期间保留输入所有权。如果覆盖层保持可见时另一个组件应接收输入，请通过句柄显式释放或重定向焦点。

将每个自定义组件实例视为属于一次交互。再次启动该交互时创建新实例。

使用提供给组件工厂的完成回调结束交互。它会解析 `ctx.ui.custom()` 的 promise 并销毁组件。不要对由 `ctx.ui.custom()` 创建的覆盖层调用 `OverlayHandle.hide()`。

参见 [`overlay-qa-tests.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts) 了解定位、堆叠、焦点、响应式可见性和动画行为。

## 正确应用主题

使用传递给扩展或组件回调的主题。主题助手会为语义颜色（如强调色、弱化文本、成功、警告、错误、工具输出和 Markdown）生成带 ANSI 样式的字符串。

使用 `theme.style()` 将前景色和背景色与文本属性组合：

```typescript
return new Text(
  theme.style("Done!", {
    fg: "success",
    bg: "toolSuccessBg",
    bold: true,
  }),
  0,
  0,
);
```

样式颜色可以是语义主题标记或具体的 `Color`。前景标记可用作 `fg`，背景标记可用作 `bg`；若要在其他位置使用标记的颜色，请传入其具体颜色，例如 `{ fg: theme.colors.userMessageBg }`。通过 `theme.colors` 访问具体颜色，并在需要颜色运算时使用 `@earendil-works/pi-tui` 中的 `mixColors()` 等工具。主题设置为终端默认值的标记会以终端自身的颜色渲染；`theme.colors` 报告终端声明的颜色，若未声明则给出猜测值。使用 `theme.appearance`（`"dark"` 或 `"light"`）来决定，例如是变亮还是变暗某个颜色。Pi 会根据终端能力将结果转换为真彩色或 256 色输出。主题标记每个主题只转换一次；尽可能在渲染路径之外计算具体颜色。

现有的 `theme.fg()` 和 `theme.bg()` 助手仍可用于应用单个语义颜色。

除非 `invalidate()` 重建，否则不要永久存储带有主题颜色的字符串。主题切换会清除渲染缓存，但不能移除嵌入在应用状态中的旧 ANSI 颜色。

在渲染期间评估的主题回调不需要特殊重建。无状态组件也可以在每次渲染时计算主题化输出。

使用 [主题](/docs/themes/) 创建终端调色板。在渲染应与当前应用主题匹配的 Markdown 时，使用 Pi 的 `getMarkdownTheme()`。

## 保持渲染响应性

渲染运行在交互路径上。按宽度和内容缓存代价高昂的布局与高亮工作，然后在 `invalidate()` 中清除该缓存。

保持默认视图紧凑，通过扩展或专用屏幕揭示细节。对于自定义工具渲染，处理部分结果，并在可安全更新时复用之前的组件。

诊断渲染问题时，使用 `PI_TUI_WRITE_LOG` 捕获原始 ANSI 流。测试窄宽度、宽字符、调整大小事件、主题更改、焦点切换，以及常规与全屏两种模式。

## 示例与源码

已检查的扩展示例涵盖了主要模式：

- [`preset.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts) 和 [`tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tools.ts) 使用了选择与设置列表。
- [`qna.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/qna.ts) 使用了可取消的异步 UI。
- [`modal-editor.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/modal-editor.ts) 替换了编辑器。
- [`custom-footer.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts) 替换了页脚。
- [`widget-placement.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/widget-placement.ts) 在编辑器周围放置了持久内容。
- [`doom-overlay/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/doom-overlay/) 演示了持续渲染的覆盖层。

公共导出定义于 [`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts)。关于扩展的生命周期、状态、工具、事件及模式行为，请参阅 [扩展](/docs/extensions/)。
