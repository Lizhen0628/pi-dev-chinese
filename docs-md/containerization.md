# 在隔离环境中运行 Pi

使用隔离环境来限制生成的命令可访问或影响的文件、凭据、进程和网络服务。

你可以隔离完整的 Pi 进程，或将 Pi 保留在主机上，并将选定的工具接入隔离环境中运行。

## 选择隔离方法

| 方法 | Pi 运行位置 | 隔离内容 | 凭证处理 | 最适合 |
|---|---|---|---|---|
| 普通 Docker | 容器 | Pi、内置工具、`!` 命令和扩展 | 凭证传递到容器中 | 一个简单的本地容器边界 |
| Docker 沙箱 | 托管沙箱 | Pi、内置工具、`!` 命令和扩展 | 提供商凭证保留在主机上，由代理替换 | 托管本地隔离，不暴露真实提供商密钥 |
| OpenShell | 本地或远程沙箱 | Pi、内置工具、`!` 命令和扩展 | 策略控制的凭证和推断路由 | 文件系统、进程、网络和凭证策略 |
| Gondolin 扩展 | 主机 | 内置工具和 `!` 命令 | 存储的 Pi 凭证保留在主机上，但命令继承主机环境变量 | 一个本地微虚拟机，用于工具执行，同时保留主机界面 |

该方法改变了扩展的运行位置。当完整的 Pi 进程在隔离环境中运行时，其扩展也在那里运行。当主机 Pi 通过 Gondolin 委派内置工具时，其他扩展工具仍在主机上运行，除非它们也委派自己的工作。

## 决定 Pi 能访问什么

隔离进程仍可能影响你暴露给它的资源：

- 读写主机挂载允许 Pi 修改这些主机文件。
- 挂载 `~/.pi/agent` 会暴露你的 Pi 凭据、设置、扩展和会话。
- 传入容器的环境变量可供容器内进程使用。
- 网络访问可能允许代码或工具输出离开环境。
- 仅工具隔离不会约束主机 Pi 进程或未使用隔离后端的扩展工具。

仅暴露任务所需的工作文件夹、凭据和网络目标。当你不想写入影响主机时，使用只读挂载或将文件复制进出环境。

## 在纯 Docker 中运行 Pi

纯 Docker 提供了最简单的全流程容器边界。

### 构建镜像

创建 `Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

从包含该文件的目录构建它：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .
```

### 启动 Pi

从您希望 Pi 访问的工作目录运行：

```bash
docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

将 `ANTHROPIC_API_KEY` 替换为您提供商所需的凭据。命名的 `pi-agent-home` 卷用于在多次运行之间保留容器本地设置、凭据和会话。

除非容器应有权访问您主机的 Pi 配置和凭据，否则不要挂载主机的 `~/.pi/agent`。

### 验证工作区

在 Pi 内运行：

```text
!pwd
```

该命令应显示 `/workspace`。`/workspace` 下的更改会写入挂载的主机文件夹。若此行为不可接受，请移除绑定挂载或改用只读挂载。

## 使用 Docker 沙箱运行 Pi

[Docker 沙箱](https://docs.docker.com/ai/sandboxes/) 在受管沙箱内运行完整的 Pi 进程。其代理可将真实的提供商凭据保留在宿主机上，并在请求离开沙箱时进行替换。

在创建沙箱之前配置凭据。不要在沙箱内运行 `/login`，因为这会向沙箱中写入真实凭据。

### 使用 Claude Pro 或 Max 令牌

在装有 Claude Code 的机器上，使用 `claude setup-token` 生成令牌。如果已配置 `anthropic` 密钥，请先移除它，以便代理不会在持有者令牌之外添加 API 密钥头：

```bash
sbx secret rm anthropic

sbx secret set-custom \
  --host api.anthropic.com \
  --env ANTHROPIC_OAUTH_TOKEN \
  --placeholder 'sk-ant-oat01-{rand}'
```

`sbx secret set-custom` 从标准输入读取真实令牌。沙箱收到一个 OAuth 格式的占位符，代理仅对发送到配置主机的请求替代该占位符。

对于 Anthropic API 密钥，请改用 `sbx secret set anthropic`。

### 启动 Pi

从你希望挂载的工作目录中运行以下命令：

```bash
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

对于已有沙盒，可以非交互式地运行 Pi：

```bash
sbx exec <sandbox-name> -- pi -p "列出失败的测试"
```

有关其他提供商、故障排查和镜像固定，请参阅 [Pi 套件文档](https://github.com/docker/sbx-kits-contrib/tree/main/pi)。

## 使用 OpenShell 运行 Pi

[NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview) 提供本地或远程沙箱，包含文件系统、进程、网络、凭据和推理策略。

### 选择网关

每个沙盒都需要一个活跃的网关：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

### 创建沙箱

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

Pi、其内置工具、`!` 命令以及扩展工具均在 OpenShell 边界内运行。

### 将文件传输至远程外壳

远程网关不会绑定挂载您的主机工作文件夹。请在外壳内克隆仓库，或显式传输文件：

```bash
openshell sandbox upload pi-sandbox ./working-folder /workspace
openshell sandbox download pi-sandbox /workspace/working-folder ./working-folder-out
```

OpenShell 推理路由可以将原始模型凭据保留在外壳之外。配置后，将 Pi 指向网关暴露的相应兼容 OpenAI 或兼容 Anthropic 的端点即可。

## 通过 Gondolin 路由工具

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微虚拟机。其示例扩展将 Pi 进程和基于文件系统的提供商凭证保留在主机上，同时将内置工具和用户 `!` 命令路由到虚拟机中。

虚拟机内部的命令继承主机的进程环境。因此，通过环境变量提供的提供商密钥可能在虚拟机内部可见。除非您移除敏感变量或修改扩展的环境处理方式，否则不要将此模式用作凭证边界。

Gondolin 要求安装 Node.js 23.6 或更高版本，并通过您的操作系统软件包管理器安装 QEMU。

### 安装扩展

从 Pi 源检出（source checkout）开始：

```bash
mkdir -p ~/.pi/agent/extensions
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

### 启动 Pi

从你想挂载的工作文件夹运行 Pi：

```bash
cd /path/to/working-folder
pi -e ~/.pi/agent/extensions/gondolin
```

该扩展将宿主工作文件夹挂载到 VM 中的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls`。在 `/workspace` 下的文件更改会直接写入宿主。

其他扩展工具仍然在宿主上运行，除非它们明确委托其操作。在添加可能绕过 VM 边界的工具之前，请查看 [Gondolin 示例](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/gondolin/)。
