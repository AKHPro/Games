/* Word Blast 1.0 · פיצוץ מילים - English bubble shooter for the classroom (projector) and phones.
   Design: Imagina (handoff/README.md). (c) 2026 Amir · Englishia · All rights reserved */
import { ICONS } from "./icons.js";
import { LEVELS, levelOf, AGES, TYPES, typeOf, buildLevel, parseTeacher, TEACHER_SAMPLE, sameWord, PROMPTS_PER_LEVEL } from "./content.js";
import { createBoard, COLORS } from "./board.js";

const VERSION = "1.0";
const GAME_ID = "word-blast";
const DEMO = /\/demo\//.test(location.pathname);
const HUB = DEMO ? "../" : "../../";
const LANG = (window.EnglishiaLang && EnglishiaLang.lang) || "he";
const DIR = (window.EnglishiaLang && EnglishiaLang.dir) || "rtl";

/* ======== LAYOUT: every size of the play screen lives here (bubble size D, cannon scale, columns) ======== */
const LAYOUT = {
  desk: {
    stageW: 1920, stageH: 1080,
    board: { x: 455, y: 14, w: 1010, h: 962 },   // the glass play area (design px)
    prompt: { x: 455, y: 988, w: 1010, h: 84 },
    D: 140, cols: 7,                              // bubble diameter and bubbles per row (6 on the offset rows), as in the v1 design
    cannon: 0.8, loaded: 1.0,                     // shooter sprite scale (x D) and loaded-ball size (x D)
    wordFs: 0.27, wordMin: 22, labelMax: 1.45,    // word size (x D), smallest word size in px, widest label (x D) for very long words
    dangerGap: 0.85, dotGap: 0.25, speed: 130, basketW: 1.25, basketPts: 50, shooterPad: 1.36
  },
  phone: {
    stageW: 390,
    D: 72, cols: 5, cannon: 0.8, loaded: 1.0, wordFs: 0.27, wordMin: 13, labelMax: 1.45,
    dangerGap: 0.85, dotGap: 0.24, speed: 125, basketW: 1.25, basketPts: 50, shooterPad: 1.36
  }
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const EXTRA = {
  "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'
};
function ico(n, size = 24, sw, color) {
  const inner = ICONS[n] || EXTRA[n] || ICONS.help;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color || "currentColor"}" stroke-width="${sw || 2.6}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}
const FWD = DIR === "ltr" ? "arrow-right" : "arrow-left", BACK = DIR === "ltr" ? "arrow-left" : "arrow-right";
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const fmtN = (n) => Math.round(n).toLocaleString("en-US");
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const now = () => performance.now() / 1000;
const authUser = () => { try { return window.EnglishiaAuth && EnglishiaAuth.user; } catch (e) { return null; } };

/* translate a Hebrew string for attributes and inputs, which the page translator does not reach */
const trL = (s) => (window.EnglishiaLang && EnglishiaLang.lang !== "he" && EnglishiaLang.t ? EnglishiaLang.t(s) : s);
/* ---------- settings + saved data ---------- */
const PREF = Object.assign({ type: "gap", level: "normal", age: "y12" }, LS.get("wb-settings", {}));
if (!LEVELS.some((l) => l.k === PREF.level)) PREF.level = "normal";
if (!AGES.some((a) => a.k === PREF.age)) PREF.age = "y12";
if (!TYPES.some((t) => t.k === PREF.type)) PREF.type = "gap";
const savePref = () => LS.set("wb-settings", PREF);
let SAVE = Object.assign({ best: {}, stage: {} }, LS.get("wb-save", {}));
let TEACH = Object.assign({ title: "", text: "" }, LS.get("wb-teacher", {}));
const keyOf = () => `${PREF.type}:${PREF.level}:${PREF.type === "teacher" ? "t" : PREF.age}`;
const bestOf = () => SAVE.best[keyOf()] || 0;
const stageOf = () => SAVE.stage[keyOf()] || 1;
let MUTE = !!LS.get("wb-mute", false);

