# 键位绑定

所有快捷键都可以通过 `~/.pi/agent/keybindings.json` 自定义。每个动作可以绑定一个或多个按键。

配置文件使用与 Pi 内部一致、扩展作者在 `keyHint()` 和注入的 `keybindings` 管理器中使用的带命名空间的键位 ID。

使用旧式无命名空间 ID（如 `cursorUp`、`expandTools`）的旧配置会在启动时自动迁移到命名空间 ID。

编辑 `keybindings.json` 后，在 Pi 里运行 `/reload` 即可生效，无需重启会话。

## 按键格式

格式为 `修饰键+键`，修饰键有 `ctrl`、`shift`、`alt`、`super`（可组合），键包括：

- **字母：** `a-z`
- **数字：** `0-9`
- **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

修饰键组合示例：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`super+k`、`ctrl+super+k`、`ctrl+1` 等。

`super` 绑定要求终端单独上报该修饰键（通常通过 Kitty 键盘协议）；不支持的终端中可能无效。

## 全部动作

### TUI 编辑器光标移动

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.editor.cursorUp` | `up` | 光标上移，顶部时浏览更早的历史 |
| `tui.editor.cursorDown` | `down` | 光标下移，底部时浏览更新的历史 |
| `tui.editor.historyPrevious` | *（无）* | 选择上一条提示词历史 |
| `tui.editor.historyNext` | *（无）* | 选择下一条提示词历史 |
| `tui.editor.cursorLeft` | `left`、`ctrl+b` | 光标左移 |
| `tui.editor.cursorRight` | `right`、`ctrl+f` | 光标右移 |
| `tui.editor.cursorWordLeft` | `alt+left`、`ctrl+left`、`alt+b` | 按词左移 |
| `tui.editor.cursorWordRight` | `alt+right`、`ctrl+right`、`alt+f` | 按词右移 |
| `tui.editor.cursorLineStart` | `home`、`ctrl+home`、`ctrl+a` | 移到行首 |
| `tui.editor.cursorLineEnd` | `end`、`ctrl+end`、`ctrl+e` | 移到行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 向前跳到字符 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 向后跳到字符 |
| `tui.editor.pageUp` | `pageUp`、`ctrl+pageUp` | 上翻一页 |
| `tui.editor.pageDown` | `pageDown`、`ctrl+pageDown` | 下翻一页 |

专用的历史动作始终操作历史条目，与多行提示词中的光标位置无关。主编辑器获得焦点时，显式的历史绑定优先于应用动作：把 `tui.editor.historyPrevious` 绑到 `ctrl+p` 会在该上下文中覆盖模型轮换，但选择器里的 Ctrl+P 不受影响。

### TUI 编辑器删除

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`、`ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`、`alt+backspace` | 向后删除一个词 |
| `tui.editor.deleteWordForward` | `alt+d`、`alt+delete` | 向前删除一个词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删到行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删到行尾 |

