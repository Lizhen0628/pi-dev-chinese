#!/usr/bin/env node
/* 上游同步检查
 *
 * 对比 earendil-works/pi 官方仓库：
 *   1. packages/coding-agent/docs/*.md —— 通过 git tree 的 blob SHA 检测文档差异（1 次 API 调用）
 *   2. releases —— 检测最新版本，并维护 releases 缓存（供构建时注入“动态”页）
 *
 * 产物：
 *   - sync/upstream/<slug>.md      上游英文快照（有差异时更新）
 *   - sync/upstream.json           上游 blob SHA 清单
 *   - sync/releases-cache.json     最近 10 个 Release 的规范化缓存
 *   - sync-report.md               差异报告（供 workflow 建/更新跟踪 issue）
 *
 * 首次运行（无 manifest）会把全部文档记为基线，报告带 BASELINE 标记，workflow 跳过建 issue。
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(root);
const UPSTREAM = "earendil-works/pi";
const DOCS_DIR = "packages/coding-agent/docs";
/* 与 build.js 的 DOCS_NAV 保持一致 */
const SLUGS = [
  "index", "quickstart", "usage", "providers", "models", "custom-provider",
  "settings", "keybindings", "environment-variables", "security", "containerization",
  "extensions", "skills", "prompt-templates", "themes", "packages",
  "sessions", "compaction", "session-format", "sdk", "rpc", "json", "tui", "development",
  "windows", "termux", "tmux", "terminal-setup", "shell-aliases", "llama-cpp",
];

const TOKEN = process.env.GITHUB_TOKEN || "";
const H = { "User-Agent": "pi-dev-chinese-sync", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

const manifestPath = join(repoRoot, "sync", "upstream.json");
const cachePath = join(repoRoot, "sync", "releases-cache.json");
const snapDir = join(repoRoot, "sync", "upstream");
const reportPath = join(repoRoot, "sync-report.md");

const api = async (path) => {
  const res = await fetch(`https://api.github.com${path}`, { headers: H });
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`);
  return res.json();
};
const blobSha = (buf) => createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

async function vendor(slug) {
  const res = await fetch(`https://raw.githubusercontent.com/${UPSTREAM}/main/${DOCS_DIR}/${slug}.md`, { headers: H });
  if (!res.ok) throw new Error(`下载 ${slug}.md: HTTP ${res.status}`);
  writeFileSync(join(snapDir, `${slug}.md`), Buffer.from(await res.arrayBuffer()));
}

/* --- 1. 文档差异 --- */
const tree = await api(`/repos/${UPSTREAM}/git/trees/main?recursive=1`);
const treeByPath = new Map(tree.tree.map((e) => [e.path, e]));
const firstRun = !existsSync(manifestPath);
const manifest = firstRun ? { files: {}, latestRelease: null } : JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.files ||= {};
mkdirSync(snapDir, { recursive: true });

const rows = [];
for (const slug of SLUGS) {
  const p = `${DOCS_DIR}/${slug}.md`;
  const entry = treeByPath.get(p);
  const prev = manifest.files[slug];

  if (!entry) {
    if (prev && !prev.missing) {
      rows.push([slug, "⚠️ 上游已删除", p]);
      prev.missing = true;
    }
    continue;
  }
  if (!prev) {
    await vendor(slug);
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    rows.push([slug, firstRun ? "基线" : "🆕 上游新增", p]);
  } else if (prev.missing) {
    await vendor(slug);
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    rows.push([slug, "♻️ 上游恢复", p]);
  } else if (prev.sha !== entry.sha) {
    await vendor(slug);
    manifest.files[slug] = { sha: entry.sha, fetchedAt: today() };
    rows.push([slug, "✏️ 有更新", p]);
  }
}
/* 上游新增了清单之外的文档（对应 docs-md 还没有译文） */
const known = new Set([...SLUGS, ...Object.keys(manifest.files)]);
const upstreamDocs = [...treeByPath.keys()].filter((p) => p.startsWith(DOCS_DIR + "/") && p.endsWith(".md"));
for (const p of upstreamDocs) {
  const slug = p.slice(DOCS_DIR.length + 1, -3);
  if (!known.has(slug)) rows.push([slug, "🆕 上游新增（清单外）", p]);
}

/* --- 2. Release 检测与缓存 --- */
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

/* --- 3. 报告 --- */
const lines = [];
lines.push(firstRun ? "<!-- BASELINE -->" : `<!-- SYNC ${new Date().toISOString()} -->`);
lines.push("# 上游同步报告", "");
lines.push(`- 检查时间：${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`);
lines.push(`- 上游仓库：[${UPSTREAM}](https://github.com/${UPSTREAM})`);
if (latest) lines.push(`- 最新版本：**${latest}**（${norm[0].date}）${releaseChanged ? " — 🆕 检测到新版本" : ""}`);
lines.push("");
const docsChanged = rows.filter((r) => r[1] !== "基线");
if (docsChanged.length) {
  lines.push("## 文档差异", "", "| 文档 | 状态 | 上游改动历史 |", "|---|---|---|");
  for (const [slug, status, p] of docsChanged) {
    lines.push(`| \`${slug}\` | ${status} | [commits](https://github.com/${UPSTREAM}/commits/main/${p}) |`);
  }
  lines.push("");
  lines.push(
    "**更新指引**：英文快照在 `sync/upstream/<文档>.md`，对应译文在 `docs-md/<文档>.md`，改完提交推送即自动重新部署。" +
      "其中 `extensions`、`sdk`、`rpc`、`tui`、`custom-provider` 是结构化编译版，只需按快照同步有变化的小节。"
  );
  lines.push("");
} else {
  lines.push("文档与上次快照一致，无待处理差异。", "");
}
if (cacheChanged && !firstRun) lines.push(`Release 缓存已更新（${norm.length} 个版本），推送后会自动重新部署并刷新“动态”页的版本列表。`, "");
lines.push("---");
lines.push("<sub>本报告由「上游同步检查」workflow 每日自动生成并覆盖本 issue 正文。</sub>");
writeFileSync(reportPath, lines.join("\n"));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const changed = firstRun ? "baseline" : docsChanged.length || releaseChanged || cacheChanged ? "yes" : "none";
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: "a" });
}
console.log(`sync-check: changed=${changed}, docs 差异 ${docsChanged.length} 项, latest=${latest}`);
