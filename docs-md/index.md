# Pi

Pi 是一个可扩展的 AI 代理，可在您的终端中运行。给它一个目标和工作文件夹，它就能检查文件、运行命令、编辑内容，并处理多步骤任务。

使用 Pi 进行软件开发、研究笔记、写作项目、数据文件或业余工作。您可以按原样使用 Pi，提示它适应您的工作流程，或使用 SDK 构建由 Pi 驱动的其他应用程序。

## 开始使用 Pi

刚接触 Pi？请遵循[快速入门](/docs/quickstart/)安装 Pi、连接模型并完成您的首个任务。

若已安装 Pi，请选择您想进行的操作：

- [交互式使用 Pi](/docs/usage/) 以添加文件、运行命令、指导持续工作并导出结果。
- [选择模型](/docs/models/) 或连接订阅、API 密钥、本地模型或兼容端点。
- [继续或分支会话](/docs/sessions/) 以恢复工作或探索其他方法而不丢失历史记录。
- [配置 Pi](/docs/configuration/) 以满足您的偏好、工作文件夹、指令和可复用资源。
- [了解 Pi 的工作原理](/docs/how-pi-works/)，包括工具、上下文、会话及代理循环。

## 自定义 Pi

Pi 可复用提示词、加载专门指令、添加可执行集成、更改其终端界面、连接模型服务，并将这些资源作为软件包分发。
使用[快速入门自定义选择器](quickstart.md#choose-how-to-customize-pi)来选取满足你需求的最小机制。

## 自动化或嵌入 Pi

- 对于一次性或脚本化任务，使用[打印模式](cli.md#invocation-and-output)。
- 使用 [JSON 事件流模式](/docs/json/) 来消费单次运行中的结构化事件。
- 使用 [RPC 模式](/docs/rpc/) 来控制独立的 Pi 进程。
- 使用 [TypeScript SDK](/docs/sdk/) 在应用程序内运行 Pi。

## 查找参考和设置信息

使用参考页面查阅 [CLI 选项](/docs/cli/)、[设置](/docs/settings/)、[提供商](/docs/providers/)、[键位绑定](/docs/keybindings/) 和 [环境变量](/docs/environment-variables/)。

关于特定平台的帮助，请参阅 [终端设置](/docs/terminal-setup/)、[Windows](/docs/windows/)、[tmux](/docs/tmux/)、[Android 上的 Termux](/docs/termux/) 或 [容器化](/docs/containerization/)。

## 安全工作

Pi 的工具和扩展以 Pi 进程的权限运行。项目信任控制 Pi 加载哪些项目资源，但不会对工具调用进行沙箱隔离。在使用不受信任的文件、仓库、扩展或无人值守自动化之前，请查阅[安全](/docs/security/)文档。
