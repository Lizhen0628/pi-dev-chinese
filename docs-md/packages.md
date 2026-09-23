# Pi 软件包

Pi 软件包将扩展、技能、提示词模板和主题作为一个单元进行安装和分发。当某个自定义配置需要通过网络共享，或几个资源需要归并在一起时，可使用软件包。

软件包是一个普通目录或npm软件包。它可以暴露约定的资源目录，在`package.json`中的`pi`键下声明显式路径，并携带自身的运行时依赖。

## 安装和管理软件包

从npm、git或本地路径安装：

```bash
pi install npm:@example/pi-tools@1.0.0
pi install git:github.com/example/pi-tools@v1
pi install ./local-package
```

`pi list` 显示已配置的软件包。使用 `pi remove <source>` 移除某个软件包，使用 `pi update --extensions` 协调软件包安装。所有软件包命令和选项参见 [命令行](cli.md#package-commands)。

个人安装写入 `~/.pi/agent/settings.json`。添加 `--local` 或 `-l` 可将软件包声明写入 `.pi/settings.json`。Pi 仅在项目信任授予后才读取该文件中的声明。

项目软件包仅在项目信任解决后才安装和加载。软件包可执行扩展代码，并可包含指示模型运行程序的技能。安装第三方软件包前请审查其源码。授予项目信任前请审查项目软件包声明。

使用 `--extension` 或 `-e` 可在不将其添加到设置中的情况下，为单次调用尝试一个软件包：

```bash
pi -e npm:@example/pi-tools
```

## 选择来源

| 来源 | 示例 | 行为 |
|---|---|---|
| npm | `npm:@example/pi-tools@1.0.0` | 安装在 Pi npm 目录下 |
| git | `git:github.com/example/pi-tools@v1` | 克隆并协调到所选引用 |
| URL | `https://github.com/example/pi-tools` | 视为 git 来源 |
| 本地 | `./pi-tools` | 从解析路径加载，不进行复制 |

带版本的 npm 规范会被固定。Git 标签和提交也会被固定；软件包更新会协调检出内容，但不会移动已配置的引用。

相对本地路径从包含它们的设置文件解析。文件路径加载一个扩展。目录遵循常规软件包发现规则。

## 创建软件包

最简单的软件包使用常规目录：

```text
my-pi-package/
├── package.json
├── extensions/
├── skills/
├── prompts/
└── themes/
```

若没有 `pi` 清单，Pi 会从这些目录中自动发现 TypeScript 和 JavaScript 扩展、技能目录、Markdown 提示词模板以及 JSON 主题。

当资源位于其他位置或需要筛选时，请使用显式清单：

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

路径相对于软件包根目录。数组支持通配符模式及排除项。若通过通配符遍历无法发现点前缀或符号链接的资源根目录，请直接列出它们。

`pi-package` 关键字使得 npm 软件包有资格在 [Pi 软件包画廊](https://pi.dev/packages) 中被发现。可选的 `pi.image` 和 `pi.video` 字段用于添加画廊预览。

## 声明依赖

将由扩展在运行时导入的软件包放入 `dependencies` 中。当 Pi 安装 npm 或 git 源时，会一并安装软件包依赖。

Pi 向扩展和技能提供以下软件包：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-tui`
- `typebox`

将上述主机提供的软件包在 `peerDependencies` 中声明，范围设为 `"*"`，且不要将其打包。Pi 会抑制对受管理的 npm 软件包以及通过 npm、pnpm 或 Bun 安装的 git 软件包的自动对等安装。本地软件包不会被安装或修改，因此其依赖树仍由软件包作者负责。

不要将主机提供的软件包列入 `dependencies`。物理副本可能会绕过 Pi 在编译后的 ESM 中的扩展模块映射，从而产生重复的类、注册表和初始化工作。当 Pi 检测到此清单配置时，会报告扩展警告。用作依赖的其他 Pi 软件包必须包含在发布的 tarball 中，并通过其 `node_modules` 资源路径进行引用。

已安装的软件包会以独立的模块根加载。不要依赖两个软件包共享一个依赖实例，或一个软件包解析另一个软件包未声明的依赖。

## 选择软件包资源

设置中的对象形式可以精确定位从软件包加载的资源：

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
- 使用 `[]` 表示不加载该类型的任何内容。
- 使用 `!pattern` 可排除 glob 匹配的内容。
- 使用 `+path` 可精确包含一个允许的路径。
- 使用 `-path` 可精确排除一个路径。

过滤器会缩小软件包清单的范围。它们不会暴露软件包本身未声明的资源。

运行 `pi config` 可启用或禁用已发现的资源。它从个人配置开始；按 Tab 键切换范围，或运行 `pi config --local` 从项目覆盖配置开始。

## 理解作用域与身份

同一个软件包可以同时出现在个人设置和项目设置中。项目条目通常会替换个人条目。当使用 `autoload: false` 时，项目条目则作为个人软件包上的过滤增量。

Pi 通过软件包名称识别 npm 软件包，通过不含引用的仓库 URL 识别 git 软件包，通过解析后的绝对路径识别本地软件包。这可以防止同一软件包通过等效声明被重复加载。

在打包每个资源之前，请使用 [扩展](/docs/extensions/)、[技能](/docs/skills/)、[提示词模板](/docs/prompt-templates/) 和 [主题](/docs/themes/) 进行设计。