### TUI 输入

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.input.newLine` | `shift+enter`、`ctrl+j` | 插入换行 |
| `tui.input.submit` | `enter` | 提交输入 |
| `tui.input.tab` | `tab` | Tab / 补全 |

### TUI Kill Ring

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | 在删除文本之间轮换粘贴 |
| `tui.editor.undo` | `ctrl+-`（Windows 上 `ctrl+z`；WSL 上 `alt+z`） | 撤销上一次编辑 |

### TUI 剪贴板与选择

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.input.copy` | `ctrl+c` | 复制选区 |
| `tui.select.up` | `up` | 选择上移 |
| `tui.select.down` | `down` | 选择下移 |
| `tui.select.pageUp` | `pageUp` | 列表上翻页 |
| `tui.select.pageDown` | `pageDown` | 列表下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`、`ctrl+c` | 取消选择 |

### TUI 全屏视口

这些动作在交互模式使用 `--tui-mode fullscreen` 时生效，作用于主对话记录滚动区域。双指触控板与鼠标滚轮滚动指针下的区域（固定编辑器/状态/页脚区域上方则回退为滚动对话记录）。点击 OSC 8 超链接会用默认处理器打开。按住主键拖动可选择文本并复制到剪贴板；在记录顶部或底部边缘按住可自动滚出屏外内容。记录上滚后，其底部行会出现可点击的"跳到最新消息"标签并显示 `tui.altScreen.bottom` 快捷键。终端相关的鼠标/触控板行为见[终端设置](/docs/terminal-setup/)。

全屏记录绑定优先于编辑器绑定。因此全屏模式下，无修饰键的导航键控制对话记录，其 `ctrl` 变体继续控制编辑器；非全屏模式下两组都控制编辑器。

记录搜索面板会显示配置的上一个/下一个快捷键及可点击箭头。再次按 `tui.altScreen.search` 或按 `tui.altScreen.searchClose` 关闭。

| 按键 | 普通模式 | 全屏模式 |
|------|----------|----------|
| `home`、`end` | 编辑器 | 对话记录 |
| `ctrl+home`、`ctrl+end` | 编辑器 | 编辑器 |
| `pageUp`、`pageDown` | 编辑器 | 对话记录 |
| `ctrl+pageUp`、`ctrl+pageDown` | 编辑器 | 编辑器 |

这一路由可通过普通动作绑定重新配置。例如 `"tui.altScreen.pageUp": "ctrl+pageUp"` 会让 `pageUp` 控制编辑器、`ctrl+pageUp` 在全屏下控制记录。绑定 `tui.altScreen.halfPageUp` 和 `tui.altScreen.halfPageDown` 可半页滚动；`tui.altScreen.lineUp` 和 `tui.altScreen.lineDown` 单行滚动。设 `"tui.altScreen.pageUp": []` 可彻底禁用该记录快捷键。用户绑定直接替换该动作的默认值。

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `tui.altScreen.pageUp` | `pageUp` | 记录上翻一页 |
| `tui.altScreen.pageDown` | `pageDown` | 记录下翻一页 |
| `tui.altScreen.halfPageUp` | *（无）* | 记录上翻半页 |
| `tui.altScreen.halfPageDown` | *（无）* | 记录下翻半页 |
| `tui.altScreen.lineUp` | *（无）* | 记录上滚一行 |
| `tui.altScreen.lineDown` | *（无）* | 记录下滚一行 |
| `tui.altScreen.previousPrompt` | `ctrl+shift+up`、`ctrl+up`（Windows/WSL 上仅 `ctrl+up`） | 跳到上一个标记消息 |
| `tui.altScreen.nextPrompt` | `ctrl+shift+down`、`ctrl+down`（Windows/WSL 上仅 `ctrl+down`） | 跳到下一个标记消息 |
| `tui.altScreen.search` | `ctrl+shift+f`（Windows/WSL 上 `ctrl+f`） | 搜索渲染后的记录 |
| `tui.altScreen.searchNext` | `enter`、`ctrl+g` | 搜索时选择下一个匹配 |
| `tui.altScreen.searchPrevious` | `shift+enter`、`ctrl+shift+g` | 搜索时选择上一个匹配 |
| `tui.altScreen.searchClose` | `escape` | 关闭记录搜索 |
| `tui.altScreen.top` | `home` | 滚到记录开头 |
| `tui.altScreen.bottom` | `end` | 滚到记录末尾并跟随新输出 |

### 应用

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.interrupt` | `escape` | 取消 / 中止 |
| `app.clear` | `ctrl+c` | 清空编辑器（第一次）/ 退出（第二次） |
| `app.exit` | `ctrl+d` | 退出（编辑器为空时） |
| `app.suspend` | `ctrl+z`（Windows 上无） | 挂起到后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器打开（`externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上记事本，其他平台 `nano`） |
| `app.clipboard.pasteImage` | `ctrl+v`（Windows/WSL 上 `alt+v`） | 粘贴剪贴板中的图片或文本 |

### 会话

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.session.new` | *（无）* | 开始新会话（`/new`） |
| `app.session.tree` | *（无）* | 打开会话树导航（`/tree`） |
| `app.session.fork` | *（无）* | 分叉当前会话（`/fork`） |
| `app.session.resume` | *（无）* | 打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序方式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换"仅命名会话"过滤 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 查询为空时删除会话 |

