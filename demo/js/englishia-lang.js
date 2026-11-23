/* Englishia language switch v1.0 — Hebrew (default) / Arabic / Russian as the student's native language.
   One shared setting: localStorage "englishia-lang" (he | ar | ru). English parts always stay English (LTR).
   Hebrew is the source language. For ar/ru a dictionary (englishia-dict-<lang>.js) is loaded and:
   - data objects (word banks) are swapped in place, keeping the Hebrew original in _he / _name for reports;
   - visible UI text and attributes are translated as they appear (MutationObserver).
   Nothing about scores, ids or saved data depends on the language. */
(function () {
  "use strict";
  if (window.EnglishiaLang) return;
  var KEY = "englishia-lang";
  var LANGS = {
    he: { name: "עברית", dir: "rtl" },
    ar: { name: "العربية", dir: "rtl" },
    ru: { name: "Русский", dir: "ltr" }
  };
  var lang = "he";
  try { var v = localStorage.getItem(KEY); if (LANGS[v]) lang = v; } catch (e) {}
  var qs = /[?&]lang=(he|ar|ru)\b/.exec(location.search);
  if (qs) { lang = qs[1]; try { localStorage.setItem(KEY, lang); } catch (e) {} }

  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/[^\/]*(\?.*)?$/, "") : "";
  var ver = me && /[?&]v=([\w.]+)/.exec(me.src || "");
  ver = ver ? ver[1] : "1";

  var HE = /[\u0590-\u05FF]/;
  var D = null, S = null, N = null, N2 = null, TPL = null;
  var missing = {};

  if (lang !== "he") {
    // Parser-inserted so the dictionary is ready before any game script runs.
    document.write('<script src="' + base + "englishia-dict-" + lang + ".js?v=" + ver + '"><\/script>');
  }

  function norm(s) {
    return String(s).replace(/[\u200d\ufe0f]/g, "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}?!.]+$/gu, "").trim();
  }
  function esc(s) { return s.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }
  function init() {
    if (D || lang === "he") return !!D;
    var src = window.ENGLISHIA_DICT;
    if (!src) return false;
    D = src.d || {}; S = src.s || {}; N = {}; N2 = {}; TPL = [];
    for (var k in D) {
      var nk = norm(k);
      if (nk && !(nk in N)) N[nk] = D[k];
      var n2 = nk.replace(/[.:]+$/, "");
      if (n2 && !(n2 in N2)) N2[n2] = norm(D[k]).replace(/[.:]+$/, "");
      if (k.indexOf("{}") >= 0) {
        var parts = k.trim().split("{}").map(esc);
        try { TPL.push([new RegExp("^" + parts.join("([\\s\\S]+?)") + "$"), D[k].trim()]); } catch (e) {}
      }
    }
    TPL.sort(function (a, b) { return b[0].source.length - a[0].source.length; });
    return true;
  }

  // Translate one string. Returns the input unchanged when nothing matches.
  function core(s, depth) {
    if (s in D) return D[s];
    var n = norm(s);
    if (n && n in N) {
      var i = s.indexOf(n.charAt(0)), pre = s.slice(0, i), post = s.slice(i + n.length);
      if (s.substr(i, n.length) === n) return pre + norm(N[n]) + post;
      return N[n];
    }
    var n2 = n && n.replace(/[.:]+$/, "");
    if (n2 && n2 in N2) {
      var i2 = s.indexOf(n2);
      return i2 >= 0 ? s.slice(0, i2) + N2[n2] + s.slice(i2 + n2.length) : N2[n2];
    }
    if (depth < 2) {
      for (var j = 0; j < TPL.length; j++) {
        var m = TPL[j][0].exec(s);
        if (m) {
          var k = 1, out = TPL[j][1].replace(/\{\}/g, function () { var g = m[k++] || ""; return HE.test(g) ? t(g, depth + 1) : g; });
          return out;
        }
      }
    }
    return null;
  }
  function t(s, depth) {
    if (lang === "he" || s == null) return s;
    s = String(s);
    if (!HE.test(s) || !init()) return s;
    depth = depth || 0;
    var lead = /^\s*/.exec(s)[0], trail = /\s*$/.exec(s)[0], mid = s.trim();
    var r = core(mid, depth);
    if (r != null) return lead + r + trail;
    // Fallback: translate pieces between separators.
    var segs = mid.split(/(\s*[·|•\n–—:()\/]\s*|\s+-\s+)/);
    if (segs.length > 1) {
      var any = false;
      for (var i = 0; i < segs.length; i += 2) {
        var sg = segs[i]; if (!HE.test(sg)) continue;
        var nx = segs[i + 1] || "", rr = null;
        if (/^\s*:/.test(nx)) { rr = core(sg.trim() + ":", depth + 1); if (rr != null) { segs[i] = sg.replace(sg.trim(), rr.replace(/:\s*$/, "")); any = true; continue; } }
        rr = core(sg.trim(), depth + 1);
        if (rr != null) { segs[i] = sg.replace(sg.trim(), rr); any = true; }
        else missing[sg.trim()] = 1;
      }
      if (any) return lead + segs.join("") + trail;
    } else missing[mid] = 1;
    return s;
  }

  // Swap Hebrew strings inside data objects (word banks). Keeps the original Hebrew as _he / _name.
  function tData(v, owner) {
    if (!HE.test(v)) return v;
    var en = owner && typeof owner.en === "string" ? owner.en : null;
    if (en && S[v + "@@" + en]) return S[v + "@@" + en];
    if (v in D) return D[v];
    if (/<[a-z\/]/i.test(v)) {
      return v.split(/(<[^>]+>)/).map(function (p) { return p.charAt(0) === "<" ? p : t(p); }).join("");
    }
    return t(v);
  }
  function swapData(obj) {
    if (lang === "he" || !init() || !obj) return obj;
    var seen = new Set();
    (function walk(o) {
      if (!o || typeof o !== "object" || seen.has(o)) return;
      seen.add(o);
      var keys = Array.isArray(o) ? null : Object.keys(o);
      if (keys) {
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i], val = o[k];
          if (typeof val === "string") {
            if (k.charAt(0) === "_") continue;
            var nv = tData(val, o);
            if (nv !== val) {
              if ((k === "he" || k === "name") && !("_" + k in o)) Object.defineProperty(o, "_" + k, { value: val, enumerable: false, writable: true });
              try { o[k] = nv; } catch (e) {}
            }
          } else walk(val);
        }
      } else {
        for (var j = 0; j < o.length; j++) {
          if (typeof o[j] === "string") { var nj = tData(o[j], null); if (nj !== o[j]) o[j] = nj; }
          else walk(o[j]);
        }
      }
    })(obj);
    return obj;
  }

  /* ---------- live DOM translation ---------- */
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "data-tip"];
  function skip(el) {
    for (var p = el; p && p.nodeType === 1; p = p.parentNode) {
      if (p.getAttribute("translate") === "no" || p.classList.contains("el-noi18n")) return true;
      var tn = p.tagName; if (tn === "SCRIPT" || tn === "STYLE" || tn === "TEXTAREA" || tn === "NOSCRIPT") return true;
      if (tn === "INPUT" && p.type !== "button" && p.type !== "submit") return true;
    }
    return false;
  }
  function fixLangAttr(el) {
    if (el.getAttribute && el.getAttribute("lang") === "he") {
      el.setAttribute("lang", lang); el.setAttribute("dir", LANGS[lang].dir);
    }
  }
  function doText(n) {
    var v = n.nodeValue;
    if (!v || !HE.test(v) || !n.parentNode || skip(n.parentNode)) return;
    var r = t(v);
    if (r !== v) {
      n.nodeValue = r;
      if (lang === "ru") {
        var pe = n.parentNode.closest && n.parentNode.closest("[dir=rtl]");
        if (pe && pe !== document.documentElement && !HE.test(pe.textContent)) pe.setAttribute("dir", "ltr");
      }
    }
  }
  function doEl(el) {
    if (el.nodeType !== 1 || skip(el)) return;
    fixLangAttr(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && HE.test(a)) { var r = t(a); if (r !== a) el.setAttribute(ATTRS[i], r); }
    }
    if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && HE.test(el.value)) el.value = t(el.value);
  }
  function doTree(root) {
    if (!root) return;
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || skip(root)) return;
    doEl(root);
    var w = document.createTreeWalker(root, 5, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  var lastTitle = "";
  function doTitle() {
    if (document.title !== lastTitle && HE.test(document.title)) document.title = t(document.title);
    lastTitle = document.title;
  }
  var domOn = false;
  function startDom() {
    if (domOn || lang === "he" || !init()) return;
    domOn = true;
    doTree(document.documentElement); doTitle();
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) doTree(m.addedNodes[j]);
      }
      doTitle();
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["lang", "value"]) });
  }

  // Native dialogs
  if (lang !== "he") {
    ["alert", "confirm", "prompt"].forEach(function (f) {
      var o = window[f]; if (!o) return;
      window[f] = function (msg, def) { return o.call(window, t(msg), def); };
    });
  }

  /* ---------- page direction, fonts ---------- */
  function applyRoot() {
    var h = document.documentElement;
    h.setAttribute("data-el-lang", lang);
    if (lang === "he") return;
    var wasHe = h.getAttribute("lang") === "he" || h.getAttribute("dir") === "rtl";
    if (wasHe) { h.setAttribute("lang", lang); h.setAttribute("dir", LANGS[lang].dir); }
  }
  applyRoot();
  var css = document.createElement("style");
  css.textContent =
    "html[data-el-lang=ar] body{font-family:Rubik,'Segoe UI',Tahoma,Arial,sans-serif}" +
    "html[data-el-lang=ru] body{font-family:Rubik,'Segoe UI',Arial,sans-serif}" +
    ".el-lang{position:fixed;z-index:2147483000;top:8px;left:50%;transform:translateX(-50%);font:600 13px/1 'Segoe UI',Tahoma,Arial,sans-serif;direction:ltr}" +
    ".el-lang.el-inline{position:relative;top:auto;left:auto;transform:none;display:inline-block;margin:0 6px;vertical-align:middle}" +
    ".el-lang.el-inline.el-center{display:flex;justify-content:center;margin:0 auto 8px}" +
    ".el-lang>button{display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:16px;border:1px solid rgba(255,255,255,.35);background:rgba(20,24,31,.82);color:#fff;cursor:pointer;font:inherit}" +
    ".el-lang>button svg{width:16px;height:16px;flex:none}" +
    ".el-lang .el-menu{position:absolute;top:36px;left:50%;transform:translateX(-50%);min-width:130px;background:#14181f;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:4px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.4)}" +
    ".el-lang.open .el-menu{display:block}" +
    ".el-lang .el-menu button{display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:0;border-radius:7px;background:none;color:#fff;cursor:pointer;font:600 15px/1.2 'Segoe UI',Tahoma,Arial,sans-serif}" +
    ".el-lang .el-menu button:hover,.el-lang .el-menu button[aria-checked=true]{background:rgba(255,255,255,.14)}" +
    ".el-lang .el-menu svg{width:14px;height:14px}" +
    "@media print{.el-lang{display:none}}";
  (document.head || document.documentElement).appendChild(css);

  var GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 12h19M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5c-2.6-2.7-3.9-5.9-3.9-9.5s1.3-6.8 3.9-9.5z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function setLang(l) {
    if (!LANGS[l] || l === lang) return;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    var u = location.href.replace(/([?&])lang=(he|ar|ru)&?/, "$1").replace(/[?&]$/, "");
    if (u !== location.href) location.replace(u); else location.reload();
  }
  function mount(target, opts) {
    opts = opts || {};
    if (document.querySelector(".el-lang")) return;
    var box = document.createElement("div");
    box.className = "el-lang" + (target ? " el-inline" : "") + (opts.prepend ? " el-center" : "");
    box.setAttribute("translate", "no");
    var b = document.createElement("button");
    b.type = "button"; b.id = "el-lang-btn";
    b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-label", "Language / שפה / اللغة / Язык");
    b.title = "שפה · اللغة · Язык";
    b.innerHTML = GLOBE + "<span>" + LANGS[lang].name + "</span>";
    var menu = document.createElement("div");
    menu.className = "el-menu"; menu.setAttribute("role", "menu");
    Object.keys(LANGS).forEach(function (k) {
      var o = document.createElement("button");
      o.type = "button"; o.setAttribute("role", "menuitemradio"); o.setAttribute("aria-checked", String(k === lang));
      o.setAttribute("data-lang", k); o.dir = LANGS[k].dir; o.lang = k;
      o.innerHTML = "<span>" + LANGS[k].name + "</span>" + (k === lang ? CHECK : "");
      o.onclick = function (e) { e.stopPropagation(); setLang(k); };
      menu.appendChild(o);
    });
    b.onclick = function (e) { e.stopPropagation(); box.classList.toggle("open"); };
    document.addEventListener("click", function () { box.classList.remove("open"); });
    box.appendChild(b); box.appendChild(menu);
    if (opts.style) box.setAttribute("style", opts.style);
    var host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) box.className = "el-lang";
    if (host && opts.prepend) host.insertBefore(box, host.firstChild); else (host || document.body).appendChild(box);
    ["pointerdown", "mousedown", "touchstart", "keydown"].forEach(function (ev) { box.addEventListener(ev, function (e) { e.stopPropagation(); }); });
  }

  window.EnglishiaLang = {
    lang: lang, dir: LANGS[lang].dir, langs: LANGS, key: KEY,
    t: function (s) { return t(s); }, swapData: swapData, mount: mount, set: setLang,
    isRTL: function () { return LANGS[lang].dir === "rtl"; },
    nativeName: function () { return { he: "עברית", ar: "العربية", ru: "Русский" }[lang]; },
    missing: function () { return Object.keys(missing); },
    _ready: function () { init(); startDom(); }
  };
  window.addEventListener("storage", function (e) { if (e.key === KEY && e.newValue && e.newValue !== lang && LANGS[e.newValue]) location.reload(); });

  function ready() { startDom(); if (!(me && me.hasAttribute("data-nomount"))) mount(me && me.getAttribute("data-mount"), { style: me && me.getAttribute("data-style"), prepend: !!(me && me.hasAttribute("data-prepend")) }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
