#!/usr/bin/env node
/* 每日上游同步 + LLM 自动翻译
 *
 * 流程：
 *   1. 对比 earendil-works/pi 官方仓库 docs 的 blob SHA，检测差异（1 次 API 调用）
 *      —— 覆盖前把旧快照备份到 sync/upstream-old/，供人工比对
 *   2. 检测最新 GitHub Release，维护 releases 缓存（构建时注入“动态”页）
 *   3. 对有差异的文档：分块调用硅基流动 LLM 翻译，写入 docs-md/<slug>.md
 *      —— 大型参考文档（extensions/sdk/rpc/tui/custom-provider）走“结构化编译”模式
 *      —— 链接自动重写为站内路径 / GitHub 绝对链接；译文做长度/围栏健全性校验
 *   4. 生成 sync-report.md 供 workflow 提交与更新跟踪 issue
 *
 * 首次运行（无 manifest）只建基线，不翻译、不建 issue。
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(root);
const UPSTREAM = "earendil-works/pi";
const DOCS_DIR = "packages/coding-agent/docs";
const RAW_DOCS = `https://raw.githubusercontent.com/${UPSTREAM}/main/${DOCS_DIR}/`;
const CODE_BLOB = `https://github.com/${UPSTREAM}/blob/main/packages/coding-agent/`;
const CODE_TREE = `https://github.com/${UPSTREAM}/tree/main/packages/coding-agent/`;
/* 与 build.js 的 DOCS_NAV 保持一致 */
const SLUGS = [
  "index", "quickstart", "usage", "providers", "models", "custom-provider",
  "settings", "keybindings", "environment-variables", "security", "containerization",
  "extensions", "skills", "prompt-templates", "themes", "packages",
  "sessions", "compaction", "session-format", "sdk", "rpc", "json", "tui", "development",
  "windows", "termux", "tmux", "terminal-setup", "shell-aliases", "llama-cpp",
];
/* 长篇参考文档走结构化编译模式，其余全量翻译 */
const CONDENSED = new Set(["extensions", "sdk", "rpc", "tui", "custom-provider"]);

const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const LLM_KEY = process.env.SILICONFLOW_API_KEY || "";
const LLM_URL = "https://api.siliconflow.cn/v1/chat/completions";
const LLM_MODEL = "deepseek-ai/DeepSeek-V4-Flash";

