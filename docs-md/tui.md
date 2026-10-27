# 终端 UI

`@earendil-works/pi-tui` 提供 Pi 使用的终端组件系统。当内置对话框、通知、状态文本和小部件不足以满足所需交互时，扩展会使用它。

从一个[扩展](extensions.md#interact-with-the-user)的 `ctx.ui` 方法开始。仅在界面需要自己的渲染、键盘或鼠标输入、焦点、布局或生命周期时构建自定义组件。

## 选择集成点

| 需求 | 使用 |
|---|---|
| 选择、确认、输入或多行编辑器 | `ctx.ui.select()`、`confirm()`、`input()` 或 `editor()` |
| 非阻塞反馈 | `ctx.ui.notify()` 或 `setStatus()` |
| 编辑器附近的持久内容 | `ctx.ui.setWidget()` |
| 替换页眉、页脚或编辑器 | 相应的 `ctx.ui` 组件工厂 |
| 临时交互式屏幕或覆盖层 | `ctx.ui.custom()` |
| 工具或会话条目的自定义渲染 | 扩展渲染器 |

这些 API 在需要时会接收 Pi 的当前主题和键位绑定。不要在扩展内部创建第二个终端渲染器。

## 理解组件模型

组件根据可用宽度渲染一组终端行。它可选地处理键盘和鼠标输入，并且当状态或主题相关内容变化时，必须使缓存输出失效。

每一行渲染必须适配提供的宽度。应测量可见终端列数而非字符串长度，因为 ANSI 转义、宽字符、表情符号和组合字符会改变显示宽度。

使用 `visibleWidth()`、`truncateToWidth()`、`sliceByColumn()` 和 `wrapTextWithAnsi()` 来处理终端宽度，而不是自行实现。Pi 在每行结束后重置样式和超链接，因此每个渲染行都需要重新应用样式。

组件状态更改后，使受影响的组件失效，并调用注入的 `tui.requestRender()`。TUI 会合并渲染请求并更新终端。

## 组合内置组件

软件包中包含用于常见布局和控件的组件：

- `Text`、`Markdown`、`Image` 和 `TruncatedText` 用于渲染内容。
- `Container`、`VStack`、`HStack`、`Box` 和 `Spacer` 用于组合布局。
- `Input` 和 `Editor` 用于接受文本输入。
- `SelectList` 和 `SettingsList` 用于实现可搜索的选择和设置流程。
- `ScrollView` 提供有边界的可滚动视口。
- `Loader` 和 `CancellableLoader` 用于报告进行中的工作。
- `MouseRegion` 为其他组件添加指针交互行为。

在重新实现选择、滚动、文本编辑或宽度处理时，应优先使用这些组件。扩展示例展示了如何将其与 Pi 的边框和主题相结合。

## 处理键盘输入与焦点

使用 `matchesKey()` 和 `Key` 处理终端键盘输入。解析器会考虑支持的终端协议和按键修饰符。扩展组件应使用注入的 `KeybindingsManager` 来配置可自定义的应用程序操作。

显示文本光标的组件应实现 `Focusable` 并在其可视光标前紧邻放置 `CURSOR_MARKER`。将光标单元格包裹在 `renderFakeCursor()` 中，以便 TUI 以反转视频方式绘制它，或当硬件光标显示时在 `CURSOR_MARKER` 之后隐藏它。TUI 使用该标记为输入法编辑器定位硬件光标。

包装 `Input` 或 `Editor` 的容器必须将其 `focused` 状态传播给该子组件。若不传播，中文、日文、韩文及其他输入法候选窗口可能会出现在错误的屏幕位置。

替换主编辑器时，应扩展 Pi 的 `CustomEditor`。它保留应用程序快捷键和代理控制。

将你的编辑器未处理的按键转发给基础实现，并通过清除自定义编辑器工厂来恢复默认设置。

## 处理鼠标输入

全屏模式会将标准化的鼠标事件路由至各组件。处理器可以标记事件为已处理、捕获拖拽序列、请求焦点或请求渲染。

未处理的滚轮事件会滚动最近的 `ScrollView`。未处理的主键拖拽仍可用于记录选择。OSC 8 链接优先于周边的点击区域。

常规模式将鼠标输入交由终端处理，因为终端拥有滚动缓冲区。即使在全屏鼠标输入可用的情况下，也要为每种交互设计键盘操作路径。

## 使用自定义屏幕和覆盖层

`ctx.ui.custom()` 暂时将一个组件对交互区域的控制权赋予该组件，并在该组件调用提供的完成回调时解析。

### 构建最小化自定义屏幕

以下完整扩展展示了自定义组件的生命周期：在给定宽度内渲染、使用注入的按键绑定、状态变更后使缓存输出失效、请求重新渲染、并通过 `done()` 完成。

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

该组件不显示文本光标，因此无需实现 `Focusable`。包含 `Input` 或 `Editor` 的组件必须实现 `Focusable`，并将其 `focused` 值传递给子组件。

自定义组件不会将 pi 报告为等待用户输入状态，因为 `ctx.ui.custom()` 同时承担加载器和其他非阻塞 UI 的宿主。当内联组件等待用户应答时，传入 `blocked: { kind: "question", message: "Pick a color" }`，以支持[程序状态](terminal-setup.md#program-status)的终端在组件可见期间将 pi 显示为阻塞状态。`kind` 取值为 `"question"`、`"permission"` 或 `"auth"`。覆盖层忽略此选项。

传入 `overlay: true` 可在现有内容之上绘制。覆盖层选项控制尺寸、锚点、偏移、边距和响应式可见性。覆盖层句柄可在交互保持活跃期间改变焦点，或通过 `setHidden()` 临时隐藏和显示覆盖层。

焦点覆盖层在常规渲染期间保留输入所有权。如果覆盖层保持可见时希望另一组件接收输入，请通过句柄显式释放或重定向焦点。

将每个自定义组件实例视为属于一次交互。再次启动该交互时创建新实例。

通过组件工厂提供的完成回调结束交互。该回调解析 `ctx.ui.custom()` 的 promise 并释放组件。不要对由 `ctx.ui.custom()` 创建的覆盖层调用 `OverlayHandle.hide()`。

定位、层级、焦点、响应式可见性和动画行为见 [`overlay-qa-tests.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/overlay-qa-tests.ts)。

## 正确应用主题

使用传递给扩展或组件回调的主题。主题辅助函数可生成用于语义颜色的 ANSI 样式字符串，例如强调色、弱化文本、成功、警告、错误、工具输出和 Markdown。

使用 `theme.style()` 将前景色和背景色与文本属性结合：

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

样式颜色可以是语义主题令牌或具体的 `Color`。前景令牌作为 `fg` 接受，背景令牌作为 `bg` 接受；若要在另一位置使用令牌颜色，请传入其具体颜色，例如 `{ fg: theme.colors.userMessageBg }`。通过 `theme.colors` 访问具体颜色，并在需要颜色计算时使用 `@earendil-works/pi-tui` 中的工具（如 `mixColors()`）。主题设置为终端默认值的令牌将使用终端自身的颜色渲染；`theme.colors` 报告终端声明的颜色，若终端未声明则提供猜测值。使用 `theme.appearance`（`"dark"` 或 `"light"`）来决定，例如，是提亮还是加深颜色。Pi 会根据终端能力将结果转换为真彩色或 256 色输出。主题令牌每个主题仅转换一次；尽可能在渲染路径之外计算具体颜色。

现有的 `theme.fg()` 和 `theme.bg()` 辅助函数仍可用于应用单一语义颜色。

除非 `invalidate()` 会重建，否则不要永久存储带主题颜色的字符串。主题更改会清除渲染缓存，但无法移除嵌入在应用程序状态中的旧 ANSI 颜色。

渲染期间评估的主题回调无需特殊重建。无状态组件也可以在每次渲染时计算主题化输出。

使用 [主题](/docs/themes/) 创建终端调色板。在渲染应与活动应用程序主题匹配的 Markdown 时，使用 Pi 的 `getMarkdownTheme()`。

## 保持渲染响应

渲染运行在交互式路径上。缓存开销较大的布局和按宽度与内容进行的高亮处理，然后通过 `invalidate()` 清除该缓存。

保持默认视图紧凑，通过扩展或专用屏幕揭示细节。对于自定义工具渲染，在处理部分结果时，在可安全更新的情况下复用先前的组件。

在诊断渲染问题时，使用 `PI_TUI_WRITE_LOG` 捕获原始 ANSI 流。测试窄宽度、宽字符、调整大小事件、主题变化、焦点切换，以及常规和全屏两种模式。

## 示例与源码

已检查的扩展示例涵盖了主要模式：

- [`preset.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/preset.ts) 和 [`tools.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tools.ts) 使用选择与设置列表。
- [`qna.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/qna.ts) 使用可取消的异步用户界面。
- [`modal-editor.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/modal-editor.ts) 替换编辑器。
- [`custom-footer.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/custom-footer.ts) 替换页脚。
- [`widget-placement.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/widget-placement.ts) 在编辑器周围放置持续显示的内容。
- [`doom-overlay/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/doom-overlay/) 演示持续渲染的覆盖层。

公共导出定义在 [`packages/tui/src/index.ts`](https://github.com/earendil-works/pi/blob/main/packages/tui/src/index.ts) 中。关于扩展生命周期、状态、工具、事件和模式行为，请参阅[扩展](/docs/extensions/)。
