# 终端界面

`@earendil-works/pi-tui` 提供了 Pi 所使用的终端组件系统。当内置的对话框、通知、状态文本和组件无法满足扩展所需的交互时，扩展可使用该系统。

从[扩展](extensions.md#interact-with-the-user)中的 `ctx.ui` 方法开始。仅当界面需要自己的渲染、键盘或鼠标输入、焦点、布局或生命周期时，才构建自定义组件。

## 选择集成点

| 需求 | 使用方式 |
|---|---|
| 选择、确认、输入或多行编辑 | `ctx.ui.select()`、`confirm()`、`input()` 或 `editor()` |
| 非阻塞反馈 | `ctx.ui.notify()` 或 `setStatus()` |
| 编辑器附近的持久内容 | `ctx.ui.setWidget()` |
| 替换页眉、页脚或编辑器 | 对应的 `ctx.ui` 组件工厂 |
| 临时交互式屏幕或覆盖层 | `ctx.ui.custom()` |
| 工具或会话条目的自定义渲染 | 扩展渲染器 |

这些 API 在需要时会接收 Pi 的活动主题和按键绑定。不要在扩展内创建第二个终端渲染器。

## 理解组件模型

组件针对给定的可用宽度渲染一系列终端行。它可选地处理键盘和鼠标输入，并且当其状态或主题相关内容发生变化时，必须使缓存的输出失效。

每一行渲染内容必须适配所提供的宽度。应测量可见终端列宽而非字符串长度，因为 ANSI 转义序列、宽字符、表情符号和组合字符会影响显示宽度。

请使用 `visibleWidth()`、`truncateToWidth()`、`sliceByColumn()` 和 `wrapTextWithAnsi()`，而不是自行实现终端宽度处理。Pi 会在每行结束后重置样式和超链接，因此需在每一渲染行上重新应用样式。

组件状态更改后，使受影响的组件失效，并调用注入的 `tui.requestRender()`。TUI 会将渲染请求合并，并更新终端。

## 组合内置组件

该软件包包含常用布局和控件组件：

- `Text`、`Markdown`、`Image` 和 `TruncatedText` 用于渲染内容。
- `Container`、`VStack`、`HStack`、`Box` 和 `Spacer` 用于构成布局。
- `Input` 和 `Editor` 用于接受文本输入。
- `SelectList` 和 `SettingsList` 实现可搜索的选择与设置流程。
- `ScrollView` 提供有边界的可滚动视口。
- `Loader` 和 `CancellableLoader` 用于报告进行中的工作。
- `MouseRegion` 为其他组件添加指针行为。

应优先使用这些组件，而非自行构建选择、滚动、文本编辑或宽度处理。扩展示例展示了如何将它们与 Pi 的边框和主题相结合。

## 处理键盘输入与焦点

使用 `matchesKey()` 和 `Key` 处理终端键盘输入。解析器会考虑支持的终端协议及按键修饰符。扩展组件应使用注入的 `KeybindingsManager` 来配置应用程序操作。

显示文本光标时，组件应实现 `Focusable`，并在其可视光标之前放置 `CURSOR_MARKER`。将光标单元格包裹在 `renderFakeCursor()` 中，以便 TUI 以反显方式绘制，或在硬件光标显示后在 `CURSOR_MARKER` 之后将其隐藏。TUI 利用该标记为输入法编辑器定位硬件光标。

包含 `Input` 或 `Editor` 的容器必须将自身的 `focused` 状态传递给子组件。若不进行传递，中文、日文、韩文及其他 IME 候选窗口可能出现在错误屏幕位置。

替换主编辑器时，扩展 Pi 的 `CustomEditor`。它保留了应用程序快捷键与代理控制。

将你的编辑器未处理的按键转发给基础实现，并通过清除自定义编辑器工厂恢复默认行为。

## 处理鼠标输入

全屏模式将标准化后的鼠标事件路由至组件。处理器可标记事件为已处理、捕获拖拽序列、请求焦点或请求渲染。

未处理的滚轮事件将滚动最近的 `滚动视图`。未处理的主键拖拽仍可用于选择脚本。OSC 8 链接优先于包围的点击区域。

常规模式将鼠标输入留给终端，因为终端拥有回滚缓冲区。即使在支持全屏鼠标输入的情况下，也要为每种交互设计键盘操作路径。

## 使用自定义屏幕和覆盖层

`ctx.ui.custom()` 临时让一个组件控制交互区域，当该组件调用提供的完成回调时，该函数会解析。

### 构建一个最小自定义屏幕

这个完整的扩展展示了自定义组件的生命周期：在提供的宽度内渲染、使用注入的按键绑定、状态变化后使缓存输出失效、请求重新渲染，并通过 `done()` 完成。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("pick-target", {
    description: "Pick a deployment target",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("pick-target requires interactive mode", "error");
        return;
      }

      const choices = ["development", "staging", "production"];
      const selected = await ctx.ui.custom<string | undefined>((tui, theme, keybindings, done) => {
        let selectedIndex = 0;
        let cachedWidth: number | undefined;
        let cachedLines: string[] | undefined;

        const invalidate = () => {
          cachedWidth = undefined;
          cachedLines = undefined;
        };

        return {
          render(width: number): string[] {
            if (cachedLines && cachedWidth === width) return cachedLines;

            cachedWidth = width;
            cachedLines = [
              theme.fg("accent", "Choose a deployment target"),
              ...choices.map((choice, index) => `${index === selectedIndex ? "> " : "  "}${choice}`),
              theme.fg("dim", "up/down move, enter selects, escape cancels"),
            ].map((line) => truncateToWidth(line, width));
            return cachedLines;
          },
          handleInput(data: string): void {
            if (keybindings.matches(data, "tui.select.up")) {
              selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
            } else if (keybindings.matches(data, "tui.select.down")) {
              selectedIndex = (selectedIndex + 1) % choices.length;
            } else if (keybindings.matches(data, "tui.select.confirm")) {
              done(choices[selectedIndex]);
              return;
            } else if (keybindings.matches(data, "tui.select.cancel")) {
              done(undefined);
              return;
            } else {
              return;
            }

            invalidate();
            tui.requestRender();
          },
          invalidate,
        };
      });

      if (selected) ctx.ui.notify(`Selected ${selected}`, "info");
    },
  });
}
```

该组件不显示文本光标，因此不需要 `Focusable`。包含 `Input` 或 `Editor` 的组件必须实现 `Focusable`，并将其 `focused` 值传递给该子组件。

传入 `overlay: true` 可在现有内容之上绘制。覆盖层选项控制大小、锚点、偏移、边距和响应式可见性。覆盖层句柄可以在交互保持活动期间更改焦点，或通过 `setHidden()` 临时隐藏和显示覆盖层。

聚焦的覆盖层在普通渲染期间保留输入所有权。如果覆盖层保持可见时另一个组件应接收输入，请通过句柄显式释放或重定向焦点。

将每个自定义组件实例视为属于一次交互。再次启动该交互时，创建新实例。

使用提供给组件工厂的完成回调结束交互。它会解析 `ctx.ui.custom()` 的 promise 并销毁组件。不要对由 `ctx.ui.custom()` 创建的覆盖层调用 `OverlayHandle.hide()`。

有关定位、堆叠、焦点、响应式可见性和动画行为，请参阅 [`overlay-qa-tests.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。

