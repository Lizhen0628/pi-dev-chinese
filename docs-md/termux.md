# 在 Android 上通过 Termux 运行 Pi

Pi 可通过 [Termux](https://termux.dev/) 在 Android 上运行，Termux 是一个终端模拟器和 Linux 环境。支持文本输入、文件工具和 shell 命令。Pi 可以通过 Termux:API 使用 Android 剪贴板进行文本的复制和粘贴。不支持剪贴板图片粘贴。

## 开始之前

从 [GitHub 或 F-Droid](https://github.com/termux/termux-app#installation) 安装 Termux。请勿使用已弃用的 Google Play 版本。

[Termux:API](https://github.com/termux/termux-api#installation) 为可选安装。仅当您希望 Pi 复制或粘贴 Android 剪贴板文本，或 shell 命令需要 Android 设备 API 时，才需安装它。

## 安装 Pi

1. 更新 Termux 软件包：

   ```bash
   pkg update && pkg upgrade
   ```

2. 安装 Node.js 和 Git：

   ```bash
   pkg install nodejs git
   ```

3. 安装 Pi：

   ```bash
   npm install -g --ignore-scripts @earendil-works/pi-coding-agent
   ```

4. 验证安装：

   ```bash
   pi --version
   ```

5. 打开您要工作的文件夹并启动 Pi：

   ```bash
   cd /path/to/working-folder
   pi
   ```

继续阅读主 [快速入门](quickstart.md#3-choose-a-model) 以连接模型并运行您的第一个任务。

## 访问 Android 共享存储

在授予权限之前，Termux 无法访问 Android 共享存储。请运行以下命令一次：

```bash
termux-setup-storage
```

批准后，Android 共享存储将在 `/storage/emulated/0` 下可用，并通过 Termux 在 `~/storage/` 下创建的链接访问。

仅在 Pi 需要访问这些文件时才授予此权限。在 Termux 中运行的命令和工具使用与 Termux 进程相同的存储权限。

## 使用剪贴板命令

Pi 使用 `termux-clipboard-set` 复制文本，并使用 `termux-clipboard-get` 作为其剪贴板粘贴快捷键。Shell 命令可以直接使用这两个命令。安装 Termux:API 应用及其命令行软件包：

```bash
pkg install termux-api
```

验证集成：

```bash
printf 'Pi clipboard test' | termux-clipboard-set
termux-clipboard-get
```

第二个命令应输出 `Pi clipboard test`。

Termux 剪贴板 API 仅支持文本。Pi 的剪贴板粘贴快捷键会将文本插入编辑器，但无法附加剪贴板图像。

## 添加 Termux 特定说明

Pi 能检测到它在 Termux 中运行，但无法推断您希望它如何与 Android 交互。仅将与您工作相关的环境细节添加到 `~/.pi/agent/AGENTS.md` 中：

````markdown
# Termux 环境

- Pi 在 Android 上的 Termux 中运行。
- Android 共享存储位于 `/storage/emulated/0`。
- 使用 `termux-open-url "https://example.com"` 打开 URL。
- 使用 `termux-open <路径>` 打开文件。
- 除非任务需要，否则不要访问共享存储。
````

在活动会话期间更改文件后，运行 `/reload`。

## 故障排除

### 剪贴板集成失败

请确认您已安装两个组件：

1. 与 Termux 同源的 Termux:API Android 应用
2. `termux-api` 命令行软件包

然后在 Pi 外部运行上述剪贴板验证命令。如果在此处失败，请先修复 Termux:API 安装，再重试 Pi 的复制命令。

### 共享存储报权限被拒绝

运行 `termux-setup-storage`，批准 Android 权限请求，然后重试 `~/storage/` 或 `/storage/emulated/0` 下的路径。

### 安装后找不到 Pi

打开一个新的 Termux shell 并运行：

```bash
npm prefix -g
command -v pi
```

确认全局 npm 二进制目录位于 `PATH` 中，若软件包缺失，则重新安装 Pi。
