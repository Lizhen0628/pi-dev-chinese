# Pi 文档总览

Pi 是一个极简的终端编码智能体外壳（harness）。它的核心刻意保持小巧，其余能力通过 TypeScript 扩展、技能（skills）、提示词模板、主题和 Pi 软件包来扩展。

## 快速开始

用 npm 安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。Pi 在正常的 npm 安装中不需要安装脚本。

在 Linux 或 macOS 上也可以使用安装脚本：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

如果通过 curl 或 npm 安装，用 npm 卸载：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

pnpm、Yarn 或 Bun 安装的，用对应的卸载命令：`pnpm remove -g @earendil-works/pi-coding-agent`、`yarn global remove @earendil-works/pi-coding-agent` 或 `bun uninstall -g @earendil-works/pi-coding-agent`。

然后在项目目录里运行：

```bash
pi
```

用 `/login` 登录订阅类提供商，或在启动 Pi 之前设置好 `ANTHROPIC_API_KEY` 之类的 API Key。

完整的首次运行流程见[快速上手](/docs/quickstart/)。

## 从这里开始

- [快速上手](/docs/quickstart/) —— 安装、认证并完成第一次会话。
- [使用 Pi](/docs/usage/) —— 交互模式、斜杠命令、上下文文件与 CLI 参考。
- [提供商](/docs/providers/) —— 内置提供商的订阅与 API Key 配置。
- [llama.cpp](/docs/llama-cpp/) —— 运行本地路由并用 `/llama` 管理模型。
- [安全](/docs/security/) —— 项目信任、沙箱边界与漏洞报告。
- [容器化](/docs/containerization/) —— 用 Gondolin、Docker 或 OpenShell 隔离运行 Pi。
- [设置](/docs/settings/) —— 全局与项目级设置。
- [键位绑定](/docs/keybindings/) —— 默认快捷键与自定义键位。
- [会话](/docs/sessions/) —— 会话管理、分支与树状导航。
- [压缩](/docs/compaction/) —— 上下文压缩与分支摘要。

## 定制

- [扩展](/docs/extensions/) —— 用 TypeScript 模块添加工具、命令、事件与自定义 UI。
- [技能](/docs/skills/) —— Agent Skills，可复用的按需能力。
- [提示词模板](/docs/prompt-templates/) —— 从斜杠命令展开的复用提示词。
- [主题](/docs/themes/) —— 内置与自定义终端主题。
- [Pi 软件包](/docs/packages/) —— 打包并分享扩展、技能、提示词与主题。
- [自定义模型](/docs/models/) —— 为受支持的提供商 API 添加模型条目。
- [自定义提供商](/docs/custom-provider/) —— 实现自定义 API 与 OAuth 流程。

## 编程接入

- [SDK](/docs/sdk/) —— 在 Node.js 应用中嵌入 Pi。
- [RPC 模式](/docs/rpc/) —— 通过 stdin/stdout JSONL 集成。
- [JSON 事件流模式](/docs/json/) —— 带结构化事件的打印模式。
- [TUI 组件](/docs/tui/) —— 为扩展构建自定义终端 UI。

## 参考

- [环境变量](/docs/environment-variables/) —— Pi 进程配置，以及 bash 工具可用的会话元数据。
- [会话格式](/docs/session-format/) —— JSONL 会话文件格式、条目类型与 SessionManager API。

## 平台设置

- [Windows](/docs/windows/)
- [Android 上的 Termux](/docs/termux/)
- [tmux](/docs/tmux/)
- [终端设置](/docs/terminal-setup/)
- [Shell 别名](/docs/shell-aliases/)

## 开发

- [开发指南](/docs/development/) —— 本地搭建、项目结构与调试。
