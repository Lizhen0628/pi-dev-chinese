# 快速入门

Pi 在您的终端中运行，并处理您机器上的文件。要使用它，您需要通过受支持的提供商访问模型。这可以是订阅、API 密钥或本地模型。

对于原生 Windows 设置，请阅读 [Windows 设置](/docs/windows/)。对于 Android，请阅读 [Termux 设置](/docs/termux/)。

## 1. 安装 Pi

在 macOS 或 Linux 上，您可以使用安装程序：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

或者，通过 npm 安装 Pi。这需要 Node.js 22.19 或更高版本：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

Pi 的正常 npm 安装不需要依赖生命周期脚本。

验证安装：

```bash
pi --version
```

## 2. 启动 Pi

切换到您希望 Pi 工作的文件夹，然后启动它：

```bash
cd /path/to/folder
pi
```

工作文件夹有助于 Pi 发现相关文件、指令和配置。Pi 还使用它来分组保存会话。

<p align="center"><img src="images/interactive-mode.png" alt="Pi 在终端中运行，包含对话、输入编辑器和状态页脚" width="750"></p>

界面显示您的对话、用于提示词和命令的编辑器，以及包含当前文件夹、模型和会话状态的页脚。参见 [在终端中使用 Pi](/docs/usage/) 了解如何添加文件、运行命令、引导持续工作以及管理结果。

## 3. 选择模型

**模型**生成 Pi 的回复。**提供商**是 Pi 用于访问该模型的服务或账户。

在 Pi 中，运行：

```text
/login
```

选择一个提供商，然后按照提示使用订阅或存储 API 密钥。之后如果你想选择其他可用的模型，可以运行 `/model`。

参见[选择模型和提供商](/docs/models/)了解支持的提供商、环境变量认证、本地模型和自定义端点。

## 4. 给 Pi 分配任务

Pi 会展示它执行的每次文件读取、搜索、命令和编辑操作。它不会在每次工具调用前都征求许可。

输入一个与你工作匹配的任务，例如：

```text
总结 @meeting-notes.md 并将行动项保存到 action-items.md。
```

```text
解释这个仓库的结构以及如何运行其检查。
```

```text
比较 @previous.csv 与 @current.csv 并总结重要变化。
```

在编辑器中输入 `@` 来搜索文件，而不是输入其完整路径。当 Pi 完成后，审查其响应及任何更改的文件。对于重要工作，请使用版本控制或备份。对于不受信任或无人值守的工作，请使用容器或其他沙箱。参见 [安全](/docs/security/)。

## 稍后继续

Pi 会自动保存会话。退出 Pi 后，使用以下命令恢复同一工作文件夹的最近会话：

```bash
pi --continue
```

使用 `/resume` 选择其他已保存的会话。有关会话命名、分支、压缩、导出和共享，请参阅 [继续或分支会话](/docs/sessions/)。

## 后续步骤

- [交互式使用 Pi](/docs/usage/) 了解输入、命令、快捷键及排队消息。
- [添加指令](configuration.md#context-files)，让 Pi 在文件夹中工作时始终遵循。
- [选择模型与提供商](/docs/models/)。

### 如何自定义 Pi

从满足需求的最轻量机制开始：

| 需求 | 起始方式 |
|---|---|
| 为文件夹提供 Pi 的持久指令 | [`AGENTS.md`](configuration.md#context-files) |
| 从 `/` 菜单复用提示词 | [提示词模板](/docs/prompt-templates/) |
| 添加任务特定指令和支持文件 | [技能](/docs/skills/) |
| 添加可执行工具、命令或事件处理器 | [扩展](/docs/extensions/) |
| 构建自定义终端组件 | [终端界面](/docs/tui/) |
| 连接不支持的模型服务 | [自定义提供商](/docs/custom-provider/) |
| 安装或分发多个资源 | [Pi 软件包](/docs/packages/) |

## 卸载 Pi

如果你通过 npm 安装了 Pi，请运行：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

如果你使用了安装器，请重新运行它并选择 **卸载 Pi**：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

这两种方法都不会移除 `~/.pi/agent/` 中的配置、凭据、会话或已安装的 Pi 软件包。
