/* ==========================================================================
   黄伟国 · 个人简历网站交互脚本
   原生 JavaScript，无任何外部依赖
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- 代码高亮 */
  const KEYWORDS = {
    python: ["def", "class", "import", "from", "return", "if", "elif", "else", "for",
      "while", "with", "as", "try", "except", "finally", "in", "not", "and", "or",
      "None", "True", "False", "self", "lambda", "yield", "pass", "raise", "global",
      "assert", "del", "is", "async", "await"],
    java: ["public", "private", "protected", "static", "void", "class", "interface",
      "extends", "implements", "new", "return", "if", "else", "for", "while", "do",
      "try", "catch", "finally", "throw", "throws", "import", "package", "int", "long",
      "double", "float", "boolean", "char", "byte", "short", "String", "final", "this",
      "super", "null", "true", "false", "record", "var", "synchronized", "abstract",
      "enum", "instanceof", "break", "continue", "switch", "case", "default"],
    vrp: ["system-view", "sysname", "interface", "quit", "vlan", "batch", "port",
      "link-type", "trunk", "allow-pass", "default", "access", "Vlanif", "ip", "address",
      "route-static", "acl", "number", "rule", "deny", "permit", "traffic-filter",
      "inbound", "save", "display", "stp", "dhcp", "enable", "pool", "port-security",
      "ssh", "user-interface", "vty"],
    ios: ["enable", "configure", "terminal", "hostname", "interface", "exit", "vlan",
      "name", "switchport", "mode", "trunk", "access", "encapsulation", "dot1q", "ip",
      "address", "routing", "route", "router", "ospf", "network", "area", "access-list",
      "access-class", "line", "vty", "write", "memory", "no", "shutdown", "show",
      "running-config"]
  };

  const STR_RE = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;
  const COM_RE = {
    python: String.raw`#[^\n]*`,
    vrp: String.raw`#[^\n]*`,
    java: String.raw`//[^\n]*|/\*[\s\S]*?\*/`,
    ios: String.raw`//[^\n]*|/\*[\s\S]*?\*/|![^\n]*`
  };

  const reCache = {};
  function langRe(lang) {
    if (reCache[lang]) return reCache[lang];
    const kw = (KEYWORDS[lang] || []).join("|");
    const src =
      "(?<com>" + COM_RE[lang] + ")|(?<str>" + STR_RE + ")" +
      "|(?<kw>\\b(?:" + kw + ")\\b)" +
      "|(?<num>\\b\\d+(?:\\.\\d+)?\\b)" +
      "|(?<fn>\\b[A-Za-z_]\\w*(?=\\())";
    reCache[lang] = new RegExp(src, "g");
    return reCache[lang];
  }

  function esc(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlight(code, lang) {
    const re = langRe(lang);
    re.lastIndex = 0;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      if (m.index > last) out += esc(code.slice(last, m.index));
      const g = m.groups || {};
      const cls = g.com ? "tok-com" : g.str ? "tok-str" : g.kw ? "tok-kw" : g.num ? "tok-num" : "tok-fn";
      out += '<span class="' + cls + '">' + esc(m[0]) + "</span>";
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    out += esc(code.slice(last));
    return out;
  }

  /* ------------------------------------------------------------ 代码示例渲染 */
  const SNIP = window.SNIPPETS || { python: [], java: [], config: {} };
  const state = { python: 0, java: 0 };
  const IDS = {
    python: { desc: "pyDesc", file: "pyFile", code: "pyCode", points: "pyPoints" },
    java: { desc: "javaDesc", file: "javaFile", code: "javaCode", points: "javaPoints" }
  };

  function renderSnippet(kind, index) {
    const list = SNIP[kind];
    const item = list[index];
    if (!item) return;
    state[kind] = index;

    const ids = IDS[kind];
    document.getElementById(ids.desc).textContent = item.desc;
    document.getElementById(ids.file).textContent = item.file;
    document.getElementById(ids.code).innerHTML = highlight(item.code, kind);

    const ul = document.getElementById(ids.points);
    ul.textContent = "";
    item.points.forEach(function (p) {
      const li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    });

    $$('[data-tabs="' + kind + '"] button').forEach(function (btn, i) {
      btn.classList.toggle("active", i === index);
      btn.setAttribute("aria-selected", i === index ? "true" : "false");
    });

    const pre = document.getElementById(ids.code).closest("pre");
    if (pre) {
      pre.classList.remove("expanded");
      const expandBtn = pre.parentElement.querySelector(".code-expand");
      if (expandBtn) {
        expandBtn.classList.remove("is-open");
        expandBtn.innerHTML = '展开全部 <span>⌄</span>';
      }
    }
    setTimeout(syncExpanders, 30);
  }

  function buildTabs(kind) {
    const wrap = $('[data-tabs="' + kind + '"]');
    if (!wrap) return;
    SNIP[kind].forEach(function (item, i) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.textContent = item.tab;
      btn.addEventListener("click", function () {
        renderSnippet(kind, i);
      });
      wrap.appendChild(btn);
    });
    renderSnippet(kind, 0);
  }

  /* ---------------------------------------------------------- 代码折叠展开 */
  function syncExpanders() {
    $$(".code-expand").forEach(function (btn) {
      const pre = btn.previousElementSibling;
      if (!pre || pre.tagName !== "PRE") return;
      if (pre.classList.contains("expanded")) { btn.hidden = false; return; }
      btn.hidden = pre.scrollHeight <= pre.clientHeight + 6;
    });
  }

  function wireExpanders() {
    $$(".code-expand").forEach(function (btn) {
      const pre = btn.previousElementSibling;
      if (!pre) return;
      btn.addEventListener("click", function () {
        const open = pre.classList.toggle("expanded");
        btn.classList.toggle("is-open", open);
        btn.innerHTML = open ? '收起代码 <span>⌃</span>' : '展开全部 <span>⌄</span>';
      });
    });
    syncExpanders();
    let t = null;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(syncExpanders, 220);
    });
  }

  /* ------------------------------------------------------------------ 复制 */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  function wireCopy() {
    $$(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.dataset.copy;
        if (key === "huawei" || key === "cisco") {
          copyText(SNIP.config[key] || "").then(flash);
        } else {
          const list = SNIP[key] || [];
          const item = list[state[key]];
          if (item) copyText(item.code).then(flash);
        }
        function flash(ok) {
          const old = btn.textContent;
          btn.textContent = ok ? "已复制 ✓" : "复制失败";
          btn.classList.toggle("copied", !!ok);
          setTimeout(function () {
            btn.textContent = old;
            btn.classList.remove("copied");
          }, 1600);
        }
      });
    });
  }

  /* -------------------------------------------------------------- 导航 / 进度 */
  function initNav() {
    const nav = $("#nav");
    const bar = $("#progressBar");
    const links = $$("#navLinks a");
    const sections = links.map(function (a) {
      return { link: a, el: document.querySelector(a.getAttribute("href")) };
    }).filter(function (s) { return s.el; });

    const toggle = $("#navToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        const open = document.body.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
      });
      links.forEach(function (a) {
        a.addEventListener("click", function () {
          document.body.classList.remove("nav-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    let ticking = false;
    function update() {
      const y = window.scrollY || document.documentElement.scrollTop;
      if (nav) nav.classList.toggle("scrolled", y > 24);
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + "%";
      }
      let current = sections[0];
      sections.forEach(function (s) {
        if (s.el.getBoundingClientRect().top <= 140) current = s;
      });
      sections.forEach(function (s) {
        s.link.classList.toggle("active", s === current);
      });
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* --------------------------------------------------------------- 滚动出现 */
  function initReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in-view"); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------- 数字滚动 */
  function initCounters() {
    const nums = $$("[data-count]");
    if (!nums.length) return;
    const run = function (el) {
      const target = parseInt(el.dataset.count, 10) || 0;
      if (reduceMotion) { el.textContent = String(target); return; }
      const start = performance.now();
      const dur = target > 1000 ? 1400 : 1000;
      const from = target > 1000 ? target - 40 : 0;
      function tick(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    if (!("IntersectionObserver" in window)) { nums.forEach(run); return; }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.5 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* --------------------------------------------------------------- 打字效果 */
  function initTyped() {
    const el = $("#typed");
    if (!el) return;
    const words = ["网络工程师", "网络运维 / 网络技术支持", "Python 网络自动化", "华为 · 思科 设备配置"];
    if (reduceMotion) { el.textContent = words[0]; return; }
    let wi = 0, ci = 0, deleting = false;

    function step() {
      const word = words[wi];
      ci += deleting ? -1 : 1;
      el.textContent = word.slice(0, ci);
      let delay = deleting ? 45 : 95;
      if (!deleting && ci === word.length) { deleting = true; delay = 1800; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 320; }
      setTimeout(step, delay);
    }
    setTimeout(step, 700);
  }

  /* ------------------------------------------------------------- 画布网络 */
  function initCanvas() {
    const canvas = $("#net");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, nodes = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(58, Math.max(22, Math.round((w * h) / 28000)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: Math.random() * 1.6 + 0.9,
          hue: Math.random() > 0.7 ? "77,141,255" : "56,232,200"
        });
      }
    }

    function frame(animate) {
      ctx.clearRect(0, 0, w, h);
      const maxDist = Math.min(160, Math.max(110, w / 9));

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (animate) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < -20) a.x = w + 20; if (a.x > w + 20) a.x = -20;
          if (a.y < -20) a.y = h + 20; if (a.y > h + 20) a.y = -20;
        }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxDist * maxDist) continue;
          const alpha = (1 - Math.sqrt(d2) / maxDist) * 0.32;
          ctx.strokeStyle = "rgba(95,150,235," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        // 鼠标附近的连线
        const mdx = a.x - mouse.x, mdy = a.y - mouse.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 170) {
          const alpha = (1 - md / 170) * 0.5;
          ctx.strokeStyle = "rgba(56,232,200," + alpha.toFixed(3) + ")";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        ctx.fillStyle = "rgba(" + a.hue + ",0.75)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let raf = null, lastT = 0;
    function loop(t) {
      if (t - lastT > 42) { frame(true); lastT = t; }
      raf = requestAnimationFrame(loop);
    }

    build();
    if (reduceMotion) { frame(false); return; }
    raf = requestAnimationFrame(loop);

    let resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 180);
    });
    window.addEventListener("mousemove", function (e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });
    window.addEventListener("mouseout", function () { mouse.x = -9999; mouse.y = -9999; });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf && !reduceMotion) { raf = requestAnimationFrame(loop); }
    });
  }

  /* ------------------------------------------------------------- 设备切换 */
  function initDevices() {
    const btns = $$(".dev-btn");
    if (!btns.length) return;
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.dataset.device;
        btns.forEach(function (b) {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        $$(".device-panel").forEach(function (p) {
          const on = p.id === "panel-" + key;
          p.classList.toggle("active", on);
          if (on) p.removeAttribute("hidden"); else p.setAttribute("hidden", "");
        });
      });
    });
  }

  /* ------------------------------------------------------------------ 启动 */
  function boot() {
    buildTabs("python");
    buildTabs("java");

    const cfgH = document.getElementById("cfgHuawei");
    if (cfgH) cfgH.innerHTML = highlight(SNIP.config.huawei || "", "vrp");
    const cfgC = document.getElementById("cfgCisco");
    if (cfgC) cfgC.innerHTML = highlight(SNIP.config.cisco || "", "ios");

    wireCopy();
    wireExpanders();
    initNav();
    initReveal();
    initCounters();
    initTyped();
    initCanvas();
    initDevices();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
