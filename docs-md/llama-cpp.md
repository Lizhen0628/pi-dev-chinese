# 使用 llama.cpp 的本地模型

Pi 支持 [llama.cpp](https://llama.app) 路由器服务器。该路由器能够发现多个 GGUF 模型，并按需加载或卸载它们。

## 安装 llama.cpp

使用[官方安装程序](https://llama.app/docs/installation)安装 llama.cpp：

```bash
curl -LsSf https://llama.app/install.sh | sh
```

验证安装：

```bash
llama cli --version
```

有关其他安装方法，包括软件包管理器或从源代码构建，请参阅 [llama.app](https://llama.app)。

## 启动路由器

启动 `llama serve` 时不带 `--model`、`-m` 或 `-hf` 参数。传入模型会启动单模型模式而非路由器模式。有关路由器配置，请参阅 [llama.cpp 服务器指南](https://llama.app/docs/serve#serving-multiple-models-router-mode)。

```bash
llama serve \
  --no-models-autoload \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl all \
  -c 32768
```

重要选项：

- `--no-models-autoload` 保持通过 `/llama` 显式加载模型。
- `--jinja` 启用兼容的聊天模板和工具调用。
- `-ngl all` 将所有层卸载到 GPU。省略此选项以使用自动 GPU 卸载。
- `-c 32768` 设置上下文大小（以 token 为单位）。使用 `-c 0` 以使用模型的完整上下文窗口，这可能需要显著更多的内存。上下文在并行服务器槽位之间共享。

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

手动添加文件后重启路由器。路由器还支持通过 `--models-preset` 使用缓存模型和预设文件，如 [服务器指南](https://llama.app/docs/serve#serving-multiple-models-router-mode) 所述。

## 配置 Pi

启动 Pi 并配置提供商：

```text
/login llama.cpp
```

输入路由器 URL 和可选的 API 密钥。默认 URL 为 `http://127.0.0.1:8080`。

如果使用 `--no-models-autoload` 参数启动路由器，则 `/login llama.cpp` 仅保存连接。运行 `/llama` 加载模型，然后运行 `/model` 为当前会话选择已加载的模型。

环境变量可以配置相同的值，无需运行 `/login`：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

如果服务器使用 API 密钥，请使用匹配的 `--api-key` 值启动 `llama serve`。保持 `--host 127.0.0.1` 以仅限本地访问。

## 管理模型

运行：

```text
/llama
```

- 选择一个未加载的模型以加载它。
- 选择一个已加载的模型以卸载它。
- 选择**下载模型…**，搜索 Hugging Face，然后选择仓库和量化。确切的 `owner/repository[:quant]` 值也适用。
- 在加载或下载过程中按 Escape 键确认取消。

Hugging Face 搜索在设置 `HF_TOKEN` 时使用它，然后检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。搜索在没有认证的情况下也有效，但受限于较低的速率限制。Pi 在下载受限仓库之前会发出警告，并提供其访问页面的链接。下载由 llama.cpp 服务器执行，因此当所选仓库需要访问权限时，该进程也必须拥有 `HF_TOKEN`。

如果加载了其他模型，Pi 会询问是先卸载它们还是保持加载状态。Pi 不会静默卸载模型，也从不删除模型文件。路由器（router）可能与其他客户端共享，因此 `/llama` 始终显示路由器的当前状态。

已加载和休眠的模型出现在 `/model` 中。休眠的模型在选中时自动唤醒。启用路由器自动加载后，未加载的预设模型也会出现，并在选中时加载。使用 `--no-models-autoload` 时，在通过 `/llama` 选择模型之前先加载它。

如果路由器断开连接，`/llama` 会显示**重试**和**关闭**。重试会重新连接并刷新模型状态，而不会重放中断的操作。

## 分类

分类器模型回答关于 JSON 状态的类型化 `choice`、`bool` 和 `score` 问题，类似 TypeSafe 的 Jev 模型。模型通过 [`codemode`](cli.md#enable-codemode) 脚本访问它们，扩展则通过 `ctx.modelRegistry.classify()`；参见[分类器模型](models.md#use-classifier-models)。Pi 以两种方式将 llama.cpp 模型列为分类器：

- **决策模型**，如 [Julia-1、Laya、Kev、lev 和 OpenJev](https://huggingface.co/collections/ggml-org/decision-models-6abf80cca3c83f127060a769)，通过 llama.cpp 的 `/v1/systemone` 端点原生回答。它们仅作为分类器出现，使用 `typesafe-system-one` API，不在 `/model` 中。
- **聊天模型**也被列为分类器，使用相同的 ID 和 `llama-cpp-classify` API，该 API 从下一 token 概率中读取答案，如下所述。

llama.cpp 0.6.0 及更高版本在路由器的模型列表中报告决策模型：其 `architecture.output_modalities` 包含 `decisions`。路由器从 GGUF 元数据中读取此信息，而无需加载模型，因此 Pi 也能识别未加载和休眠的决策模型。较旧的 llama.cpp 构建不报告此信息，Pi 将其决策模型列为聊天模型。

### 将聊天模型用作分类器

模型不会生成答案。每个问题都会变成一个聊天提示词：状态、请求中的每个问题、再次状态，然后是在单令牌标签下带有答案的问题。标签是选项的字母（最多 62 个选项）、布尔的 `Yes`/`No`，以及分数的数字（最多 10 级）。状态的第二份副本在问题视图中读取，这提高了小模型在 JevBench 上的准确性。Pi 读取标签的概率作为下一个令牌并对其进行归一化。选项返回每个选项的概率和置信度 `(n * peak - 1) / (n - 1)`；分数返回预期级别。

- 原始标签概率通常过于自信。每个请求的 `temperature` 选项在归一化之前划分标签 logits；高于 1 的值会软化分布。它不会改变答案。
- 问题一个接一个地运行。最终问题之前的所有内容对于一个请求的所有问题都是相同的，因此服务器的提示词缓存只计算一次。状态出现两次，因此需要其上下文大小的两倍。
- 小模型可能遵循状态内编写的指令。提示词告诉模型将状态作为数据进行判断，但这并不能保证。
- 混合模型（例如 Qwen3.5）在没有上下文检查点的情况下无法回卷部分缓存的提示词。如果每个问题都重新处理整个状态，请使用 `--ctx-checkpoints 32 --checkpoint-min-step 0` 启动路由器。

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
