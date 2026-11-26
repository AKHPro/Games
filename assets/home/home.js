"use strict";
/* Englishia home v1.3. Reads games.json (schema unchanged) and renders a compact shelf of tiles.
   Config comes from window.HOME_CFG (set in index.html):
   { mode: "official"|"preview", games: <url of games.json>, base: <prefix for game paths/thumbnails from that json>,
     site: <prefix of the site root>, demoHref: <where the Demo button goes> } */
(function () {
  var CFG = window.HOME_CFG || {};
  var SITE = CFG.site || "";
  var BASE = CFG.base || "";
  var OFFICIAL = CFG.mode !== "preview" || CFG.dataset === "official";
  var CATEGORY_HE = { All: "הכל", Grammar: "דקדוק", Vocabulary: "אוצר מילים", Reading: "קריאה", Quiz: "בוחן" };
  // Games that have a short root URL (englishia.app/<id>/). Others open via their games.json path.
  var SHORT = ["word-race", "word-detective", "grammar-maze", "mila-quest"];
  // Short one-line descriptions (Hebrew, translated by the language dictionary).
  var LINE = {
    "grammar-maze": "מבוך תלת־ממדי, כל פיצול הוא שאלה",
    "mila-quest": "ריצה תלת־ממדית לאוצר מילים",
    "word-detective": "חלקי דיבור, זמנים ובגרות",
    "word-race": "חידון מירוץ חי לכל הכיתה",
    "sentence-sprint": "מירוץ פלטפורמות לבניית משפטים",
    "word-blast": "יורים בועות עם התשובה הנכונה"
  };
  // Square tile art made for the home (thumbnails in games.json are 16:9 screenshots). Falls back to the game's own thumbnail.
  var ART = {
    "grammar-maze": "grammar-maze.svg", "mila-quest": "mila-quest.jpg", "word-detective": "word-detective.svg",
    "word-race": "word-race.svg", "sentence-sprint": "sentence-sprint.svg", "word-blast": "word-blast.jpg"
  };
  var I_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><circle cx="12" cy="7.4" r=".6" fill="currentColor"/></svg>';
  var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var STAR_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>';
  var DEMO_ICON = '<svg class="hub-demo-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 3h6M10 3v5.2L5.8 19.2A2.2 2.2 0 0 0 7.8 22h8.4a2.2 2.2 0 0 0 2-2.8L14 8.2V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><path d="M8.2 14h7.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  var state = { query: "", category: "All", games: [], categories: [], source: "pending" };
  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function safeRel(v) {
    if (typeof v !== "string") return "";
    var p = v.trim();
    if (!p || p.indexOf("..") >= 0 || p.indexOf("\\") >= 0 || p.indexOf(":") >= 0 || p.charAt(0) === "/") return "";
    return p;
  }
  function normalize(data) {
    var src = Array.isArray(data) ? { categories: [], games: data } : (data || {});
    var games = Array.isArray(src.games) ? src.games.filter(function (g) { return g && typeof g.id === "string" && g.id.trim() && typeof g.title === "string" && g.title.trim(); }) : [];
    var cats = Array.isArray(src.categories) ? src.categories.filter(function (c) { return typeof c === "string" && c.trim(); }) : [];
    return { games: games, categories: cats };
  }
  // The official catalog still has "(Demo)" in one title; do not show it on the official home.
  function cleanTitle(t) { return OFFICIAL ? String(t).replace(/\s*\((demo|דמו)\)\s*$/i, "") : String(t); }
  function cleanDesc(t) { return OFFICIAL ? String(t || "").replace(/^\s*DEMO\s*[·\-–:]\s*/i, "") : String(t || ""); }

  function gameHref(g) {
    if (OFFICIAL && SHORT.indexOf(g.id) >= 0) return SITE + g.id + "/";
    var p = safeRel(g.path);
    return p ? BASE + p : "";
  }
  function artSrc(g) {
    if (ART[g.id]) return SITE + "assets/home/tiles/" + ART[g.id];
    var t = safeRel(g.thumbnail);
    return t ? BASE + t : "";
  }
  function shortLine(g) {
    if (LINE[g.id]) return LINE[g.id];
    var d = cleanDesc(g.description).split(/(?<=[.!?])\s/)[0] || "";
    return d.length > 70 ? d.slice(0, 67).replace(/\s+\S*$/, "") + "…" : d;
  }
  function tagsOf(g) { return Array.isArray(g.tags) ? g.tags.filter(function (t) { return typeof t === "string"; }) : []; }

  function matches(g) {
    if (state.category !== "All" && (g.category || "Other") !== state.category) return false;
    var q = state.query.trim().toLowerCase();
    if (!q) return true;
    var hay = [cleanTitle(g.title), g.subtitleHe, cleanDesc(g.description), shortLine(g), g.level, g.category].concat(tagsOf(g)).join("\n").toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function tileHTML(g) {
    var href = gameHref(g), art = artSrc(g), title = cleanTitle(g.title);
    var he = g.subtitleHe ? String(g.subtitleHe).replace(/\s*\((demo|דמו)\)\s*$/i, "").replace(/\s*\(דמו\)/, "") : "";
    if (!OFFICIAL) he = g.subtitleHe || "";
    var tags = tagsOf(g).slice(0, 2);
    var media = art ? '<img src="' + esc(art) + '" alt="" width="256" height="256" decoding="async" loading="lazy">'
      : '<span class="ph" aria-hidden="true">' + esc(title.charAt(0).toUpperCase()) + "</span>";
    var inner = '<span class="tile-art">' + media +
      (g.featured ? '<span class="feat">' + STAR_ICON + '<span>Featured</span></span>' : "") + "</span>" +
      '<span class="tile-name">' + esc(title) + "</span>" +
      (he ? '<span class="tile-he" lang="he" dir="rtl">' + esc(he) + "</span>" : "") +
      '<span class="tile-line"' + (LINE[g.id] ? ' lang="he" dir="rtl"' : "") + ">" + esc(shortLine(g)) + "</span>" +
      (tags.length ? '<ul class="tile-tags">' + tags.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "");
    var link = href
      ? '<a class="tile-link" href="' + esc(href) + '" data-game="' + esc(g.id) + '" aria-label="' + esc(title + (he ? " · " + he : "")) + '">' + inner + "</a>"
      : '<span class="tile-link">' + inner + "</span>";
    return '<li class="tile">' + link +
      '<button type="button" class="tile-info" data-info="' + esc(g.id) + '" aria-haspopup="dialog" aria-expanded="false" title="מידע על המשחק" aria-label="מידע על המשחק">' + I_ICON + "</button></li>";
  }

  function render() {
    closePop();
    var cats = ["All"];
    var used = state.games.map(function (g) { return (g.category || "").trim(); });
    state.categories.concat(used).forEach(function (c) { c = (c || "").trim(); if (c && used.indexOf(c) >= 0 && cats.indexOf(c) < 0) cats.push(c); });
    if (cats.indexOf(state.category) < 0) state.category = "All";
    $("chips").innerHTML = cats.length > 2 ? cats.map(function (n) {
      return '<button type="button" class="chip" data-category="' + esc(n) + '" aria-pressed="' + (n === state.category) + '"><span>' + esc(n) + "</span>" +
        (CATEGORY_HE[n] ? '<span class="chip-he" lang="he" dir="rtl">' + CATEGORY_HE[n] + "</span>" : "") + "</button>";
    }).join("") : "";
    var list = state.games.filter(matches);
    $("tiles").innerHTML = list.map(tileHTML).join("");
    $("empty").hidden = list.length > 0;
    $("empty").innerHTML = state.query.trim() ? 'No games match “' + esc(state.query.trim()) + '”. <span lang="he" dir="rtl">אין משחקים שמתאימים לחיפוש</span>' : "";
    var loading = $("loading"); if (loading) loading.remove();
  }

  /* ---------- info popover ---------- */
  var pop = null, popFor = null;
  function closePop() {
    if (!pop) return;
    pop.hidden = true;
    if (popFor) { var b = popFor.querySelector(".tile-info"); if (b) b.setAttribute("aria-expanded", "false"); }
    popFor = null;
  }
  function placePop() {
    if (!pop || pop.hidden || !popFor) return;
    var r = popFor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
    var top = r.bottom + 8;
    if (top + h > vh - 8) top = r.top - h - 8;
    if (top < 8) top = Math.max(8, (vh - h) / 2);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function openPop(id, tileEl) {
    var g = state.games.filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    if (!pop) {
      pop = document.createElement("div"); pop.className = "pop"; pop.id = "pop"; pop.hidden = true;
      pop.setAttribute("role", "dialog"); document.body.appendChild(pop);
    }
    if (popFor === tileEl && !pop.hidden) { closePop(); return; }
    closePop();
    var href = gameHref(g), title = cleanTitle(g.title);
    var he = g.subtitleHe ? (OFFICIAL ? String(g.subtitleHe).replace(/\s*\(דמו\)/, "") : g.subtitleHe) : "";
    pop.setAttribute("aria-label", title);
    pop.innerHTML = '<button type="button" class="x" data-close aria-label="סגירה" title="סגירה">' + X_ICON + "</button>" +
      "<h3>" + esc(title) + "</h3>" + (he ? '<p class="he" lang="he" dir="rtl">' + esc(he) + "</p>" : "") +
      (g.level ? '<p class="lvl"' + (/[\u0590-\u05FF]/.test(g.level) ? ' lang="he" dir="rtl"' : "") + ">" + esc(g.level) + "</p>" : "") +
      '<p class="desc">' + esc(cleanDesc(g.description)) + "</p>" +
      (tagsOf(g).length ? "<ul>" + tagsOf(g).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>" : "") +
      (href ? '<a class="go" href="' + esc(href) + '">' + PLAY_ICON + '<span>Open game</span><span lang="he" dir="rtl">פתח משחק</span></a>' : "");
    popFor = tileEl; pop.hidden = false;
    tileEl.querySelector(".tile-info").setAttribute("aria-expanded", "true");
    placePop();
    var x = pop.querySelector(".x"); if (x) x.focus({ preventScroll: true });
  }

  /* ---------- Demo button (owner / tester only; the demo URL itself stays public) ---------- */
  function syncDemoButton() {
    var A = window.EnglishiaAuth, ex = $("hub-demo-btn");
    var show = !!(A && (A.isOwner || A.isTester || A.canSeeDemo)) || (CFG.mode === "preview" && /[?&]demobtn=1\b/.test(location.search));
    if (!show) { if (ex) ex.remove(); return; }
    if (ex) return;
    var inner = document.querySelector(".topbar .bar-inner"); if (!inner) return;
    var a = document.createElement("a");
    a.id = "hub-demo-btn"; a.className = "hub-demo-btn"; a.href = CFG.demoHref || "demo/";
    a.setAttribute("title", "מעבר לאינגלישיה דמו"); a.setAttribute("aria-label", "דמו — מעבר לאינגלישיה דמו");
    a.innerHTML = DEMO_ICON + '<span lang="he" dir="rtl">דמו</span>';
    inner.appendChild(a);
  }
  window.mountEnglishiaDemoButton = function () {
    var A = window.EnglishiaAuth; if (!A) return;
    var go = syncDemoButton;
    if (A.ready) A.ready().then(go).catch(go);
    if (A.onChange) A.onChange(go);
    go();
  };

  /* ---------- events ---------- */
  $("searchForm").addEventListener("submit", function (e) { e.preventDefault(); });
  $("q").addEventListener("input", function (e) { state.query = e.target.value; render(); });
  document.addEventListener("click", function (e) {
    var chip = e.target.closest("[data-category]");
    if (chip) { state.category = chip.getAttribute("data-category") || "All"; render(); return; }
    var info = e.target.closest("[data-info]");
    if (info) { e.preventDefault(); openPop(info.getAttribute("data-info"), info.closest(".tile")); return; }
    if (e.target.closest("[data-close]")) { closePop(); return; }
    if (pop && !pop.hidden && !e.target.closest("#pop")) closePop();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && pop && !pop.hidden) { var t = popFor; closePop(); if (t) t.querySelector(".tile-info").focus(); }
  });
  window.addEventListener("resize", placePop);
  window.addEventListener("scroll", placePop, { passive: true });

  /* ---------- data ---------- */
  function readFallback() {
    try { return normalize(JSON.parse($("games-fallback").textContent)); } catch (e) { return { games: [], categories: [] }; }
  }
  function apply(d, src) { state.games = d.games; state.categories = d.categories; state.source = src; render(); }

  // Old links like englishia.app/#/game/mila-quest go straight to the game.
  function legacyRedirect(games) {
    var m = /^#\/game\/([^\/]+)/.exec(location.hash || "");
    if (!m) return false;
    var id = decodeURIComponent(m[1]);
    var g = games.filter(function (x) { return x.id === id; })[0];
    var href = g && gameHref(g);
    if (href) { location.replace(href); return true; }
    return false;
  }

  apply(readFallback(), "fallback");
  fetch(CFG.games || "games.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) { var d = normalize(j); if (!legacyRedirect(d.games)) apply(d, "live"); })
    .catch(function () { /* keep the built-in list */ });
})();
