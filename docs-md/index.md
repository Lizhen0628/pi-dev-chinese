# Pi

Pi 是一个可扩展的 AI 代理，可在您的终端中运行。给它一个目标和工作文件夹，它就能检查文件、运行命令、编辑内容，并处理多步骤任务。

使用 Pi 进行软件开发、研究笔记、写作项目、数据文件或业余工作。您可以按原样使用 Pi，提示它适应您的工作流程，或使用 SDK 构建由 Pi 驱动的其他应用程序。

## 开始使用 Pi

初次接触 Pi？请遵循 [快速入门](/docs/quickstart/) 安装 Pi，连接模型，并完成您的首个任务。

若 Pi 已安装，选择您想执行的操作：

- [交互式使用 Pi](/docs/usage/) 以添加文件、运行命令、指导持续工作，并导出结果。
- [选择模型](/docs/models/) 或连接订阅、API 密钥、本地模型或兼容端点。
- [继续或分支会话](/docs/sessions/) 以恢复工作或探索其他方法，而不丢失历史记录。
- [配置 Pi](/docs/configuration/) 以设置您的偏好、工作文件夹、指令及可复用资源。
- [了解 Pi 的工作原理](/docs/how-pi-works/)，包括工具、上下文、会话及代理循环。

## 自定义 Pi

Pi 可以复用提示词、加载专用指令、添加可执行的集成、更改其终端界面、连接模型服务，并将这些资源作为软件包分发。
使用[快速入门自定义选择器](quickstart.md#choose-how-to-customize-pi)来挑选最符合您需求的最小机制。

## 自动化或嵌入 Pi

- 使用[打印模式](cli.md#invocation-and-output)处理一次性或脚本化任务。
- 使用[JSON事件流模式](/docs/json/)从一次运行中消费结构化事件。
- 使用[RPC模式](/docs/rpc/)控制独立的Pi进程。
- 使用[TypeScript SDK](/docs/sdk/)在应用程序内运行Pi。

## 查找参考和设置信息

使用参考页面查找 [命令行选项](/docs/cli/)、[设置](/docs/settings/)、[提供商认证](/docs/providers/)、[按键绑定](/docs/keybindings/) 和 [环境变量](/docs/environment-variables/)。

有关特定平台的帮助，请参阅 [终端设置](/docs/terminal-setup/)、[Windows](/docs/windows/)、[tmux](/docs/tmux/)、[Android 上的 Termux](/docs/termux/) 或 [容器化](/docs/containerization/)。

## 安全工作

Pi 的工具和扩展以 Pi 进程的权限运行。项目信任控制 Pi 加载的项目资源，但它不会对工具调用进行沙盒隔离。在使用不受信任的文件、仓库、扩展或无人值守的自动化之前，请查看[安全](/docs/security/)。