## 正确应用主题

使用传递给扩展或组件回调的主题。主题辅助函数会为语义颜色（如强调色、弱化文本、成功、警告、错误、工具输出和 Markdown）生成 ANSI 样式的字符串。

使用 `theme.style()` 将前景色、背景色与文本属性组合：

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

样式颜色可以是语义主题令牌或具体的 `Color`。前景令牌作为 `fg` 接受，背景令牌作为 `bg` 接受；要在其他位置使用令牌的颜色，请传入其具体颜色，例如 `{ fg: theme.colors.userMessageBg }`。通过 `theme.colors` 访问具体颜色，并在需要颜色计算时使用 `@earendil-works/pi-tui` 中的工具函数（如 `mixColors()`）。主题设置为终端默认值的令牌会以终端自身的颜色渲染；`theme.colors` 会报告终端声明的颜色，若终端未声明则给出猜测值。使用 `theme.appearance`（`"dark"` 或 `"light"`）来决定，例如，是提亮还是加深颜色。Pi 会根据终端能力将结果转换为真彩色或 256 色输出。主题令牌每个主题只转换一次；尽可能在渲染路径之外计算具体颜色。

现有的 `theme.fg()` 和 `theme.bg()` 辅助函数仍可用于应用单一语义颜色。

除非 `invalidate()` 会重建字符串，否则不要永久存储带有主题颜色的字符串。主题更改会清除渲染缓存，但无法移除已嵌入应用程序状态中的旧 ANSI 颜色。

在渲染期间评估的主题回调无需特殊重建。无状态组件也可以在每次渲染时计算主题化输出。

使用 [主题](/docs/themes/) 创建终端调色板。在渲染应与当前应用程序主题匹配的 Markdown 时，使用 Pi 的 `getMarkdownTheme()`。

## 保持渲染响应

渲染运行在交互路径上。按宽度和内容缓存昂贵的布局和突出显示工作，然后从 `invalidate()` 中清除该缓存。

保持默认视图紧凑，通过展开或专用屏幕揭示细节。对于自定义工具渲染，处理部分结果，并在可以安全更新时重用之前的组件。

在诊断渲染问题时，使用 `PI_TUI_WRITE_LOG` 捕获原始 ANSI 流。测试窄宽度、宽字符、调整大小事件、主题更改、焦点转换以及常规和全屏模式。

## 示例与源码

已检查的扩展示例涵盖了主要模式：

- [`preset.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts) 与 [`tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tools.ts) 使用选择与设置列表。
- [`qna.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/qna.ts) 使用可取消的异步 UI。
- [`modal-editor.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/modal-editor.ts) 替换编辑器。
- [`custom-footer.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts) 替换页脚。
- [`widget-placement.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/widget-placement.ts) 在编辑器周围放置持久内容。
- [`doom-overlay/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/doom-overlay/) 演示了持续渲染的覆盖层。

公共导出定义于 [`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts)。有关扩展生命周期、状态、工具、事件与模式行为，请参阅 [扩展](/docs/extensions/)。
