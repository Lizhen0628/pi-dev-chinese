# 快速上手

本页带你从安装走到第一次真正有用的 Pi 会话。

## 安装

Pi 以 npm 包的形式分发：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。Pi 在正常的 npm 安装中不需要安装脚本。

### 卸载

用安装时对应的包管理器卸载。curl 安装脚本走的是 npm 全局安装，所以 curl 和 npm 安装都用 npm 移除：

```bash
# curl 安装脚本或 npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

卸载 Pi 不会删除 `~/.pi/agent/` 下的设置、凭据、会话和已安装的 Pi 软件包。

在你希望它工作的项目目录里启动：

```bash
cd /path/to/project
pi
```

## 认证

Pi 既可以通过 `/login` 使用订阅类提供商，也可以通过环境变量或认证文件使用 API Key 类提供商。

### 方式一：订阅登录

启动 Pi 后运行：

```text
/login
```

然后选择一个提供商。内置的订阅登录包括 Claude Pro/Max、ChatGPT Plus/Pro（Codex）和 GitHub Copilot。

### 方式二：API Key

启动 Pi 之前设置好 API Key：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

也可以运行 `/login` 并选择 API Key 类提供商，把 Key 保存到 `~/.pi/agent/auth.json`。

全部受支持的提供商、环境变量与云端配置见[提供商](/docs/providers/)。

## 第一次会话

Pi 启动后，输入一个请求并回车：

```text
总结一下这个仓库，并告诉我怎么运行它的检查。
```

默认情况下，Pi 给模型四个工具：

- `read` —— 读取文件
- `write` —— 创建或覆盖文件
- `edit` —— 以补丁方式修改文件
- `bash` —— 运行 shell 命令

另外还有几个内置只读工具（`grep`、`find`、`ls`），可通过工具选项开启。Pi 在当前工作目录中运行，可以修改其中的文件。想要随时回滚，建议配合 git 或其他检查点机制使用。

## 给 Pi 项目说明

Pi 启动时会加载上下文文件。在项目里放一个 `AGENTS.md`，告诉它这个项目该怎么干活：

```markdown
# 项目说明

- 改完代码后运行 `npm run check`。
- 不要在本地跑生产库迁移。
- 回答保持简洁。
```

Pi 会加载：

- `~/.pi/agent/AGENTS.md` —— 全局说明
- 上级目录和当前目录中的 `AGENTS.md` 或 `CLAUDE.md`

如果某个目录里存在 `AGENTS.override.md`，Pi 会用它替代该目录的 `AGENTS.md` 或 `CLAUDE.md`。

改完上下文文件后，重启 Pi 或运行 `/reload`。

## 常见玩法

### 引用文件

在编辑器里输入 `@` 可以模糊搜索文件，也可以直接在命令行传入：

```bash
pi @README.md "总结一下这个"
pi @src/app.ts @src/app.test.ts "把这两个放在一起评审"
```

图片或文本可以用 Ctrl+V 粘贴（Windows 上是 Alt+V）；在支持的终端里图片也可以直接拖进来。

### 运行 shell 命令

在交互模式中：

```text
!npm run lint
```

命令输出会发送给模型。用 `!!命令` 可以在不把输出加入模型上下文的情况下运行命令。

### 切换模型

用 `/model` 或 Ctrl+L 为当前会话选择模型。在模型选择器里按 Ctrl+S 可以把高亮的模型保存为启动默认。`/thinking` 用于选择当前会话的思考等级，同样可用 Ctrl+S 保存默认；Shift+Tab 循环切换思考等级。Ctrl+P / Shift+Ctrl+P 在常用模型之间轮换。

### 稍后继续

会话会自动保存：

```bash
pi -c                  # 继续最近一次会话
pi -r                  # 浏览历史会话
pi --name "我的任务"    # 启动时设置会话显示名
pi --session <路径|id>  # 打开指定会话
```

在 Pi 内部，用 `/resume`、`/new`、`/tree`、`/fork` 和 `/clone` 管理会话。

### 非交互模式

一次性提示词：

```bash
pi -p "总结一下这个代码库"
cat README.md | pi -p "总结这段文字"
pi -p @screenshot.png "这张图里有什么？"
```

用 `--mode json` 得到 JSON 事件输出，或用 `--mode rpc` 做进程集成。

## 下一步

- [使用 Pi](/docs/usage/) —— 交互模式、斜杠命令、会话、上下文文件与 CLI 参考。
- [提供商](/docs/providers/) —— 认证与模型配置。
- [设置](/docs/settings/) —— 全局与项目配置。
- [键位绑定](/docs/keybindings/) —— 快捷键与自定义。
- [Pi 软件包](/docs/packages/) —— 安装共享的扩展、技能、提示词与主题。

平台说明：[Windows](/docs/windows/)、[Termux](/docs/termux/)、[tmux](/docs/tmux/)、[终端设置](/docs/terminal-setup/)、[Shell 别名](/docs/shell-aliases/)。
