# 使用Pi

本页收集了快速入门页面中未涵盖的日常使用细节。

## 交互模式

<p align="center"><img src="images/interactive-mode.png" alt="交互模式" width="600"></p>

该界面包含四个主要区域：

- **启动头部** —— 快捷键、已加载的上下文文件、提示词模板、技能和扩展
- **消息** —— 用户消息、助手回复、工具调用、工具结果、通知、错误和扩展界面
- **编辑器** —— 输入区域；边框颜色表示当前的思考级别
- **底部栏** —— 工作目录、会话名称、token/缓存用量、费用、上下文用量和当前模型。总计包括助手回复、工具报告的用量及摘要生成。

编辑器可临时被内置界面（如 `/settings`）或自定义扩展界面所替代。

### 编辑器功能

| 功能 | 方式 |
|---------|-----|
| 文件引用 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | 按 Tab 补全路径 |
| 多行输入 | Shift+Enter，或 Windows Terminal 中使用 Ctrl+Enter |
| 复制响应 | Ctrl+X 复制 `/tree` 中选中的消息；否则复制最后一条助手消息，或当 `fullscreenCopyOnSelect` 禁用时，复制当前全屏文本选择 |
| 图像 | 使用 Ctrl+V 粘贴（Windows 上为 Alt+V），或拖入终端 |
| Shell 命令 | `!command` 运行命令并将输出发送给模型 |
| 隐藏 Shell 命令 | `!!command` 运行命令但不将输出发送给模型 |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`（Windows 上为记事本），其他平台为 `nano` |

参见 [按键绑定](/docs/keybindings/) 以了解所有快捷键和自定义设置。

## 斜杠命令

在编辑器中输入 `/` 可打开命令补全功能。扩展可以注册自定义命令，技能通过 `/skill:name` 调用，提示词模板通过 `/templatename` 展开。

| 命令 | 描述 |
|---------|-------------|
| `/login`, `/logout` | 管理 OAuth 或 API 密钥凭据 |
| [`/llama`](/docs/llama-cpp/) | 下载、加载和卸载 llama.cpp 路由模型 |
| `/model` | 切换模型；在选取器中按 Ctrl+S 可保存启动默认模型 |
| `/thinking` | 切换思考级别；在选取器中按 Ctrl+S 可保存启动默认级别 |
| `/scoped-models` | 启用/禁用模型以支持 Ctrl+P 循环切换 |
| `/settings` | 主题、消息投递、传输及其他偏好设置 |
| `/resume` | 从之前的会话中选择 |
| `/new` | 开始新会话 |
| `/name <名称>` | 设置会话显示名称 |
| `/session` | 显示会话文件、ID、消息、令牌和成本 |
| `/tree` | 跳转到会话中的任意位置并从该处继续 |
| `/trust` | 保存项目信任决策以供未来会话使用 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话中 |
| `/compact [提示词]` | 手动压缩上下文，可选附带自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [文件]` | 将会话导出为 HTML 或 JSONL 格式 |
| `/import <文件>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 作为私有 GitHub gist 上传，附带可分享的 HTML 链接 |
| `/bug [描述]` | 向 Pi 开发者报告问题；参见 [会话](sessions.md#reporting-bugs) |
| `/reload` | 重新加载按键绑定、扩展、技能、提示词、主题和上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

## 消息队列

在代理仍处于工作状态时，你可以提交消息：

- **Enter** 排队一条引导消息，在当前助手回合执行完其工具调用后交付。
- **Alt+Enter** 排队一条追问消息，在代理完成所有工作后交付。
- **Escape** 中止并将排队的消息恢复到编辑器中。
- **Alt+Up** 将排队的消息取回编辑器。

在 Windows Terminal 中，Alt+Enter 默认是全屏。如果你想 pi 接收该快捷键，请按照 [终端设置](/docs/terminal-setup/) 中的说明重新映射。

在 [设置](/docs/settings/) 中使用 `steeringMode` 和 `followUpMode` 配置交付方式。

## 会话

会话会自动保存到 `~/.pi/agent/sessions/` ，按工作目录进行整理。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择一个会话
pi --no-session        # 临时模式；不保存
pi --name "my task"    # 启动时设置会话显示名称
pi --session <path|id> # 使用特定的会话文件或会话 ID
pi --fork <path|id>    # 将会话分叉到一个新的会话文件中
```

实用的会话命令：

- `/session` 显示当前会话文件和 ID。
- `/tree` 浏览文件内的会话树，并可总结已废弃的分支。
- `/fork` 从较早的用户消息创建一个新会话。
- `/clone` 将当前活动分支复制到一个新的会话文件中。
- `/compact` 总结较早的消息以释放上下文空间。

详见 [会话](/docs/sessions/) 和 [压缩](/docs/compaction/)。

## 上下文文件