const GH_HEADERS = { "User-Agent": "pi-dev-chinese-sync", ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}) };
const manifestPath = join(repoRoot, "sync", "upstream.json");
const cachePath = join(repoRoot, "sync", "releases-cache.json");
const snapDir = join(repoRoot, "sync", "upstream");
const snapOldDir = join(repoRoot, "sync", "upstream-old");
const reportPath = join(repoRoot, "sync-report.md");

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`);
  return res.json();
};
const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vendor(slug, { backup = false } = {}) {
  const localPath = join(snapDir, `${slug}.md`);
  if (backup && existsSync(localPath)) {
    mkdirSync(snapOldDir, { recursive: true });
    copyFileSync(localPath, join(snapOldDir, `${slug}.md`));
  }
  const res = await fetch(`${RAW_DOCS}${slug}.md`, { headers: GH_HEADERS });
  if (!res.ok) throw new Error(`下载 ${slug}.md: HTTP ${res.status}`);
  writeFileSync(localPath, Buffer.from(await res.arrayBuffer()));
}

/* ---------- 1. 差异检测 ---------- */
const tree = await api(`/repos/${UPSTREAM}/git/trees/main?recursive=1`);
const treeByPath = new Map(tree.tree.map((e) => [e.path, e]));
const firstRun = !existsSync(manifestPath);
const manifest = firstRun ? { files: {}, latestRelease: null } : JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.files ||= {};
mkdirSync(snapDir, { recursive: true });

const rows = []; // [slug, 状态, 上游路径]
const pending = []; // 需要翻译的 slug
for (const slug of SLUGS) {
  const p = `${DOCS_DIR}/${slug}.md`;
  const entry = treeByPath.get(p);
  const prev = manifest.files[slug];

  if (!entry) {
    if (prev && !prev.missing) {
      rows.push([slug, "⚠️ 上游已删除（译文保留）", p]);
      prev.missing = true;
    }
    continue;
  }
  if (!prev) {
    await vendor(slug);
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    const status = firstRun ? "基线" : "🆕 上游新增";
    rows.push([slug, status, p]);
    if (!firstRun) pending.push(slug);
  } else if (prev.missing) {
    await vendor(slug, { backup: true });
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    rows.push([slug, "♻️ 上游恢复", p]);
    pending.push(slug);
  } else if (prev.sha !== entry.sha) {
    await vendor(slug, { backup: true });
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    rows.push([slug, "✏️ 有更新", p]);
    pending.push(slug);
  }
}
/* 上游新增了清单之外的文档（docs-md/build.js 侧还没有登记） */
const known = new Set([...SLUGS, ...Object.keys(manifest.files)]);
for (const p of upstreamDocsOnly(treeByPath)) {
  const slug = p.slice(DOCS_DIR.length + 1, -3);
  if (!known.has(slug)) {
    await vendor(slug);
    manifest.files[slug] = { sha: treeByPath.get(p).sha, fetchedAt: today() };
    rows.push([slug, "🆕 上游新增（清单外，需登记 build.js）", p]);
    pending.push(slug);
  }
}
function upstreamDocsOnly(treeByPath) {
  return [...treeByPath.keys()].filter((p) => p.startsWith(DOCS_DIR + "/") && p.endsWith(".md"));
}

/* ---------- 2. Release 检测与缓存 ---------- */
const rel = await api(`/repos/${UPSTREAM}/releases?per_page=10`);
const norm = rel
  .filter((r) => !r.draft)
  .map((r) => ({ tag: r.tag_name, name: r.name || r.tag_name, date: (r.published_at || "").slice(0, 10), url: r.html_url }));
const cacheStr = JSON.stringify(norm, null, 2) + "\n";
const cacheChanged = !existsSync(cachePath) || readFileSync(cachePath, "utf8") !== cacheStr;
if (cacheChanged) writeFileSync(cachePath, cacheStr);
const latest = norm[0]?.tag ?? null;
const releaseChanged = manifest.latestRelease !== null && manifest.latestRelease !== latest;
manifest.latestRelease = latest;

/* ---------- 3. LLM 翻译 ---------- */
const GLOSSARY =
  "术语表：harness→外壳；extension→扩展；skill→技能；prompt template→提示词模板；theme→主题；package→软件包；session→会话；compaction→压缩；steering→引导；follow-up→追问；provider→提供商；model→模型；tool→工具；command→命令。";
const SYS_FULL = `你是资深技术文档翻译，把 MIT 协议开源项目 pi 的官方英文文档翻译成简体中文。
规则：
1. 只输出译文 markdown，不要任何解释或前言，不要用代码围栏包裹全文。
2. 代码块中的代码、命令、环境变量名、API 字段名、文件路径、URL、HTML 保持原样；代码块内的注释可译为中文。
3. 完整保留 markdown 结构：标题层级、列表、表格、引用、粗体、front-matter 键名；front-matter 的值译为中文。
4. ${GLOSSARY}
5. /model、Ctrl+L 这类命令与按键组合保留原样；链接文字翻译，URL 和锚点保持不变。
6. 风格：简洁、准确、面向开发者的技术文档体；不添加原文没有的内容，不遗漏原文内容。`;
const SYS_CONDENSED = `${SYS_FULL}
7. 本文属于长篇参考文档的中文编译版：标题、表格、参数与取值说明必须完整翻译，不得丢失事实；叙述性正文可适度精炼；每个小节最多保留 1-2 个最具代表性的代码块，被省略的代码块原位置放一行：> 完整代码见英文原文。`;

const sleepBeforeRetry = (n) => sleep(2500 * n);

async function llmTranslate(system, user) {
  const body = {
    model: LLM_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `请翻译以下 markdown 片段，只输出译文：\n\n${user}` },
    ],
    temperature: 0.2,
    max_tokens: 8000,
    stream: false,
  };
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 4) throw new Error(`LLM HTTP ${res.status}（重试耗尽）`);
      await sleepBeforeRetry(attempt);
      continue;
    }
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 400 && /max_tokens/i.test(t)) {
        delete body.max_tokens;
        continue;
      }
      throw new Error(`LLM HTTP ${res.status}: ${t.slice(0, 180)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM 返回空内容");
    return content;
  }
  throw new Error("LLM 重试耗尽");
}

function chunkMarkdown(md, target) {
  const lines = md.split("\n");
  const chunks = [];
  let cur = [];
  let curLen = 0;
  let inFence = false;
  const flush = () => {
    if (cur.length) chunks.push(cur.join("\n"));
    cur = [];
    curLen = 0;
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const isHeading = /^#{1,6}\s/.test(line) && !inFence;
    if (!inFence && curLen > 0 && (isHeading || curLen + line.length + 1 > target)) flush();
    cur.push(line);
    curLen += line.length + 1;
    if (!inFence && curLen > target * 2 && line.trim() === "") flush();
  }
  flush();
  return chunks;
}

function cleanChunkOut(text, srcChunk) {
  let t = text.trim();
  /* 只在整段被围栏包裹且原文并非以围栏开头时剥离 */
  if (!/^\s*```/.test(srcChunk)) {
    t = t.replace(/^```(?:markdown|md)\s*\n/, "");
    if (/^```/.test(t) && /```\s*$/.test(t) && t.split("```").length === 3) {
      t = t.replace(/^```\s*\n/, "").replace(/\n```\s*$/, "");
    }
  }
  return t.trim();
}

