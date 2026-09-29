# 使用 llama.cpp 运行本地模型

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由器服务器。该路由器能够发现多个 GGUF 模型，并按需加载或卸载它们。

请使用支持路由器功能的当前 llama.cpp 版本。遵循 [构建指南](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) 或为您的平台安装 [预构建版本](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

不使用 `--model` 或 `-m` 启动 `llama-server`。传入模型会启动单模型模式，而非路由模式。

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
- `-ngl 999` 将尽可能多的层卸载到 GPU。
- `-c 32768` 为每个加载的模型设置上下文窗口。省略它则使用模型的原始上下文，可能需多得多的内存。

单文件模型可直接放在模型目录中。将多模态和多分片模型放在单独的子目录中：

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

手动添加文件后重启路由器。有关每个模型的上下文大小和其他选项，请使用 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

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

- 选择未加载的模型以加载它。
- 选择已加载的模型以卸载它。
- 选择**下载模型…**，搜索 Hugging Face，然后选择仓库和量化方式。精确的 `owner/repository[:quant]` 值也可以使用。
- 在加载或下载过程中按 Escape 键以确认取消。

设置了 `HF_TOKEN` 时，Hugging Face 搜索会使用它，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。没有认证时搜索也能工作，但速率限制更低。Pi 在下载受限仓库前会发出警告，并链接到其访问页面。llama.cpp 服务器执行下载，因此当所选仓库需要访问权限时，其进程也必须具有 `HF_TOKEN`。

如果其他模型已加载，Pi 会询问是先卸载它们还是保持加载状态。Pi 不会静默卸载模型，也从不删除模型文件。路由器可能与其他客户端共享，因此 `/llama` 始终显示路由器的当前状态。

已加载和休眠的模型出现在 `/model` 中。休眠的模型在选中时自动唤醒。启用路由器自动加载后，未加载的预设模型也会出现，并在选中时加载。使用 `--no-models-autoload` 时，在选中前通过 `/llama` 加载模型。

如果路由器断开，`/llama` 会显示 **重试** 和 **关闭**。重试会重新连接并刷新模型状态，而不会重放中断的操作。

## 分类

每个列出用于聊天的模型也会作为分类器模型列出，具有相同的 ID 和 `llama-cpp-classify` API。分类器模型回答关于 JSON 状态的类型化 `choice`、`bool` 和 `score` 问题，类似 TypeSafe 的 Jev 模型。模型从 [`codemode`](cli.md#enable-codemode) 脚本中访问它们，扩展通过 `ctx.modelRegistry.classify()` 访问；参见 [分类器模型](models.md#use-classifier-models)。

模型不生成答案。每个问题变成一个聊天提示：状态、请求中的每个问题、再次状态，然后在单令牌标签下呈现问题及其答案。标签对于选择是字母（最多 62 个选项），对于布尔是 `Yes`/`No`，对于分数是数字（最多 10 个级别）。状态的第二份副本在问题可见时读取，这提高了小型模型在 JevBench 上的准确性。Pi 读取标签的概率作为下一个令牌，并对它们进行归一化。选择返回每个选项的概率和置信度 `(n * peak - 1) / (n - 1)`；分数返回预期水平。

- 原始标签概率通常过于自信。每个请求的 `temperature` 选项在归一化之前分割标签 logits；大于 1 的值会软化分布。它不改变答案。
- 问题依次运行。请求的所有问题中，最终问题之前的一切都是相同的，因此服务器的提示缓存只计算一次。状态出现两次，因此需要上下文中其大小的两倍。
- 小型模型可能遵循状态内写的指令。提示告诉模型将状态作为数据进行判断，但这并不保证。
- 混合模型如 Qwen3.5 在没有上下文检查点的情况下无法回退部分缓存的提示。如果每个问题重新处理整个状态，请使用 `--ctx-checkpoints 32 --checkpoint-min-step 0` 启动路由器。

## 故障排除

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/llama` 中没有模型：** 检查 `--models-dir`、目录布局，并重启路由器。
- **使用 `--no-models-autoload` 时 `/model` 缺少模型：** 先通过 `/llama` 加载它。
- **加载失败或内存占用过多：** 调低 `-c` 或卸载另一个模型。
- **服务器未处于路由器模式：** 启动时不要包含 `--model`、`-m` 或 `-hf`。

要移除 `llama.cpp` 提供商和 `/llama`，在 `pi config` 中禁用 Built-in 下的 `llama.cpp`，或在[设置](settings.md#resources)中设置 `"extensions": ["-builtin:llama.cpp"]`。