/* shared teacher list in the link: #list=<base64url JSON> */
function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64d(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
let SHARED_LOADED = false;
try {
  const m = /[#&]list=([\w-]+)/.exec(location.hash);
  if (m) { const o = JSON.parse(b64d(m[1])); if (o && typeof o.x === "string") { TEACH = { title: String(o.t || "").slice(0, 60), text: o.x.slice(0, 6000) }; LS.set("wb-teacher", TEACH); PREF.type = "teacher"; savePref(); SHARED_LOADED = true; } }
} catch (e) {}
const teacherList = () => parseTeacher(TEACH.text);

/* ---------- sound + speech (tiny WebAudio blips, no files) ---------- */
let AC = null;
function beep(fr, d = 0.12, type = "sine", v = 0.12, delay = 0, to) {
  if (MUTE) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume().catch(() => {});
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(fr, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) {}
}
const SFX = {
  tap: () => beep(520, 0.06, "triangle", 0.07),
  shoot: () => beep(300, 0.14, "triangle", 0.09, 0, 900),
  stick: () => beep(220, 0.08, "square", 0.04),
  pop: (i = 0) => beep(620 + i * 90, 0.09, "triangle", 0.1, i * 0.05),
  ok: () => { beep(660, 0.1, "triangle"); beep(990, 0.18, "triangle", 0.12, 0.09); },
  no: () => beep(190, 0.28, "sawtooth", 0.06),
  basket: () => beep(1250, 0.06, "sine", 0.06),
  drop: () => beep(160, 0.4, "square", 0.05, 0, 90),
  win: () => [523, 659, 784, 1047].forEach((fr, i) => beep(fr, 0.2, "triangle", 0.12, i * 0.12)),
  lose: () => [392, 330, 262].forEach((fr, i) => beep(fr, 0.26, "triangle", 0.1, i * 0.16))
};
const CAN_SPEAK = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
function speak(text) {
  if (!CAN_SPEAK || !text || MUTE) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.9;
    const vs = speechSynthesis.getVoices(), v = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v; speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- images ---------- */
const IMG = {};
function loadImages() {
  const names = ["shooter-base", "shooter-barrel", "shot-counter"];
  COLORS.forEach((c) => { names.push(`ball-${c}-plain`, `ball-${c}`); [1, 2, 3].forEach((i) => names.push(`burst-${c}-${i}`)); });
  ["cyan", "pink"].forEach((c) => names.push(`basket-${c}-back`, `basket-${c}-front`));
  return Promise.all(names.map((n) => new Promise((res) => { const i = new Image(); i.onload = () => { IMG[n] = i; res(); }; i.onerror = res; i.src = `img/${n}.png?v=${VERSION}`; })));
}
const owl = (pose, sm) => `img/owl-${pose}${sm ? "-sm" : ""}.png?v=${VERSION}`;

/* ---------- stage scaling (fixed design sizes) ---------- */
const stage = $("#stage");
stage.style.direction = DIR; stage.classList.toggle("ltr", DIR === "ltr");
let MOBILE = false, SCALE = 1, MH = 844, LOCK = false;
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const m = LOCK ? MOBILE : vw < 700 || vw / vh < 0.75;
  const changed = m !== MOBILE; MOBILE = m;
  stage.classList.toggle("m", m); stage.classList.toggle("d", !m);
  if (m) {
    SCALE = Math.min(vw / 390, vh / 640); MH = Math.max(640, Math.round(vh / SCALE));
    stage.style.width = "390px"; stage.style.height = MH + "px";
    stage.style.left = Math.round((vw - 390 * SCALE) / 2) + "px"; stage.style.top = "0px";
  } else {
    SCALE = Math.min(vw / 1920, vh / 1080); stage.style.width = "1920px"; stage.style.height = "1080px";
    stage.style.left = Math.round((vw - 1920 * SCALE) / 2) + "px"; stage.style.top = Math.round((vh - 1080 * SCALE) / 2) + "px";
  }
  stage.style.transform = `scale(${SCALE})`;
  return changed;
}
let VIEW = { name: "", render: null };
function show(name, render) { VIEW = { name, render }; render(); stage.scrollTop = 0; }
let rsz = 0;
window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { const ch = fit(); if (VIEW.name === "game") relayout(); else if (ch && VIEW.render) VIEW.render(); }, 120); });

/* ---------- shared top parts ---------- */
function mountShared() {
  try { if (window.EnglishiaLang && $("#langSlot") && !$("#langSlot .el-lang")) EnglishiaLang.mount("#langSlot"); } catch (e) {}
  try { if (window.EnglishiaAuth && $("#engSlot") && !$("#engSlot").children.length) EnglishiaAuth.mountMenu("#engSlot"); } catch (e) {}
}
window.WBApp = { onAuth() { if (VIEW.name === "menu") { mountShared(); paintBest(); } syncCloud(); } };
const backBtn = () => `<a class="gbtn backbtn" id="bHub" href="${HUB}" title="חזרה לאינגלישיה">${ico(BACK, MOBILE ? 22 : 30, 3)}<span>${MOBILE ? "אנגלישיה" : "חזרה לאנגלישיה"}</span></a>`;
const soundBtn = () => `<button class="gbtn iconbtn" id="bSound" aria-label="צליל" title="צליל">${ico(MUTE ? "volume-x" : "volume-on", MOBILE ? 22 : 30, 2.6)}</button>`;
function wireSound() { const s = $("#bSound"); if (s) s.onclick = () => { MUTE = !MUTE; LS.set("wb-mute", MUTE); s.innerHTML = ico(MUTE ? "volume-x" : "volume-on", MOBILE ? 22 : 30, 2.6); if (!MUTE) SFX.tap(); else try { speechSynthesis.cancel(); } catch (e) {} }; }
function credit() {
  const l1 = `© 2026 Amir · Englishia · All rights reserved · Word Blast ${DEMO ? "Demo version " : "Version "}${VERSION}`;
  const l2 = `© 2026 אמיר · אינגלישיה · כל הזכויות שמורות · ${DEMO ? "גרסת דמו " : "גרסה "}${VERSION}`;
  return `<div class="credit" id="wb-credit"><div dir="ltr">${esc(l1)}</div><div dir="rtl">${esc(l2)}</div></div>`;
}
const bokeh = () => `<div class="bokeh b1"></div><div class="bokeh b2"></div><div class="bokeh b3"></div>`;
function toast(msg, kind = "") { const t = document.createElement("div"); t.className = "toast " + kind; t.textContent = msg; stage.appendChild(t); setTimeout(() => t.classList.add("out"), 2200); setTimeout(() => t.remove(), 2700); }
const deco = (w, c, x, y, s, r) => `<div class="deco" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${r}deg)"><img src="img/ball-${c}.png?v=${VERSION}" alt=""><span class="en" style="font-size:${s * 0.2}px">${w}</span></div>`;

