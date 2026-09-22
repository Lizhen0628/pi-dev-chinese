# Pi 软件包

Pi 软件包将扩展、技能、提示词模板和主题作为一个整体进行安装与分发。当某项定制需要通过 npm 或 git 共享，或当多个资源归属于同一集合时，可使用软件包。

软件包是一个普通目录或 npm 软件包。它可以暴露常规的资源目录，在 `package.json` 的 `pi` 键下声明显式路径，并携带自身的运行时依赖。

## 安装和管理软件包

从 npm、git 或本地路径安装：

```bash
pi install npm:@example/pi-tools@1.0.0
pi install git:github.com/example/pi-tools@v1
pi install ./local-package
```

`pi list` 显示已配置的软件包。使用 `pi remove <source>` 移除某个软件包，使用 `pi update --extensions` 协调软件包安装。有关所有软件包命令和选项，请参阅 [命令行](cli.md#package-commands)。

个人安装会写入 `~/.pi/agent/settings.json`。添加 `--local` 或 `-l` 可将软件包声明写入 `.pi/settings.json`。Pi 仅在授予项目信任后才读取该文件中的声明。

项目软件包仅在项目信任解决后才安装和加载。软件包可以执行扩展代码，并可能包含指示模型运行程序的技能。安装第三方软件包前请审查其源代码。授予项目信任前请审查项目软件包声明。

使用 `--extension` 或 `-e` 可在单次调用中试用软件包，而无需将其添加到设置中：

```bash
pi -e npm:@example/pi-tools
```

## 选择来源

| 来源 | 示例 | 行为 |
|---|---|---|
| npm | `npm:@example/pi-tools@1.0.0` | 安装到 Pi npm 目录下 |
| git | `git:github.com/example/pi-tools@v1` | 克隆并同步到所选引用 |
| URL | `https://github.com/example/pi-tools` | 视为 git 来源 |
| 本地 | `./pi-tools` | 从解析路径加载，不进行复制 |

带版本的 npm 规范会被固定。Git 标签和提交也会被固定；软件包更新会同步检出内容，但不会移动已配置的引用。

相对本地路径从包含它们的设置文件解析。文件路径加载一个扩展。目录遵循常规软件包发现规则。

## 创建软件包

最简单的软件包使用常规目录结构：

```text
my-pi-package/
├── package.json
├── extensions/
├── skills/
├── prompts/
└── themes/
```

如果没有 `pi` 清单，Pi 会从这些目录中发现 TypeScript 和 JavaScript 扩展、技能目录、Markdown 提示词模板以及 JSON 主题。

当资源位于其他位置或需要过滤时，请使用显式清单：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./src/extension.ts"],
    "skills": ["./resources/skills"],
    "prompts": ["./resources/prompts/*.md"],
    "themes": ["./resources/themes/*.json"]
  }
}
```

路径相对于软件包根目录。数组支持 glob 模式及排除项。对于以点开头或符号链接的资源根目录，如果通过 glob 遍历无法发现，请直接列出。

`pi-package` 关键字使 npm 软件包有资格在 [Pi 软件包画廊](https://pi.dev/packages) 中被发现。可选的 `pi.image` 和 `pi.video` 字段用于添加画廊预览。

## 声明依赖关系

将扩展运行时导入的软件包放入 `dependencies` 中。Pi 在安装 npm 或 git 源时，会同时安装软件包依赖。

Pi 向扩展和技能提供以下软件包：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`
- `typebox`

在 `peerDependencies` 中以 `"*"` 版本范围声明导入的 Pi 软件包，且不要将其打包。其他用作依赖的 Pi 软件包必须包含在发布的压缩包中，并通过其 `node_modules` 资源路径引用。

已安装的软件包以独立的模块根加载。不要依赖两个软件包共享一个依赖实例，或一个软件包解析另一个软件包未声明的依赖。

## 选择软件包资源

设置中的对象形式会缩小从软件包加载的资源范围：

```json
{
  "packages": [
    {
      "source": "npm:@example/pi-tools",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"]
    }
  ]
}
```

对于每种资源类型：

- 省略该属性以加载软件包允许的所有内容。
- 使用 `[]` 不加载该类型的任何内容。
- 使用 `!pattern` 排除匹配的 glob。
- 使用 `+path` 包含一个确切允许的路径。
- 使用 `-path` 排除一个确切的路径。

过滤器会收窄软件包清单。它们不会暴露软件包本身未声明的资源。

运行 `pi config` 启用或禁用发现的资源。它从个人配置开始；按 Tab 切换范围，或运行 `pi config --local` 从项目覆盖开始。

## 理解作用域与身份

同一软件包可同时出现在个人设置与项目设置中。项目条目通常取代个人条目。当设置 `autoload: false` 时，项目条目则作为个人软件包之上的过滤增量。

Pi 通过软件包名称识别 npm 软件包，通过不含引用的仓库 URL 识别 git 软件包，通过解析后的绝对路径识别本地软件包。这避免了同一软件包因等效声明而被重复加载。

在打包每个资源之前，请使用 [扩展](/docs/extensions/)、[技能](/docs/skills/)、[提示词模板](/docs/prompt-templates/) 和 [主题](/docs/themes/) 进行设计。