function rewriteLinks(md) {
  return md.replace(/\]\(([^)\s]+)([^)]*)\)/g, (m, target, rest) => {
    if (/^(https?:|#|mailto:)/.test(target)) return m;
    if (/\.md$/.test(target)) {
      const slug = target.split("/").pop().replace(/\.md$/, "");
      return `](/docs/${slug === "index" ? "" : slug}/${rest})`;
    }
    if (/^images\//.test(target)) return `](${RAW_DOCS}${target}${rest})`;
    if (target.startsWith("../")) {
      const p = target.slice(3);
      return `](${/\.[a-z]+$/i.test(p) ? CODE_BLOB + p : CODE_TREE + p}${rest})`;
    }
    if (/^(src|examples)\//.test(target)) {
      return `](${/\.[a-z]+$/i.test(target) ? CODE_BLOB + target : CODE_TREE + target}${rest})`;
    }
    return m;
  });
}

const translateResults = new Map(); // slug -> {ok, info}
async function translateDoc(slug) {
  if (!LLM_KEY) {
    translateResults.set(slug, { ok: false, info: "未配置 SILICONFLOW_API_KEY" });
    return;
  }
  try {
    const src = readFileSync(join(snapDir, `${slug}.md`), "utf8");
    const condensed = CONDENSED.has(slug);
    const chunks = chunkMarkdown(src, condensed ? 10000 : 6000);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      const text = await llmTranslate(condensed ? SYS_CONDENSED : SYS_FULL, chunks[i]);
      out.push(cleanChunkOut(text, chunks[i]));
      if (i < chunks.length - 1) await sleep(1200);
    }
    let doc = out.join("\n\n");
    doc = rewriteLinks(doc);
    const ratio = doc.replace(/\s/g, "").length / Math.max(1, src.replace(/\s/g, "").length);
    if (doc.length < 80 || ratio < 0.18) throw new Error(`译文过短 ratio=${ratio.toFixed(2)}`);
    if (!condensed) {
      const fIn = (src.match(/```/g) || []).length;
      const fOut = (doc.match(/```/g) || []).length;
      if (Math.abs(fIn - fOut) > 2) throw new Error(`代码围栏数异常 in=${fIn} out=${fOut}`);
    }
    writeFileSync(join(repoRoot, "docs-md", `${slug}.md`), doc.endsWith("\n") ? doc : doc + "\n");
    translateResults.set(slug, { ok: true, info: `${chunks.length} 块 · 压缩比 ${ratio.toFixed(2)}${condensed ? " · 编译版" : ""}` });
  } catch (e) {
    translateResults.set(slug, { ok: false, info: e.message });
  }
}
for (const slug of pending) {
  await translateDoc(slug);
  await sleep(800);
}

/* ---------- 4. 报告 ---------- */
const statusOf = (slug, base) => {
  const r = translateResults.get(slug);
  if (!r) return base;
  return `${base} · ${r.ok ? "🤖 已自动翻译" : "⚠️ 自动翻译失败"}（${r.info}）`;
};
const lines = [];
lines.push(firstRun ? "<!-- BASELINE -->" : `<!-- SYNC ${new Date().toISOString()} -->`);
lines.push("# 上游同步报告", "");
lines.push(`- 检查时间：${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`);
lines.push(`- 上游仓库：[${UPSTREAM}](https://github.com/${UPSTREAM})`);
if (latest) lines.push(`- 最新版本：**${latest}**（${norm[0].date}）${releaseChanged ? " — 🆕 检测到新版本" : ""}`);
lines.push("");
const docsChanged = rows.filter((r) => r[1] !== "基线");
const anyTranslated = [...translateResults.values()].some((r) => r.ok);
if (docsChanged.length) {
  if (anyTranslated) {
    lines.push(
      "本轮差异已由 LLM 自动翻译并更新 `docs-md/`，随本次提交自动部署到网站。**建议对照 `sync/upstream/`（英文快照）人工校对术语。**",
      ""
    );
  }
  lines.push("## 文档差异", "", "| 文档 | 状态 | 上游改动历史 |", "|---|---|---|");
  for (const [slug, status, p] of docsChanged) {
    lines.push(`| \`${slug}\` | ${statusOf(slug, status)} | [commits](https://github.com/${UPSTREAM}/commits/main/${p}) |`);
  }
  lines.push("");
  lines.push(
    "**人工处理指引**：英文快照在 `sync/upstream/<文档>.md`（旧版可用 git 历史查看），译文在 `docs-md/<文档>.md`，改完提交推送即自动重新部署。" +
      "5 个大文档（extensions/sdk/rpc/tui/custom-provider）是结构化编译版，只需同步有变化的小节；" +
      "清单外新增文档还需在 `build.js` 的 `DOCS_NAV` 登记才会出现在侧栏。"
  );
  lines.push("");
} else {
  lines.push("文档与上次快照一致，无待处理差异。", "");
}
if (cacheChanged && !firstRun) lines.push(`Release 缓存已更新（${norm.length} 个版本），推送后自动重新部署并刷新“动态”页版本列表。`, "");
lines.push("---");
lines.push("<sub>本报告由「每日上游同步与自动翻译」workflow 自动生成并覆盖本 issue 正文。</sub>");
writeFileSync(reportPath, lines.join("\n"));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const changed = firstRun ? "baseline" : docsChanged.length || releaseChanged || cacheChanged ? "yes" : "none";
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: "a" });
}
console.log(
  `sync-check: changed=${changed}, docs 差异 ${docsChanged.length} 项, 翻译 ${pending.length} 篇（成功 ${[...translateResults.values()].filter((r) => r.ok).length}）, latest=${latest}`
);
