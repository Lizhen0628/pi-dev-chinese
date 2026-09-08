# pi-dev-chinese · pi.dev 中文站

Pi（[pi.dev](https://pi.dev)）编码智能体的社区中文站点，托管于 Cloudflare Pages：
**https://chinese.pi.tools-online.site**

## 这是什么

- Pi 是 Earendil Inc. 开源的（MIT 协议）极简 AI 编码智能体，原站为 [pi.dev](https://pi.dev)。
- 本站是其**社区中文翻译站**，非官方。文档内容依据项目仓库（[earendil-works/pi](https://github.com/earendil-works/pi)，MIT）中的文档翻译，保留原项目版权与许可；如与英文原文有出入，以英文原文为准。
- 视觉风格致敬原站的"终端 + 衬线斜体"设计；实现代码为本仓库原创（MIT）。

## 站点结构

```
site/            静态页面（首页 /docs /news /packages /models 入口页）
docs-md/         中文文档 markdown 源文件（对应上游 packages/coding-agent/docs）
build.js         构建脚本：docs-md/*.md → dist/docs/<slug>/index.html
dist/            构建产物（部署目录，不提交）
```

## 本地开发

```bash
npm install
npm run build       # 生成 dist/
npx serve dist      # 或任意静态服务器预览
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并部署到 Cloudflare Pages：

1. 需要在仓库 Secrets 配置：
   - `CLOUDFLARE_API_TOKEN`：具有 Pages Write 权限的 Cloudflare API Token
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID
2. 自定义域名 `chinese.pi.tools-online.site` 绑定在 Pages 项目上。

## 上游同步机制（自动）

仓库带有定时差异检测，无需人工盯上游：

- **每日 09:30（北京时间）** 运行 [上游同步检查](.github/workflows/sync-check.yml)（也可手动 `workflow_dispatch` 触发）：
  1. 对比上游仓库 `packages/coding-agent/docs/*.md` 的 blob SHA，检测文档新增/更新/删除/恢复；
  2. 检测最新 GitHub Release；
  3. 有差异时：更新 `sync/upstream/*.md` 英文快照与 `sync/upstream.json` 清单并自动提交，同时创建/更新跟踪 issue **「上游同步：待处理的官网差异」**（含差异表格与上游 commits 链接）；
  4. Release 变化会更新 `sync/releases-cache.json`，提交后自动触发部署，刷新“动态”页顶部的**最近版本列表**（构建时注入，见 `build.js`）。
- 收到 issue 后，对照 `sync/upstream/<文档>.md` 更新 `docs-md/<文档>.md` 译文并推送即可；5 个编译版大文档只需同步变化的小节。
- 局限：首页文案与“动态”页的人工翻译部分无法自动同步，issue 会提示需要人工处理的内容。

## 许可

- 本仓库的站点实现代码：MIT
- 文档中文翻译：基于 [earendil-works/pi](https://github.com/earendil-works/pi)（MIT）翻译，版权归原项目版权人所有