### 模型与思考

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 轮换到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p`（Windows/WSL 上 `alt+p`） | 轮换到上一个模型 |
| `app.models.save` | `ctrl+s` | 把选中的默认模型或常用模型配置保存到设置 |
| `app.thinking.cycle` | `shift+tab` | 循环切换思考等级 |
| `app.thinking.save` | `ctrl+s` | 把当前思考等级保存到设置 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或展开思考块 |

### 显示与消息队列

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | 复制 `/tree` 中选中的消息；否则复制最后一条助手消息，或在 `fullscreenCopyOnSelect` 关闭时复制当前全屏选区 |
| `app.message.followUp` | `alt+enter`（Windows/WSL 上 `ctrl+q`） | 排入追问消息 |
| `app.message.dequeue` | `alt+up`（Windows/WSL 上 `alt+q`） | 把排队消息还原到编辑器 |

### 树导航

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.tree.foldOrUp` | `ctrl+left`、`alt+left` | 折叠当前分支段，或跳到上一段开头 |
| `app.tree.unfoldOrDown` | `ctrl+right`、`alt+right` | 展开当前分支段，或跳到下一段开头/分支末尾 |
| `app.tree.editLabel` | `shift+l` | 编辑选中树节点的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | 切换树中标签时间戳显示 |
| `app.tree.filter.default` | `ctrl+d` | 树过滤切到默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | 切换隐藏工具结果的树过滤 |
| `app.tree.filter.userOnly` | `ctrl+u` | 切换只看用户消息的树过滤 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 切换只看带标签条目的树过滤 |
| `app.tree.filter.all` | `ctrl+a` | 切换显示全部条目的树过滤 |
| `app.tree.filter.cycleForward` | `ctrl+o` | 向后循环树过滤 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | 向前循环树过滤 |

### 常用模型选择器

在常用模型选择器（`/scoped-models` 打开）中使用。

| 键位 ID | 默认 | 说明 |
|---------|------|------|
| `app.models.enableAll` | `ctrl+a` | 启用全部模型（或匹配当前搜索的全部） |
| `app.models.clearAll` | `ctrl+x` | 清空全部模型（或匹配当前搜索的全部） |
| `app.models.toggleProvider` | `ctrl+p` | 启用/禁用当前提供商的全部模型 |
| `app.models.reorderUp` | `alt+up` | 在轮换顺序中上移选中模型 |
| `app.models.reorderDown` | `alt+down` | 在轮换顺序中下移选中模型 |

## 自定义配置

创建 `~/.pi/agent/keybindings.json`：

```json
{
  "tui.editor.historyPrevious": "ctrl+p",
  "tui.editor.historyNext": "ctrl+n",
  "tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

每个动作可以是单个按键或按键数组。用户配置覆盖默认值。

原生 Windows 上 `app.suspend` 没有默认绑定，因为 Windows 终端不支持 Unix 作业控制；手动绑定后 Pi 会显示状态消息而不是挂起。WSL 中正常的 Linux `ctrl+z`/`fg` 行为不受影响。

### Emacs 风格示例

```json
{
  "tui.editor.historyPrevious": "ctrl+p",
  "tui.editor.historyNext": "ctrl+n",
  "tui.editor.cursorLeft": ["left", "ctrl+b"],
  "tui.editor.cursorRight": ["right", "ctrl+f"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+f"],
  "tui.editor.deleteCharForward": ["delete", "ctrl+d"],
  "tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim 风格示例

```json
{
  "tui.editor.cursorUp": ["up", "alt+k"],
  "tui.editor.cursorDown": ["down", "alt+j"],
  "tui.editor.cursorLeft": ["left", "alt+h"],
  "tui.editor.cursorRight": ["right", "alt+l"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+w"]
}
```