Pi 在启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md` 用于全局指令
- 父目录，从当前工作目录向上遍历
- 当前目录

如果某个目录包含 `AGENTS.override.md`，Pi 会加载该文件而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。来自其他目录的上下文文件仍会正常分层。

使用上下文文件来记录项目约定、命令、安全规则和偏好设置。可以使用 `--no-context-files` 或 `-nc` 禁用加载。

### 系统提示词文件

用以下文件替换默认系统提示词：

- 项目目录下的 `/.pi/SYSTEM.md`
- 全局目录下的 `~/.pi/agent/SYSTEM.md`

在这两处任一位置使用 `APPEND_SYSTEM.md` 文件，即可在默认提示词基础上追加内容，而不替换默认提示词。

### 项目信任

在交互式启动时，pi会在信任包含项目本地设置、资源或项目`.agents/skills`且没有对`~/.pi/agent/trust.json`中该文件夹或父文件夹保存决策的项目文件夹前进行询问。信任项目允许pi加载`.pi/settings.json`和`.pi`资源，安装缺失的项目软件包，并执行项目扩展。

在信任决策之前，pi仅加载上下文文件、用户/全局扩展以及命令行`-e`扩展，以便它们能处理`project_trust`事件。项目本地扩展、项目软件包管理的扩展和项目设置仅在项目被信任后加载。这种分离同样适用于切换到来自不同当前工作目录（cwd）的会话时，若该目录的信任尚未在当前进程中解开。

非交互模式（`-p`、`--mode json`和`--mode rpc`）不显示信任提示。在没有适用的已保存信任决策时，它们使用全局设置中的`defaultProjectTrust`：`ask`（默认）和`never`会忽略这些项目资源，而`always`则信任它们。传入`--approve`/`-a`或`--no-approve`/`-na`可单次运行覆盖项目信任。

如果无扩展或已保存决策适用，`defaultProjectTrust`控制回退行为。在`~/.pi/agent/settings.json`中将其设置为`"ask"`、`"always"`或`"never"`，或通过`/settings`更改。

`pi config`和软件包命令使用相同的项目信任流程，但`pi update`从不提示。传入`--approve`信任单次命令的项目本地设置，或`--no-approve`忽略它们。

在交互模式中使用`/trust`保存项目信任决策，供未来会话使用，包括对直接父文件夹的信任。它仅写入`~/.pi/agent/trust.json`；当前会话不重载，因此重启pi后更改才会生效。

## 导出和分享会话

使用 `/export [file]` 将会话写入 HTML。

使用 `/share` 上传私有 GitHub gist，并提供可分享的 HTML 链接。

如果你使用 pi 进行开源工作，并希望为模型、提示词、工具和评估研究发布会话，请参阅 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它会将会话发布到 Hugging Face 数据集。

## 命令行参考

```bash
pi [options] [--] [@files...] [messages...]
```

### 包命令

```bash
pi install <source> [-l]     # 安装软件包，-l 表示项目本地安装
pi remove <source> [-l]      # 移除软件包
pi uninstall <source> [-l]   # 移除命令的别名
pi update [source|self|pi]   # 仅更新 pi 本身，或更新某一软件包源
pi update --all              # 更新 pi 及所有软件包；协调固定的 git 引用
pi update --extensions       # 仅更新软件包；协调固定的 git 引用
pi update --models           # 仅刷新模型目录
pi update --self             # 仅更新 pi 本身
pi update --extension <src>  # 更新单个软件包
pi list                      # 列出已安装的软件包
pi config                    # 启用/禁用软件包资源
```

这些命令管理 pi 软件包，且 `pi update` 可更新 pi CLI 的安装。若要卸载 pi 本身，请参阅[快速入门](quickstart.md#uninstall)。`pi config` 与项目软件包命令接受 `--approve`/`--no-approve` 参数，以在单次命令中信任或忽略项目本地设置。`pi update` 从不提示项目信任。

有关软件包来源与安全注意事项，请参阅[Pi 软件包](/docs/packages/)。

### 模式

| 标志 | 描述 |
|------|------|
| default | 交互模式 |
| `-p`, `--print` | 打印响应并退出 |
| `--mode json` | 将所有事件输出为 JSON 行；参见 [JSON 模式](/docs/json/) |
| `--mode rpc` | 通过标准输入/输出进行 RPC 模式；参见 [RPC 模式](/docs/rpc/) |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式下，pi 也会读取通过管道传入的标准输入，并将其合并到初始提示词中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 描述 |
|--------|-------------|
| `--provider <name>` | 提供商，如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | 模型模式或 ID；支持 `provider/id` 及可选的 `:<thinking>` |
| `--api-key <key>` | API 密钥，覆盖环境变量 |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 用于 Ctrl+P 循环切换的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 描述 |
|--------|-------------|
| `-c`, `--continue` | 继续最近的会话 |
| `-r`, `--resume` | 浏览并选择一个会话 |
| `--session <路径\|ID>` | 使用特定的会话文件或部分 UUID |
| `--fork <路径\|ID>` | 将会话文件或部分 UUID 分支到一个新会话中 |
| `--session-dir <目录>` | 自定义会话存储目录 |
| `--no-session` | 临时模式；不保存任何内容 |
| `--name <名称>`, `-n <名称>` | 启动时设置会话显示名称 |

### 工具选项

| 选项 | 描述 |
|--------|-------------|
| `--tools <list>`, `-t <list>` | 允许使用特定的内置、扩展和自定义工具 |
| `--exclude-tools <list>`, `-xt <list>` | 禁用特定的内置、扩展和自定义工具 |
| `--no-builtin-tools`, `-nbt` | 禁用内置工具，但保持扩展/自定义工具启用 |
| `--no-tools`, `-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`powershell`（Windows）、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项

