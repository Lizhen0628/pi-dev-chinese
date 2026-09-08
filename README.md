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

## 上游同步机制（自动 + LLM 翻译）

仓库带有每日定时同步，全自动处理上游差异：

- **每天北京时间凌晨 03:00** 运行 [每日上游同步与自动翻译](.github/workflows/daily-sync.yml)（也可手动 `workflow_dispatch` 触发）：
  1. 对比上游仓库 `packages/coding-agent/docs/*.md` 的 blob SHA，检测文档新增/更新/删除/恢复；
  2. 检测最新 GitHub Release；
  3. 有差异的文档**自动调用硅基流动 LLM（DeepSeek-V4-Flash）翻译**并更新 `docs-md/`——普通文档全量翻译，5 个大型参考文档（extensions/sdk/rpc/tui/custom-provider）按"结构化编译"模式翻译；链接自动重写为站内路径；译文做长度与代码围栏健全性校验，失败则保留旧译文并在 issue 中标记人工处理；
  4. `npm run build` 构建校验通过后提交推送 → 自动部署到 Cloudflare Pages；
  5. 同步创建/更新跟踪 issue **「上游同步：待处理的官网差异」**：差异表格、上游 commits 链接、每篇的自动翻译结果（🤖 成功 / ⚠️ 失败需人工）。
- **人工职责**：issue 出现后建议抽查译文术语（尤其🤖条目）；首页文案与“动态”页的翻译摘要仍为人工维护；清单外新增文档需在 `build.js` 的 `DOCS_NAV` 登记侧栏。
- 仓库 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`SILICONFLOW_API_KEY`。

## 许可

- 本仓库的站点实现代码：MIT
- 文档中文翻译：基于 [earendil-works/pi](https://github.com/earendil-works/pi)（MIT）翻译，版权归原项目版权人所有
