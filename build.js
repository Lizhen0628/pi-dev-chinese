/* 构建脚本：docs-md/*.md → dist/docs/<slug>/index.html，并复制静态资源 */
import { marked } from "marked";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");

/* 文档导航：与原站 docs 侧栏对应的中文分组 */
const DOCS_NAV = [
  { group: "入门", items: [
    ["index", "总览"],
    ["quickstart", "快速上手"],
    ["usage", "使用 Pi"],
  ]},
  { group: "配置", items: [
    ["providers", "提供商"],
    ["models", "自定义模型"],
    ["custom-provider", "自定义提供商"],
    ["settings", "设置"],
    ["keybindings", "键位绑定"],
    ["environment-variables", "环境变量"],
    ["security", "安全"],
    ["containerization", "容器化"],
  ]},
  { group: "定制", items: [
    ["extensions", "扩展"],
    ["skills", "技能"],
    ["prompt-templates", "提示词模板"],
    ["themes", "主题"],
    ["packages", "Pi 软件包"],
  ]},
  { group: "会话", items: [
    ["sessions", "会话"],
    ["compaction", "压缩"],
    ["session-format", "会话格式"],
  ]},
  { group: "集成", items: [
    ["sdk", "SDK"],
    ["rpc", "RPC 模式"],
    ["json", "JSON 事件流模式"],
    ["tui", "TUI 组件"],
    ["development", "开发"],
  ]},
  { group: "平台与终端", items: [
    ["windows", "Windows"],
    ["termux", "Android (Termux)"],
    ["tmux", "tmux"],
    ["terminal-setup", "终端设置"],
    ["shell-aliases", "Shell 别名"],
    ["llama-cpp", "llama.cpp"],
  ]},
];

const ORDER = DOCS_NAV.flatMap((g) => g.items.map(([slug]) => slug));

function themeScript() {
  return `<script>(function(){var t=localStorage.getItem("pi-theme")||"auto";document.documentElement.setAttribute("data-theme",t);})();<\/script>`;
}

function navHtml(active) {
  return `
  <header class="topnav">
    <div class="topnav-inner">
      <a class="nav-logo" href="/" aria-label="Pi 中文站首页">
        <svg width="26" height="26" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 1h9v3H5v3h5v3H5v5H2V1zm10 7h2v7h-3V9h1V8z"/></svg>
      </a>
      <nav class="nav-links" aria-label="主导航">
        <a href="/">首页</a>
        <a href="/docs/" class="${active === "docs" ? "active" : ""}">文档</a>
        <a href="/news/" class="${active === "news" ? "active" : ""}">动态</a>
        <a href="/packages/" class="${active === "packages" ? "active" : ""}">软件包</a>
        <a href="/models/" class="${active === "models" ? "active" : ""}">模型</a>
      </nav>
      <div class="nav-right">
        <button class="theme-toggle" id="themeToggle" title="切换主题">主题：自动</button>
      </div>
    </div>
  </header>`;
}

function footerHtml() {
  return `
  <footer>
    <div class="wrap">
      <div class="foot-grid">
        <div class="foot-col">
          <h4>Pi 中文站</h4>
          <a href="/docs/">文档</a>
          <a href="/news/">动态</a>
          <a href="/packages/">软件包</a>
          <a href="/models/">模型</a>
        </div>
        <div class="foot-col">
          <h4>项目</h4>
          <a href="https://github.com/earendil-works/pi" target="_blank" rel="noopener">GitHub</a>
          <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent" target="_blank" rel="noopener">npm</a>
          <a href="https://discord.gg/3cU7Bz4UPx" target="_blank" rel="noopener">Discord</a>
          <a href="https://x.com/pidotdev" target="_blank" rel="noopener">X (@pidotdev)</a>
        </div>
        <div class="foot-col">
          <h4>相关</h4>
          <a href="https://pi.dev" target="_blank" rel="noopener">pi.dev（英文原站）</a>
          <a href="https://earendil.com" target="_blank" rel="noopener">Earendil Inc.</a>
          <a href="https://github.com/earendil-works/pi/blob/main/LICENSE" target="_blank" rel="noopener">MIT License</a>
        </div>
      </div>
      <p class="foot-note">
        本站是 Pi（<a href="https://pi.dev" target="_blank" rel="noopener">pi.dev</a>，由 Earendil Inc. 与贡献者开发，MIT 协议）的社区中文翻译站，用于方便中文读者阅读其文档，非官方站点。文档内容依据 MIT 协议翻译发布，版权归原作者所有；如与英文原文有出入，以英文原文为准。
      </p>
    </div>
  </footer>`;
}

