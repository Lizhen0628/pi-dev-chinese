# 按键绑定

Pi 提供了诸如 `session.new` 之类的命名动作，可以为它们分配按键绑定。您可以更改默认分配，或在 Pi 的[用户配置](configuration.md#agent-directory)中为未绑定的动作分配按键。

按 `/hotkeys` 可查看主编辑器和应用程序当前生效的快捷键。

## 按键绑定

在 `keybindings.json` 文件中定义按键绑定。`<agent-directory>/keybindings.json` 是默认配置文件路径，若不指定，代理目录默认位于 `~/.pi/agent`，详见[代理目录](configuration.md#agent-directory)。

将每个动作标识符映射为一个按键或按键列表：

```json
{
  "$schema": "https://pi.dev/schemas/keybindings.schema.json",
  "app.session.new": "ctrl+shift+n",
  "app.session.tree": ["ctrl+shift+t", "alt+shift+t"]
}
```

配置项的值会替换该动作的默认绑定。若需禁用某动作的按键绑定，可将其设为空列表：

```json
{
  "tui.altScreen.pageUp": []
}
```

编辑完成后，运行 `/reload` 命令，将更改应用到当前会话。

以下为译文：

## 按键写法

按键组合写作 `修饰键+键名`。修饰键包括 `ctrl`、`shift`、`alt` 和 `super`，可组合使用。有效的键名为：

- **字母：** `a`-`z`
- **数字：** `0`-`9`
- **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **功能键：** `f1`-`f12`
- **符号：** `` ` ` `、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

示例：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`super+k`、`ctrl+super+k` 和 `ctrl+1`。

`super` 绑定要求终端能够单独报告该修饰键，通常通过 Kitty 键盘协议实现。在不支持该协议的终端中可能无法生效。

## 操作

### 终端界面

#### 光标移动

| 按键绑定 | 默认值 | 描述 |
|---|---|---|
| `tui.editor.cursorUp` | `up` | 向上移动光标，浏览顶部历史记录 |
| `tui.editor.cursorDown` | `down` | 向下移动光标，浏览底部历史记录 |
| `tui.editor.historyPrevious` | 无 | 选择上一条提示词历史记录 |
| `tui.editor.historyNext` | 无 | 选择下一条提示词历史记录 |
| `tui.editor.cursorLeft` | `left`, `ctrl+b` | 光标左移 |
| `tui.editor.cursorRight` | `right`, `ctrl+f` | 光标右移 |
| `tui.editor.cursorWordLeft` | `alt+left`, `ctrl+left`, `alt+b` | 光标向左移动一个词 |
| `tui.editor.cursorWordRight` | `alt+right`, `ctrl+right`, `alt+f` | 光标向右移动一个词 |
| `tui.editor.cursorLineStart` | `home`, `ctrl+a` | 移动到行首 |
| `tui.editor.cursorLineEnd` | `end`, `ctrl+e` | 移动到行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | 向前跳转到字符 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | 向后跳转到字符 |
| `tui.editor.pageUp` | `pageUp`, `ctrl+pageUp` | 按页向上滚动 |
| `tui.editor.pageDown` | `pageDown`, `ctrl+pageDown` | 按页向下滚动 |

专用的历史记录操作在光标位置之外浏览提示词历史记录，并使用相同键优先于应用程序操作。

#### 文本编辑

| 按键绑定 ID | 默认按键 | 描述 |
|---|---|---|
| `tui.editor.deleteCharBackward` | `backspace` | 向后删除字符 |
| `tui.editor.deleteCharForward` | `delete`, `ctrl+d` | 向前删除字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`, `alt+backspace` | 向后删除单词 |
| `tui.editor.deleteWordForward` | `alt+d`, `alt+delete` | 向前删除单词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | 删除至行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | 删除至行尾 |
| `tui.editor.yank` | `ctrl+y` | 粘贴最近删除的文本 |
| `tui.editor.yankPop` | `alt+y` | 在 yank 后循环切换已删除的文本 |
| `tui.editor.undo` | `ctrl+-`（Windows 上为 `ctrl+z`；WSL 上为 `alt+z`） | 撤销上次编辑 |

**按键绑定 ID** | **默认按键** | **描述**
|---|---|---|
| `tui.input.newLine` | `shift+enter`, `ctrl+j` | 插入新行 |
| `tui.input.submit` | `enter` | 提交输入 |
| `tui.input.tab` | `tab` | Tab 键或自动补全 |
| `tui.input.copy` | `ctrl+c` | 复制所选内容 |
| `tui.select.up` | `up` | 向上移动选择 |
| `tui.select.down` | `down` | 向下移动选择 |
| `tui.select.pageUp` | `pageUp` | 列表向上翻页 |
| `tui.select.pageDown` | `pageDown` | 列表向下翻页 |
| `tui.select.confirm` | `enter` | 确认选择 |
| `tui.select.cancel` | `escape`, `ctrl+c` | 取消选择 |

#### 全屏模式

在全屏模式下，以下操作控制转录内容，并优先于使用相同按键的编辑器操作。

| 键绑定 ID | 默认值 | 描述 |
|---|---|---|
| `tui.altScreen.pageUp` | `pageUp` | 将转录向上滚动一页 |
| `tui.altScreen.pageDown` | `pageDown` | 将转录向下滚动一页 |
| `tui.altScreen.halfPageUp` | 无 | 将转录向上滚动半页 |
| `tui.altScreen.halfPageDown` | 无 | 将转录向下滚动半页 |
| `tui.altScreen.lineUp` | 无 | 将转录向上滚动一行 |
| `tui.altScreen.lineDown` | 无 | 将转录向下滚动一行 |
| `tui.altScreen.previousPrompt` | `ctrl+shift+up`, `ctrl+up`（`ctrl+up` 仅在 Windows 和 WSL 上） | 跳转到上一条标记消息 |
| `tui.altScreen.nextPrompt` | `ctrl+shift+down`, `ctrl+down`（`ctrl+down` 仅在 Windows 和 WSL 上） | 跳转到下一条标记消息 |
| `tui.altScreen.search` | `ctrl+shift+f`（在 Windows 和 WSL 上为 `ctrl+f`） | 搜索渲染后的转录 |
| `tui.altScreen.searchNext` | `enter`, `ctrl+g` | 搜索时选择下一个匹配项 |
| `tui.altScreen.searchPrevious` | `shift+enter`, `ctrl+shift+g` | 搜索时选择上一个匹配项 |
| `tui.altScreen.searchClose` | `escape` | 关闭转录搜索 |
| `tui.altScreen.top` | `ctrl+home` | 滚动到转录开头 |
| `tui.altScreen.bottom` | `ctrl+end` | 滚动到转录末尾并跟随新输出 |

### 应用程序

| 按键绑定 ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | 取消 / 中止 |
| `app.clear` | `ctrl+c` | 清空编辑器（第一次）/ 退出（第二次） |
| `app.exit` | `ctrl+d` | 退出（当编辑器为空时） |
| `app.suspend` | `ctrl+z`（Windows 上无） | 挂起到后台 |
| `app.editor.external` | `ctrl+g` | 在外部编辑器中打开（`externalEditor`、`$VISUAL`、`$EDITOR`、Windows 上的记事本，或其他地方的 `nano`） |
| `app.clipboard.pasteImage` | `ctrl+v`（Windows 和 WSL 上为 `alt+v`） | 从剪贴板粘贴 macOS 上的文件、图像或文本 |

在原生 Windows 上，`app.suspend` 没有默认值，因为 Windows 终端不支持 Unix 作业控制。如果您手动分配它，Pi 会显示状态消息而不是挂起。WSL 使用正常的 `ctrl+z` 和 `fg` 行为。

### 会话

| 按键绑定 ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.session.new` | 无 | 开始新会话（`/new`） |
| `app.session.tree` | 无 | 打开会话树导航器（`/tree`） |
| `app.session.fork` | 无 | 分叉当前会话（`/fork`） |
| `app.session.resume` | 无 | 打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | 切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | 切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | 切换仅命名过滤器 |
| `app.session.rename` | `ctrl+r` | 重命名会话 |
| `app.session.delete` | `ctrl+d` | 删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | 查询为空时删除会话 |

### 模型与思考

| 按键绑定 ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | 打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | 切换到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p`（Windows 和 WSL 上为 `alt+p`） | 切换到上一个模型 |
| `app.models.save` | `ctrl+s` | 将选定的默认模型或作用域模型配置保存到设置中 |
| `app.thinking.cycle` | `shift+tab` | 循环切换思考级别 |
| `app.thinking.save` | `ctrl+s` | 将当前思考级别保存到设置中 |
| `app.thinking.toggle` | `ctrl+t` | 折叠或展开思考块 |

### 显示与消息队列

| 键绑定 ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | 折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | 在 `/tree` 中复制选中的消息；在全屏模式下，当 `fullscreenCopyOnSelect` 为 `false` 时复制活动选区；否则复制最后一条助手消息。在 OAuth 登录屏幕上，复制登录 URL |
| `app.message.followUp` | `alt+enter`（Windows 和 WSL 上为 `ctrl+q`） | 将追问消息加入队列 |
| `app.message.dequeue` | `alt+up`（Windows 和 WSL 上为 `alt+q`） | 将排队的消息恢复到编辑器 |

### 树形导航

| 按键绑定 ID | 默认按键 | 描述 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`, `alt+left` | 折叠当前分支段，或跳转到上一段起始位置 |
| `app.tree.unfoldOrDown` | `ctrl+right`, `alt+right` | 展开当前分支段，或跳转到下一段起始位置或分支末尾 |
| `app.tree.editLabel` | `shift+l` | 编辑所选树节点的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | 在树中切换标签时间戳的显示 |
| `app.tree.filter.default` | `ctrl+d` | 将树过滤器设置为默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | 切换隐藏工具结果的树过滤器 |
| `app.tree.filter.userOnly` | `ctrl+u` | 切换仅显示用户消息的树过滤器 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | 切换仅显示带标签条目的树过滤器 |
| `app.tree.filter.all` | `ctrl+a` | 切换显示所有条目的树过滤器 |
| `app.tree.filter.cycleForward` | `ctrl+o` | 向前循环切换树过滤器 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | 向后循环切换树过滤器 |

### 作用域模型选择器

用于作用域模型选择器内部（通过 `/scoped-models` 打开）。

| 按键绑定 ID | 默认值 | 描述 |
|--------|---------|-------------|
| `app.models.enableAll` | `ctrl+a` | 启用所有模型（或所有匹配当前搜索的模型） |
| `app.models.clearAll` | `ctrl+x` | 清除所有模型（或所有匹配当前搜索的模型） |
| `app.models.toggleProvider` | `ctrl+p` | 切换当前提供商的所有模型 |
| `app.models.reorderUp` | `alt+up` | 在循环顺序中向上移动所选模型 |
| `app.models.reorderDown` | `alt+down` | 在循环顺序中向下移动所选模型 |
