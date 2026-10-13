# 使用 NVIDIA RTX 和 llama.cpp 运行 Pi

[NVIDIA 本地 AI 推理配方](https://nvidia.github.io/local-ai-inference-recipes/index.html) 提供了针对特定 NVIDIA 硬件和模型调优的 llama.cpp 设置。每个配方给出一个单模型的 `llama-server` 命令。Pi 与 llama.cpp 路由器配合使用，该路由器可以服务和管理多个模型，因此本指南将配方命令转换为路由器预设。

以下示例使用 Windows PowerShell。有关 Pi 的完整路由器和模型管理参考，请参阅 [使用 llama.cpp 的本地模型](/docs/llama-cpp/)。

## 开始之前

1. 打开[配方目录](https://nvidia.github.io/local-ai-inference-recipes/index.html)，选择你的硬件、操作系统和模型，然后选择 **llama.cpp**。检查先决条件和内存要求。保留配方的启动命令，以便后续转换使用。
2. 按照配方的设置说明安装 llama.cpp。配方的设置取决于其构建方式，例如 CUDA 支持或推测解码选项。
3. 运行 `llama-server --help`，并检查其是否列出 `--models-preset`。如果没有，则该构建无法将配方作为路由器预设加载。请使用更新且仍满足配方要求的构建版本。
4. 通过[快速入门](/docs/quickstart/)安装 Pi。在原生 Windows 上，另请参阅[在 Windows 上运行 Pi](/docs/windows/)。

## 将配方转换为预设文件

预设文件列出了一种或多种模型的设置。每个部分的名称将作为 Pi 中显示的模型 ID。将预设文件保存在 `llama-server` 旁边，或在启动路由器时传入其完整路径。

将配方命令中的每个选项转换为预设文件的一行：

- 去掉开头的破折号：`--ctx-size 65536` 变为 `ctx-size = 65536`。
- 将没有值的选项写为 `true`：`--jinja` 变为 `jinja = true`。
- 去掉值周围的双引号和 PowerShell 换行续行的反引号。
- 省略 `--host` 和 `--port`。它们属于路由器命令行。
- 添加 `load-on-startup = true`，让路由器在启动时加载模型。
- 将简短的模型文件选项替换为对应的预设长键：

| 配方选项 | 预设键 |
|---|---|
| `-hf` | `hf-repo` |
| `-hff` | `hf-file` |
| `-hfrd` | `hf-repo-draft` |
| `--spec-draft-model` | `spec-draft-model` |

例如，以下配方命令：

```powershell
llama-server.exe -hf "unsloth/Qwen3.8-27B-GGUF" `
  -hff "Qwen3.8-27B-UD-Q4_K_M.gguf" `
  -hfrd "z-lab/Qwen3.8-27B-DFlash2-GGUF" `
  --spec-draft-model "Qwen3.8-27B-DFlash2-Q4_K_M.gguf" `
  --no-mmproj `
  --host 127.0.0.1 `
  --port 9931 `
  --batch-size 4096 `
  --ubatch-size 1024 `
  --ctx-size 65536 `
  --parallel 1 `
  -ngl 999 `
  --jinja `
  --chat-template-kwargs '{"preserve_thinking":true}' `
  --spec-type draft-dflash `
  --spec-draft-n-max 7 `
  --spec-draft-backend-sampling
```

转换后变成 `qwen3.8-27b.ini`：

```ini
version = 1

[qwen3.8-27b]
load-on-startup = true
hf-repo = unsloth/Qwen3.8-27B-GGUF
hf-file = Qwen3.8-27B-UD-Q4_K_M.gguf
hf-repo-draft = z-lab/Qwen3.8-27B-DFlash2-GGUF
spec-draft-model = Qwen3.8-27B-DFlash2-Q4_K_M.gguf
no-mmproj = true
batch-size = 4096
ubatch-size = 1024
ctx-size = 65536
parallel = 1
ngl = 999
jinja = true
chat-template-kwargs = {"preserve_thinking":true}
spec-type = draft-dflash
spec-draft-n-max = 7
spec-draft-backend-sampling = true
```

## 启动路由器

在 llama.cpp 文件夹中打开 PowerShell 并运行：

```powershell
.\llama-server.exe --models-preset qwen3.8-27b.ini --host 127.0.0.1 --port 8080
```

如果配置需要 Hugging Face 令牌，请在启动路由器前，在同一 PowerShell 窗口中设置 `$env:HF_TOKEN`。首次启动时，路由器会下载模型文件。

使用[路由器健康检查](llama-cpp.md#troubleshooting)来确认服务器已就绪。在 Windows PowerShell 中，使用 `curl.exe` 而不是 `curl`，因为 PowerShell 将 `curl` 映射到不同的命令。当 `/models` 列出 `qwen3.8-27b` 且状态为 `loaded` 时，表示模型已就绪。

## 在 Pi 中使用模型

按照[配置 Pi](llama-cpp.md#configure-pi)操作，并连接到 `http://127.0.0.1:8080`。预设部分名称即为模型 ID，因此在此示例中，请在 `/model` 中选择 `qwen3.8-27b`。

NVIDIA 配方的内存设置假定只有所选模型使用 GPU。如果 `/llama` 显示有其他已加载的模型，请在使用配方模型前将其卸载。