function sidebarHtml(currentSlug) {
  const groups = DOCS_NAV.map((g) => {
    const links = g.items
      .map(([slug, label]) => {
        const href = slug === "index" ? "/docs/" : `/docs/${slug}/`;
        const cls = slug === currentSlug ? ' class="active"' : "";
        return `      <a href="${href}"${cls}>${label}</a>`;
      })
      .join("\n");
    return `    <div class="group">${g.group}</div>\n${links}`;
  }).join("\n");
  return `<aside class="docs-side" aria-label="文档导航">\n${groups}\n  </aside>`;
}

function renderDoc(slug, md) {
  /* 去掉文档自身的顶级 H1（模板里已有标题），提取标题与摘要 */
  const lines = md.split("\n");
  let title = "文档";
  let intro = "";
  const bodyLines = [];
  let removedH1 = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!removedH1 && /^#\s+/.test(line)) {
      title = line.replace(/^#\s+/, "").trim();
      removedH1 = true;
      /* 紧随其后的第一个非空段落作为摘要 */
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && !/^#/.test(lines[j]) && !/^```/.test(lines[j])) {
        intro = lines[j].replace(/\*/g, "").trim();
        i = j;
      }
      continue;
    }
    bodyLines.push(line);
  }
  const content = marked.parse(bodyLines.join("\n"));

  const idx = ORDER.indexOf(slug);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const label = (s) => {
    for (const g of DOCS_NAV) {
      const hit = g.items.find(([x]) => x === s);
      if (hit) return hit[1];
    }
    return s;
  };
  const href = (s) => (s === "index" ? "/docs/" : `/docs/${s}/`);
  const pager = `
      <div class="doc-pager">
        ${prev ? `<a href="${href(prev)}">← ${label(prev)}</a>` : "<span></span>"}
        ${next ? `<a href="${href(next)}">${label(next)} →</a>` : "<span></span>"}
      </div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="auto">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · Pi 中文文档</title>
<meta name="description" content="${intro ? intro.slice(0, 150) : "Pi 编码智能体中文文档"}">
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
${themeScript()}
</head>
<body>
${navHtml("docs")}
  <main class="wrap docs-layout">
  ${sidebarHtml(slug)}
    <article class="docs-main">
      <p class="trans-note">本文为社区中文翻译（依据 MIT 协议），<a href="https://pi.dev/docs/latest${slug === "index" ? "" : "/" + slug}" target="_blank" rel="noopener">阅读英文原文 →</a>。译文可能滞后于上游更新。</p>
      <h1>${title}</h1>
      ${content}
      ${pager}
    </article>
  </main>
${footerHtml()}
  <script src="/assets/main.js"><\/script>
</body>
</html>`;
}

/* --- 执行 --- */
mkdirSync(dist, { recursive: true });
cpSync(join(root, "site"), dist, { recursive: true });

const docsDir = join(root, "docs-md");
const files = readdirSync(docsDir).filter((f) => f.endsWith(".md"));
let built = 0;
for (const f of files) {
  const slug = basename(f, ".md");
  const md = readFileSync(join(docsDir, f), "utf8");
  const html = renderDoc(slug, md).replace("<\\/script>", "</script>");
  const outDir = slug === "index" ? join(dist, "docs") : join(dist, "docs", slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  built++;
}
console.log(`built ${built} docs pages → dist/`);

/* 注入“最近版本”列表（来自 sync/releases-cache.json，由上游同步检查 workflow 维护） */
try {
  const cachePath = join(root, "sync", "releases-cache.json");
  if (existsSync(cachePath)) {
    const releases = JSON.parse(readFileSync(cachePath, "utf8"));
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const items = releases
      .map(
        (r) =>
          `<a class="rel-item" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="rel-tag">${esc(r.tag)}</span><span class="rel-name">${esc(r.name)}</span><time>${esc(r.date)}</time></a>`
      )
      .join("\n");
    const newsPath = join(dist, "news", "index.html");
    let html = readFileSync(newsPath, "utf8");
    if (!html.includes("<!-- releases:start -->")) throw new Error("news 页缺少 releases 标记");
    html = html.replace(/<!-- releases:start -->[\s\S]*?<!-- releases:end -->/, `<!-- releases:start -->\n${items}\n<!-- releases:end -->`);
    writeFileSync(newsPath, html);
  }
} catch (e) {
  console.warn("releases 列表注入失败:", e.message);
}

/* 404 页 */
if (!existsSync(join(dist, "404.html"))) {
  writeFileSync(
    join(dist, "404.html"),
    `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>404 · Pi 中文站</title><link rel="stylesheet" href="/assets/style.css"></head><body><main class="wrap" style="text-align:center;padding:120px 24px;"><h1 class="display">404 · 页面不存在</h1><p class="lead" style="margin:0 auto 28px;">你要找的页面不在这里。<a href="/">返回首页</a> 或浏览 <a href="/docs/">中文文档</a>。</p></main></body></html>`
  );
}
