# 使用 llama.cpp 运行本地模型

Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 路由器服务器。该路由器能够发现多个 GGUF 模型，并按需加载或卸载它们。

请使用支持路由器功能的当前 llama.cpp 构建版本。遵循 [构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) 或为您的平台安装 [预构建版本](https://github.com/ggml-org/llama.cpp/releases)。

## 启动路由器

不要使用 `--model` 或 `-m` 启动 `llama-server`。传入模型会启动单模型模式而非路由模式。

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
- `-c 32768` 为每个加载的模型设置上下文窗口。省略该参数以使用模型的原生上下文，这可能需要显著更多的内存。

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

手动添加文件后重启路由器。对于每个模型的上下文大小和其他选项，请使用 [llama.cpp 模型预设](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。对于针对特定 NVIDIA GPU 和模型调整的设置，请参阅 [使用 NVIDIA RTX 和 llama.cpp 运行 Pi](/docs/nvidia-rtx-llama-cpp/)。

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
- 选择 **下载模型…**，搜索 Hugging Face，然后选择一个仓库和量化方式。精确的 `owner/repository[:quant]` 值同样有效。
- 在加载或下载过程中按 Escape 键以确认取消。

Hugging Face 搜索在设置 `HF_TOKEN` 时使用它，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。搜索无需认证也可工作，但速率限制较低。Pi 在下载受限仓库前会发出警告，并链接到其访问页面。llama.cpp 服务器执行下载，因此当所选仓库需要访问权限时，其进程也必须具有 `HF_TOKEN`。

如果其他模型已加载，Pi 会询问是首先卸载它们还是保持加载状态。Pi 不会静默卸载模型，也从不删除模型文件。路由器可能与其他客户端共享，因此 `/llama` 始终显示路由器的当前状态。

已加载和休眠的模型出现在 `/model` 中。休眠模型在选中时自动唤醒。启用路由器自动加载后，未加载的预设模型也会出现，并在选中时加载。使用 `--no-models-autoload` 时，通过 `/llama` 加载模型后再选择它。

如果路由器断开连接，`/llama` 会显示 **重试** 和 **关闭**。重试会重新连接并刷新模型状态，而不会重放中断的操作。

## 分类

分类模型对JSON状态回答类型化的“选择”、“布尔”和“评分”问题，类似于TypeSafe的Jev模型。模型通过 [`codemode`](cli.md#enable-codemode) 脚本触达它们，扩展则通过 `ctx.modelRegistry.classify()` 使用；参见 [分类模型](models.md#use-classifier-models)。Pi以两种方式将llama.cpp模型列为分类器：

- **决策模型** 如 [Julia-1、Laya、Kev、lev和OpenJev](https://huggingface.co/collections/ggml-org/decision-models-6abf80cca3c83f127060a769) 通过llama.cpp的 `/v1/systemone` 端点原生回答。它们仅作为分类器出现，使用 `typesafe-system-one` 接口，而非 `/model`。
- **聊天模型** 也以相同ID和 `llama-cpp-classify` 接口被列为分类器，后者从下一词元概率中读取答案，如下所述。

llama.cpp 0.6.0及更高版本在路由器模型列表中报告决策模型：它们的 `architecture.output_modalities` 包含 `decisions`。路由器从GGUF元数据中读取此信息，无需加载模型，因此Pi也能识别未加载和休眠的决策模型。较旧的llama.cpp版本不报告此信息，Pi将其决策模型列作聊天模型。

### 将聊天模型用作分类器

模型不生成答案。每个问题构成一个聊天提示：状态、请求中的每个问题、再次出现状态，然后在单令牌标签下附带问题及其答案。标签为选项的字母（最多62个选项）、布尔值的`Yes`/`No`，以及分数的数字（最多10个等级）。状态的第二份副本在问题可见的情况下被读取，这提高了小型模型在JevBench上的准确性。Pi读取标签作为下一个令牌的概率并对其进行归一化。选择返回每个选项的概率及置信度`(n * peak - 1) / (n - 1)`；分数返回期望等级。

- 原始标签概率通常过于自信。每个请求的`temperature`选项在归一化前划分标签逻辑值；高于1的值会使分布变软。它不改变任何答案。
- 问题依次运行。请求中所有问题之前的内容相同，因此服务器的提示缓存只评估一次。状态出现两次，因此需要其两倍大小的上下文。
- 小型模型可能遵循状态内编写的指令。提示告诉模型将状态视为数据，但这并非保证。
- 混合模型（如Qwen3.5）在没有上下文检查点的情况下无法回退部分缓存的提示。如果每个问题重新处理整个状态，请使用`--ctx-checkpoints 32 --checkpoint-min-step 0`启动路由器。

## 故障排查

检查路由器是否可达：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **`/models` 中没有模型：** 检查 `/models` 是否设置为包含 GGUF 文件的目录，并重启路由器。
- **`/model` 中缺少模型：** 先用 `/model` 加载它。
- **加载失败或占用内存过多：** 降低 `-c` 或卸载另一个模型。
- **服务器未处于路由器模式：** 不带 `--model`、`-m` 或 `-hf` 启动它。

要移除 `llama.cpp` 提供商和 `/llama`，请在 `pi config` 的 Built-in 下禁用 `llama.cpp`，或在 [设置](settings.md#resources) 中设置 `"extensions": ["-builtin:llama.cpp"]`。
