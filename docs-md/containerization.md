# 容器化

Pi 默认以完整权限运行，但有时你需要更精细地控制它能写哪些目录、有哪些访问权。

总体有两类做法：
1. 把整个 `pi` 进程放进隔离环境运行；或
2. 在宿主机上运行 `pi`，把工具执行路由进隔离环境。

## 选择模式

| 模式 | 隔离什么 | 最适合 | 说明 |
|------|----------|--------|------|
| Gondolin 扩展 | 内置工具与 `!` 命令 | 本地微虚拟机隔离，同时认证留在宿主机 | 见 [`examples/extensions/gondolin/`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/gondolin/)。 |
| Plain Docker | 完整 `pi` 进程进本地容器 | 简单的本地隔离 | 提供商 API Key 会进入容器。 |
| OpenShell | 完整 `pi` 进程进策略管控沙箱 | 本地或远程托管沙箱 | 需要 OpenShell 网关 |
| Docker Sandboxes | 完整 `pi` 进程进托管沙箱 | 本地隔离，提供商密钥留在宿主机 | 需要 Docker Sandboxes（`sbx`） |

扩展跟随 `pi` 进程所在位置运行。宿主机 `pi` 配合工具路由扩展时，其他自定义扩展工具仍在宿主机执行，除非它们自己也委托执行。

## Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微虚拟机。想让 `pi` 留在宿主机、同时把所有内置工具路由进虚拟机时，用[示例扩展](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/gondolin)。

安装：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

从想挂载的项目目录运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

扩展把宿主 cwd 挂载为虚拟机内的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find`、`ls`。用户 `!` 命令同样路由进虚拟机。`/workspace` 下的文件改动直通写回宿主机。

要求：`@earendil-works/gondolin` 需要 Node.js >= 23.6.0，另需 QEMU（用包管理器安装）。

## Plain Docker

想要最简单的本地容器边界时，把整个 `pi` 进程跑在 Docker 里。

`Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

构建并运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

`-v "$PWD:/workspace"` 把当前目录挂载进容器的 /workspace，Docker 内对 `/workspace` 的读写直接作用于宿主文件，与 Gondolin 示例类似。

想让容器有独立的设置与会话，给 `/root/.pi/agent` 用命名卷。挂载宿主的 `~/.pi/agent` 会把宿主的认证与会话文件暴露给容器。

## OpenShell

想要带文件系统、进程、网络、凭据和推理管控的策略型沙箱时，用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。OpenShell 可以通过本地网关（后端为 Docker、Podman 或 VM 运行时）或远程 Kubernetes 网关运行沙箱。

每个沙箱都需要一个活动网关。创建沙箱前先注册并选择：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

在 OpenShell 沙箱中启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

这种模式下，整个 `pi` 进程运行在沙箱内。内置工具、`!` 命令和扩展工具都在 OpenShell 边界内执行。

网关为远程时，项目文件不会从宿主机 bind-mount，沙箱内的写入不会反映到你的机器。在沙箱内克隆仓库，或使用 OpenShell 文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell 可以把原始模型 API Key 保存在沙箱之外。配置推理路由后，沙箱内的代码可以调用 `https://inference.local`，网关在上游注入配置好的提供商凭据。想让模型流量走这条通道，把 Pi 配置为对应的 OpenAI 兼容或 Anthropic 兼容端点。

## Docker Sandboxes

[Docker Sandboxes](https://docs.docker.com/ai/sandboxes/) 是 Docker 提供的托管沙箱运行时，把整个 `pi` 进程跑进沙箱。它就是[无内置沙箱](/docs/security/)所指的容器边界之一。

与上面的 Plain Docker 不同，提供商凭据不会传入容器：沙箱收到的是一个占位值，`sbx` 代理在出口访问 `api.anthropic.com` 时替换为真实凭据。凭据在创建时接线，所以创建沙箱前先把凭据存到宿主机。

Claude Pro/Max 订阅：在一台装有 Claude Code 的机器上运行 `claude setup-token`，然后把结果存到宿主机。如果已绑定 `anthropic` secret，先删除，否则代理会在 Bearer token 之外再加一个 `x-api-key` 头，Anthropic 会拒绝请求。`sbx secret set-custom` 从 stdin 读取令牌，不会进入 shell 历史。

```bash
sbx secret rm anthropic

sbx secret set-custom \
  --host api.anthropic.com \
  --env ANTHROPIC_OAUTH_TOKEN \
  --placeholder 'sk-ant-oat01-{rand}'
```

沙箱拿到的是 OAuth 形状的占位符而非真实令牌，代理在访问该主机的出口处替换；`ANTHROPIC_OAUTH_TOKEN` 是 Pi 本来就会读取并优先于 API Key 的变量，所以无需额外配置。

API Key 则改用 `sbx secret set anthropic` 存储，接线方式相同：代理在出口替换占位值。

凭据存好后，从想挂载的项目目录启动 `pi`：

```bash
sbx run --kit "docker.io/sbx/pi-kit:latest" pi
```

该 kit 把 `pi` 预烘进镜像，沙箱启动无需安装任何东西，当前目录即沙箱工作区。

不要在沙箱内部认证：在那里 `/login` 会把真实令牌写进容器，破坏代理模型。

脚本化用法相同：

```bash
sbx exec <sandbox-name> -- pi -p "列出失败的测试"
```

完整凭据矩阵、故障排查与版本固定见 [kit 文档](https://github.com/docker/sbx-kits-contrib/tree/main/pi)。
