# 开发指南

更多准则参见仓库的 [AGENTS.md](https://github.com/earendil-works/pi/blob/main/AGENTS.md)。

## 搭建

```bash
git clone https://github.com/earendil-works/pi
cd pi
npm install
npm run build
```

从源码运行：

```bash
/path/to/pi/pi-test.sh
```

脚本可以在任意目录执行。Pi 保持调用者的当前工作目录。

### 实验性远程外壳

远程外壳 server/client 集成仅供开发使用。在仓库内运行：

```bash
PI_EXPERIMENTAL=1 ./pi-test.sh server
PI_EXPERIMENTAL=1 ./pi-test.sh client
```

`PI_SERVER_DIR` 覆盖服务端配置与套接字目录（默认 `~/.pi/server`）；`PI_SERVER_ID` 在省略 `--server-id` 时选择逻辑服务端 ID。

`client` 和 `experimental/plugin` 包子路径只在 checkout 中以 `source` 条件解析。它们的实现和 server/client 命令不包含在 npm 包和独立二进制中。`pi-client`、`pi-protocol`、`pi-server` 是 coding-agent 的开发依赖而非运行时依赖。本地 SDK 与 stdio RPC API 不受影响。

## 分叉 / 换牌

通过 `package.json` 配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

在你的分叉中修改 `name`、`configDir` 和 `bin` 字段。这会影响 CLI 横幅、配置路径和环境变量名。

## 路径解析

三种执行模式：npm 安装、独立二进制、源码 tsx。

包内资源**始终使用 `src/config.ts`**：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

不要对包内资源直接使用 `__dirname`。

## 调试命令

`/debug`（隐藏）写入 `~/.pi/agent/pi-debug.log`：
- 带 ANSI 码的已渲染 TUI 行
- 最近发送给 LLM 的消息

## 测试

```bash
./test.sh                         # 运行非 LLM 测试（无需 API Key）
npm test                          # 运行全部测试
npm test -- test/specific.test.ts # 运行指定测试
```

### 已发布包冒烟测试

构建后运行 `npm run check:package-install`。它会打包公开的包，并在仓库外的临时目录中只把 coding-agent 作为直接依赖安装。本地 tarball 覆盖选择性地替代已声明的传递依赖，不安装仅开发用的包。该检查在无凭据、无模型请求的条件下验证 SDK import 与 CLI 启动。

`npm run check` 还会检查运行时依赖声明，并拒绝通过 import 被拉进包构建的、应排除的开发源码。

## 项目结构

```
packages/
  ai/           # LLM 提供商抽象
  agent/        # 智能体循环与消息类型
  tui/          # 终端 UI 组件
  coding-agent/ # CLI 与交互模式
```
