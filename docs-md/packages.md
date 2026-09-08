# Pi 软件包

> Pi 可以帮你创建 Pi 软件包——让它把你的扩展、技能、提示词模板或主题打包。

Pi 软件包把扩展、技能、提示词模板和主题打包在一起，通过 npm 或 git 分享。软件包在 `package.json` 的 `pi` 键下声明资源，或使用约定目录。

## 目录

- [安装与管理](#安装与管理)
- [包来源](#包来源)
- [创建 Pi 软件包](#创建-pi-软件包)
- [包结构](#包结构)
- [依赖](#依赖)
- [包过滤](#包过滤)
- [启用与禁用资源](#启用与禁用资源)
- [作用域与去重](#作用域与去重)

## 安装与管理

> **安全提示：** Pi 软件包以完整系统权限运行。扩展执行任意代码，技能可指示模型执行包括运行可执行文件在内的任何操作。安装第三方包前请审查其源码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # 原生 URL 也可以
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list                     # 显示设置中已安装的软件包
pi update                   # 只更新 pi
pi update --all             # 更新 pi、更新软件包并对齐固定的 git 引用
pi update --extensions      # 只更新软件包并对齐固定的 git 引用
pi update --models          # 只刷新模型目录
pi update --self            # 只更新 pi
pi update --self --force    # 即使是最新版也重装 pi
pi update npm:@foo/bar      # 更新单个软件包
pi update --extension npm:@foo/bar
```

这些命令管理 Pi 软件包，`pi update` 也可以更新 pi CLI 安装。对实验性的安装器托管安装，`pi update` 会把目标版本安装进一个由 lockfile 支撑的暂存版本，验证通过后才激活；更新失败时当前版本不受影响。托管安装不支持 `--force`；如需修复请重新运行安装器。卸载 Pi 见[快速上手](/docs/quickstart/)。

默认情况下，`install` 和 `remove` 写入用户设置（`~/.pi/agent/settings.json`）。用 `-l` 改为写入项目设置（`.pi/settings.json`）。项目设置可以和团队共享；项目被信任后，Pi 启动时会自动安装其中缺失的软件包。

想先试用再安装，用 `--extension` 或 `-e`：它会安装到临时目录，仅本次运行有效：

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## 包来源

设置和 `pi install` 接受三种来源类型。

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- 带版本号的规格会被固定，软件包更新会跳过它们（`pi update --extensions`、`pi update --all`）。
- 用户级安装位于 `~/.pi/agent/npm/`。
- 项目级安装位于 `.pi/npm/`。
- 在 `settings.json` 中设置 `npmCommand`，可以把 npm 包的查询和安装固定到某个包装命令，如 `mise` 或 `asdf`。

示例：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- 不带 `git:` 前缀时只接受协议 URL（`https://`、`http://`、`ssh://`、`git://`）。
- 带 `git:` 前缀时接受简写格式，包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- HTTPS 与 SSH URL 都支持。
- SSH URL 自动使用你配置的 SSH 密钥（遵守 `~/.ssh/config`）。
- 非交互运行（如 CI）时，可设 `GIT_TERMINAL_PROMPT=0` 禁用凭据询问，并设 `GIT_SSH_COMMAND`（如 `ssh -o BatchMode=yes -o ConnectTimeout=5`）实现快速失败。
- 引用固定为标签或提交。`pi update --extensions` 和 `pi update --all` 不会把它们移动到更新的引用，但会把已有克隆对齐到配置的引用。
- 用 `pi install git:host/user/repo@新引用` 更新设置并把已有软件包移到新的固定引用。
- 克隆到 `~/.pi/agent/git/<host>/<path>`（全局）或 `.pi/git/<host>/<path>`（项目）。
- 对齐导致检出内容变化时，Pi 会重置并清理克隆，若存在 `package.json` 再运行 `npm install`。

**SSH 示例：**
```bash
# git@host:path 简写（需要 git: 前缀）
pi install git:git@github.com:user/repo

# ssh:// 协议格式
pi install ssh://git@github.com/user/repo

# 带版本引用
pi install git:git@github.com:user/repo@v1.0.0
```

### 本地路径

```
/absolute/path/to/package
./relative/path/to/package
```

本地路径指向磁盘上的文件或目录，添加到设置时不做复制。相对路径相对于它所在的设置文件解析。路径是文件时作为单个扩展加载；是目录时按软件包规则加载资源。

## 创建 Pi 软件包

在 `package.json` 里加一个 `pi` 清单，或使用约定目录。加上 `pi-package` 关键词以便被目录收录。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径相对于包根目录。数组支持 glob 模式和 `!` 排除。正向清单 glob 按字典序发现可见路径；点开头的路径需直接列出；如果某个 glob 需要穿过符号链接继续匹配，请直接列出符号链接的资源根。

### 目录页元数据

[软件包目录](https://pi.dev/packages)展示带 `pi-package` 标签的包。加 `video` 或 `image` 字段可以显示预览：

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **video**：仅 MP4。桌面上悬停自动播放，点击打开全屏播放器。
- **image**：PNG、JPEG、GIF 或 WebP，作为静态预览展示。

两者都设置时视频优先。

## 包结构

### 约定目录

没有 `pi` 清单时，Pi 从这些目录自动发现资源：

- `extensions/` 加载 `.ts` 和 `.js` 文件
- `skills/` 递归查找含 `SKILL.md` 的目录，并把顶级 `.md` 文件作为技能加载
- `prompts/` 加载 `.md` 文件
- `themes/` 加载 `.json` 文件

## 依赖

第三方运行时依赖应放进 `package.json` 的 `dependencies`。不注册扩展、技能、提示词模板或主题的依赖也放在 `dependencies`。Pi 从 npm 或 git 安装软件包时会运行 `npm install`，这些依赖会被自动安装。

Pi 为扩展和技能内置了核心包。如果 import 了下列任何包，请把它们列入 `peerDependencies`（范围写 `"*"`）且不要打包：`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`。

其他 Pi 软件包必须打包进你的 tarball：加入 `dependencies` 和 `bundledDependencies`，然后通过 `node_modules/` 路径引用它们的资源。Pi 以独立模块根加载软件包，因此分开安装的包不会冲突或共享模块。

示例：

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## 包过滤

在设置中用对象形式过滤软件包加载的内容：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+路径` 和 `-路径` 是相对包根的精确路径。

- 省略某个键 = 加载该类型的全部内容。
- `[]` = 该类型什么都不加载。
- `!模式` 排除匹配项。
- `+路径` 强制包含精确路径。
- `-路径` 强制排除精确路径。
- 过滤器叠加在清单之上，只能收窄已允许的范围。

## 启用与禁用资源

用 `pi config` 启用/禁用已安装软件包和本地目录中的扩展、技能、提示词模板与主题。`pi config` 默认打开全局设置（`~/.pi/agent/settings.json`）；按 Tab 在全局与项目本地模式间切换。`pi config -l` 则从项目覆盖（`.pi/settings.json`）开始，继承的全局资源会以暗色显示。

## 作用域与去重

软件包可以同时出现在全局和项目设置中。同一个包两处都出现时，项目条目优先；除非项目条目设置了 `autoload: false`——此时它作为全局条目之上的增量生效。包的身份判定依据：

- npm：包名
- git：不含引用的仓库 URL
- 本地：解析后的绝对路径
