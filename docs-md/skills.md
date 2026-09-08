# 技能（Skills）

> Pi 可以自己创建技能——让你的使用场景直接告诉它，让它写一个。

技能是智能体按需加载的自包含能力包。一个技能为特定任务提供专门的工作流、安装说明、辅助脚本和参考文档。

Pi 实现了 [Agent Skills 标准](https://agentskills.io/specification)，对大多数违规项给出警告但保持宽容。技能名可以与父目录名不同（标准不允许这一点）；因为该规则对跨多个智能体外壳共享的技能目录并不友好，Pi 选择了放宽。

## 目录

- [存放位置](#存放位置)
- [工作原理](#工作原理)
- [技能命令](#技能命令)
- [技能结构](#技能结构)
- [Frontmatter](#frontmatter)
- [校验](#校验)
- [示例](#示例)
- [技能仓库](#技能仓库)

## 存放位置

> **安全提示：** 技能可以指示模型执行任何操作，并可能包含模型会调用的可执行代码。使用前请审查技能内容。

Pi 从以下位置加载技能：

- 全局：
  - `~/.pi/agent/skills/`
  - `~/.agents/skills/`
- 项目（仅在项目被信任后）：
  - `.pi/skills/`
  - 当前目录及祖先目录中的 `.agents/skills/`（上溯到 git 仓库根；不在仓库中则到文件系统根）
- 软件包：`skills/` 目录或 `package.json` 中的 `pi.skills` 条目
- 设置：`skills` 数组（文件或目录）
- CLI：`--skill <路径>`（可重复；即使加了 `--no-skills` 也照常加载）

发现规则：
- 在 `~/.pi/agent/skills/` 和 `.pi/skills/` 中，根级 `.md` 文件若带有合法技能 frontmatter 且 `description` 非空，会作为独立技能被发现
- 在所有技能位置，包含 `SKILL.md` 的目录会被递归发现
- 在 `~/.agents/skills/` 和项目 `.agents/skills/` 中，根级 `.md` 文件被忽略，但分组文件夹内声明了技能 frontmatter 的嵌套 `.md` 会被发现
- 其他不像技能的根级 Markdown 文件会被静默忽略

用 `--no-skills` 可禁用发现（显式 `--skill` 路径仍然加载）。

### 使用其他外壳的技能

想用 Claude Code 或 OpenAI Codex 的技能，把它们的目录加进设置即可：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

项目级的 Claude Code 技能，加到 `.pi/settings.json`：

```json
{
  "skills": ["../.claude/skills"]
}
```

## 工作原理

1. 启动时，Pi 扫描技能位置，提取名称与描述
2. 系统提示按[规范](https://agentskills.io/integrate-skills)以 XML 格式列出可用技能
3. 任务匹配时，智能体用 `read`（不可用时用 `bash`）加载完整 SKILL.md（模型不总是主动去读；用提示词引导或 `/skill:名称` 强制加载）
4. 智能体按说明执行，用相对路径引用脚本和资源

这就是渐进式披露：上下文中常驻的只有描述，完整说明按需加载。

## 技能命令

技能会注册为 `/skill:名称` 命令：

```bash
/skill:brave-search           # 加载并执行技能
/skill:pdf-tools extract      # 带参数加载技能
```

命令后的参数会以 `User: <参数>` 的形式追加到技能内容后面。

在交互模式通过 `/settings`，或在 `settings.json` 中开关技能命令：

```json
{
  "enableSkillCommands": true
}
```

## 技能结构

技能就是一个带 `SKILL.md` 的目录，其余内容随意组织。

```
my-skill/
├── SKILL.md              # 必需：frontmatter + 说明
├── scripts/              # 辅助脚本
│   └── process.sh
├── references/           # 按需加载的详细文档
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md 格式

````markdown
---
name: my-skill
description: 这个技能做什么、什么时候用。要写具体。
---

# 我的技能

## 安装

首次使用前运行一次：
```bash
cd /path/to/skill && npm install
```

## 用法

```bash
./scripts/process.sh <input>
```
````

在技能内部用相对路径引用：

```markdown
详见[参考指南](references/REFERENCE.md)。
```

## Frontmatter

依照 [Agent Skills 规范](https://agentskills.io/specification#frontmatter-required)：

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 是 | 最长 64 字符；小写字母、数字、连字符。与标准不同，Pi 不要求它与父目录名一致——那条标准规则对共享技能目录并不友好。 |
| `description` | 是 | 最长 1024 字符。技能做什么、什么时候用。 |
| `license` | 否 | 许可证名称或对随附文件的引用。 |
| `compatibility` | 否 | 最长 500 字符。环境要求。 |
| `metadata` | 否 | 任意键值映射。 |
| `allowed-tools` | 否 | 空格分隔的预批准工具列表（实验性）。 |
| `disable-model-invocation` | 否 | 为 `true` 时技能不出现在系统提示中，只能用 `/skill:名称` 调用。 |

### 名称规则

- 1-64 个字符
- 只能小写字母、数字、连字符
- 不能以连字符开头或结尾
- 不能有连续连字符
Pi 不要求名称与父目录一致。Agent Skills 标准有此要求，但该要求对多工具共享的技能目录并不友好。

合法：`pdf-processing`、`data-analysis`、`code-review`
非法：`PDF-Processing`、`-pdf`、`pdf--processing`

### 描述的最佳实践

描述决定了智能体什么时候加载这个技能，要写具体。

好的写法：
```yaml
description: 从 PDF 文件中提取文本和表格、填写 PDF 表单、合并多个 PDF。处理 PDF 文档时使用。
```

差的写法：
```yaml
description: 帮你处理 PDF。
```

## 校验

Pi 按 Agent Skills 标准校验技能。大多数问题只警告，技能仍会加载：

- 名称超过 64 字符或含非法字符
- 名称以连字符开头/结尾或有连续连字符
- 描述超过 1024 字符

未知的 frontmatter 字段会被忽略。

声明了技能但缺少描述的不加载。格式错误的 `SKILL.md` 和没有描述的 `SKILL.md` 会警告且不加载。其他没有合法技能 frontmatter 的 Markdown 文件被忽略。

名称冲突（不同位置出现同名技能）会警告并保留先发现的那个。

## 示例

```
brave-search/
├── SKILL.md
├── search.js
└── content.js
```

**SKILL.md：**
````markdown
---
name: brave-search
description: 通过 Brave Search API 进行网页搜索与内容提取。查找文档、事实或任意网页内容时使用。
---

# Brave Search

## 安装

```bash
cd /path/to/brave-search && npm install
```

## 搜索

```bash
./search.js "查询词"              # 基本搜索
./search.js "查询词" --content    # 包含网页内容
```

## 提取网页内容

```bash
./content.js https://example.com
```
````

## 技能仓库

- [Anthropic Skills](https://github.com/anthropics/skills) —— 文档处理（docx、pdf、pptx、xlsx）、Web 开发
- [Pi Skills](https://github.com/badlogic/pi-skills) —— 网页搜索、浏览器自动化、Google API、转写