/* ================= MENU ================= */
function menuScreen() {
  LOCK = false; fit(); stopLoop();
  show("menu", () => {
    const tl = teacherList();
    const types = TYPES.map((t) => {
      const on = PREF.type === t.k;
      const ex = t.k === "teacher" ? (tl.items.length ? `<span class="tc-ex"><b class="en">${tl.items.length}</b> <span>שורות</span>${TEACH.title ? ` · <span class="tt">${esc(TEACH.title)}</span>` : ""}</span>` : `<span class="tc-ex">עדיין אין רשימה</span>`) : `${t.k === "trans" ? `<span class="tc-ex"><span>${LANG === "ar" ? "كلب" : LANG === "ru" ? "собака" : "כלב"}</span> ${DIR === "rtl" ? "←" : "→"} <span class="en">dog</span></span>` : `<span class="tc-ex en">${esc(t.ex)}</span>`}`;
      return `<button class="tcard${on ? " on" : ""}" data-type="${t.k}" id="type-${t.k}" role="radio" aria-checked="${on}"><span class="radio"></span><span class="tc-txt"><span class="tc-t">${t.he}</span>${ex}</span><span class="tc-ic ic-${t.k}">${ico(t.ico, MOBILE ? 22 : 30, 2.6)}</span></button>`;
    }).join("");
    const lv = LEVELS.map((l, i) => `<button class="lvbtn${PREF.level === l.k ? " on" : ""}" data-lv="${l.k}" id="lv-${l.k}"><span>${l.he}</span><span class="bars">${[0, 1, 2, 3, 4].map((b) => `<i class="${b <= i ? "f" : ""}"></i>`).join("")}</span></button>`).join("");
    const ages = AGES.map((a) => `<button class="agebtn${PREF.age === a.k ? " on" : ""}" data-age="${a.k}">${a.he}</button>`).join("");
    const how = `<div class="how glass"><div class="kick">${ico("help", MOBILE ? 18 : 24)}<span>איך משחקים</span></div><div class="how-steps"><span><b>1</b>קוראים</span><span><b>2</b>מכוונים</span><span><b>3</b>קולעים במילה</span></div></div>`;
    const decoBalls = MOBILE ? deco("went", "orange", 300, 96, 64, 10) + deco("because", "blue", 8, 120, 66, -12) :
      deco("because", "blue", 40, 260, 168, -10) + deco("went", "orange", 930, 150, 140, 12) + deco("early", "teal", 980, 520, 120, 0) + deco("bright", "green", 50, 740, 130, 8) + deco("have", "red", 610, 820, 120, -8) + deco("always", "violet", 350, 580, 100, 14);
    stage.innerHTML = `<section class="scr on menu" id="s-menu">${bokeh()}
      <div class="topbar"><div class="grp">${backBtn()}${MOBILE ? "" : '<span id="engSlot"></span>'}</div><div class="grp">${soundBtn()}<span id="langSlot"></span></div></div>
      ${decoBalls}
      <div class="logo"><div class="lg1 en" translate="no">Word</div><div class="lg2 en" translate="no">Blast</div><div class="lgsub">פיצוץ מילים</div></div>
      <img class="owl-menu" src="${owl("idle", MOBILE)}" alt="Lexi">
      ${MOBILE ? "" : how}
      <div class="panel glass">
        <div class="kick">${ico("puzzle", MOBILE ? 18 : 26)}<span>סוג המשימה</span></div>
        <div class="types" role="radiogroup">${types}</div>
        <button class="gbtn tedit" id="bTeacher">${ico("pencil", MOBILE ? 18 : 24)}<span>רשימה של המורה: יצירה ועריכה</span></button>
        <div class="kick">${ico("gauge", MOBILE ? 18 : 26)}<span>רמת קושי</span></div>
        <div class="levels">${lv}</div>
        <div class="agerow${PREF.type === "trans" || PREF.type === "gap" ? "" : " dim"}"><span class="kick sm">שכבת גיל</span><div class="ages">${ages}</div></div>
        <button class="btn orange play" id="bPlay">${ico("play", MOBILE ? 26 : 40, 3)}<span>שחקו!</span></button>
        <div class="bestline" id="bestLine"></div>
      </div>
      ${MOBILE ? how + '<div class="m-acc"><span id="engSlot"></span></div>' : ""}
      ${credit()}
    </section>`;
    mountShared(); wireSound(); paintBest();
    $$(".tcard").forEach((b) => (b.onclick = () => { SFX.tap(); if (b.dataset.type === "teacher" && !teacherList().items.length) { teacherScreen(); return; } PREF.type = b.dataset.type; savePref(); VIEW.render(); }));
    $$(".lvbtn").forEach((b) => (b.onclick = () => { SFX.tap(); PREF.level = b.dataset.lv; savePref(); VIEW.render(); }));
    $$(".agebtn").forEach((b) => (b.onclick = () => { SFX.tap(); PREF.age = b.dataset.age; savePref(); VIEW.render(); }));
    $("#bTeacher").onclick = () => { SFX.tap(); teacherScreen(); };
    $("#bPlay").onclick = () => { SFX.tap(); startLevel(); };
  });
  if (SHARED_LOADED) { SHARED_LOADED = false; setTimeout(() => toast("רשימה של המורה נטענה מהקישור", "ok"), 300); }
}
function paintBest() {
  const el = $("#bestLine"); if (!el) return;
  let rank = "";
  try { const u = authUser(); if (u && EnglishiaAuth.ranks && EnglishiaAuth.ranks.mine) { const r = EnglishiaAuth.ranks.mine(); if (r) rank = EnglishiaAuth.ranks.chip(r, MOBILE ? 22 : 28); } } catch (e) {}
  el.innerHTML = `${ico("trophy", MOBILE ? 18 : 24)}<span>השיא שלך:</span> <b class="en">${fmtN(bestOf())}</b> · <span>שלב</span> <b class="en">${stageOf()}</b>${rank ? `<span class="rk">${rank}</span>` : ""}`;
}

