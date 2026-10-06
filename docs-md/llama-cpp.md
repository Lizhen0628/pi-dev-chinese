# 使用 llama.cpp 运行本地模型

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由器服务器。该路由器能够发现多个 GGUF 模型，并按需加载或卸载它们。

请使用支持路由器的当前 llama.cpp 构建版本。按照 [构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) 操作，或为您的平台安装 [预构建版本](https://github.com/ggml-org/llama.cpp/releases)。

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
- `-c 32768` 为每个加载的模型设置上下文窗口。省略它则使用模型的原生上下文，这可能需要显著更多的内存。

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

- 选择一个未加载的模型来加载它。
- 选择一个已加载的模型来卸载它。
- 选择**下载模型…**，搜索 Hugging Face，然后选择仓库和量化。准确的 `owner/repository[:quant]` 值也可用。
- 在加载或下载期间按 Escape 键确认取消。

当设置 `HF_TOKEN` 时，Hugging Face 搜索会使用它，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。搜索无需认证也可工作，但速率限制较低。Pi 在下载受限仓库前会发出警告，并链接到访问页面。llama.cpp 服务器执行下载，因此当所选仓库需要访问时，其进程也必须具有 `HF_TOKEN`。

如果加载了其他模型，Pi 会询问是先卸载它们还是保持加载状态。Pi 不会默默卸载模型，也绝不会删除模型文件。路由器可能与其他客户端共享，因此 `/llama` 始终显示路由器的当前状态。

已加载和休眠的模型出现在 `/model`。休眠模型在选择时会自动唤醒。启用路由器自动加载后，未加载的预设模型也会显示，并在选择时加载。使用 `--no-models-autoload` 时，在选择模型之前通过 `/llama` 加载模型。

如果路由器断开连接，`/llama` 会显示**重试**和**关闭**。重试会重新连接并刷新模型状态，但不会重放中断的操作。

## 分类

分类器模型回答有关 JSON 状态的类型化 `choice`、`bool` 和 `score` 问题，类似于 TypeSafe 的 Jev 模型。模型从 [`codemode`](cli.md#enable-codemode) 脚本中调用它们，扩展则通过 `ctx.modelRegistry.classify()` 调用；参见 [分类器模型](models.md#use-classifier-models)。Pi 以两种方式将 llama.cpp 模型列为分类器：

- **决策模型**，例如 [Julia-1、Laya、Kev、lev 和 OpenJev](https://huggingface.co/collections/ggml-org/decision-models-6abf80cca3c83f127060a769)，通过 llama.cpp 的 `/v1/systemone` 端点原生回答问题。它们仅以 `typesafe-system-one` API 的形式作为分类器出现，不显示在 `/model` 中。
- **聊天模型**也以相同的 ID 和 `llama-cpp-classify` API 列为分类器，该 API 如下所述从下一 token 概率中读取答案。

llama.cpp 0.6.0 及更高版本在路由器的模型列表中报告决策模型：其 `architecture.output_modalities` 包含 `decisions`。路由器无需加载模型即可从 GGUF 元数据中读取此信息，因此 Pi 也能识别未加载和休眠的决策模型。较旧的 llama.cpp 构建不报告此信息，Pi 会将它们的决策模型列为聊天模型。

### 将聊天模型用作分类器

模型不生成答案。每个问题构成一个聊天提示：状态、请求中的每个问题、再次出现的状态，然后是带有单令牌标签的问题及其答案。标签是选项的字母（最多62个选项）、布尔值的`Yes`/`No`，以及分数的数字（最多10个等级）。状态的第二份副本在问题可见的情况下被读取，这提高了小模型在JevBench上的准确性。Pi读取标签作为下一个令牌的概率并对其进行归一化。选择返回每个选项的概率以及置信度`(n * peak - 1) / (n - 1)`；分数返回期望等级。

- 原始标签概率通常过于自信。每个请求的`temperature`选项在归一化之前划分标签逻辑值；高于1的值会使分布变得平缓。这不会改变答案。
- 问题依次运行。请求中所有问题在最终问题之前的内容相同，因此服务器的提示缓存只评估一次。状态出现两次，因此需要其上下文大小的两倍。
- 小模型可能遵循状态内编写的指令。提示告诉模型将状态视为数据，但这并非保证。
- 混合模型（如Qwen3.5）在没有上下文检查点的情况下无法回退部分缓存的提示。如果每个问题重新处理整个状态，请使用`--ctx-checkpoints 32 --checkpoint-min-step 0`启动路由器。

## 故障排查

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/llama` 中没有模型：** 检查 `--models-dir`、目录结构，并重启路由器。
- **使用 `--no-models-autoload` 时 `/model` 中缺少模型：** 先用 `/llama` 加载它。
- **加载失败或内存占用过高：** 降低 `-c` 或卸载另一个模型。
- **服务器未处于路由器模式：** 启动时不带 `--model`、`-m` 或 `-hf`。

要移除 `llama.cpp` 提供商和 `/llama`，请在 `pi config` 的“内置”下禁用 `llama.cpp`，或在 [设置](settings.md#resources) 中设置 `"extensions": ["-builtin:llama.cpp"]`。
