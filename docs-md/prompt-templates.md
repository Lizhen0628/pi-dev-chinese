# 提示词模板

> Pi 可以创建提示词模板——把你的工作流告诉它，让它帮你写。

提示词模板是能展开为完整提示词的 Markdown 片段。在编辑器中输入 `/名称` 调用模板，`名称` 即去掉 `.md` 的文件名。

## 存放位置

Pi 从以下位置加载提示词模板：

- 全局：`~/.pi/agent/prompts/*.md`
- 项目：`.pi/prompts/*.md`（仅在项目被信任后）
- 软件包：`prompts/` 目录或 `package.json` 中的 `pi.prompts` 条目
- 设置：`prompts` 数组（文件或目录）
- CLI：`--prompt-template <路径>`（可重复）

用 `--no-prompt-templates` 禁用发现。

## 格式

```markdown
---
description: 评审 git 暂存区变更
---
评审暂存区中的变更（`git diff --cached`）。重点关注：
- Bug 与逻辑错误
- 安全问题
- 错误处理缺失
```

- 文件名就是命令名：`review.md` 变成 `/review`。
- `description` 可选；缺省时用第一个非空行。
- `argument-hint` 可选；设置后会在补全下拉中显示在描述之前。

### 参数提示

在 frontmatter 中用 `argument-hint` 在补全列表里展示预期参数。必需参数用尖括号 `<参数>`，可选参数用方括号 `[参数]`：

```markdown
---
description: 从 URL 评审 PR，带结构化的问题与代码分析
argument-hint: "<PR-URL>"
---
```

补全下拉中的效果：

```
→ pr   <PR-URL>       — 从 URL 评审 PR，带结构化的问题与代码分析
  is   <issue>        — 分析 GitHub issue（bug 或功能请求）
  wr   [说明]         — 端到端完成当前任务
  cl   — 发布前审计变更日志
```

## 用法

在编辑器中输入 `/` 加模板名。补全列表会展示可用模板及其描述。

```
/review                           # 展开 review.md
/component Button                 # 带参数展开
/component Button "click handler" # 多个参数
```

## 参数

模板支持位置参数、默认值和简单切片：

- `$1`、`$2`…… 位置参数
- `$@` 或 `$ARGUMENTS` —— 全部参数连接
- `${1:-默认值}` —— 第 1 个参数存在且非空时用它，否则用默认值
- `${@:-默认值}` 或 `${ARGUMENTS:-默认值}` —— 全部参数存在且非空时用它们，否则用默认值
- `${@:N}` —— 从第 N 个参数开始（1 起始）
- `${@:N:L}` —— 从第 N 个开始的 L 个参数

示例：

```markdown
---
description: 创建组件
---
创建一个名为 $1 的 React 组件，包含功能：$@
```

默认值适合可选参数：

```markdown
用 ${1:-7} 个要点总结当前状态。
```

用法：`/component Button "onClick 处理器" "禁用态支持"`

## 加载规则

- `prompts/` 目录的模板发现是**非递归**的。
- 子目录中的模板想被加载，需要通过设置的 `prompts` 数组或软件包清单显式添加。