/* ================= TEACHER LIST ================= */
function teacherScreen() {
  LOCK = false; fit(); stopLoop();
  show("teacher", () => {
    stage.innerHTML = `<section class="scr on teacher" id="s-teacher">${bokeh()}
      <div class="topbar"><div class="grp"><button class="gbtn backbtn" id="bBack">${ico(BACK, MOBILE ? 22 : 30, 3)}<span>לתפריט</span></button></div><div class="grp"><span id="langSlot"></span></div></div>
      <div class="tpanel glass">
        <h1>${ico("book", MOBILE ? 26 : 40)}<span>רשימה של המורה</span></h1>
        <p class="hint">כל שורה היא משימה אחת: <b>שאלה או משפט</b> | <b>התשובה הנכונה</b> | <b>תשובות שגויות</b> (לא חובה, מופרדות בפסיק). במשפט להשלמה כותבים ___ במקום החסר.</p>
        <div class="ex en" dir="ltr">${esc(trL(TEACHER_SAMPLE)).replace(/\n/g, "<br>")}</div>
        <label class="lbl" for="tTitle">שם הרשימה</label>
        <input id="tTitle" maxlength="60" value="${esc(TEACH.title)}" placeholder="${esc(trL("למשל: Past Simple · כיתה י׳ 3"))}">
        <label class="lbl" for="tText">המשימות</label>
        <textarea id="tText" dir="auto" spellcheck="false" placeholder="${esc(trL(TEACHER_SAMPLE))}">${esc(TEACH.text)}</textarea>
        <div class="tstat" id="tStat"></div>
        <div class="tbtns">
          <button class="btn green sm" id="tSave">${ico("save", 24)}<span>שמירה ומשחק</span></button>
          <button class="btn blue sm" id="tLink">${ico("link", 24)}<span>קישור לתלמידים</span></button>
          <button class="btn wbtn sm" id="tSample">${ico("lightbulb", 24)}<span>דוגמה</span></button>
          <button class="btn red sm" id="tClear">${ico("trash", 24)}<span>ניקוי</span></button>
        </div>
        <div class="tshare" id="tShare" hidden></div>
        <p class="hint sm">הרשימה נשמרת במכשיר הזה${authUser() ? " ובחשבון שלך" : ""}. התלמידים פותחים את הקישור או סורקים את הקוד ומשחקים עם אותה רשימה.</p>
      </div>
      ${credit()}
    </section>`;
    mountShared();
    const stat = () => {
      const r = parseTeacher($("#tText").value);
      $("#tStat").innerHTML = `<span class="okc">${ico("check", 20)}<b class="en">${r.items.length}</b> <span>משימות תקינות</span></span>` +
        (r.bad.length ? `<span class="badc">${ico("x", 20)}<b class="en">${r.bad.length}</b> <span>שורות עם בעיה</span>: ${r.bad.slice(0, 3).map((b) => `<span class="bl"><span>שורה</span> <b class="en">${b.n}</b> (<span>${esc(b.why)}</span>)</span>`).join(" · ")}</span>` : "");
      return r;
    };
    stat(); $("#tText").oninput = stat;
    const store = () => { TEACH = { title: $("#tTitle").value.trim(), text: $("#tText").value }; LS.set("wb-teacher", TEACH); syncCloud(true); };
    $("#bBack").onclick = () => { store(); menuScreen(); };
    $("#tSample").onclick = () => { if (!$("#tText").value.trim()) $("#tText").value = trL(TEACHER_SAMPLE); else $("#tText").value = $("#tText").value.replace(/\s*$/, "\n") + trL(TEACHER_SAMPLE); stat(); };
    $("#tClear").onclick = () => { if ($("#tText").value.trim() && !confirm("למחוק את כל הרשימה?")) return; $("#tText").value = ""; $("#tTitle").value = ""; stat(); store(); $("#tShare").hidden = true; };
    $("#tSave").onclick = () => { const r = stat(); if (!r.items.length) { toast("אין עדיין משימות תקינות", "bad"); return; } store(); PREF.type = "teacher"; savePref(); startLevel(); };
    $("#tLink").onclick = () => {
      const r = stat(); if (!r.items.length) { toast("אין עדיין משימות תקינות", "bad"); return; } store();
      const url = location.origin + location.pathname + "#list=" + b64e(JSON.stringify({ t: TEACH.title, x: TEACH.text }));
      let qr = ""; try { const q = qrcode(0, "L"); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) {}
      const sh = $("#tShare"); sh.hidden = false;
      sh.innerHTML = `${qr ? `<div class="qr">${qr}</div>` : ""}<div class="sl"><input readonly dir="ltr" value="${esc(url)}" id="tUrl"><button class="btn wbtn sm" id="tCopy">${ico("link", 22)}<span>העתקה</span></button></div>`;
      $("#tCopy").onclick = () => { const i = $("#tUrl"); i.select(); let ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(url); ok = true; } else ok = document.execCommand("copy"); } catch (e) {} toast(ok ? "הקישור הועתק" : "סמנו והעתיקו את הקישור", ok ? "ok" : ""); };
    };
  });
}

