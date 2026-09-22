# 使用 llama.cpp 运行本地模型

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由器服务器。该路由器能够发现多个 GGUF 模型，并按需加载或卸载它们。

请使用支持路由器功能的当前 llama.cpp 构建版本。按照 [构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) 操作，或为您的平台安装 [预构建版本](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

启动 `llama-server` 时不带 `--model` 或 `-m` 参数。传入模型会启动单模型模式而非路由器模式。

```bash
llama-server \
  --models-dir ~/models \
  --no-models-autoload \
  --jinja \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 999 \
  -c 32768
```

重要选项：

- `--models-dir ~/models` 发现本地 GGUF 文件。
- `--no-models-autoload` 保持通过 `/llama` 显式加载。
- `--jinja` 启用兼容的聊天模板和工具调用。
- `-ngl 999` 尽可能多地将层卸载到 GPU。
- `-c 32768` 为每个加载的模型设置上下文窗口。省略它则使用模型的原生上下文，这可能需要更多的内存。

单文件模型可以直接放在模型目录中。将多模态和多分片模型放在单独的子目录中：

```text
~/models/
├── llama-3.2-1b-Q4_K_M.gguf
├── gemma-3-4b-it-Q4_K_M/
│   ├── gemma-3-4b-it-Q4_K_M.gguf
│   └── mmproj-F16.gguf
└── large-model-Q4_K_M/
    ├── large-model-Q4_K_M-00001-of-00003.gguf
    ├── large-model-Q4_K_M-00002-of-00003.gguf
    └── large-model-Q4_K_M-00003-of-00003.gguf
```

手动添加文件后重启路由器。有关每个模型的上下文大小和其他选项，请参阅 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

## 配置 Pi

启动 Pi 并配置提供商：

```text
/login llama.cpp
```

输入路由器 URL 和可选的 API 密钥。默认 URL 为 `http://127.0.0.1:8080`。

如果你使用 `--no-models-autoload` 启动路由器，`/login llama.cpp` 仅存储连接。运行 `/llama` 加载模型，然后使用 `/model` 为当前会话选择已加载的模型。

环境变量可以配置相同的值，而无需使用 `/login`：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

如果服务器使用 API 密钥，请使用匹配的 `--api-key` 值启动 `llama-server`。保持 `--host 127.0.0.1` 以仅限本地访问。

## 管理模型

运行：

```text
/llama
```

- 选择一个未加载的模型以加载它。
- 选择一个已加载的模型以卸载它。
- 选择 **下载模型…**，搜索 Hugging Face，然后选择仓库和量化。精确的 `owner/repository[:quant]` 值也可以使用。
- 在加载或下载过程中按 Escape 键以确认取消。

Hugging Face 搜索在设置时使用 `HF_TOKEN`，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。搜索也可以在无认证的情况下工作，但速率限制较低。Pi 在下载受限仓库前会发出警告，并链接到它们的访问页面。llama.cpp 服务器执行下载，因此当所选仓库需要访问权限时，其进程也必须具有 `HF_TOKEN`。

如果加载了其他模型，Pi 会询问是否先卸载它们或保持加载。Pi 不会静默卸载模型，也从不删除模型文件。路由可能与其他客户端共享，因此 `/llama` 始终显示路由的当前状态。

已加载和休眠的模型出现在 `/model` 中。休眠模型在选中时会自动唤醒。启用路由自动加载后，未加载的预设模型也会出现，并在选中时加载。使用 `--no-models-autoload` 时，先通过 `/llama` 加载模型，然后再选择它。

如果路由断开，`/llama` 显示 **重试** 和 **关闭**。重试会重新连接并刷新模型状态，而不重放中断的操作。

## 故障排查

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/llama` 中没有模型：** 检查 `--models-dir`、目录结构，并重启路由器。
- **使用 `--no-models-autoload` 时 `/model` 中缺少模型：** 先用 `/llama` 加载它。
- **加载失败或内存占用过高：** 降低 `-c` 或卸载另一个模型。
- **服务器未处于路由器模式：** 启动时不要使用 `--model`、`-m` 或 `-hf`。