| 选项 | 描述 |
|--------|-------------|
| `-e`, `--extension <source>` | 从路径、npm 或 git 加载扩展；可重复使用 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能；可重复使用 |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示词模板；可重复使用 |
| `--no-prompt-templates` | 禁用提示词模板发现 |
| `--theme <path>` | 加载主题；可重复使用 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`, `-nc` | 禁用 `AGENTS.md` 和 `CLAUDE.md` 发现 |

将 `--no-*` 与显式标志结合使用，即可精确加载所需内容，忽略设置。示例：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项

| 选项 | 描述 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示词；上下文文件和技能仍会附加 |
| `--append-system-prompt <text>` | 附加到系统提示词 |
| `--tui-mode <mode>` | TUI 模式：`regular`（默认）或实验性 `fullscreen` |
| `--use-theme <name[/name]>` | 设置本次运行的初始交互主题，而不更改设置 |
| `--verbose` | 强制详细启动输出 |
| `-a`, `--approve` | 信任本次运行的项目本地文件 |
| `-na`, `--no-approve` | 忽略本次运行的项目本地文件 |
| `--` | 停止选项解析；剩余参数为提示词或 `@file` 输入 |
| `-h`, `--help` | 显示帮助 |
| `-v`, `--version` | 显示版本 |

在 `fullscreen` 模式下，转录内容在终端视口内滚动，而排队消息、工作状态、扩展组件、编辑器和页脚保持在底部固定。鼠标/触控板输入滚动指针下的区域；键盘视口操作始终可用。支持 Kitty 图形协议（包括 Kitty 和 Ghostty）的终端中，内联图像可正常工作。在 iTerm2 中，它们以文本占位符形式渲染，因为其内联图像协议无法在应用程序控制的滚动期间删除或裁剪放置。在 `regular` 模式下，pi 使用主屏幕和终端拥有的回滚缓冲区，iTerm2 内联图像继续正常渲染。有关终端特定设置和变通方法，请参阅 [终端设置](/docs/terminal-setup/)。

在 `/settings` 中设置 **TUI 模式**，可立即在 `regular` 和 `fullscreen` 之间切换，并为未来会话选择默认模式。**全屏退出输出** 控制退出全屏时是打印最终转录内容，还是恢复之前的屏幕并仅打印会话恢复提示。

### 文件参数

使用 `@` 前缀将文件包含在消息中：

```bash
pi @prompt.md "回答这个问题"
pi -p @screenshot.png "这张图片里有什么？"
pi @code.ts @test.ts "审查这些文件"
```

### 示例

```bash
# 使用初始提示进行交互
pi "列出 src/ 中的所有 .ts 文件"

# 非交互式
pi -p "总结此代码库"

# 提示以破折号开头
pi -p -- "- 总结这些要点"

# 非交互式，通过管道输入标准输入
cat README.md | pi -p "总结此文本"

# 命名的一次性会话
pi --name "发布审计" -p "审计此仓库"

# 使用不同模型
pi --provider openai --model gpt-4o "帮我重构"

# 使用带提供商前缀的模型
pi --model openai/gpt-4o "帮我重构"

# 使用带有思考级别简写的模型
pi --model sonnet:high "解决此复杂问题"

# 限制模型循环切换
pi --models "claude-*,gpt-4o"

# 只读模式
pi --tools read,grep,find,ls -p "审查代码"

# 禁用某个扩展或内置工具，同时保留其余可用
pi --exclude-tools ask_question
```

## 设计原则

Pi 保持核心小巧，并将工作流特定行为推入扩展、技能、提示词模板和软件包中。

它有意不包含内置的 MCP、子代理、权限弹窗、计划模式、待办事项或后台 bash。你可以将这些工作流构建或安装为扩展或软件包，或使用外部工具（如容器和 tmux）。

要了解完整理由，请阅读[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