/* ================= GAME ================= */
let G = null, board = null, raf = 0, lastT = 0;
function startLevel(again) {
  const L = levelOf(PREF.level);
  const prompts = buildLevel({ type: PREF.type, level: PREF.level, age: PREF.age, seed: (Date.now() ^ (stageOf() * 7919)) >>> 0, teacher: teacherList() });
  if (!prompts.length) { toast("אין משימות לרשימה הזאת", "bad"); return; }
  G = { L, prompts, i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, firstTry: 0, wordHits: 0, mistakes: 0, tries: 0, hints: L.hints, practised: [], review: [],
    start: now(), pausedFor: 0, pauseAt: 0, paused: false, over: false, qStart: now(), stage: stageOf(), key: keyOf(), type: PREF.type, timeLeft: L.timer || 0, wrongOnThis: false };
  LOCK = true; fit();
  show("game", gameScreen);
}
function boardLayout() {
  const P = MOBILE ? LAYOUT.phone : LAYOUT.desk;
  let bx, by, bw, bh;
  if (MOBILE) { bx = 6; by = 112; bw = 378; bh = MH - by - 112 - 66 - 10; }
  else ({ x: bx, y: by, w: bw, h: bh } = P.board);
  const D = P.D, inner = D * P.cols, mx = (bw - inner) / 2;
  const pivotY = bh - D * P.shooterPad * (P.cannon / 0.8) - (MOBILE ? 4 : 8);
  const bw2 = D * P.basketW;
  return { bx, by, bw, bh, L: Object.assign({}, P, { W: bw, H: bh, mx, top: MOBILE ? 6 : 10, pivotY, scale: SCALE, showAim: true,
    baskets: [{ x: mx + bw2 * 0.5, y: bh - bw2 * 0.42, w: bw2 }, { x: bw - mx - bw2 * 0.5, y: bh - bw2 * 0.42, w: bw2 }], basketPts: Math.round(P.basketPts * G.L.mul) }) };
}
function gameScreen() {
  const { bx, by, bw, bh, L } = boardLayout();
  const promptBox = MOBILE ? { x: 6, y: by + bh + 8, w: 378, h: 98 } : LAYOUT.desk.prompt;
  const hud = MOBILE ? `
      <div class="topbar">${`<div class="grp">${backBtn()}</div>`}<div class="grp"><button class="gbtn iconbtn" id="bPause" aria-label="השהיה" title="השהיה">${ico("pause", 22)}</button>${soundBtn()}<span id="langSlot"></span></div></div>
      <div class="mhud"><div class="pill sc">${ico("star", 18)}<b class="en" id="hScore">0</b></div><div class="pill lvl"><span>${G.L.he}</span> · <span>שלב</span> <b class="en">${G.stage}</b></div>
        <div class="pill prog">${ico("target", 18)}<b class="en" id="hProg">0/${G.prompts.length}</b><span class="bar"><i id="hBar"></i></span></div></div>` : `
      <div class="lcol">
        <div class="grp">${soundBtn()}<button class="gbtn iconbtn" id="bPause" aria-label="השהיה" title="השהיה">${ico("pause", 30)}</button><button class="gbtn iconbtn" id="bFull" aria-label="מסך מלא" title="מסך מלא">${ico("maximize", 28)}</button></div>
        <div id="langSlot" class="lslot"></div>
        <div class="card glass nextcard"><div class="kick">${ico("circle-dot", 24)}<span>הכדור הבא</span></div><div class="nextrow"><img id="nextBall" alt=""><button class="gbtn swapbtn" id="bSwap">${ico("swap", 26)}<span>החלפה</span></button></div></div>
        <button class="btn yellow hintbtn" id="bHint">${ico("lightbulb", 30)}<span>רמז</span><b class="en hn" id="hHints">${G.hints}</b></button>
        <img class="owl-game" id="owl" src="${owl("idle")}" alt="Lexi">
      </div>
      <div class="rcol">
        ${backBtn()}
        <div class="card glass"><div class="kick">${ico("star", 24)}<span>ניקוד</span></div><div class="big en" id="hScore">0</div><div class="sub"><span>שיא:</span> <b class="en">${fmtN(bestOf())}</b></div></div>
        <div class="card glass"><div class="kick">${ico("gauge", 24)}<span>רמת קושי</span></div><div class="lvrow"><span class="lvchip" style="--c:${G.L.color}">${G.L.he}</span><span class="stg"><span>שלב</span> <b class="en">${G.stage}</b></span></div>
          <div class="timer"><span class="kick sm">${ico("clock", 22)}<span>זמן</span></span><b class="en" id="hTime">00:00</b></div></div>
        <div class="card glass"><div class="kick">${ico("target", 24)}<span>${G.type === "gap" ? "משפטים" : "משימות"}</span><b class="en pr" id="hProg">0/${G.prompts.length}</b></div><div class="bar"><i id="hBar"></i></div><div class="stars" id="hStars">${[0, 1, 2].map(() => ico("star", 34, 2.4)).join("")}</div></div>
        <div class="card glass strk"><div class="kick">${ico("flame", 24)}<span>רצף תשובות</span></div><b class="en big2" id="hStreak">×0</b></div>
      </div>`;
  const mBottom = MOBILE ? `<div class="mbottom" style="top:${promptBox.y + promptBox.h + 8}px">
      <button class="btn yellow hintbtn" id="bHint">${ico("lightbulb", 22)}<span>רמז</span><b class="en hn" id="hHints">${G.hints}</b></button>
      <div class="mnext"><button class="gbtn swapbtn" id="bSwap">${ico("swap", 20)}<span>החלפה</span></button><img id="nextBall" alt=""><span class="nl">הבא</span></div>
      <img class="owl-m" id="owl" src="${owl("idle", true)}" alt="Lexi"></div>` : "";
  stage.innerHTML = `<section class="scr on game" id="s-game">${bokeh()}
    ${hud}
    <div class="board" id="board" style="left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px"><canvas id="cv" aria-label="לוח הכדורים"></canvas>
      <div class="fb" id="fb" hidden></div></div>
    <div class="prompt glass" id="prompt" style="left:${promptBox.x}px;top:${promptBox.y}px;width:${promptBox.w}px;height:${promptBox.h}px"></div>
    ${mBottom}
    <div class="overlay" id="ov" hidden></div>
  </section>`;
  mountShared(); wireSound();
  const cv = $("#cv");
  board = createBoard(cv, IMG, { result: onResult, sound: (k) => SFX[k] && SFX[k]() });
  board.layout(L);
  board.reset({ colors: G.L.colors, aimHelp: G.L.aimHelp, shots: G.L.shots, rows: G.L.rows, filler: makeFiller() });
  wireGame(cv);
  nextPrompt(true);
  startLoop();
}
/* words for all the other bubbles: words of this level's prompts (as in the design), never the current answer */
function makeFiller() {
  const pool = (G.prompts.fillers || []).slice();
  let bag = [];
  return (avoid) => {
    const cur = avoid || (board && board.answer) || "";
    for (let t = 0; t < 40; t++) {
      if (!bag.length) bag = pool.slice().sort(() => Math.random() - 0.5);
      const w = bag.pop(); if (w && !sameWord(w, cur)) return w;
    }
    return pool[0] || null;
  };
}
function relayout() {
  if (!board || !G) return;
  const { bx, by, bw, bh, L } = boardLayout();
  const el = $("#board"); if (el) Object.assign(el.style, { left: bx + "px", top: by + "px", width: bw + "px", height: bh + "px" });
  board.layout(L);
}
function wireGame(cv) {
  const toBoard = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * board.L.W, y: (e.clientY - r.top) / r.height * board.L.H }; };
  let down = false;
  cv.addEventListener("pointermove", (e) => { if (G.over || G.paused) return; if (e.pointerType === "mouse" || down) { const p = toBoard(e); board.aimAt(p.x, p.y); } });
  cv.addEventListener("pointerdown", (e) => { if (G.over || G.paused) return; down = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} const p = toBoard(e); board.aimAt(p.x, p.y); e.preventDefault(); });
  const up = (e) => { if (!down) return; down = false; if (G.over || G.paused) return; const p = toBoard(e); if (p.y < board.L.pivotY - board.L.D * 0.4) { board.aimAt(p.x, p.y); shoot(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", () => (down = false));
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  $("#bSwap").onclick = () => { if (G.over || G.paused) return; board.swap(); SFX.tap(); paintNext(); };
  $("#bHint").onclick = () => { if (G.over || G.paused || G.hints <= 0) return; G.hints--; G.usedHint = true; board.flashHint(); SFX.tap(); $("#hHints").textContent = G.hints; $("#bHint").disabled = G.hints <= 0; owlPose("happy", 1); };
  $("#bHint").disabled = G.hints <= 0;
  $("#bPause").onclick = () => pause(true);
  const fl = $("#bFull"); if (fl) fl.onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
}
function shoot() { if (board.fire()) { G.tries++; paintNext(); paintHud(); } }
document.addEventListener("keydown", (e) => {
  if (VIEW.name !== "game" || !G || G.over) return;
  if (e.key === "Escape" || e.key === "p") { pause(!G.paused); return; }
  if (G.paused) return;
  const step = (e.shiftKey ? 0.6 : 2.5) * Math.PI / 180;
  if (e.key === "ArrowLeft") { board.aim = board.clampAim(board.aim - step); e.preventDefault(); }
  else if (e.key === "ArrowRight") { board.aim = board.clampAim(board.aim + step); e.preventDefault(); }
  else if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") { shoot(); e.preventDefault(); }
  else if (e.key === "s" || e.key === "ArrowDown") { board.swap(); paintNext(); e.preventDefault(); }
  else if (e.key === "h") $("#bHint").click();
});
const cur = () => G.prompts[G.i];
function nextPrompt(first) {
  const p = cur(); if (!p) return;
  G.qStart = now(); G.timeLeft = G.L.timer || 0; G.wrongOnThis = false; G.usedHint = false;
  board.setChoices(p.ans, p.wrong, G.L.copies || 1);
  paintPrompt(); paintNext(); paintHud();
  if (!first) owlPose("idle");
}
function paintPrompt(solved) {
  const p = cur(), el = $("#prompt"); if (!p || !el) return;
  const t = typeOf(p.type === "gap" ? "gap" : p.type === "trans" ? "trans" : "question");
  const tag = `<span class="ptag">${ico(t.ico, MOBILE ? 16 : 24)}<span>${p.lead}</span></span>`;
  let body;
  if (p.type === "gap" && p.text.includes("___")) {
    const [a, ...rest] = p.text.split("___");
    body = `<span class="en">${esc(a)}<span class="gap${solved ? " ok" : ""}">${solved ? esc(p.ans) : "&nbsp;"}</span>${esc(rest.join("___"))}</span>`;
  } else if (p.native) body = `<span class="nat" dir="auto">${esc(p.text)}</span>${solved ? ` <span class="arr">←</span> <span class="en ok">${esc(p.ans)}</span>` : ""}`;
  else body = `<span class="en">${esc(p.text)}</span>${solved ? ` <span class="en ok">${esc(p.ans)}</span>` : ""}`;
  const tm = G.L.timer ? `<span class="ptime" id="pTime">${ico("clock", MOBILE ? 14 : 20)}<b class="en">${Math.ceil(G.timeLeft)}</b></span>` : "";
  el.innerHTML = `${tag}${tm}<div class="ptext" id="ptext">${body}</div>`;
  // shrink long prompts so they always fit
  const pt = $("#ptext"); let fs = MOBILE ? 24 : 50; pt.style.fontSize = fs + "px";
  for (let k = 0; k < 14 && (pt.scrollHeight > pt.clientHeight + 2 || pt.scrollWidth > pt.clientWidth + 2); k++) { fs *= 0.92; pt.style.fontSize = fs + "px"; }
}
function paintNext() { const n = $("#nextBall"); if (n && board) n.src = `img/ball-${board.next}-plain.png?v=${VERSION}`; }
function paintHud() {
  if (!G) return;
  const s = $("#hScore"); if (s) s.textContent = fmtN(G.score);
  const pr = $("#hProg"); if (pr) pr.textContent = `${G.correct}/${G.prompts.length}`;
  const bar = $("#hBar"); if (bar) bar.style.width = (100 * G.correct / G.prompts.length) + "%";
  const st = $("#hStreak"); if (st) st.textContent = "×" + G.streak;
  const stars = $$("#hStars .ico"); const k = G.correct / G.prompts.length; stars.forEach((x, i) => x.classList.toggle("on", k >= [0.34, 0.67, 1][i]));
}
let owlT = 0;
function owlPose(p, secs = 1.6) { const o = $("#owl"); if (!o) return; o.src = owl(p, MOBILE); o.classList.toggle("hop", p === "happy"); clearTimeout(owlT); if (p !== "idle") owlT = setTimeout(() => { const q = $("#owl"); if (q) { q.src = owl("idle", MOBILE); q.classList.remove("hop"); } }, secs * 1000); }
function feedback(kind, html, ms = 1500) {
  const f = $("#fb"); if (!f) return; f.className = "fb " + kind; f.innerHTML = html; f.hidden = false;
  clearTimeout(f._t); f._t = setTimeout(() => { f.hidden = true; }, ms);
}
function rec(p, ok, given) {
  try { if (authUser() && EnglishiaAuth.recordAnswer) EnglishiaAuth.recordAnswer(GAME_ID, { item: p.item, topic: p.topic, level: G.L.he, prompt: p.text.replace("___", "_"), correct: ok, given: String(given || ""), expected: p.ans }); } catch (e) {}
}
function onResult(r) {
  if (!G || G.over) return;
  const p = cur(), mul = G.L.mul;
  if (r.kind === "correct") {
    G.wordHits++; G.correct++; G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
    if (!G.wrongOnThis) G.firstTry++;
    const base = Math.round((100 + 25 * Math.min(G.streak - 1, 4)) * mul), chain = Math.round(50 * mul) * r.popped, fall = Math.round(LAYOUT.desk.basketPts * mul) * r.fell;
    G.score += base + chain + fall;
    board.floatText(r.x, r.y - board.L.D * 0.6, "+" + (base + chain), "#ffe680", board.L.D * 0.5);
    for (let i = 0; i <= Math.min(r.popped, 6); i++) SFX.pop(i);
    SFX.ok(); owlPose("happy");
    if (!G.practised.some((w) => sameWord(w, p.ans))) G.practised.push(p.ans);
    feedback("ok", `${ico("check", MOBILE ? 18 : 28, 3)}<span>מצוין!</span> <b class="en">${esc(p.ans)}</b>${G.streak > 1 ? ` · <span>רצף</span> <b class="en">×${G.streak}</b>` : ""}`);
    rec(p, true, r.word);
    paintPrompt(true); paintHud();
    if (p.say) setTimeout(() => speak(p.say), 250);
    if (G.correct >= G.prompts.length) { G.over = true; board.frozen = true; setTimeout(() => endLevel(true), 1300); return; }
    G.i++;
    setTimeout(() => { if (G && !G.over) nextPrompt(); }, 900);
    board.frozen = true; setTimeout(() => { if (G && !G.over) board.frozen = false; }, 900);
    return;
  }
  if (r.kind === "wrong") {
    G.wordHits++; G.streak = 0; G.mistakes++; G.wrongOnThis = true;
    if (!G.review.some((x) => sameWord(x.ans, p.ans))) G.review.push({ wrong: r.word, ans: p.ans, text: p.text });
    SFX.no(); owlPose("sad");
    feedback("bad", `${ico("x", MOBILE ? 18 : 28, 3)}<span>לא נכון. נסו שוב</span>${MOBILE ? "" : ` · <span>המילה הנכונה מהבהבת</span>`}`, 1800);
    rec(p, false, r.word);
    if (G.mistakes % G.L.drop === 0 && !r.danger) { setTimeout(() => { if (!G || G.over) return; if (!board.canDrop()) { toast("זהירות! הכדורים קרובים לקו", "bad"); return; } const lost = board.insertRow(); SFX.drop(); toast("הרשת ירדה שורה", "bad"); if (lost) loseBy("line"); }, 700); }
  } else {
    G.streak = 0;
    feedback("", `${ico("crosshair", MOBILE ? 18 : 28, 3)}<span>פספוס. כוונו אל כדור עם מילה</span>`, 1400);
  }
  paintHud();
  if (r.danger) { loseBy("line"); return; }
  if (board.shots <= 0) setTimeout(() => { if (G && !G.over) loseBy("shots"); }, 500);
}
function loseBy(why) { if (!G || G.over) return; G.over = true; G.lostBy = why; board.frozen = true; SFX.lose(); owlPose("sad", 3); setTimeout(() => endLevel(false), 900); }
function pause(on) {
  if (!G || G.over) return;
  G.paused = on; board.frozen = on;
  const ov = $("#ov");
  if (on) { G.pauseAt = now(); ov.hidden = false; ov.innerHTML = `<div class="ovcard glass"><h2>${ico("pause", 40)}<span>הפסקה</span></h2><button class="btn green" id="oResume">${ico("play", 34, 3)}<span>המשך</span></button><button class="btn wbtn sm" id="oRestart">${ico("rotate", 26)}<span>מתחילים מחדש</span></button><button class="btn gbtn sm" id="oMenu">${ico("home", 26)}<span>לתפריט</span></button></div>`;
    $("#oResume").onclick = () => pause(false); $("#oRestart").onclick = () => { ov.hidden = true; startLevel(true); }; $("#oMenu").onclick = () => { G.over = true; menuScreen(); };
  } else { G.pausedFor += now() - G.pauseAt; ov.hidden = true; }
}
const elapsed = () => (G ? (G.paused ? G.pauseAt : now()) - G.start - G.pausedFor : 0);

/* ---------- loop ---------- */
function startLoop() { stopLoop(); lastT = now(); const tick = () => { raf = requestAnimationFrame(tick); const t = now(), dt = Math.min(0.05, t - lastT); lastT = t; if (!board) return; if (!G || !G.paused) board.step(dt); board.draw(); tickHud(dt); }; raf = requestAnimationFrame(tick); }
function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
let hudAcc = 0;
function tickHud(dt) {
  if (!G || G.over || G.paused) return;
  hudAcc += dt;
  if (G.L.timer && !board.frozen) {
    G.timeLeft -= dt;
    if (G.timeLeft <= 0) {
      G.timeLeft = G.L.timer; G.mistakes++; G.streak = 0; G.wrongOnThis = true; SFX.no(); owlPose("sad");
      feedback("bad", `${ico("clock", 26)}<span>נגמר הזמן</span>`, 1400);
      if (G.mistakes % G.L.drop === 0 && board.canDrop()) { const lost = board.insertRow(); SFX.drop(); if (lost) { loseBy("line"); return; } }
      paintHud();
    }
  }
  if (hudAcc > 0.25) { hudAcc = 0; const t = $("#hTime"); if (t) t.textContent = mmss(elapsed()); const pt = $("#pTime b"); if (pt) { pt.textContent = Math.max(0, Math.ceil(G.timeLeft)); pt.parentNode.classList.toggle("low", G.timeLeft < 6); } }
}

/* ================= END ================= */
function endLevel(win) {
  stopLoop();
  const g = G, secs = Math.max(1, Math.round(elapsed()));
  const shotsLeft = board ? board.shots : 0, bonus = win ? Math.round(50 * g.L.mul) * shotsLeft : 0;
  g.score += bonus;
  const acc = g.wordHits ? Math.round(100 * g.correct / g.wordHits) : 0;
  const stars = win ? (acc >= 90 ? 3 : acc >= 70 ? 2 : 1) : 0;
  const prevBest = SAVE.best[g.key] || 0, isBest = g.score > prevBest && g.score > 0;
  if (isBest) SAVE.best[g.key] = g.score;
  if (win) SAVE.stage[g.key] = Math.max(SAVE.stage[g.key] || 1, g.stage + 1);
  LS.set("wb-save", SAVE);
  try { if (authUser()) { EnglishiaAuth.recordSession(GAME_ID, g.score, secs, progressData()); if (EnglishiaAuth.flushAnswers) EnglishiaAuth.flushAnswers(); } } catch (e) {}
  win ? SFX.win() : null;
  LOCK = false; fit();
  show("end", () => {
    const title = win ? "השלב הושלם!" : g.lostBy === "line" ? "הכדורים הגיעו לקו" : "נגמרו היריות";
    const typeHe = g.type === "teacher" ? "רשימה של המורה" : typeOf(g.type).he;
    const chips = g.practised.slice(0, MOBILE ? 8 : 14).map((w) => `<span class="wchip en">${esc(w)}</span>`).join("");
    const review = g.review.slice(0, MOBILE ? 2 : 3).map((r) => `<div class="rv">${ico("rotate", MOBILE ? 16 : 22)}<span>לחזור על:</span> <span class="wchip bad en">${esc(r.wrong)}</span> <span>התשובה הנכונה:</span> <span class="wchip en">${esc(r.ans)}</span></div>`).join("");
    const stats = [["check", "נכונות", `${g.firstTry}/${g.prompts.length}`], ["percent", "דיוק", acc + "%"], ["flame", "רצף שיא", "×" + g.bestStreak], [win ? "crosshair" : "clock", win ? "בונוס יריות" : "זמן", win ? "+" + fmtN(bonus) : mmss(secs)]];
    stage.innerHTML = `<section class="scr on end ${win ? "win" : "lose"}" id="s-end">${bokeh()}${win ? confetti() : ""}
      <div class="topbar"><div class="grp">${backBtn()}</div><div class="grp">${soundBtn()}<span id="langSlot"></span></div></div>
      <img class="owl-end" src="${owl(win ? "happy" : "sad", MOBILE)}" alt="Lexi">
      <div class="endcard glass">
        ${isBest ? '<div class="newbest">שיא חדש!</div>' : ""}
        <h1>${title}</h1>
        <div class="endsub"><span>שלב</span> <b class="en">${g.stage}</b> · <span>${g.L.he}</span> · <span>${typeHe}</span></div>
        <div class="endstars">${[0, 1, 2].map((i) => `<span class="${i < stars ? "on" : ""}">${ico("star", MOBILE ? 40 : 76, 2)}</span>`).join("")}</div>
        <div class="endscore en">${fmtN(g.score)}</div>
        <div class="stats">${stats.map(([i, l, v]) => `<div class="stat"><div class="kick sm">${ico(i, MOBILE ? 14 : 20)}<span>${l}</span></div><b class="en">${v}</b></div>`).join("")}</div>
        ${chips ? `<div class="kick sm ctr">${ico("book", MOBILE ? 16 : 22)}<span>מילים שתרגלתם</span></div><div class="wchips">${chips}</div>` : ""}
        ${review}
      </div>
      <div class="endbtns">
        ${win ? `<button class="btn orange" id="eNext"><span>לשלב הבא</span>${ico(FWD, MOBILE ? 24 : 34, 3)}</button>` : ""}
        <button class="btn wbtn${win ? " sm2" : ""}" id="eAgain">${ico("rotate", MOBILE ? 22 : 30)}<span>${win ? "שוב" : "נסו שוב"}</span></button>
        <button class="btn gbtn sm2" id="eMenu">${ico("home", MOBILE ? 22 : 30)}<span>לתפריט</span></button>
      </div>
      ${credit()}
    </section>`;
    mountShared(); wireSound();
    const n = $("#eNext"); if (n) n.onclick = () => { SFX.tap(); startLevel(); };
    $("#eAgain").onclick = () => { SFX.tap(); startLevel(true); };
    $("#eMenu").onclick = () => { SFX.tap(); menuScreen(); };
  });
  window.__WB.last = { win, score: g.score, acc, stars, firstTry: g.firstTry, secs };
}
function confetti() { const c = ["#ff5fd2", "#39e1ff", "#ffe680", "#3dffa0", "#9b6bff", "#ffa21f"]; let h = ""; for (let i = 0; i < (MOBILE ? 26 : 60); i++) h += `<i class="cf" style="left:${Math.random() * 100}%;background:${c[i % 6]};animation-delay:${(Math.random() * 3).toFixed(2)}s;animation-duration:${(3 + Math.random() * 3).toFixed(2)}s"></i>`; return `<div class="confetti">${h}</div>`; }

/* ---------- cloud progress (Englishia account) ---------- */
function progressData() { return { v: 1, best: SAVE.best, stage: SAVE.stage, teacher: TEACH.text ? TEACH : undefined }; }
let synced = false;
function syncCloud(push) {
  try {
    const u = authUser(); if (!u || !window.EnglishiaAuth) return;
    if (push) { EnglishiaAuth.saveProgressSoon(GAME_ID, progressData()); return; }
    if (synced) return; synced = true;
    EnglishiaAuth.loadProgress(GAME_ID).then((d) => {
      if (!d) return;
      for (const k of Object.keys(d.best || {})) SAVE.best[k] = Math.max(SAVE.best[k] || 0, +d.best[k] || 0);
      for (const k of Object.keys(d.stage || {})) SAVE.stage[k] = Math.max(SAVE.stage[k] || 1, +d.stage[k] || 1);
      if (d.teacher && d.teacher.text && !TEACH.text) { TEACH = d.teacher; LS.set("wb-teacher", TEACH); }
      LS.set("wb-save", SAVE); if (VIEW.name === "menu") VIEW.render();
    });
  } catch (e) {}
}

/* ---------- boot ---------- */
window.__WB = { get view() { return VIEW.name; }, get G() { return G; }, get board() { return board; }, LAYOUT, last: null, menu: () => menuScreen(), start: () => startLevel() };
fit();
Promise.all([loadImages(), document.fonts && document.fonts.load ? Promise.all([document.fonts.load("600 30px Fredoka"), document.fonts.load("700 30px Heebo")]).catch(() => {}) : 0]).then(() => menuScreen());
