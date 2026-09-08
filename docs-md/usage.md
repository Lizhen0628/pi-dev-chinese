# 使用 Pi

本页汇总快速上手之外在日常使用中会用到的细节。

## 交互模式

界面分为四个主要区域：

- **启动头部** —— 快捷键、已加载的上下文文件、提示词模板、技能和扩展
- **消息区** —— 用户消息、助手回复、工具调用、工具结果、通知、错误与扩展 UI
- **编辑器** —— 你输入内容的地方；边框颜色指示当前思考等级
- **页脚** —— 工作目录、会话名称、token/缓存用量、费用、上下文占用与当前模型。统计包含助手回复、工具上报的用量以及摘要生成的消耗。

编辑器可能被内置 UI（如 `/settings`）或自定义扩展 UI 临时替换。

### 编辑器功能

| 功能 | 操作 |
|------|------|
| 引用文件 | 输入 `@` 模糊搜索项目文件 |
| 路径补全 | 按 Tab 补全路径 |
| 多行输入 | Shift+Enter，Windows Terminal 上为 Ctrl+Enter |
| 复制回复 | Ctrl+X 在 `/tree` 中复制选中的消息；否则复制最后一条助手消息，或在 `fullscreenCopyOnSelect` 关闭时复制全屏视图中的当前选区 |
| 图片 | Ctrl+V 粘贴（Windows 上为 Alt+V），或直接拖入终端 |
| Shell 命令 | `!命令` 运行并把输出发给模型 |
| 隐式 Shell 命令 | `!!命令` 运行但不把输出加入模型上下文 |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`（Windows 上为记事本，其他平台为 `nano`） |

全部快捷键与自定义见[键位绑定](/docs/keybindings/)。

## 斜杠命令

在编辑器中输入 `/` 打开命令补全。扩展可以注册自定义命令；技能以 `/技能名:名称` 的形式提供；提示词模板通过 `/模板名` 展开。

| 命令 | 说明 |
|------|------|
| `/login`、`/logout` | 管理 OAuth 或 API Key 凭据 |
| [`/llama`](/docs/llama-cpp/) | 下载、加载与卸载 llama.cpp 路由模型 |
| `/model` | 切换模型；选择器内按 Ctrl+S 保存为启动默认 |
| `/thinking` | 切换思考等级；选择器内按 Ctrl+S 保存为启动默认 |
| `/scoped-models` | 启用/禁用参与 Ctrl+P 轮换的模型 |
| `/settings` | 主题、消息投递、传输方式等偏好设置 |
| `/resume` | 从历史会话中选择恢复 |
| `/new` | 开始新会话 |
| `/name <名称>` | 设置会话显示名 |
| `/session` | 显示会话文件、ID、消息数、token 与费用 |
| `/tree` | 跳到会话中的任意节点并从那里继续 |
| `/trust` | 保存项目信任决定，供以后的会话使用 |
| `/fork` | 从更早的某条用户消息创建新会话 |
| `/clone` | 把当前活动分支复制为一个新会话 |
| `/compact [提示]` | 手动压缩上下文，可附带自定义指令 |
| `/copy` | 复制最后一条助手消息到剪贴板 |
| `/export [文件]` | 把会话导出为 HTML 或 JSONL |
| `/import <文件>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 上传为私有 GitHub gist，生成可分享的 HTML 链接 |
| `/reload` | 重新加载键位、扩展、技能、提示词、主题与上下文文件 |
| `/hotkeys` | 显示所有快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 Pi |

## 消息队列

智能体还在工作时你也可以继续提交消息：

- **Enter** —— 排入引导（steering）消息，在当前助手回合执行完工具调用后投递。
- **Alt+Enter** —— 排入追问（follow-up）消息，在智能体完成全部工作后投递。
- **Escape** —— 中止运行，并把已排队的消息还原到编辑器。
- **Alt+Up** —— 把排队中的消息取回编辑器。

在 Windows Terminal 上，Alt+Enter 默认是全屏。如果希望 Pi 收到这个快捷键，按[终端设置](/docs/terminal-setup/)中的说明重新映射。

投递行为可在[设置](/docs/settings/)中通过 `steeringMode` 和 `followUpMode` 配置。

## 会话

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录归档。

```bash
pi -c                  # 继续最近一次会话
pi -r                  # 浏览并选择一个会话
pi --no-session        # 临时模式，不保存
pi --name "我的任务"    # 启动时设置会话显示名
pi --session <路径|id> # 使用指定的会话文件或会话 ID
pi --fork <路径|id>    # 把会话分叉到新的会话文件
```

常用会话命令：

- `/session` 显示当前会话文件与 ID。
- `/tree` 在会话树内导航，可为被放弃的分支生成摘要。
- `/fork` 从更早的用户消息创建新会话。
- `/clone` 把当前活动分支复制为新的会话文件。
- `/compact` 摘要较早的消息以释放上下文。

