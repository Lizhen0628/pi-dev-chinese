# 技能

技能为 Pi 提供针对特定类型工作的专门指令和支持文件。Pi 通过名称和描述展示每个可用技能，仅在任务需要时才加载其完整指令。

当工作流需要的上下文比提示词模板更多，但又不需要新的可执行集成点时，可以使用技能。技能可将脚本、参考资料和资产与其指令捆绑在一起。

Pi 实现了 [Agent 技能规范](https://agentskills.io/specification)。大多数字段无效时会产生警告，而不会阻止启动。

## 创建技能

技能是包含 `SKILL.md` 的目录：

```text
pdf-tools/
├── SKILL.md
├── scripts/
│   └── extract.sh
├── references/
│   └── formats.md
└── assets/
    └── template.json
```

以 frontmatter 开头，后接直接指令，开始编写 `SKILL.md`：

```markdown
---
name: pdf-tools
description: 从 PDF 文件中提取文本和表格。在阅读、转换或检查 PDF 时使用。
---

# PDF 工具

在转换文档前，先阅读 `references/formats.md`。运行脚本时，请相对于此技能目录执行。
```

描述决定了模型何时考虑加载该技能。既要说明技能的功能，也要说明其适用场景。避免使用诸如“帮助处理 PDF”之类的描述，这类描述无法提供足够的路由信息。

引用捆绑文件时，请使用相对于技能目录的路径。Pi 会告知模型技能所在位置，以便其解析这些路径。

## 了解技能如何加载

启动时，Pi 会扫描配置的技能位置，并将每个技能的名称、描述和路径添加到系统提示中。它不会添加完整的指令。

当任务匹配时，模型会读取 `SKILL.md` 并遵循其指令。这样可以在需要之前将详细指导排除在上下文之外。模型可能无法加载相关技能，因此当您需要强制加载时，请使用 `/skill:name`。

`/skill:name` 之后的参数会作为用户请求附加到加载的指令中：

```text
/skill:pdf-tools extract report.pdf
```

当技能仅应通过其显式命令可用时，请在 front-matter 中设置 `disable-model-invocation: true`。`enableSkillCommands` [设置](/docs/settings/) 控制技能命令是否出现在交互式命令发现中；手动输入的 `/skill:name` 命令仍然有效。

<a id="choose-where-it-loads"></a>

## 将其添加到 Pi

将技能放在你的用户或项目技能目录中。包含 `SKILL.md` 的目录会被递归发现。

Pi 还支持代理技能位置 `~/.agents/skills/` 和 `.agents/skills/`。项目 `.agents/skills/` 目录会从工作目录通过其祖先目录被发现，在存在仓库根目录时停止。

Pi 接受一些独立的 Markdown 技能，但包含 `SKILL.md` 的目录是可移植的形式，应优先使用。参见 [设置](settings.md#resources) 和 [Pi 软件包](/docs/packages/) 了解额外位置。

项目技能可以指示模型运行脚本或修改文件。在授予项目信任之前，审查不熟悉的技能及其支持文件。

## 编写可移植的 frontmatter

Agent Skills 规范定义了以下字段：

| 字段 | 用途 |
|---|---|
| `name` | 命令和显示名称 |
| `description` | 提供给模型的路由描述 |
| `license` | 许可证名称或捆绑的许可证文件 |
| `compatibility` | 环境要求 |
| `metadata` | 附加的键值元数据 |
| `allowed-tools` | 实验性的预批准工具列表 |
| `disable-model-invocation` | 将技能从自动模型选择中隐藏 |

名称使用小写字母、数字和连字符，没有前导、尾随或连续连字符。它们最多可以包含 64 个字符；描述最多可以包含 1024 个。

Pi 在声明的名称与父目录不同时既不要求也不警告。其他 Agent Skills 实现可能会强制执行该要求，因此匹配的名称仍然是可移植的选择。

格式错误的 `SKILL.md` 文件和没有描述声明的技能不会被加载。名称冲突保留第一个发现的技能并产生警告。

## 验证并分享技能

从技能可被发现的位置运行 Pi，然后检查启动诊断和 `/skill:name` 命令。在活动会话中编辑技能后运行 `/reload`。

使用 [Pi 软件包](/docs/packages/) 通过 npm 或 git 分发一个或多个技能。将环境配置保留在技能内部，并在软件包中声明所需的运行时依赖。

示例请参见 [Anthropic 技能合集](https://github.com/anthropics/skills) 和 [Pi 技能合集](https://github.com/badlogic/pi-skills)。
