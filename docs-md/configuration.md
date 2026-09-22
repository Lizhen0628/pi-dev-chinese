# 配置

Pi 支持用户级和项目级配置。用户级配置位于代理目录中，默认路径为 `~/.pi/agent`。项目配置位于工作目录下的 `.pi` 中，并在[项目信任](security.md#understand-project-trust)授予后加载。唯一的例外是 `sessionDir`，Pi 在解析信任之前会先读取该配置，以便定位会话。

在交互模式下，使用 `/settings` 更改常用偏好。对于其他选项，可让 Pi 更新配置或直接编辑相关文件。手动更改设置、按键绑定、指令或资源后，请运行 `/reload`。

## Agent 目录

Agent 目录在下方显示为 `<agent-dir>`。通过 `PI_CODING_AGENT_DIR` 环境变量或 SDK 的 [`agentDir`](/docs/sdk/) 选项设置其位置。

| 路径 | 职责 |
|---|---|
| `<agent-dir>/settings.json` | 用户级[设置](/docs/settings/)，包括偏好、默认值、资源路径和 Pi 软件包声明。 |
| `<agent-dir>/keybindings.json` | 自定义终端 UI 和应用[键位绑定](/docs/keybindings/)。 |
| `<agent-dir>/models.json` | [兼容端点、模型和模型覆盖](models.md#configure-a-compatible-endpoint)。 |
| `<agent-dir>/auth.json` | 保存的 API 密钥和 OAuth 凭证。 |
| `<agent-dir>/AGENTS.override.md`、`AGENTS.md`、`AGENTS.MD`、`CLAUDE.md` 或 `CLAUDE.MD` | 跨工作目录应用的用户指令。 |
| `<agent-dir>/SYSTEM.md` | 替换 Pi 的默认系统提示符。 |
| `<agent-dir>/APPEND_SYSTEM.md` | 向 Pi 的系统提示符添加指令。 |
| `<agent-dir>/extensions/` | 用户[扩展](/docs/extensions/)。 |
| `<agent-dir>/skills/` | 用户[技能](/docs/skills/)和支持文件。 |
| `<agent-dir>/prompts/` | 用户[提示词模板](/docs/prompt-templates/)，以斜杠命令形式暴露。 |
| `<agent-dir>/themes/` | 用户[主题](/docs/themes/)文件。 |

## 项目 `.pi` 目录

| 路径 | 职责 |
|---|---|
| `.pi/settings.json` | 项目级[设置](/docs/settings/)、资源路径及 Pi 软件包声明。 |
| `.pi/SYSTEM.md` | 替换项目的系统提示词。 |
| `.pi/APPEND_SYSTEM.md` | 向系统提示词中添加项目特定的指令。 |
| `.pi/extensions/` | 项目扩展。 |
| `.pi/skills/` | 项目技能及支持文件。 |
| `.pi/prompts/` | 以斜杠命令形式暴露的项目提示词模板。 |
| `.pi/themes/` | 项目主题文件。 |

对于 `SYSTEM.md` 和 `APPEND_SYSTEM.md`，受信任的项目文件优先于对应的代理目录文件。同名文件不会合并。

## 上下文文件

上下文文件与项目的 `.pi` 配置是分开的。Pi 从代理目录、工作目录及其父目录加载这些文件。当 Pi 在其所在目录或其下任意子目录运行时，该上下文文件都会生效。

`AGENTS.override.md` 仅在同一目录下替换 `AGENTS.md` 或 `CLAUDE.md`。它不会抑制来自代理目录或其他目录的上下文文件。

上下文文件的发现不要求项目受信任。