详见[会话](/docs/sessions/)与[压缩](/docs/compaction/)。

## 上下文文件

Pi 启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md` —— 全局说明
- 上级目录（从当前工作目录逐级向上）
- 当前目录

如果某个目录里存在 `AGENTS.override.md`，Pi 会用它替代该目录的 `AGENTS.md` 或 `CLAUDE.md`；其他目录的上下文文件仍正常叠加。

上下文文件适合放项目约定、常用命令、安全规则和偏好。用 `--no-context-files` 或 `-nc` 可禁用加载。

### 系统提示文件

用以下文件替换默认系统提示：

- 项目级：`.pi/SYSTEM.md`
- 全局：`~/.pi/agent/SYSTEM.md`

在以上任一位置放置 `APPEND_SYSTEM.md` 则是在默认提示后追加而不是替换。

### 项目信任

交互启动时，如果项目目录包含项目级设置、资源或项目 `.agents/skills`，而 `~/.pi/agent/trust.json` 中对该目录（或其父目录）没有保存过信任决定，Pi 会先询问是否信任该项目。信任后 Pi 才会加载 `.pi/settings.json` 与 `.pi` 资源、安装缺失的项目软件包、执行项目扩展。

在信任决定做出之前，Pi 只加载上下文文件、用户/全局扩展和 CLI `-e` 扩展，让它们有机会处理 `project_trust` 事件。项目本地扩展、项目软件包管理的扩展和项目设置只在该项目被信任之后加载。切换到另一个工作目录的会话且其信任未在当前进程内解决时，同样遵循这一划分。

非交互模式（`-p`、`--mode json`、`--mode rpc`）不显示信任询问。没有适用的已保存决定时，按全局设置中的 `defaultProjectTrust` 处理：`ask`（默认）和 `never` 会忽略项目资源，`always` 则信任它们。也可以用 `--approve`/`-a` 或 `--no-approve`/`-na` 为单次运行覆盖项目信任。

`pi config` 和软件包命令走同样的项目信任流程，但 `pi update` 从不弹询问。用 `--approve` 让单条命令信任项目本地设置，或用 `--no-approve` 忽略它们。

在交互模式中用 `/trust` 保存项目信任决定（包括对其直接父目录的信任），供以后的会话使用。它只写入 `~/.pi/agent/trust.json`，当前会话不会重新加载，重启 Pi 后生效。

## 导出与分享会话

用 `/export [文件]` 把会话导出为 HTML。

用 `/share` 上传为私有 GitHub gist 并生成可分享的 HTML 链接。

如果你用 Pi 做开源工作，并希望为模型、提示词、工具与评测研究发布会话，可以看看 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)，它把会话发布为 Hugging Face 数据集。

## CLI 参考

```bash
pi [选项] [--] [@文件...] [消息...]
```

### 软件包命令

```bash
pi install <来源> [-l]     # 安装软件包，-l 表示项目本地
pi remove <来源> [-l]      # 移除软件包
pi uninstall <来源> [-l]   # remove 的别名
pi update [来源|self|pi]   # 只更新 pi，或更新某个包来源
pi update --all            # 更新 pi 与所有软件包；对齐固定的 git 引用
pi update --extensions     # 只更新软件包；对齐固定的 git 引用
pi update --models         # 只刷新模型目录
pi update --self           # 只更新 pi
pi update --extension <src> # 更新单个软件包
pi list                    # 列出已安装的软件包
pi config                  # 启用/禁用软件包资源
```

这些命令管理 Pi 软件包，`pi update` 也可以更新 pi CLI 本身。卸载 Pi 见[快速上手](/docs/quickstart/)。`pi config` 和项目软件包命令接受 `--approve`/`--no-approve`，为单条命令信任或忽略项目本地设置；`pi update` 从不弹项目信任询问。

包来源与安全说明见 [Pi 软件包](/docs/packages/)。

### 模式

| 标志 | 说明 |
|------|------|
| 默认 | 交互模式 |
| `-p`、`--print` | 打印回复后退出 |
| `--mode json` | 以 JSON 行输出全部事件，见 [JSON 模式](/docs/json/) |
| `--mode rpc` | 基于 stdin/stdout 的 RPC 模式，见 [RPC 模式](/docs/rpc/) |
| `--export <输入> [输出]` | 把会话导出为 HTML |

打印模式下，Pi 也会读取管道输入并合并进初始提示词：

```bash
cat README.md | pi -p "总结这段文字"
```

### 模型选项

| 选项 | 说明 |
|------|------|
| `--provider <名称>` | 提供商，如 `anthropic`、`openai`、`google` |
| `--model <模式>` | 模型模式或 ID；支持 `provider/id`，可附 `:<思考等级>` |
| `--api-key <key>` | API Key，覆盖环境变量 |
| `--thinking <等级>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <模式列表>` | 逗号分隔的模式列表，用于 Ctrl+P 轮换 |
| `--list-models [搜索]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|------|------|
| `-c`、`--continue` | 继续最近一次会话 |
| `-r`、`--resume` | 浏览并选择会话 |
| `--session <路径\|id>` | 使用指定会话文件或部分 UUID |
| `--fork <路径\|id>` | 把会话文件分叉为新会话 |
| `--session-dir <目录>` | 自定义会话存储目录 |
| `--no-session` | 临时模式，不保存 |
| `--name <名称>`、`-n <名称>` | 启动时设置会话显示名 |

