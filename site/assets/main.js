/* Pi 中文站 — 交互脚本 */
(function () {
  "use strict";

  /* 主题切换：自动 → 亮色 → 暗色 */
  var THEMES = ["auto", "light", "dark"];
  var LABELS = { auto: "主题：自动", light: "主题：亮色", dark: "主题：暗色" };
  var btn = document.getElementById("themeToggle");
  function current() {
    return document.documentElement.getAttribute("data-theme") || "auto";
  }
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("pi-theme", t);
    if (btn) btn.textContent = LABELS[t] || LABELS.auto;
  }
  if (btn) {
    btn.textContent = LABELS[current()] || LABELS.auto;
    btn.addEventListener("click", function () {
      var next = THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length];
      apply(next);
    });
  }

  /* 安装命令切换 */
  var INSTALL = {
    curl: "curl -fsSL https://pi.dev/install.sh | bash",
    pwsh: "irm https://pi.dev/install.ps1 | iex",
    npm: "npm install -g @earendil-works/pi-coding-agent",
    pnpm: "pnpm install -g @earendil-works/pi-coding-agent",
    bun: "bun install -g @earendil-works/pi-coding-agent",
  };
  var cmdEl = document.getElementById("installCmd");
  var copyBtn = document.getElementById("copyBtn");
  var tabs = document.querySelectorAll(".install-tabs button");
  var activeCmd = INSTALL.curl;
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.classList.remove("active"); });
      t.classList.add("active");
      activeCmd = INSTALL[t.getAttribute("data-tab")];
      if (cmdEl) {
        cmdEl.innerHTML = '<span class="p">$ </span>' + activeCmd;
      }
    });
  });
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = cmdEl ? cmdEl.textContent.replace(/^\$\s*/, "") : "";
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      var old = copyBtn.textContent;
      copyBtn.textContent = "已复制 ✓";
      setTimeout(function () { copyBtn.textContent = old; }, 1600);
    });
  }

  /* 终端打字动画（尊重用户减少动态偏好） */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".type-line").forEach(function (el) {
    var text = el.getAttribute("data-text") || "";
    if (reduce) { el.textContent = text; return; }
    el.textContent = "";
    var i = 0;
    var timer = setInterval(function () {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(timer);
    }, 42);
  });
})();
