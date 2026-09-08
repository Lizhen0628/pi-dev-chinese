# llama.cpp

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 的路由服务器。路由器可以发现多个 GGUF 模型并按需加载/卸载。

请使用带路由支持的较新 llama.cpp 构建。参考[构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)自行编译，或安装对应平台的[预构建版本](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

不带 `--model` 或 `-m` 启动 `llama-server`。传了模型参数就会进入单模型模式而不是路由模式。

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
- `--no-models-autoload` 让加载始终通过 `/llama` 显式进行。
- `--jinja` 启用兼容的聊天模板与工具调用。
- `-ngl 999` 尽可能多地把层卸载到 GPU。
- `-c 32768` 设置每个已加载模型的上下文窗口。省略则用模型原生上下文，但可能需要多得多的内存。

单文件模型直接放在模型目录即可。多模态和多分片模型放到单独的子目录：

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

手动添加文件后重启路由器。按模型设置上下文大小等选项，用 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

## 配置 Pi

启动 Pi 并配置提供商：

```text
/login llama.cpp
```

输入路由器 URL 和可选的 API Key。默认 URL 是 `http://127.0.0.1:8080`。

路由器以 `--no-models-autoload` 启动时，`/login llama.cpp` 只保存连接。用 `/llama` 加载模型，再用 `/model` 把它选为当前会话的模型。

也可以不用 `/login`，直接用环境变量：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

服务器启用 API Key 时，`llama-server` 启动参数带上对应的 `--api-key`。本地专用请保持 `--host 127.0.0.1`。

## 管理模型

运行：

```text
/llama
```

- 选择未加载的模型以加载它。
- 选择已加载的模型以卸载它。
- 选择 **Download model…**，搜索 Hugging Face，选择仓库与量化版本。也支持精确的 `owner/repository[:quant]` 写法。
- 加载或下载过程中按 Escape 确认取消。

Hugging Face 搜索依次使用 `HF_TOKEN`、`$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。不认证也能搜索，只是速率限制更低。下载受限（gated）仓库前 Pi 会警告并附上其访问页面。下载由 llama.cpp 服务器执行，因此所选仓库需要授权时，服务器进程也必须有 `HF_TOKEN`。

还有其他模型在加载时，Pi 会询问是先卸载它们还是保持加载。Pi 不会悄悄卸载模型，也从不删除模型文件。路由器可能与其他客户端共享，所以 `/llama` 总是显示路由器的当前状态。

`/model` 只列出已加载的模型。加载后运行 `/model` 把它选为当前 Pi 会话的模型。

路由器断开时，`/llama` 显示 **Retry** 和 **Close**。Retry 会重连并刷新模型状态，不会重放被中断的操作。

## 故障排查

确认路由器可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/llama` 里没有模型：** 检查 `--models-dir` 和目录布局，重启路由器。
- **`/model` 里缺模型：** 先用 `/llama` 加载。
- **加载失败或内存占用过高：** 调小 `-c`，或先卸载另一个模型。
- **服务器不在路由模式：** 不要带 `--model`、`-m` 或 `-hf` 启动。