### 工具选项

| 选项 | 说明 |
|------|------|
| `--tools <列表>`、`-t <列表>` | 只允许指定的内置/扩展/自定义工具 |
| `--exclude-tools <列表>`、`-xt <列表>` | 禁用指定的内置/扩展/自定义工具 |
| `--no-builtin-tools`、`-nbt` | 禁用内置工具但保留扩展/自定义工具 |
| `--no-tools`、`-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`powershell`（Windows）、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项

| 选项 | 说明 |
|------|------|
| `-e`、`--extension <来源>` | 从路径、npm 或 git 加载扩展；可重复 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <路径>` | 加载技能；可重复 |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <路径>` | 加载提示词模板；可重复 |
| `--no-prompt-templates` | 禁用提示词模板发现 |
| `--theme <路径>` | 加载主题；可重复 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`、`-nc` | 禁用 `AGENTS.md` 和 `CLAUDE.md` 发现 |

把 `--no-*` 与显式加载标志组合，可以完全按需加载、忽略设置文件。例如：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项

| 选项 | 说明 |
|------|------|
| `--system-prompt <文本>` | 替换默认系统提示；上下文文件与技能仍会追加 |
| `--append-system-prompt <文本>` | 在系统提示后追加 |
| `--tui-mode <模式>` | TUI 模式：`regular`（默认）或实验性的 `fullscreen` |
| `--use-theme <名称[/名称]>` | 仅本次运行使用指定主题，不改设置 |
| `--verbose` | 强制详细启动输出 |
| `-a`、`--approve` | 本次运行信任项目本地文件 |
| `-na`、`--no-approve` | 本次运行忽略项目本地文件 |
| `--` | 停止解析选项；其余参数为提示词或 `@文件` |
| `-h`、`--help` | 显示帮助 |
| `-v`、`--version` | 显示版本 |

`fullscreen` 模式下，对话记录在终端视口内滚动，而排队消息、工作状态、扩展组件、编辑器和页脚固定在底部。鼠标/触控板滚动指针下的区域；键盘视口操作始终可用。支持 Kitty 图形协议的终端（Kitty、Ghostty）可内联显示图片；iTerm2 中图片渲染为文本占位，因为其内联图片协议无法在应用接管的滚动中删除或裁剪已放置的图片。`regular` 模式使用主屏和终端自身的回滚缓冲，iTerm2 内联图片可正常显示。终端相关的设置与变通方法见[终端设置](/docs/terminal-setup/)。

在 `/settings` 中设置 **TUI mode** 可立即在 `regular` 与 `fullscreen` 间切换，并选择以后的默认值。**Fullscreen exit output** 控制退出全屏时是打印最终对话记录，还是恢复之前的屏幕内容并只打印会话恢复提示。

### 文件参数

用 `@` 前缀把文件并入消息：

```bash
pi @prompt.md "回答这个问题"
pi -p @screenshot.png "这张图里有什么？"
pi @code.ts @test.ts "评审这几个文件"
```

### 示例

```bash
# 带初始提示词的交互模式
pi "列出 src/ 下所有 .ts 文件"

# 非交互
pi -p "总结一下这个代码库"

# 以短横线开头的提示词
pi -p -- "- 总结这些要点"

# 带管道输入的非交互
cat README.md | pi -p "总结这段文字"

# 命名的一次性会话
pi --name "发布审计" -p "审计这个仓库"

# 换个模型
pi --provider openai --model gpt-4o "帮我重构"

# 带 provider 前缀的模型
pi --model openai/gpt-4o "帮我重构"

# 模型 + 思考等级简写
pi --model sonnet:high "解决这个复杂问题"

# 限制 Ctrl+P 轮换范围
pi --models "claude-*,gpt-4o"

# 只读模式
pi --tools read,grep,find,ls -p "评审这段代码"

# 只禁用一个扩展或内置工具，其余保持可用
pi --exclude-tools ask_question
```

## 设计原则

Pi 把核心保持得很小，把工作流相关的行为推进到扩展、技能、提示词模板和软件包里。

它有意不内置 MCP、子智能体、权限弹窗、计划模式、待办事项和后台 bash。这些工作流都可以作为扩展或软件包来构建或安装，也可以借助容器、tmux 之类的外部工具。

完整的设计取舍可以读作者的[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
