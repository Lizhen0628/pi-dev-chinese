# RPC 扩展界面

扩展可以通过 `ctx.ui` 请求用户交互。在 RPC 模式下，受支持的调用成为与常规 [RPC 命令](/docs/rpc-commands/) 和 [会话事件](/docs/json/) 并行的请求/响应子协议。

扩展 UI 方法分为两类：

- **对话框方法**（`select`、`confirm`、`input`、`editor`）：在 stdout 上发出 `extension_ui_request`，并阻塞直到客户端在 stdin 上发送带有匹配 `id` 的 `extension_ui_response`。
- **即发即忘方法**（`notify`、`setStatus`、`setWidget`、`setTitle`、`set_editor_text`）：在 stdout 上发出 `extension_ui_request`，但不期望响应。客户端可以显示信息或忽略它。

如果对话框方法包含 `timeout` 字段，则代理端会在超时到期时自动使用默认值解析。客户端无需跟踪超时。

## 局限

在 RPC 模式下，部分 `ExtensionUIContext` 方法因需直接访问终端 UI 而不受支持或功能有所降级：

- `custom()` 返回 `undefined`。
- `onTerminalInput()` 返回一个空操作（no-op）的反订阅函数。
- `setWorkingMessage()`、`setWorkingVisible()`、`setWorkingIndicator()`、`setHiddenThinkingLabel()`、`setFooter()`、`setHeader()`、`addAutocompleteProvider()`、`setEditorComponent()` 以及 `setToolsExpanded()` 均为空操作。
- `getEditorText()` 返回 `""`，`getEditorComponent()` 返回 `undefined`。
- `getToolsExpanded()` 返回 `false`。
- `pasteToEditor()` 在无终端粘贴处理的情况下委托给 `setEditorText()`。
- `getAllThemes()` 返回 `[]`，而 `getTheme()` 返回 `undefined`。
- `setTheme()` 返回 `{ success: false, error: "RPC 模式下不支持主题切换" }`。

注意：在 RPC 模式下，`ctx.mode` 为 `"rpc"`，`ctx.hasUI` 为 `true`，因为对话框及即发即弃（fire-and-forget）方法可通过扩展 UI 子协议正常工作。对于像 `custom()` 这类需要真实终端的 TUI 专属特性，请使用 `ctx.mode === "tui"` 进行条件判断。

## Pi 的请求

所有请求均包含 `type: "extension_ui_request"`、唯一的 `id` 以及 `method` 字段。

### select

提示用户从列表中选择。带有 `timeout` 字段的对话框方法包含以毫秒为单位的超时时间；如果客户端未及时响应，代理将自动解析为 `undefined`。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-1",
  "method": "select",
  "title": "允许危险命令？",
  "options": ["允许", "阻止"],
  "timeout": 10000
}
```

预期响应：`extension_ui_response`，包含 `value`（所选选项字符串）或 `cancelled: true`。

### 确认

提示用户进行是/否确认。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-2",
  "method": "confirm",
  "title": "清除会话？",
  "message": "所有消息将丢失。",
  "timeout": 5000
}
```

期望响应：`extension_ui_response`，包含 `confirmed: true/false` 或 `cancelled: true`。

### 输入

提示用户输入自由文本。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-3",
  "method": "input",
  "title": "输入一个值",
  "placeholder": "输入一些内容..."
}
```

预期响应：`extension_ui_response`，包含`value`（用户输入的文本）或`cancelled: true`。

### editor

打开一个多行文本编辑器，可预填内容。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-4",
  "method": "editor",
  "title": "编辑一些文本",
  "prefill": "第1行\n第2行\n第3行"
}
```

预期响应：`extension_ui_response`，包含 `value`（编辑后的文本）或 `cancelled: true`。

### notify

显示通知。即发即忘，不预期响应。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-5",
  "method": "notify",
  "message": "Command blocked by user",
  "notifyType": "warning"
}
```

`notifyType` 字段的值为 `"info"`、`"warning"` 或 `"error"`。若省略，默认为 `"info"`。

### setStatus

在页脚/状态栏中设置或清除状态条目。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-6",
  "method": "setStatus",
  "statusKey": "my-ext",
  "statusText": "第 3 轮运行中..."
}
```

发送 `statusText: undefined`（或省略该字段）以清除该键对应的状态条目。

### setWidget

设置或清除显示在编辑器上方或下方的部件（文本行块）。即发即弃。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-7",
  "method": "setWidget",
  "widgetKey": "my-ext",
  "widgetLines": ["--- My Widget ---", "Line 1", "Line 2"],
  "widgetPlacement": "aboveEditor"
}
```

发送 `widgetLines: undefined`（或省略该字段）以清除部件。`widgetPlacement` 字段为 `"aboveEditor"`（默认值）或 `"belowEditor"`。在 RPC 模式下仅支持字符串数组；组件工厂将被忽略。

### setTitle

设置终端窗口/标签页标题。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-8",
  "method": "setTitle",
  "title": "pi - my project"
}
```

### set_editor_text

设置输入编辑器中的文本。即发即忘。

```json
{
  "type": "extension_ui_request",
  "id": "uuid-9",
  "method": "set_editor_text",
  "text": "为用户预填的文本"
}
```

## 对 Pi 的响应

响应仅针对对话框方法（`select`、`confirm`、`input`、`editor`）发送。`id` 必须与请求匹配。

### 值响应（选择、输入、编辑器）

```json
{"type": "extension_ui_response", "id": "uuid-1", "value": "Allow"}
```

### 确认响应 (confirm)

```json
{"type": "extension_ui_response", "id": "uuid-2", "confirmed": true}
```

### 取消响应（任何对话框）

关闭任何对话框的方法。扩展会收到 `undefined`（对于选择/输入/编辑器）或 `false`（对于确认）。

```json
{"type": "extension_ui_response", "id": "uuid-3", "cancelled": true}
```

## 示例

请参阅已检查的 [RPC 扩展 UI 客户端](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/rpc-extension-ui.ts) 及其 [演示扩展](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/rpc-demo.ts)。

导出的请求和响应联合类型定义在 [`rpc-types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/modes/rpc/rpc-types.ts) 中。有关与模式无关的扩展指南，请参阅 [扩展](extensions.md#ui-and-modes)。
