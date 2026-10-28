# Pi 软件包

Pi 软件包将扩展、技能、提示词模板和主题作为一个整体进行安装和分发。当某项自定义需要通过 npm 或 git 共享，或者多个资源归属于同一集合时，可以使用软件包。

软件包是一个普通的目录或 npm 软件包。它可以暴露常规的资源目录，在 `package.json` 的 `pi` 键下声明显式路径，并携带自身的运行时依赖。

## 安装与管理软件包

从 npm、git 或本地路径安装：

```bash
pi install npm:@example/pi-tools@1.0.0
pi install git:github.com/example/pi-tools@v1
pi install ./local-package
```

`pi list` 显示已配置的软件包。使用 `pi remove <source>` 移除某个软件包，使用 `pi update --extensions` 协调软件包安装。有关所有软件包命令和选项，请参阅 [命令行](cli.md#package-commands)。

如果已配置的软件包在启动时安装失败，例如由于 npm 无法访问注册表，Pi 会发出警告，跳过该软件包的资源，并继续运行。Pi 会在下次启动或 `/reload` 时再次尝试安装。`pi install` 和 `pi update --extensions` 仍会报告失败并以非零状态退出。

个人安装写入 `~/.pi/agent/settings.json`。添加 `--local` 或 `-l` 可将软件包声明写入 `.pi/settings.json`。Pi 仅在授予项目信任后才会从该文件读取声明。

项目软件包仅在项目信任解决后才会安装和加载。软件包可以执行扩展代码，并可能包含指示模型运行程序的技能。安装前请审查第三方软件包源代码。授予项目信任前请审查项目软件包声明。

使用 `--extension` 或 `-e` 可尝试运行一次软件包，而无需将其添加到设置中：

```bash
pi -e npm:@example/pi-tools
```

## 选择来源

| 来源 | 示例 | 行为 |
|---|---|---|
| npm | `npm:@example/pi-tools@1.0.0` | 安装至 Pi npm 目录下 |
| git | `git:github.com/example/pi-tools@v1` | 克隆并校准至所选 ref |
| URL | `https://github.com/example/pi-tools` | 视为 git 来源处理 |
| 本地 | `./pi-tools` | 从解析的路径加载，不进行复制 |

带版本的 npm 说明会被锁定。Git 标签和提交同样被锁定；软件包更新会校准检出内容，但不会移动已配置的 ref。

相对本地路径从包含它们的设置文件中解析。文件路径加载一个扩展。目录遵循常规软件包发现规则。

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

路径相对于软件包根目录。数组接受 glob 模式及排除项。当通过 glob 遍历无法发现点前缀或符号链接的资源根目录时，请直接列出它们。

`pi-package` 关键字使 npm 软件包有资格在 [Pi 软件包画廊](https://pi.dev/packages) 中被发现。可选的 `pi.image` 和 `pi.video` 字段用于添加画廊预览。

## 显示更新日志

软件包更新后，Pi 可以显示变更内容。在下一次全新启动时，Pi 读取软件包的更新日志，并显示比上次所见版本更新的条目，位置在“扩展更新”下，方式与显示自身更新日志相同。Pi 首次见到某个软件包时，会记录版本而不显示任何内容。

这适用于至少加载一个扩展的软件包。仅提供技能、提示词模板或主题的软件包不会显示更新日志。

默认情况下，Pi 从软件包根目录读取 `CHANGELOG.md`。将 `pi.changelogPath` 指向软件包内的另一个文件，或设置为 `""` 以禁用更新日志：

```json
{
  "name": "my-pi-package",
  "version": "1.2.0",
  "pi": {
    "changelogPath": "./docs/CHANGELOG.md"
  }
}
```

使用与 Pi 更新日志相同的格式的版本标题，例如 `## [1.2.0]` 或 `## 1.2.0 - 2026-01-01`。条目与 `package.json` 中的 `version` 字段匹配，因此 git 软件包仅在该字段增加时显示更新日志。`collapseChangelog` 设置将每个软件包的段落压缩为一行，例如 `更新了 my-pi-package 到 v1.2.0。` 与 Pi 自身的更新日志不同，`/changelog` 命令不显示软件包更新日志，因此如需详细信息，请阅读软件包的更新日志文件或仓库。

## 声明依赖

将由扩展导入的运行时软件包放入 `dependencies`。当 Pi 安装 npm 或 git 源时，它会安装软件包依赖。

Pi 向扩展和技能提供以下软件包：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`
- `typebox`

将上述由主机提供的软件包声明在 `peerDependencies` 中，使用 `"*"` 范围，并且不要将它们打包。Pi 会抑制对受管 npm 软件包以及通过 npm、pnpm 或 Bun 安装的 git 软件包的自动 peer 安装。本地软件包不会被安装或修改，因此其依赖树仍由软件包作者负责。

不要将主机提供的软件包列入 `dependencies`。物理副本可能会绕过 Pi 在编译后的 ESM 中的扩展模块映射，并创建重复的类、注册表和初始化工作。当 Pi 检测到此清单配置时，它会报告扩展警告。用作依赖的其他 Pi 软件包必须包含在发布的 tarball 中，并通过其 `node_modules` 资源路径进行引用。

已安装的软件包以独立的模块根加载。不要依赖两个软件包共享一个依赖实例，或一个软件包解析另一个软件包未声明的依赖。

## 选择软件包资源

设置中的对象形式用于缩小从软件包加载的资源范围：

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

针对每种资源类型：

- 省略该属性则以加载软件包所允许的全部内容。
- 使用 `[]` 则不加载该类型的任何内容。
- 使用 `!pattern` 排除 glob 匹配项。
- 使用 `+path` 包含一个确切允许的路径。
- 使用 `-path` 排除一个确切的路径。

过滤器用于缩小软件包清单的范围，不会暴露软件包自身未声明的资源。

运行 `pi config` 可启用或禁用发现的资源及 pi 的内置扩展。该命令默认从个人配置开始；按 Tab 键切换范围，或运行 `pi config --local` 从项目覆盖配置开始。

## 理解作用域与身份标识

同一软件包可能同时出现在个人设置与项目设置中。项目条目通常会替换个人条目。当启用`autoload: false`时，项目条目则作为个人软件包的过滤增量。

Pi通过软件包名称识别npm软件包，通过不带引用的仓库URL识别git软件包，通过解析后的绝对路径识别本地软件包。这样可以防止同一软件包因等价声明而被重复加载。

在设计各资源时，请先使用[扩展](/docs/extensions/)、[技能](/docs/skills/)、[提示词模板](/docs/prompt-templates/)和[主题](/docs/themes/)进行规划，然后再进行打包。
