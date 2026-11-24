/* Sentence Sprint 1.0 · ספרינט המשפטים — online, real-time multiplayer platformer for building English sentences.
   Rooms work like Word Race: online room or presentation mode (code + QR on the projector), host-authoritative
   over the same PeerJS / signaling relay / ntfy transport (net.js). Each device runs its own runner; the host
   checks sentences, gives points and power-ups, aims attacks at the player directly ahead and relays positions.
   © 2026 Amir · Englishia · All rights reserved */
import { check, pretty, disp, gloss, knownWord, GEN, LENS, findOrder } from "./grammar.js?v=1.0";
import { buildLevel } from "./level.js?v=1.0";
import { createGame, loadImages, img, PU, PU_KEYS, DUR, F, CHAR_COLORS } from "./game.js?v=1.0";

const VERSION = "1.0", GAME_ID = "sentence-sprint", MAX_PLAYERS = 30;
const DEMO = /\/demo\//.test(location.pathname);
const HUB = DEMO ? "../" : "../../";
const URLP = new URLSearchParams(location.search);
const TEST = URLP.get("test") === "1";
const LANG = (window.EnglishiaLang && EnglishiaLang.lang) || "he";
const DIR = (window.EnglishiaLang && EnglishiaLang.dir) || "rtl";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const now = () => Date.now();
const T_ = (s) => { try { return window.EnglishiaLang ? EnglishiaLang.t(s) : s; } catch (e) { return s; } };

/* ---------- icons (Lucide-style, from the design's svg-icons.py) ---------- */
const P = {
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  projector: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  "flag-fin": '<path d="M4 22V3"/><path d="M4 3h16v10H4"/><path d="M4 3h4v5H4zM12 3h4v5h-4zM8 8h4v5H8zM16 8h4v5h-4z" fill="currentColor"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  "volume-on": '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>', user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>', pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  puzzle: '<path d="M19.44 7.85c-.47.47-.86 1.15-1.42.58L16.4 6.8a.97.97 0 0 0-1.5.05c-.33.4-.2 1 .1 1.41a2.5 2.5 0 1 1-3.6.08c.3-.4.43-1 .1-1.41a.97.97 0 0 0-1.5-.05L8.4 8.47c-.56.56-.95-.11-1.42-.58"/><rect x="3" y="9" width="18" height="12" rx="2"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  keyboard: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  "phone-rot": '<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M18 12h.01"/>', door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.56v16.88a.5.5 0 0 1-.68.47l-6-2.25A2 2 0 0 1 5 17.78V6.22a2 2 0 0 1 1.32-1.88l6-2.25a.5.5 0 0 1 .68.47Z"/>'
};
const ico = (n, s = 24, sw = 2.6, c = "currentColor", f = "none") => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
const FWD = DIR === "ltr" ? "arrow-right" : "arrow-left", BACK = DIR === "ltr" ? "arrow-left" : "arrow-right";

/* ---------- characters + levels ---------- */
const CHARS = [{ id: "zik", he: "זוהר" }, { id: "gal", he: "טל" }, { id: "ale", he: "נגה" }, { id: "saar", he: "רון" }, { id: "fox", he: "שועלי" }, { id: "bear", he: "דובי" }];
const CH = Object.fromEntries(CHARS.map((c) => [c.id, c]));
const IMG_BASE = "img/";
const av = (ch, size, extra = "") => { const c = CHAR_COLORS[ch] || CHAR_COLORS.zik; return `<span class="av ${extra}" style="width:${size}px;height:${size}px;--c1:${c[0]};--c2:${c[1]}"><img src="${IMG_BASE}head-${ch}.png" alt="" draggable="false"></span>`; };
/* same six levels, names and score multipliers as Mila Quest and Word Race */
const LEVELS = [
  { k: "veryeasy", he: "קל מאוד", mul: 0.5 }, { k: "easy", he: "קל", mul: 1 }, { k: "normal", he: "רגיל", mul: 1.5 },
  { k: "hard", he: "קשה", mul: 2 }, { k: "veryhard", he: "קשה מאוד", mul: 3 }, { k: "master", he: "אלוף", mul: 4 }
];
const levelOf = (k) => LEVELS.find((l) => l.k === k) || LEVELS[2];
const TRACKS = [{ k: "short", he: "קצר" }, { k: "medium", he: "בינוני" }, { k: "long", he: "ארוך" }];
const WLS = [{ k: "s", he: "3–4" }, { k: "m", he: "4–6" }, { k: "l", he: "6–8" }];
const bars = (n, on) => `<span class="bars">${[0, 1, 2, 3, 4, 5].map((i) => `<i style="height:${5 + i * 2.4}px;opacity:${i < n ? 1 : on ? 0.4 : 0.3}"></i>`).join("")}</span>`;

const PREF = Object.assign({ level: "normal", len: "medium", wl: "m", pu: true }, LS.get("ss-settings", {}));
if (!LEVELS.some((l) => l.k === PREF.level)) PREF.level = "normal";
if (!TRACKS.some((l) => l.k === PREF.len)) PREF.len = "medium";
if (!WLS.some((l) => l.k === PREF.wl)) PREF.wl = "m";
const gfxPref = LS.get("ss-gfx", null);
let LOW = URLP.get("gfx") === "low" ? true : gfxPref === "low" ? true : gfxPref === "normal" ? false : (navigator.hardwareConcurrency || 4) <= 2;
let MUTE = !!LS.get("ss-mute", false);
let CID = LS.get("ss-cid", "");
if (!/^[a-z0-9]{12}$/.test(CID)) { CID = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + "000000000000").replace(/[^a-z0-9]/g, "").slice(0, 12); LS.set("ss-cid", CID); }
const cleanName = (s) => String(s || "").replace(/[<>&"'`\\\u0000-\u001f\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim().slice(0, 12);

/* ---------- sound + speech ---------- */
let AC = null;
function beep(fr, d = 0.12, type = "sine", v = 0.1, delay = 0) {
  if (MUTE) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume().catch(() => {});
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime + delay;
    o.type = type; o.frequency.value = fr; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02);
  } catch (e) {}
}
const SFX = {
  tap: () => beep(520, 0.06, "triangle", 0.07), word: () => beep(880, 0.07, "triangle", 0.07), jump: () => beep(420, 0.08, "sine", 0.05),
  ok: () => { beep(660, 0.1, "triangle"); beep(990, 0.16, "triangle", 0.1, 0.09); }, no: () => beep(200, 0.22, "sawtooth", 0.05),
  tick: () => beep(880, 0.05, "square", 0.04), go: () => beep(1180, 0.3, "triangle", 0.12), hit: () => beep(140, 0.3, "square", 0.06),
  roll: () => beep(700 + Math.random() * 300, 0.03, "square", 0.025), win: () => [523, 659, 784, 1047].forEach((fr, i) => beep(fr, 0.18, "triangle", 0.1, i * 0.12))
};
const CAN_SPEAK = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
function speak(text) {
  if (!CAN_SPEAK || !text || MUTE) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.85;
    const vs = speechSynthesis.getVoices(), v = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {}
}

/* ---------- layout: menus on a fixed stage scaled to fit; the race is full screen ---------- */
const stage = $("#stage"), vp = $("#vp");
stage.classList.toggle("ltr", DIR === "ltr");
let MOBILE = false, SCALE = 1, MH = 844;
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const m = vw < 700 || vw / vh < 0.75;
  const changed = m !== MOBILE; MOBILE = m;
  stage.classList.toggle("m", m); stage.classList.toggle("d", !m); document.body.classList.toggle("low", LOW);
  if (m) { SCALE = Math.min(vw / 390, vh / 700); MH = Math.max(700, Math.round(vh / SCALE)); stage.style.height = MH + "px"; stage.style.left = Math.round((vw - 390 * SCALE) / 2) + "px"; stage.style.top = "0px"; }
  else { SCALE = Math.min(vw / 1280, vh / 720); stage.style.height = ""; stage.style.left = Math.round((vw - 1280 * SCALE) / 2) + "px"; stage.style.top = Math.round((vh - 720 * SCALE) / 2) + "px"; }
  stage.style.transform = `scale(${SCALE})`;
  return changed;
}
let VIEW = { name: "", render: null };
function show(name, render) { hideGame(); VIEW = { name, render }; vp.style.display = ""; render(); }
let rsz = 0;
window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { const ch = fit(); if (VIEW.name === "game") gameLayout(); else if (ch && VIEW.render) VIEW.render(); }, 120); });

const logo = (size, st = 9, sh = 7, stack) => `<div class="logo" style="font-size:${size}px;--st:${st}px;--sh:${sh}px"><span class="s1">Sentence</span>${stack ? "<br>" : " "}<span class="s2">Sprint</span></div>`;
const backHub = () => `<a class="pill" id="bHub" href="${HUB}" title="חזרה לאנגלישיה">${ico(BACK, 20, 2.8)}<span>${MOBILE ? "אנגלישיה" : "חזרה לאנגלישיה"}</span></a>`;
const soundBtn = () => `<button class="pill iconbtn" id="bSound" aria-label="צליל" title="צליל" style="padding:0;justify-content:center">${ico(MUTE ? "volume-x" : "volume-on", 22, 2.6)}</button>`;
const gfxBtn = () => `<button class="pill iconbtn" id="bGfx" aria-pressed="${LOW}" aria-label="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}" title="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}" style="padding:0;justify-content:center">${ico(LOW ? "gauge" : "image", 22, 2.6, LOW ? "#ff7a00" : "#1d2350")}</button>`;
function topLeft() { return `<div class="grp">${soundBtn()}${gfxBtn()}<span id="langSlot"></span>${MOBILE ? "" : '<span class="brand" id="engSlot"><i></i>Englishia</span>'}</div>`; }
function wireTop() {
  const s = $("#bSound"), g = $("#bGfx");
  if (s) s.onclick = () => { MUTE = !MUTE; LS.set("ss-mute", MUTE); s.innerHTML = ico(MUTE ? "volume-x" : "volume-on", 22, 2.6); if (!MUTE) SFX.tap(); else try { speechSynthesis.cancel(); } catch (e) {} };
  if (g) g.onclick = () => { LOW = !LOW; LS.set("ss-gfx", LOW ? "low" : "normal"); fit(); VIEW.render && VIEW.render(); };
  try { if (window.EnglishiaLang && $("#langSlot")) EnglishiaLang.mount("#langSlot"); } catch (e) {}
  try { if (window.EnglishiaAuth && $("#engSlot") && VIEW.name === "home") { $("#engSlot").innerHTML = ""; EnglishiaAuth.mountMenu("#engSlot"); } } catch (e) {}
}
window.SSApp = { onAuth() { if (VIEW.name === "home") wireTop(); } };
function credit() {
  const l1 = `© 2026 Amir · Englishia · All rights reserved · Sentence Sprint ${VERSION}${DEMO ? " (demo)" : ""}`;
  const l2 = `© 2026 אמיר · אינגלישיה · כל הזכויות שמורות · ${DEMO ? "גרסת דמו" : "גרסה"} ${VERSION}`;
  return `<div class="credit" id="ss-credit"><div dir="ltr" translate="no">${esc(l1)}</div><div dir="rtl">${esc(l2)}</div></div>`;
}
const bgDiv = () => `<div class="bg" style="background-image:url(${IMG_BASE}${MOBILE ? "menu-port" : "menu-land"}.jpg)"></div>`;

/* ================= SCREENS ================= */
/* ---------- 01 home ---------- */
function homeScreen() {
  leaveAll();
  if (location.search.includes("code=")) try { history.replaceState(null, "", location.pathname + (TEST ? "?test=1" : "")); } catch (e) {}
  show("home", () => {
    const how = `<div class="howto" style="${MOBILE ? "top:" + Math.min(452, MH - 330) + "px" : ""}"><span><i class="hi orange">${ico("arrow-up", 16, 3, "#fff")}</i>קופצים בין הקומות</span><span><i class="hi pink">${ico("puzzle", 16, 2.6, "#fff")}</i>אוספים מילים ובונים משפט</span><span><i class="hi yellow">${ico("zap", 16, 2.6, "#fff")}</i>זוכים בכוח-על</span></div>`;
    if (MOBILE) {
      const top = Math.min(300, MH - 400);
      stage.innerHTML = `<section class="scr" id="s-home">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}</div></div>
        <div class="home-logo" style="top:${Math.max(70, top - 230)}px">${logo(58, 7, 5, true)}<div style="margin-top:10px"><span class="ribbon" style="font-size:20px">ספרינט המשפטים</span></div></div>
        <div class="mbtns" style="top:${top}px">
          <button class="btn green" id="go-join">${ico("hash", 24, 3)}<span>הצטרפות עם קוד</span></button>
          <button class="btn blue" id="go-online">${ico("globe", 24, 2.8)}<span>פתיחת חדר אונליין</span></button>
        </div>
        ${how}
        <div class="m-chars" style="height:${Math.max(120, MH - top - 300)}px;align-items:flex-end">${["gal", "zik", "fox"].map((c) => `<img src="${IMG_BASE}cheer-${c}.png" alt="" style="height:${Math.min(210, Math.max(120, MH - top - 300))}px">`).join("")}</div>
        <div style="position:absolute;top:22px;right:20px;display:none"></div>
        ${credit()}</section>`;
    } else {
      const cards = [["online", "globe", "blue", "פתח חדר אונליין", "כל תלמיד רץ מהמחשב או מהטלפון שלו, מכל מקום"],
        ["present", "projector", "pink", "פתח חדר במצב הצגה", "המירוץ על המקרן, התלמידים משחקים מהטלפון"],
        ["join", "hash", "green", "הצטרף עם קוד", "קיבלתם קוד מהמורה? הכניסו אותו כאן"]];
      stage.innerHTML = `<section class="scr" id="s-home">${bgDiv()}
        <div class="topbar">${topLeft()}<div class="grp">${backHub()}</div></div>
        <div class="home-logo" style="top:52px">${logo(96)}<div style="margin-top:14px"><span class="ribbon">ספרינט המשפטים</span></div></div>
        <div class="home-cards">${cards.map(([k, i, c, t, s]) => `<button class="card hcard" id="go-${k}"><span class="hi ${c}">${ico(i, 24, 2.6, "#fff")}</span><span class="go ${c}">${ico(FWD, 18, 3, "#fff")}</span><div class="t">${t}</div><div class="s">${s}</div></button>`).join("")}</div>
        ${how}
        <div class="home-chars">${["gal", "zik", "ale", "saar", "fox", "bear"].map((c) => `<img src="${IMG_BASE}cheer-${c}.png" alt="">`).join("")}</div>
        ${credit()}</section>`;
    }
    wireTop();
    const go = (k) => { SFX.tap(); if (k === "join") joinScreen(""); else createRoom(k); };
    $$("[id^=go-]").forEach((b) => (b.onclick = () => go(b.id.slice(3))));
  });
}

/* ---------- join with a code ---------- */
function joinScreen(code, err) {
  leaveAll();
  show("join", () => {
    const d = String(code || "").replace(/\D/g, "").slice(0, 6).padEnd(6, " ");
    stage.innerHTML = `<section class="scr" id="s-join">${bgDiv()}
      <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}<button class="pill iconbtn" id="bBack" aria-label="חזרה" style="padding:0;justify-content:center">${ico(BACK, 22, 2.8)}</button></div></div>
      <div class="card joincard" style="${MOBILE ? "width:350px;top:140px" : ""}">
        <div style="font:900 ${MOBILE ? 26 : 32}px var(--ui)">הקלידו את קוד החדר</div>
        <div class="codein">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" maxlength="1" pattern="[0-9]*" aria-label="digit ${i + 1}" value="${d[i].trim()}" style="${MOBILE ? "width:46px;height:58px;font-size:30px" : ""}">`).join("")}</div>
        <div class="err" id="jerr">${esc(err || "")}</div>
        <button class="btn green" id="bJoin" style="width:100%;margin-top:12px">${ico("play", 24, 2.6, "#fff", "#fff")}<span>המשך</span></button>
      </div>${credit()}</section>`;
    wireTop();
    const ins = $$(".codein input");
    const val = () => ins.map((i) => i.value).join("");
    ins.forEach((inp, i) => {
      inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(-1); if (inp.value && ins[i + 1]) ins[i + 1].focus(); if (val().length === 6) $("#bJoin").focus(); };
      inp.onkeydown = (e) => { if (e.key === "Backspace" && !inp.value && ins[i - 1]) ins[i - 1].focus(); if (e.key === "Enter") $("#bJoin").click(); };
      inp.onpaste = (e) => { const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (t) { e.preventDefault(); ins.forEach((x, j) => (x.value = t[j] || "")); } };
    });
    $("#bBack").onclick = () => homeScreen();
    $("#bJoin").onclick = () => { const c = val(); if (c.length !== 6) { $("#jerr").textContent = T_("הקוד צריך 6 ספרות"); return; } SFX.tap(); characterScreen({ code: c }); };
    if (!err) setTimeout(() => { const f = ins.find((x) => !x.value) || ins[0]; try { f.focus(); } catch (e) {} }, 50);
  });
}

/* ---------- 03 character + name ---------- */
function characterScreen(o) {
  let name = LS.get("ss-name", "");
  try { if (!name && window.EnglishiaAuth && EnglishiaAuth.user) name = cleanName(EnglishiaAuth.user.displayName || EnglishiaAuth.user.username); } catch (e) {}
  let ch = LS.get("ss-ch", "zik"); if (!CH[ch]) ch = "zik";
  const code = o.code || (H ? H.code : "");
  show("character", () => {
    const grid = CHARS.map((c) => `<button class="chc ${c.id === ch ? "on" : ""}" data-ch="${c.id}" aria-pressed="${c.id === ch}"><img src="${IMG_BASE}cheer-${c.id}.png" alt="">${c.id === ch ? `<span class="ok">${ico("check", 16, 3.4, "#fff")}</span>` : ""}<div class="n">${c.he}</div></button>`).join("");
    const pc = CHAR_COLORS[ch];
    const roomPill = code ? `<span class="pill"><span>חדר</span> <b class="en">${code.slice(0, 3)} ${code.slice(3)}</b></span>` : "";
    if (MOBILE) {
      const gh = 2 * 128 + 8 + 30, top = 70, prevH = Math.max(130, Math.min(300, MH - top - 162 - (gh + 20) - 96));
      stage.innerHTML = `<section class="scr" id="s-char">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}</div></div>
        <div class="ttl" style="position:absolute;top:${top - 4}px;left:0;right:0;text-align:center;font-size:30px">בחרו רץ ושם</div>
        <div class="card mcard" style="top:${top + 58}px;height:${prevH}px;padding:0;overflow:hidden;background:linear-gradient(180deg,#e9f5ff,#fff)">
          <span class="btn sm orange" style="position:absolute;top:10px;inset-inline-start:12px;z-index:2">${CH[ch].he}</span>
          <img src="${IMG_BASE}cheer-${ch}.png" alt="" style="position:absolute;left:50%;transform:translateX(-50%);bottom:6px;height:${prevH - 14}px"></div>
        <div style="position:absolute;left:16px;right:16px;top:${top + 68 + prevH}px">
          <label class="sub" for="nameIn" style="margin-bottom:4px">השם שלי במירוץ</label>
          <div class="inp" style="height:50px">${ico("user", 22, 2.6, "#8b93b8")}<input id="nameIn" maxlength="12" autocomplete="off" value="${esc(name)}"><span class="cc" id="nc">${name.length}/12</span></div>
          <div class="err" id="nerr"></div></div>
        <div class="card mcard" style="top:${top + 162 + prevH}px;padding:10px"><div class="ch-grid">${grid}</div></div>
        <button class="btn orange" id="bReady" style="position:absolute;left:24px;right:24px;bottom:18px;font-size:24px">${ico("zap", 24, 2.6, "#fff", "#fff")}<span>מוכנים לזנק!</span></button>
      </section>`;
    } else {
      stage.innerHTML = `<section class="scr" id="s-char">${bgDiv()}
        <div class="topbar"><div class="grp">${soundBtn()}<span id="langSlot"></span>${roomPill}</div><div class="grp"><span class="ttl" style="font-size:34px">בחרו רץ ושם</span>${backHub()}</div></div>
        <div class="card ch-prev"><span class="btn sm orange nm">${CH[ch].he}</span><div class="spot"></div><div class="big"><img src="${IMG_BASE}cheer-${ch}.png" alt=""></div>
          <div class="namebox"><label for="nameIn">השם שלי במירוץ</label><div class="inp">${ico("user", 24, 2.6, "#8b93b8")}<input id="nameIn" maxlength="12" autocomplete="off" value="${esc(name)}"><span class="cc" id="nc">${name.length}/12</span></div><div class="err" id="nerr"></div></div></div>
        <div class="card ch-grid-c"><h3 style="font:900 20px var(--ui);display:flex;gap:9px;align-items:center"><span class="hi pink">${ico("shirt", 20, 2.6, "#fff")}</span>בחרו את הרץ שלכם</h3><div class="ch-grid">${grid}</div></div>
        <button class="btn orange readybtn" id="bReady">${ico("zap", 26, 2.6, "#fff", "#fff")}<span>מוכנים לזנק!</span></button>
      </section>`;
    }
    wireTop();
    const inp = $("#nameIn");
    inp.oninput = () => { name = cleanName(inp.value); $("#nc").textContent = inp.value.length + "/12"; };
    inp.onkeydown = (e) => { if (e.key === "Enter") $("#bReady").click(); };
    $$("[data-ch]").forEach((b) => (b.onclick = () => { ch = b.dataset.ch; name = cleanName(inp.value); SFX.tap(); VIEW.render(); }));
    $("#bReady").onclick = () => {
      name = cleanName(inp.value);
      if (!name) { $("#nerr").textContent = T_("כתבו שם (עד 12 תווים)"); inp.focus(); return; }
      LS.set("ss-name", name); LS.set("ss-ch", ch); SFX.go();
      if (o.host || (o.change && PS.local && H)) hostJoinLocal(name, ch); else if (o.change && PS.code) { PS.name = name; PS.ch = ch; sendHello(); waitScreen(); } else playerJoin(o.code, name, ch);
    };
    if (!name) setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  });
}

/* ================= HOST (teacher's projector, or the student who opened an online room) ================= */
let H = null;
const newCode = () => String(100000 + Math.floor(Math.random() * 900000));
function createRoom(mode) {
  leaveAll();
  H = { code: newCode(), mode, set: Object.assign({}, PREF), ph: "lobby", players: new Map(), net: null, status: "", race: 0, seed: 0,
    startAt: 0, endAt: 0, firstFin: 0, finCount: 0, feed: [], lastN: 0, lastSnN: 0, L: null };
  hostConnect();
  H.timer = setInterval(hostTick, 250);
  H.beat = setInterval(() => hostBroadcast(true), 2500);
  H.snapT = setInterval(hostSnap, 100);
  if (mode === "online") characterScreen({ host: true }); else lobbyScreen();
}
function hostConnect() {
  try { H.net && H.net.close(); } catch (e) {}
  H.net = SSNet.host(H.code, hostRecv, (k) => {
    if (!H) return;
    if (k === "taken") { H.code = newCode(); hostConnect(); if (VIEW.name === "lobby") VIEW.render(); return; }
    H.status = k; const el = $("#netst"); if (el) el.outerHTML = netBadge();
  });
}
function netBadge() { const k = H ? H.status : ""; return `<span class="netst ${k === "peer" ? "ok" : ""}" id="netst"><i></i><span>${k === "peer" ? "מחובר" : k === "ntfy" ? "מחובר (גיבוי)" : "מתחבר…"}</span></span>`; }
const joinURL = () => location.origin + location.pathname + "?code=" + (H ? H.code : "");
function addPlayer(cid, name, ch, local) {
  let p = H.players.get(cid);
  if (p) { p.on = true; p.last = now(); if (H.ph === "lobby") { p.name = name; p.ch = ch; } return p; }
  if (H.ph !== "lobby") return "late";
  if (H.players.size >= MAX_PLAYERS) return "full";
  const pid = H.players.size ? Math.max(...[...H.players.values()].map((x) => x.pid)) + 1 : 1;
  p = { cid, pid, name, ch, on: true, last: now(), local: !!local };
  resetStats(p);
  H.players.set(cid, p); SFX.tap();
  return p;
}
function resetStats(p) { Object.assign(p, { pts: 0, sents: 0, words: 0, pus: 0, fin: 0, finT: 0, x: 260, y: 510, f: 0, posT: 0, held: null, shieldUntil: 0, lastSent: 0, seen: new Set() }); }
function hostRecv(m, cid) {
  if (!H || !m || typeof m !== "object" || typeof cid !== "string" || cid.length > 40) return;
  const p = H.players.get(cid);
  if (m.t === "hello") {
    const name = cleanName(m.name) || "Player", ch = CH[m.ch] ? m.ch : "zik";
    const r = addPlayer(cid, name, ch, false);
    if (r === "late" || r === "full") { H.net.send(cid, { t: r }); H.net.forget(cid); return; }
    H.net.send(cid, { t: "you", pid: r.pid, x: Math.round(r.x), y: Math.round(r.y), race: H.race, held: r.held });
    hostBroadcast(); hostView();
  } else if (m.t === "p") hostPos(p, m);
  else if (m.t === "sent") hostSentence(p, m);
  else if (m.t === "use") hostUse(p, m);
  else if (m.t === "ping") { if (p) { const was = p.on; p.on = true; p.last = now(); if (!was) { hostBroadcast(); hostView(); } } }
  else if (m.t === "bye" || m.t === "_drop") {
    if (!p) return;
    if (m.t === "bye" && H.ph === "lobby") { H.players.delete(cid); H.net.forget(cid); } else p.on = false;
    hostBroadcast(); hostView();
  }
}
const toPlayer = (p, m) => { if (p.local) playerOnMsg(m, true); else H.net.send(p.cid, m); };
/* positions come from each runner's own device; the host only keeps them believable */
function hostPos(p, m) {
  if (!p || H.ph !== "race") return;
  const t = now(); p.on = true; p.last = t;
  let x = Number(m.x), y = Number(m.y); if (!isFinite(x) || !isFinite(y)) return;
  if (t < H.startAt) x = Math.min(x, H.L.start);
  const dt = p.posT ? (t - p.posT) / 1000 : 1, maxV = (GEN[H.set.level] || GEN.normal).speed * 1.6;
  if (x > p.x + maxV * dt + 160) x = p.x + maxV * dt + 160;
  p.x = Math.max(p.x - 400, x); p.y = Math.max(-200, Math.min(760, y)); p.f = (Number(m.f) | 0) & 1023; p.posT = t;
  if (p.shieldUntil > t) p.f |= F.shield;
  if (!p.fin && p.x >= H.L.finish && t >= H.startAt) hostFinish(p);
}
function hostFinish(p) {
  H.finCount++; p.fin = H.finCount; p.finT = now();
  const bonus = Math.round(([25, 15, 10][p.fin - 1] || 5) * levelOf(H.set.level).mul);
  p.pts += bonus;
  if (p.fin === 1) { H.firstFin = now(); H.endAt = Math.min(H.endAt, now() + 20000); }
  toPlayer(p, { t: "fin", place: p.fin, bonus });
  hostBroadcast(); hostView();
}
function hostSentence(p, m) {
  if (!p || H.ph !== "race" || now() < H.startAt) return;
  const k = m.k | 0;
  const words = Array.isArray(m.w) ? m.w.slice(0, 12).map((w) => String(w).toLowerCase().slice(0, 20)) : [];
  if (now() - p.lastSent < 500) return toPlayer(p, { t: "sr", k, ok: 0, why: "fast" });
  p.lastSent = now();
  const [lo, hi] = LENS[H.set.wl] || LENS.m;
  let ok = words.length >= lo && words.length <= hi && words.every(knownWord) && check(words).ok;
  const key = words.join(" ");
  if (ok && p.seen.has(key)) return toPlayer(p, { t: "sr", k, ok: 0, why: "dup" });
  if (!ok) return toPlayer(p, { t: "sr", k, ok: 0, why: words.length < lo ? "short" : "bad" });
  p.seen.add(key);
  const pts = Math.max(2, Math.round(10 * levelOf(H.set.level).mul * words.length / 4));
  p.pts += pts; p.sents++; p.words += words.length;
  let pu = null;
  if (H.set.pu) {
    const ahead = [...H.players.values()].some((q) => q !== p && !q.fin && q.x > p.x && (q.on || q.local));
    const pool = ahead ? PU_KEYS : PU_KEYS.filter((x) => PU[x].boost);
    pu = pool[Math.floor(Math.random() * pool.length)];
    p.held = pu;
  }
  toPlayer(p, { t: "sr", k, ok: 1, pts, pu });
  H.feed.push({ n: p.name, ch: p.ch, s: pretty(words), pts }); if (H.feed.length > 6) H.feed.shift();
  hostBroadcast(); hostView();
}
/* boosts help the owner; attacks hit only the runner directly ahead (nearest one in front who has not finished) */
function hostUse(p, m) {
  if (!p || H.ph !== "race" || !p.held || m.k !== p.held) return p && toPlayer(p, { t: "ur", k: m.k, ok: 0, why: "none" });
  const k = p.held;
  if (PU[k].boost) {
    p.held = null; p.pus++;
    if (k === "shield") p.shieldUntil = now() + DUR.shield * 1000;
    toPlayer(p, { t: "ur", k, ok: 1 });
    broadcastFx({ t: "fx", k, a: p.pid, b: p.pid });
    return;
  }
  let target = null;
  for (const q of H.players.values()) { if (q === p || q.fin || !(q.on || q.local) || q.x <= p.x) continue; if (!target || q.x < target.x) target = q; }
  if (!target) return toPlayer(p, { t: "ur", k, ok: 0, why: "ahead" });
  p.held = null; p.pus++;
  let blocked = 0;
  if (target.shieldUntil > now()) { blocked = 1; target.shieldUntil = 0; }
  toPlayer(p, { t: "ur", k, ok: 1, b: target.pid, bn: target.name, bl: blocked });
  broadcastFx({ t: "fx", k, a: p.pid, b: target.pid, bl: blocked, an: p.name });
}
function broadcastFx(m) {
  H.lastFx = m;
  if (H.net) H.net.broadcast(m, true);
  const me = [...H.players.values()].find((x) => x.local); if (me) playerOnMsg(m, true);
  if (H.mode === "present" && PROJ) onFx(m, PROJ);
}
const rankOf = () => {
  const arr = [...H.players.values()];
  arr.sort((a, b) => b.pts - a.pts || (a.fin || 99) - (b.fin || 99) || b.x - a.x || a.pid - b.pid);
  return new Map(arr.map((p, i) => [p.cid, i + 1]));
};
function stateMsg() {
  const rank = rankOf();
  const pl = [...H.players.values()].sort((a, b) => a.pid - b.pid).map((p) => [p.pid, p.name, p.ch, p.pts, p.on || p.local ? 1 : 0, p.fin, p.sents, p.words, p.pus, rank.get(p.cid)]);
  const t = now();
  return { t: "st", ph: H.ph, code: H.code, mode: H.mode, set: { l: H.set.level, len: H.set.len, wl: H.set.wl, pu: H.set.pu ? 1 : 0 }, seed: H.seed, race: H.race, pl,
    go: H.startAt - t, left: Math.max(0, H.endAt - t), ff: H.firstFin ? 1 : 0, feed: H.feed.slice(-4) };
}
function hostBroadcast(beat) {
  if (!H) return;
  const m = stateMsg();
  const viaN = !beat || now() - H.lastN > 4000; if (viaN) H.lastN = now();
  if (H.net) H.net.broadcast(m, viaN);
  H.lastState = m;
  const me = [...H.players.values()].find((p) => p.local);
  if (me) playerOnMsg(m, true);
}
function hostSnap() {
  if (!H || H.ph !== "race") return;
  const t = now();
  const ps = [...H.players.values()].filter((p) => p.posT || p.local).map((p) => [p.pid, Math.round(p.x), Math.round(p.y), p.f | (p.shieldUntil > t ? F.shield : 0) | (p.fin ? F.fin : 0)]);
  const m = { t: "sn", p: ps };
  const viaN = t - H.lastSnN > 3000; if (viaN) H.lastSnN = t;
  if (H.net && H.players.size) H.net.broadcast(m, viaN);
  if (PS.local && PS.G) onSnap(m, PS.G);
  if (PROJ) onSnap(m, PROJ);
}
function hostTick() {
  if (!H) return;
  const t = now();
  for (const p of H.players.values()) if (!p.local && p.on && t - p.last > 12000) { p.on = false; hostBroadcast(); hostView(); }
  if (H.ph === "race" && t > H.startAt) {
    const act = [...H.players.values()].filter((p) => p.on || p.local);
    if (act.length && act.every((p) => p.fin) && H.endAt > t + 1500) H.endAt = t + 1500;
    if (!H.players.size && t > H.startAt + 5000) H.endAt = t;
    if (t >= H.endAt) hostEnd();
  }
}
function hostStart() {
  if (!H || H.ph !== "lobby") return;
  H.race++; H.seed = (Math.random() * 2 ** 31) >>> 0 || 7;
  H.L = buildLevel({ len: H.set.len, wl: H.set.wl, level: H.set.level }, H.seed);
  for (const p of H.players.values()) resetStats(p);
  H.finCount = 0; H.firstFin = 0; H.feed = [];
  const speed = (GEN[H.set.level] || GEN.normal).speed;
  H.startAt = now() + 4200;
  H.endAt = H.startAt + Math.round(((H.L.finish - H.L.start) / speed) * 1.7 + 25) * 1000;
  H.ph = "race";
  LS.set("ss-settings", H.set);
  hostBroadcast(); hostView();
}
function hostEnd() { if (!H || H.ph !== "race") return; H.ph = "end"; hostBroadcast(); hostView(); }
function hostRematch() { if (!H) return; H.ph = "lobby"; for (const p of H.players.values()) resetStats(p); H.startAt = 0; H.endAt = 0; hostBroadcast(); hostView(); if (H.mode === "present" || !PS.local) lobbyScreen(); }
function hostView() {
  if (!H) return;
  if (H.mode === "online") { if (H.ph === "lobby" && VIEW.name === "lobby") renderLobbyPlayers(); return; }
  if (H.ph === "lobby") { if (VIEW.name === "lobby") renderLobbyPlayers(); else lobbyScreen(); return; }
  if (H.ph === "end") { if (VIEW.name !== "results") resultsScreen(H.lastState, true); return; }
  if (VIEW.name !== "game" || !PROJ || PROJ.race !== H.race) gameScreen(H.lastState, true); else gameState(H.lastState);
}
function hostJoinLocal(name, ch) {
  const p = addPlayer(CID, name, ch, true);
  Object.assign(PS, { code: H.code, name, ch, pid: p.pid, local: true });
  lobbyScreen(); hostBroadcast();
}

/* ---------- 02 lobby (host: join card + players + settings; player: waiting room) ---------- */
function lobbyData() {
  if (H) return { code: H.code, set: { l: H.set.level, len: H.set.len, wl: H.set.wl, pu: H.set.pu ? 1 : 0 }, pl: [...H.players.values()].sort((a, b) => a.pid - b.pid).map((p) => [p.pid, p.name, p.ch, 0, p.on || p.local ? 1 : 0]), host: true, present: H.mode === "present" };
  const st = PS.st || { set: { l: "normal", len: "medium", wl: "m", pu: 1 }, pl: [] };
  return { code: PS.code, set: st.set, pl: st.pl, host: false };
}
function settingsHTML(d, compact) {
  const s = d.set, dis = d.host ? "" : "disabled";
  const lv = LEVELS.map((l, i) => `<button class="chip lvl ${s.l === l.k ? "on" : ""}" data-lv="${l.k}" aria-pressed="${s.l === l.k}" ${dis}>${bars(i + 1, s.l === l.k)}<span>${l.he}</span></button>`).join("");
  const tr = TRACKS.map((t) => `<button class="chip ${s.len === t.k ? "on orange" : ""}" data-len="${t.k}" aria-pressed="${s.len === t.k}" ${dis}>${t.he}</button>`).join("");
  const wl = WLS.map((t) => `<button class="chip ${s.wl === t.k ? "on teal" : ""}" data-wl="${t.k}" aria-pressed="${s.wl === t.k}" ${dis}><span class="en">${t.he}</span></button>`).join("");
  return `<div class="set-lbl">רמת קושי</div><div class="chips lvls">${lv}</div>
    <div class="set-lbl">אורך המסלול</div><div class="chips">${tr}</div>
    <div class="set-lbl">מילים במשפט</div><div class="chips">${wl}</div>
    <div class="set-row"><span class="sub"><span class="hi yellow" style="width:28px;height:28px;border-radius:9px">${ico("zap", 16, 2.6, "#fff")}</span>כוחות-על</span><button class="tog ${s.pu ? "on" : ""}" id="tPu" role="switch" aria-checked="${!!s.pu}" aria-label="כוחות-על" ${dis}></button></div>`;
}
function wireSettings() {
  if (!H) return;
  const upd = () => { LS.set("ss-settings", H.set); hostBroadcast(); VIEW.render(); };
  $$("[data-lv]").forEach((b) => (b.onclick = () => { H.set.level = b.dataset.lv; SFX.tap(); upd(); }));
  $$("[data-len]").forEach((b) => (b.onclick = () => { H.set.len = b.dataset.len; SFX.tap(); upd(); }));
  $$("[data-wl]").forEach((b) => (b.onclick = () => { H.set.wl = b.dataset.wl; SFX.tap(); upd(); }));
  const t = $("#tPu"); if (t) t.onclick = () => { H.set.pu = !H.set.pu; SFX.tap(); upd(); };
}
function lobbyScreen() {
  show("lobby", () => {
    const d = lobbyData(), code = d.code, url = H ? joinURL() : location.origin + location.pathname + "?code=" + code;
    const shown = url.replace(/^https?:\/\//, "").replace(/\?.*$/, "").replace(/\/(index\.html)?$/, "");
    let qr = ""; try { const q = qrcode(0, "M"); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) {}
    const digits = code.split("").map((c, i) => (i === 3 ? "<i></i>" : "") + `<span>${c}</span>`).join("");
    const lvl = levelOf(d.set.l), tr = TRACKS.find((t) => t.k === d.set.len) || TRACKS[1];
    const startBtn = d.host ? `<button class="btn green startbtn" id="bStart">${ico("play", 28, 2.6, "#fff", "#fff")}<span>התחל מירוץ</span></button>` : "";
    if (MOBILE) {
      const top = 66;
      stage.innerHTML = `<section class="scr" id="s-lobby">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}</div></div>
        <div class="ttl" style="position:absolute;top:${top}px;left:0;right:0;text-align:center;font-size:30px">חדר המשחק</div>
        <div class="card mcard" id="joinCard" style="top:${top + 58}px">
          <div style="text-align:center;font:800 15px var(--ui)">קוד החדר</div>
          <div class="code en" translate="no" id="roomCode" style="margin:4px 0 10px">${digits}</div>
          <div class="qrrow"><div class="qrt" style="flex:1">הזמינו חברים<small>שיסרקו את הקוד או ייכנסו ל־</small><div class="en" style="font:700 13px var(--fred);color:var(--b2);margin-top:3px;word-break:break-all" translate="no">${esc(shown)}</div></div><div class="qrbox">${qr}</div></div>
          <div class="chips" style="justify-content:center;margin-top:10px">
            ${d.host ? `<button class="chip on blue" id="bSet">${ico("sliders", 16, 2.6)}<span>הגדרות</span></button>` : ""}
            <span class="chip on blue">${bars(LEVELS.indexOf(lvl) + 1, true)}<span>רמה: ${lvl.he}</span></span><span class="chip">אורך: ${tr.he}</span><span class="chip">${ico("zap", 15, 2.6)}<span>${d.set.pu ? "כוחות" : "בלי כוחות"}</span></span></div>
        </div>
        <div class="card mcard" id="plCard" style="top:400px;bottom:${d.host ? 96 : 118}px;overflow:hidden">
          <h3 style="font:900 19px var(--ui);display:flex;gap:9px;align-items:center;margin-bottom:8px"><span class="hi green">${ico("users", 20, 2.6, "#fff")}</span><span>מי כבר בחדר?</span><span class="cnt" id="plCnt"></span></h3>
          <div class="pl-grid" id="ptg"></div></div>
        ${d.host ? `<button class="btn green" id="bStart" style="position:absolute;left:20px;right:20px;bottom:18px;font-size:24px">${ico("play", 24, 2.6, "#fff", "#fff")}<span>התחל מירוץ</span></button>`
          : `<div class="sub" style="position:absolute;left:0;right:0;bottom:78px;justify-content:center;color:#fff;text-shadow:0 2px 0 var(--navy)">${ico("clock", 18, 2.6, "#fff")}<span>מחכים שהמורה יתחיל את המירוץ</span></div>
             <button class="btn wbtn" id="bChange" style="position:absolute;left:20px;right:20px;bottom:16px;font-size:20px">${ico("shirt", 22, 2.6)}<span>החלפת רץ ושם</span></button>`}
      </section>`;
      const place = () => { const jc = $("#joinCard"), pc = $("#plCard"); if (jc && pc) pc.style.top = (jc.offsetTop + jc.offsetHeight + 12) + "px"; };
      place(); requestAnimationFrame(place); setTimeout(place, 250);
    } else {
      stage.innerHTML = `<section class="scr" id="s-lobby">${bgDiv()}
        <div class="topbar">${topLeft()}<div style="position:absolute;left:50%;transform:translateX(-50%);top:-4px">${logo(42, 6, 4)}</div><div class="grp"><span class="pill"><span>חדר</span> <b class="en" translate="no">${code.slice(0, 3)} ${code.slice(3)}</b></span>${backHub()}</div></div>
        <div class="card lob-col join-c" id="joinCard">
          <h3><span class="hi blue">${ico(d.present ? "projector" : "smartphone", 20, 2.6, "#fff")}</span><span>מצטרפים למירוץ!</span>${H ? netBadge() : ""}</h3>
          <div class="lob-step"><b>1</b><span>היכנסו לכתובת</span></div>
          <div class="lob-url en" translate="no" style="font-size:${Math.round(Math.min(29, 640 / Math.max(10, shown.length)))}px">${esc(shown)}</div>
          <div class="lob-step"><b>2</b><span>הקלידו את קוד החדר</span></div>
          <div class="code en" translate="no" id="roomCode">${digits}</div>
          <div class="qrrow"><div class="qrt" style="flex:1">או סרקו את הקוד<small>עם המצלמה של הטלפון</small></div><div class="qrbox" id="qr">${qr}</div></div>
        </div>
        <div class="card lob-col pl-c" id="plCard"><h3><span class="hi green">${ico("users", 20, 2.6, "#fff")}</span><span>מי כבר בחדר?</span><span class="cnt" id="plCnt"></span></h3><div class="pl-grid" id="ptg"></div></div>
        <div class="card lob-col set-c" id="setCard"><h3><span class="hi purple">${ico("sliders", 20, 2.6, "#fff")}</span><span>הגדרות המירוץ</span></h3>${settingsHTML(d)}</div>
        ${startBtn}
        ${d.host ? `<span class="pill maxpill">${ico("users", 18, 2.6)}<span>עד 30 שחקנים בחדר</span></span>` : `<div class="pill" style="position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-size:19px">${ico("clock", 20, 2.6)}<span>מחכים שהמורה יתחיל את המירוץ</span></div>
          <button class="btn sm wbtn" id="bChange" style="position:absolute;bottom:22px;left:40px">${ico("shirt", 20, 2.6)}<span>החלפת רץ ושם</span></button>`}
      </section>`;
    }
    wireTop(); wireSettings();
    if ($("#bStart")) $("#bStart").onclick = () => { SFX.go(); hostStart(); };
    if ($("#bChange")) $("#bChange").onclick = () => characterScreen({ change: true, code: PS.code });
    if ($("#bSet")) $("#bSet").onclick = () => settingsSheet();
    const hb = $("#bHub"); if (hb && H) hb.onclick = (e) => { if (H.players.size && !confirm(T_("לסגור את החדר?"))) e.preventDefault(); };
    renderLobbyPlayers();
  });
}
function settingsSheet() {
  const dlg = document.createElement("div"); dlg.className = "menu-dlg"; dlg.id = "setDlg";
  const k2 = Math.min(1, window.innerWidth / 420);
  dlg.innerHTML = `<div class="card set-c" style="position:relative;inset:auto;width:388px;padding:18px;transform:scale(${k2})"><h3 style="font:900 21px var(--ui);display:flex;gap:9px;align-items:center"><span class="hi purple">${ico("sliders", 20, 2.6, "#fff")}</span><span>הגדרות המירוץ</span></h3><div id="setBody">${settingsHTML(lobbyData())}</div>
    <button class="btn green" id="bSetOk" style="margin-top:14px;width:100%">${ico("check", 22, 3)}<span>סגירה</span></button></div>`;
  document.body.appendChild(dlg);
  const rewire = () => {
    const re = () => { LS.set("ss-settings", H.set); hostBroadcast(); $("#setBody").innerHTML = settingsHTML(lobbyData()); rewire(); };
    $$("#setBody [data-lv]").forEach((b) => (b.onclick = () => { H.set.level = b.dataset.lv; re(); }));
    $$("#setBody [data-len]").forEach((b) => (b.onclick = () => { H.set.len = b.dataset.len; re(); }));
    $$("#setBody [data-wl]").forEach((b) => (b.onclick = () => { H.set.wl = b.dataset.wl; re(); }));
    const t = $("#setBody #tPu"); if (t) t.onclick = () => { H.set.pu = !H.set.pu; re(); };
  };
  rewire();
  $("#bSetOk").onclick = () => { dlg.remove(); if (VIEW.name === "lobby") VIEW.render(); };
}
function renderLobbyPlayers() {
  const g = $("#ptg"); if (!g) return;
  const d = lobbyData(), ps = d.pl;
  const many = ps.length > 9 && !MOBILE;
  const xl = ps.length > 20 && !MOBILE;
  g.classList.toggle("many", many); g.classList.toggle("xl", xl);
  const size = MOBILE ? 54 : xl ? 38 : many ? 44 : 66;
  const meP = PS.pid;
  let html = ps.map((p) => `<div class="pcell ${p[4] ? "" : "off"}">${av(p[2], size, p[0] === meP ? "me" : "")}<div class="n" translate="no">${esc(p[1])}${p[0] === meP ? ` <span style="color:var(--navy2)">(${T_("אני")})</span>` : ""}</div></div>`).join("");
  const minCells = MOBILE ? 8 : many ? 10 : 9;
  for (let i = ps.length; i < minCells; i++) html += `<div class="pcell wait"><span class="av empty" style="width:${size}px;height:${size}px;margin:0 auto 4px">${ico("user", size * 0.45, 2.4)}</span><div class="n">מחכים…</div></div>`;
  g.innerHTML = html;
  const c = $("#plCnt"); if (c) c.innerHTML = `<b class="fred">${ps.length}</b> <span>שחקנים</span>`;
  if (MOBILE && $("#ptg .me")) $("#ptg .me").style.boxShadow = "0 0 0 4px #ffc83a";
}

/* ================= PLAYER (every runner, including the host's own runner in an online room) ================= */
const PS = { code: "", name: "", ch: "zik", pid: 0, net: null, local: false, st: null, race: 0, G: null, bar: [], sel: -1, held: null, pending: null, seq: 0, recorded: {}, resume: null };
let PROJ = null;            // the projector's engine (presentation-mode host)
function leaveAll() {
  stopGame();
  try { if (PS.net) { PS.net.send({ t: "bye" }); PS.net.close(); } } catch (e) {}
  clearInterval(PS.helloT); clearInterval(PS.pingT); clearInterval(PS.watch); clearTimeout(PS._rc);
  Object.assign(PS, { code: "", pid: 0, net: null, local: false, st: null, race: 0, bar: [], held: null, pending: null, resume: null });
  if (H) { clearInterval(H.timer); clearInterval(H.beat); clearInterval(H.snapT); try { H.net && H.net.broadcast({ t: "closed" }); } catch (e) {} setTimeout(((n) => () => { try { n && n.close(); } catch (e) {} })(H.net), 300); H = null; }
  const d = $("#setDlg"); if (d) d.remove();
}
function playerJoin(code, name, ch) {
  leaveAll();
  Object.assign(PS, { code, name, ch, pid: 0 });
  LS.set("ss-join", { code, name, ch, at: now() });
  try { history.replaceState(null, "", location.pathname + "?code=" + code + (TEST ? "&test=1" : "")); } catch (e) {}
  PS.st = null; lobbyScreen(); banner("מתחברים לחדר…");
  connectPlayer();
}
function connectPlayer() {
  try { PS.net && PS.net.close(); } catch (e) {}
  clearInterval(PS.helloT); clearInterval(PS.pingT); clearInterval(PS.watch);
  const code = PS.code;
  PS.net = SSNet.join(code, CID, (m) => playerOnMsg(m, false), (k) => {
    if (k === "ready") { sendHello(); clearInterval(PS.helloT); PS.helloT = setInterval(() => { if (!PS.pid) sendHello(); }, 2000); }
    else if (k === "noroom") { if (!PS.pid) { LS.set("ss-join", null); joinScreen(code, T_("לא נמצא חדר עם הקוד הזה")); } }
    else if (k === "lost") reconnectSoon();
  });
  PS.lastMsg = now();
  PS.pingT = setInterval(() => PS.net && PS.net.send({ t: "ping" }), 4000);
  PS.watch = setInterval(() => { if (now() - PS.lastMsg > 12000) { banner("מתחברים מחדש…"); PS.lastMsg = now(); reconnectSoon(); } }, 3000);
}
function reconnectSoon() { if (PS._rc || PS.local) return; PS._rc = setTimeout(() => { PS._rc = null; if (PS.code) { PS.pid = 0; connectPlayer(); } }, 1500); }
const sendHello = () => PS.net && PS.net.send({ t: "hello", name: PS.name, ch: PS.ch });
const toHost = (m) => { if (PS.local) { if (H) hostRecv(Object.assign({ cid: CID }, m), CID); } else if (PS.net) PS.net.send(m); };
const slowLink = () => !PS.local && PS.net && PS.net.via === "n";
function banner(txt, ms) {
  let b = $("#banner"); if (!b) { b = document.createElement("div"); b.id = "banner"; b.className = "pill"; b.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:80;font-size:17px"; document.body.appendChild(b); }
  b.textContent = T_(txt); clearTimeout(b._t); if (ms) b._t = setTimeout(() => b.remove(), ms);
}
const clearBanner = () => { const b = $("#banner"); if (b) b.remove(); };

function playerOnMsg(m, local) {
  if (!m || !m.t) return;
  PS.lastMsg = now();
  if (m.t === "you") { PS.pid = m.pid; clearInterval(PS.helloT); clearBanner(); if (m.race && m.x > 300) PS.resume = { race: m.race, x: m.x, y: m.y, held: m.held }; if (PS.st) playerOnMsg(PS.st, false); return; }
  if (m.t === "late" || m.t === "full" || m.t === "closed") {
    if (local) return;
    const msg = { late: "המירוץ כבר התחיל. חכו למירוץ הבא", full: "החדר מלא (30 שחקנים)", closed: "החדר נסגר" }[m.t];
    const code = PS.code; LS.set("ss-join", null); joinScreen(code, T_(msg)); return;
  }
  if (m.t === "sn") { if (PS.G) onSnap(m, PS.G); return; }
  if (m.t === "fx") { if (PS.G) onFx(m, PS.G); return; }
  if (m.t === "sr") return onSentenceResult(m);
  if (m.t === "ur") return onUseResult(m);
  if (m.t === "fin") { PS.finPlace = m.place; PS.finBonus = m.bonus; showFinish(); return; }
  if (m.t !== "st") return;
  const prev = PS.st; PS.st = m;
  if (!local && !PS.pid) return;
  if (!local && !m.pl.some((x) => x[0] === PS.pid)) { PS.pid = 0; sendHello(); return; }
  clearBanner();
  if (m.race !== PS.race) { PS.race = m.race; PS.recorded = {}; PS.sessionStart = now(); }
  if (m.ph === "lobby") {
    if (VIEW.name !== "lobby" || (prev && JSON.stringify(prev.set) !== JSON.stringify(m.set))) lobbyScreen(); else renderLobbyPlayers();
    return;
  }
  if (m.ph === "end") { recordEnd(m); if (PS.dismissed === m.race) { if (VIEW.name !== "lobby") lobbyScreen(); return; } if (VIEW.name !== "results") resultsScreen(m, false); return; }
  if (VIEW.name !== "game" || !PS.G || PS.G.race !== m.race) gameScreen(m, false); else gameState(m);
}

/* ================= 04 GAME ================= */
let GAME = null;   // {el, G, projector, st, iv}
function hideGame() { stopGame(); }
function stopGame() {
  if (!GAME) return;
  try { GAME.G.stop(); } catch (e) {}
  clearInterval(GAME.iv); clearInterval(GAME.posIv);
  window.removeEventListener("keydown", onKey);
  GAME.el.remove(); GAME = null; PS.G = null; PROJ = null;
  document.body.classList.remove("ingame");
}
function playersMap(st) { const m = new Map(); for (const p of st.pl) m.set(p[0], { name: p[1], ch: p[2], rank: p[9] }); return m; }
function gameScreen(st, projector) {
  stopGame();
  VIEW = { name: "game", render: null };
  vp.style.display = "none";
  const set = { level: st.set.l, len: st.set.len, wl: st.set.wl };
  const L = buildLevel(set, st.seed);
  const el = document.createElement("div"); el.id = "game"; el.className = DIR === "ltr" ? "ltr" : "";
  document.body.appendChild(el); document.body.classList.add("ingame");
  el.innerHTML = `<canvas id="cv" aria-label="Sentence Sprint"></canvas><div id="hud"></div>`;
  const me = st.pl.find((p) => p[0] === PS.pid);
  const G = createGame($("#cv", el), {
    level: L, myPid: projector ? 0 : PS.pid, players: playersMap(st), projector, low: LOW, speed: (GEN[set.level] || GEN.normal).speed,
    meLabel: T_("אני"), rtl: DIR === "rtl", slowLink, myCh: me ? me[2] : PS.ch, sfx: (k) => k === "jump" && SFX.jump(),
    onCollect: (b) => { PS.bar.push({ w: b.w, id: b.id }); SFX.word(); renderBar(); return true; },
    canCollect: () => PS.bar.length < L.hi,
    onFull: () => { const sb = $("#sbar"); if (sb) { sb.classList.remove("full"); void sb.offsetWidth; sb.classList.add("full"); } toast(T_("הפס מלא: שלחו את המשפט או מחקו מילה"), "", 1400); },
    onFinish: () => { toHost({ t: "p", x: Math.round(G.me.x), y: Math.round(G.me.y), f: G.flags() }); }
  });
  G.race = st.race;
  GAME = { el, G, projector, st, L, startPerf: performance.now() + st.go, endPerf: performance.now() + st.left, lastCd: null };
  if (projector) PROJ = G; else PS.G = G;
  Object.assign(PS, { bar: [], sel: -1, held: null, pending: null, finPlace: 0, seq: 0 });
  if (!projector && PS.resume && PS.resume.race === st.race) { G.me.x = PS.resume.x; G.me.y = Math.min(510, PS.resume.y); PS.held = PS.resume.held || null; PS.resume = null; }
  gameLayout(); buildHud(); G.start(GAME.startPerf);
  GAME.iv = setInterval(hudTick, 200);
  if (!projector) {
    let lastSent = 0;
    GAME.posIv = setInterval(() => {
      if (!PS.G) return;
      const t = performance.now(), via = PS.local ? "l" : PS.net ? PS.net.via : "";
      const every = via === "n" ? 2600 : via === "s" ? 250 : 100;
      if (t - lastSent < every) return; lastSent = t;
      toHost({ t: "p", x: Math.round(G.me.x), y: Math.round(G.me.y), f: G.flags() });
    }, 100);
    window.addEventListener("keydown", onKey);
    const cv = $("#cv", el); cv.addEventListener("pointerdown", (e) => { e.preventDefault(); G.jump(); });
  }
  gameState(st);
}
function gameLayout() {
  if (!GAME) return;
  const vw = window.innerWidth, vh = window.innerHeight, el = GAME.el;
  const portrait = vh > vw, phone = Math.min(vw, vh) < 560;
  let k;
  if (portrait) k = Math.min(vw / 720, vh / 900);
  else if (phone) k = Math.min(vw / 1100, vh / 560);
  else k = Math.min(vw / 1280, vh / 720);
  el.style.setProperty("--k", k.toFixed(4));
  el.classList.toggle("gp", portrait); el.classList.toggle("gm", phone && !portrait); el.classList.toggle("gd", !phone && !portrait);
  // usable width of the sentence bar in base px (between the power and jump buttons)
  const baseW = vw / k;
  el.style.setProperty("--bw", Math.max(420, Math.min(960, baseW - (portrait ? 20 : phone ? 2 * 178 : 2 * 232))) + "px");
  GAME.G.resize();
  if (GAME.built) { renderBar(); }
}
function buildHud() {
  const hud = $("#hud", GAME.el), proj = GAME.projector;
  if (proj) {
    hud.innerHTML = `<div class="hud tl"><div class="row"><span class="hp" id="hTime">${ico("clock", 20, 2.6)}<b class="en">0:00</b></span><span class="hp"><span>חדר</span> <b class="en" translate="no">${H.code.slice(0, 3)} ${H.code.slice(3)}</b></span></div></div>
      <div class="hud tc"><div class="prog" id="prog" style="width:620px"><span class="fl s">${ico("flag", 22, 2.6)}</span><div class="tr"><div class="fill" id="pfill"></div><div id="heads"></div></div><span class="fl e">${ico("flag-fin", 22, 2.4)}</span></div></div>
      <div class="hud tr"><div class="row"><button class="gbtn" id="bEnd">${ico("flag-fin", 18, 2.4)}<span>סיים מירוץ</span></button><a class="gbtn" id="gHub" href="${HUB}">${ico(BACK, 18, 2.8)}<span>אנגלישיה</span></a></div></div>
      <div class="hud lbw" style="left:calc(14px*var(--k));top:calc(70px*var(--k));transform-origin:0 0"><div class="card lb" id="lb"></div></div>
      <div class="hud bc"><div class="feed" id="feed"></div></div>
      <div class="ov" id="ov"></div>`;
    $("#bEnd").onclick = () => { if (confirm(T_("לסיים את המירוץ עכשיו?"))) hostEnd(); };
    $("#gHub").onclick = (e) => { if (!confirm(T_("לסגור את החדר?"))) e.preventDefault(); };
  } else {
    hud.innerHTML = `<div class="hud tl"><div class="row"><span class="hp" id="hPts"><span>ניקוד</span> <b class="en o">0</b></span><span class="hp" id="hPlace"><span>מקום</span> <b class="en">1/1</b></span></div><span class="hp" id="hTime">${ico("clock", 18, 2.6)}<b class="en">0:00</b></span></div>
      <div class="hud tc"><div class="prog" id="prog"><span class="fl s">${ico("flag", 20, 2.6)}</span><div class="tr"><div class="fill" id="pfill"></div><div id="heads"></div></div><span class="fl e">${ico("flag-fin", 20, 2.4)}</span></div></div>
      <div class="hud tr"><div class="row"><a class="gbtn" id="gHub" href="${HUB}">${ico(BACK, 18, 2.8)}<span>אנגלישיה</span></a><button class="gbtn ic" id="bMenu" aria-label="תפריט" title="תפריט">${ico("pause", 22, 2.6, "currentColor", "currentColor")}</button></div></div>
      <div class="hud bl"><button class="pwr empty" id="bPwr" aria-label="הפעל כוח-על"><img id="pwrImg" src="${IMG_BASE}pu-boost-speed.png" alt=""><span class="e"><span>הפעל</span><kbd>E</kbd></span></button></div>
      <div class="hud bc"><div class="sbar" id="sbar"><div class="lab"><div class="a">${ico("puzzle", 14, 2.6)}<span>בנו משפט באנגלית</span></div><div class="b" id="sHint"></div></div>
        <div class="slots" id="slots"></div><span class="scount" id="scount"></span>
        <div class="sact"><button class="btn wbtn" id="bUndo" aria-label="מחק מילה" title="מחק מילה (Backspace)">${ico("undo", 26, 2.8)}</button><button class="btn green go" id="bSend" title="Enter">${ico("check", 24, 3.2)}<span>שלח</span></button></div></div></div>
      <div class="hud br"><div class="keys"><span class="gbtn">${ico("arrow-up", 15, 3)}<span>קפיצה</span><kbd>SPACE</kbd></span><span class="gbtn">${ico("arrow-up", 15, 3)}<span>קפיצה כפולה</span><kbd>×2</kbd></span><span class="gbtn">${ico("check", 15, 3)}<span>שלח</span><kbd>ENTER</kbd></span></div>
        <button class="btn green jump" id="bJump" aria-label="קפיצה">${ico("arrow-up", 54, 3.4)}<span>קפיצה</span></button></div>
      <div class="rot">${ico("phone-rot", 20, 2.6, "#fff")}<span>סובבו את הטלפון לרוחב</span></div>
      <div class="ov" id="ov"></div>`;
    $("#bJump").addEventListener("pointerdown", (e) => { e.preventDefault(); PS.G && PS.G.jump(); });
    $("#bPwr").onclick = () => usePower();
    $("#bUndo").onclick = () => undoWord();
    $("#bSend").onclick = () => submitSentence();
    $("#bMenu").onclick = () => gameMenu();
    $("#gHub").onclick = (e) => { if (!confirm(T_("לצאת מהמירוץ?"))) e.preventDefault(); };
    renderBar(); renderPower();
  }
  GAME.built = true;
}
function onKey(e) {
  if (!PS.G || $(".menu-dlg")) return;
  const c = e.code;
  if (c === "Space" || c === "ArrowUp" || c === "KeyW") { e.preventDefault(); if (!e.repeat) PS.G.jump(); }
  else if (c === "KeyE") { e.preventDefault(); usePower(); }
  else if (c === "Enter" || c === "NumpadEnter") { e.preventDefault(); submitSentence(); }
  else if (c === "Backspace" || c === "Delete") { e.preventDefault(); undoWord(); }
  else if (/^Digit[1-8]$/.test(c)) { e.preventDefault(); tapTile(+c.slice(5) - 1); }
}
/* ---------- sentence bar ---------- */
function liveValid() { const L = GAME && GAME.L; if (!L) return false; const w = PS.bar.map((b) => b.w); return w.length >= L.lo && check(w).ok; }
function renderBar() {
  const sl = $("#slots"); if (!sl || !GAME) return;
  const L = GAME.L, cfg = GEN[GAME.st.set.l] || GEN.normal, n = PS.bar.length;
  const col = ["pink", "blue", "orange", "teal", "purple", "green", "yellow", "red"];
  let html = PS.bar.map((b, i) => `<button class="tile ${col[(b.id || i) % 8]} ${PS.sel === i ? "sel" : ""}" data-i="${i}" translate="no">${esc(disp(b.w))}${cfg.glossBar ? `<small>${esc(gloss(b.w, LANG))}</small>` : ""}</button>`).join("");
  for (let i = n; i < L.hi; i++) html += `<span class="slot ${i === n ? "next" : ""} ${i >= L.lo ? "opt" : ""}">${i === n ? "?" : ""}</span>`;
  sl.innerHTML = html;
  sl.className = "slots";
  $("#scount").textContent = `${n}/${L.hi}`;
  const ok = cfg.liveOk && liveValid();
  const hint = $("#sHint");
  if (ok) { hint.className = "b good"; hint.textContent = T_("משפט נכון! לחצו שלח"); }
  else { hint.className = "b"; hint.textContent = n < L.lo ? T_("אספו מילים מהמסלול") : T_("סדרו את המילים ושלחו"); }
  $("#bSend").classList.toggle("ready", !!ok); $("#bSend").disabled = !!PS.pending;
  $$(".tile", sl).forEach((t) => (t.onclick = () => tapTile(+t.dataset.i)));
  // shrink the tiles until they fit
  const bar = $("#sbar");
  for (const cls of ["t1", "t2"]) { if (bar.scrollWidth <= bar.clientWidth + 1 && sl.scrollWidth <= sl.clientWidth + 1) break; sl.classList.add(cls); }
}
function tapTile(i) {
  if (i >= PS.bar.length) return;
  if (PS.sel < 0) PS.sel = i;
  else if (PS.sel === i) PS.sel = -1;
  else { const a = PS.bar[PS.sel]; PS.bar[PS.sel] = PS.bar[i]; PS.bar[i] = a; PS.sel = -1; }
  SFX.tap(); renderBar();
}
function undoWord() {
  if (!PS.bar.length) return;
  if (PS.sel >= 0) PS.bar.splice(PS.sel, 1); else PS.bar.pop();
  PS.sel = -1; SFX.tap(); renderBar();
}
function submitSentence() {
  if (!GAME || GAME.projector || PS.pending) return;
  const L = GAME.L, w = PS.bar.map((b) => b.w);
  if (performance.now() < GAME.startPerf) return;
  if (w.length < L.lo) { toast(T_("צריך לפחות") + " " + L.lo + " " + T_("מילים במשפט"), "bad", 1500); SFX.no(); return; }
  PS.seq++; PS.pending = { k: PS.seq, w, t: now() };
  toHost({ t: "sent", w, k: PS.seq });
  renderBar();
  setTimeout(() => { if (PS.pending && PS.pending.k === PS.seq) { PS.pending = null; renderBar(); } }, 4000);
}
function onSentenceResult(m) {
  const p = PS.pending; if (!p || p.k !== m.k) return;
  PS.pending = null;
  const words = p.w, level = GAME ? GAME.st.set.l : "normal";
  if (m.ok) {
    PS.bar = []; PS.sel = -1; renderBar(); SFX.ok();
    if (GEN[level] && GEN[level].glossBar) speak(pretty(words));
    recordAnswer(words, true);
    bumpScore(m.pts);
    if (m.pu) roulette(words, m.pts, m.pu); else toast(`+${m.pts} · ${T_("משפט נכון!")}`, "good", 1600);
  } else if (m.why === "dup") { toast(T_("כבר בניתם את המשפט הזה. נסו משפט אחר"), "bad", 1800); SFX.no(); renderBar(); }
  else if (m.why === "fast") renderBar();
  else {
    SFX.no(); if (PS.G) PS.G.apply("wrong");
    const sb = $("#sbar"); if (sb) { sb.classList.remove("shake"); void sb.offsetWidth; sb.classList.add("shake"); }
    toast(T_("זה עדיין לא משפט נכון. סדרו או החליפו מילים"), "bad", 1900);
    recordAnswer(words, false); renderBar();
  }
}
function bumpScore(pts) { const b = $("#hPts b"); if (b) b.textContent = String((+b.textContent || 0) + pts); }
/* ---------- power-ups ---------- */
function renderPower() {
  const b = $("#bPwr"); if (!b) return;
  const k = PS.held;
  b.classList.toggle("empty", !k); b.classList.toggle("has", !!k);
  $("#pwrImg").src = IMG_BASE + (k ? PU[k].img : "pu-boost-speed") + ".png";
  b.title = k ? T_(PU[k].he) : T_("אין כוח-על. בנו משפט נכון כדי לזכות");
}
function usePower() {
  if (!PS.G || !PS.held || PS.using || performance.now() < GAME.startPerf) return;
  const k = PS.held;
  PS.using = 1; setTimeout(() => (PS.using = 0), 600);
  if (PU[k].boost) { applyBoost(k); PS.held = null; renderPower(); }
  toHost({ t: "use", k });
}
function applyBoost(k) {
  const G = PS.G; if (!G) return;
  if (k === "shield") { G.shield = true; clearTimeout(PS.shT); PS.shT = setTimeout(() => (G.shield = false), DUR.shield * 1000); }
  else G.apply(k);
  SFX.go(); toast(T_(PU[k].he) + "!", "good", 1100);
}
function onUseResult(m) {
  if (!m.ok) { if (m.why === "ahead") toast(T_("אין אף אחד לפניכם. שמרו את הכוח"), "", 1700); return; }
  if (!PU[m.k].boost) { PS.held = null; renderPower(); SFX.go(); toast(m.bl ? T_("המגן של היריב חסם את ההתקפה") : `${T_(PU[m.k].he)} → ${m.bn || ""}`, m.bl ? "" : "good", 1500); }
}
function onFx(m, G) {
  if (!G) return;
  const mine = !GAME.projector && m.b === PS.pid && m.a !== PS.pid;
  if (!PU[m.k]) return;
  if (PU[m.k].boost) return;   // boosts are drawn from the owner's flags
  G.addFx(m.bl ? "blocked" : m.k, m.a, m.b);
  if (mine) {
    if (m.bl) { G.shield = false; toast(T_("המגן חסם התקפה!"), "good", 1500); return; }
    setTimeout(() => { G.apply(m.k); SFX.hit(); }, m.k === "rocket" ? 600 : 0);
    toast(`${T_(PU[m.k].he)}! (${m.an || ""})`, "bad", 1500);
  }
}
function onSnap(m, G) {
  const t = performance.now();
  for (const [pid, x, y, f] of m.p) G.sample(pid, x, y, f, t);
}
function roulette(words, pts, pu) {
  const ov = $("#ov"); if (!ov) return;
  const keys = PU_KEYS, items = [];
  for (let i = 0; i < 26; i++) items.push(keys[Math.floor(Math.random() * keys.length)]);
  const win = 21; items[win] = pu;
  const ch = PS.ch;
  ov.innerHTML = `<div class="ovk"><div class="rou">
    <div class="head"><span class="hi green" style="width:46px;height:46px;border-radius:50%">${ico("check", 28, 3.4, "#fff")}</span><span class="ttl" style="font-size:44px">משפט נכון!</span><span class="plus en">+${pts}</span></div>
    <div class="sent">${words.map((w) => `<span class="tile">${esc(disp(w))}</span>`).join("")}</div>
    <div class="arr d"></div>
    <div class="strip"><div class="rail" id="rail">${items.map((k) => `<div class="it"><img src="${IMG_BASE}${PU[k].img}.png" alt=""><i style="background:${PU[k].boost ? "#14b05a" : "#f2392c"}"></i></div>`).join("")}</div><div class="win"></div></div>
    <div class="arr u"></div>
    <div class="lbl" id="rlbl">${ico("shuffle", 30, 2.8, "#fff")}<span>מגריל כוח-על…</span></div>
    <div class="legend"><span><i style="background:#14b05a"></i>עוזר לי</span><span><i style="background:#f2392c"></i>פוגע ביריבים</span></div>
    ${MOBILE || LOW ? "" : `<img class="cheer" src="${IMG_BASE}cheer-${ch}.png" alt="">`}
  </div></div>`;
  ov.classList.add("dim"); ov.classList.toggle("lowfx", LOW); GAME.el.classList.add("rouon");
  const box = ov.firstElementChild, needH = box.scrollHeight + 24, k = parseFloat(getComputedStyle(GAME.el).getPropertyValue("--k")) || 1;
  box.style.transform = `translate(-50%,-50%) scale(${Math.min(k, window.innerHeight / needH, window.innerWidth / 1240).toFixed(3)})`;
  const rail = $("#rail"), itemW = 118 + 22, stripW = 760;
  const target = -(win * itemW + itemW / 2 - stripW / 2) + 11;
  rail.style.transform = "translateX(0px)";
  void rail.offsetWidth;
  rail.style.transition = "transform 2s cubic-bezier(.15,.65,.18,1)";
  rail.style.transform = `translateX(${target}px)`;
  let n = 0; const tk = setInterval(() => { if (++n > 18) return clearInterval(tk); SFX.roll(); }, 100);
  clearTimeout(PS.rouT);
  PS.rouT = setTimeout(() => {
    const l = $("#rlbl"); if (l) l.innerHTML = `${ico("zap", 30, 2.8, "#fff")}<span>${esc(T_("קיבלתם:"))} ${esc(T_(PU[pu].he))}</span>`;
    PS.held = pu; renderPower(); SFX.go();
    PS.rouT = setTimeout(() => { const o = $("#ov"); if (o && o.querySelector(".rou")) { o.innerHTML = ""; o.classList.remove("dim"); } if (GAME) GAME.el.classList.remove("rouon"); }, 900);
  }, 2100);
}
let toastT = 0;
function toast(txt, kind, ms) {
  if (!GAME) return;
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; GAME.el.appendChild(t); }
  t.className = "toast " + (kind || ""); t.textContent = txt; t.style.display = "";
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = "none"; }, ms || 1500);
}
function showFinish() {
  const ov = $("#ov"); if (!ov || !GAME) return;
  SFX.win(); ov.classList.remove("dim"); GAME.el.classList.remove("rouon");
  ov.innerHTML = `<div class="ovk"><div class="fin-ov"><div class="big">${esc(T_("סיימתם!"))} <span>${esc(T_("מקום"))}</span> <b class="en">${PS.finPlace}</b></div>
    <div class="sm"><span class="en" style="color:var(--o2);font-weight:700">+${PS.finBonus}</span> <span>${esc(T_("נקודות על הסיום"))}</span></div><div class="sm" id="finWait">${esc(T_("ממתינים לשאר הרצים…"))}</div></div></div>`;
}
function gameMenu() {
  const dlg = document.createElement("div"); dlg.className = "menu-dlg";
  dlg.innerHTML = `<div class="card" style="--k2:${Math.min(1.2, Math.max(0.7, Math.min(window.innerWidth, window.innerHeight) / 420))}"><h3>תפריט</h3>
    <button class="btn wbtn" id="mSound">${ico(MUTE ? "volume-x" : "volume-on", 22, 2.6)}<span>${MUTE ? "צליל: כבוי" : "צליל: פועל"}</span></button>
    <button class="btn wbtn" id="mGfx">${ico(LOW ? "gauge" : "image", 22, 2.6)}<span>${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}</span></button>
    ${H ? `<button class="btn orange" id="mEnd">${ico("flag-fin", 22, 2.4)}<span>סיים את המירוץ לכולם</span></button>` : ""}
    <button class="btn red" id="mLeave">${ico("door", 22, 2.6)}<span>יציאה מהמירוץ</span></button>
    <button class="btn green" id="mClose">${ico("play", 22, 2.6, "#fff", "#fff")}<span>חזרה למירוץ</span></button></div>`;
  GAME.el.appendChild(dlg);
  const close = () => dlg.remove();
  $("#mClose", dlg).onclick = close;
  $("#mSound", dlg).onclick = () => { MUTE = !MUTE; LS.set("ss-mute", MUTE); close(); };
  $("#mGfx", dlg).onclick = () => { LOW = !LOW; LS.set("ss-gfx", LOW ? "low" : "normal"); document.body.classList.toggle("low", LOW); if (GAME) { GAME.G.low = LOW; GAME.G.resize(); } close(); };
  if ($("#mEnd", dlg)) $("#mEnd", dlg).onclick = () => { close(); hostEnd(); };
  $("#mLeave", dlg).onclick = () => { if (confirm(T_("לצאת מהמירוץ?"))) { LS.set("ss-join", null); homeScreen(); } };
}
/* new room state during the race: names, ranks, points, finish */
function gameState(st) {
  if (!GAME) return;
  GAME.st = st;
  const G = GAME.G;
  G.players = playersMap(st); 
  GAME.endPerf = performance.now() + st.left;
  if (Math.abs(performance.now() + st.go - GAME.startPerf) > 400 && st.go > 0) { GAME.startPerf = performance.now() + st.go; G.startAt = GAME.startPerf; }
  const me = st.pl.find((p) => p[0] === PS.pid);
  if (me && !GAME.projector) { const b = $("#hPts b"); if (b) b.textContent = String(me[3]); }
  if (GAME.projector) renderBoard(st);
}
function renderBoard(st) {
  const lb = $("#lb"); if (!lb) return;
  const order = st.pl.slice().sort((a, b) => a[9] - b[9]).slice(0, 8);
  lb.innerHTML = `<h4>${ico("trophy", 22, 2.6, "#ff7a00")}<span>טבלת הניקוד</span></h4>` + order.map((p) => `<div class="rr"><span class="rk">${p[9]}</span>${av(p[2], 32)}<span class="n" translate="no">${esc(p[1])}</span><span class="s">${p[3]}</span></div>`).join("");
  const fd = $("#feed"); if (fd) fd.innerHTML = (st.feed || []).slice(-3).map((f) => `<div class="fi">${av(f.ch, 34)}<span translate="no">${esc(f.n)}</span><span class="en" translate="no">${esc(f.s)}</span><b>+${f.pts}</b></div>`).join("");
}
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function hudTick() {
  if (!GAME) return;
  const G = GAME.G, st = GAME.st, t = performance.now();
  // countdown
  const ov = $("#ov");
  const cd = Math.ceil((GAME.startPerf - t) / 1000);
  if (cd > 0 && cd <= 3) { if (GAME.lastCd !== cd) { GAME.lastCd = cd; ov.innerHTML = `<div class="ovk"><div class="cdown en">${cd}</div></div>`; SFX.tick(); } }
  else if (cd > 3) { if (GAME.lastCd !== "w") { GAME.lastCd = "w"; ov.innerHTML = `<div class="ovk"><div class="fin-ov"><div class="big">${esc(T_("מתכוננים…"))}</div><div class="sm">${esc(T_(GAME.projector ? "התלמידים רצים מהטלפון" : "קופצים ברווח או בכפתור הקפיצה"))}</div></div></div>`; } }
  else if (GAME.lastCd !== "go" && GAME.lastCd !== "done") { GAME.lastCd = "go"; ov.innerHTML = `<div class="ovk"><div class="cdown en">GO!</div></div>`; SFX.go(); setTimeout(() => { if (GAME && GAME.lastCd === "go") { GAME.lastCd = "done"; const o = $("#ov"); if (o && o.querySelector(".cdown")) o.innerHTML = ""; } }, 700); }
  // timer
  const tm = $("#hTime b"); if (tm) tm.textContent = fmt(Math.min(GAME.endPerf - t, Math.max(0, GAME.endPerf - t)));
  if (PS.finPlace && $("#finWait")) $("#finWait").textContent = T_("ממתינים לשאר הרצים…") + " " + fmt(GAME.endPerf - t);
  // positions: me + everyone from the snapshots
  const pos = [];
  for (const p of st.pl) {
    const q = G.posOf(p[0]);
    if (!q && !(G.me && p[0] === PS.pid)) continue;
    const x = G.me && p[0] === PS.pid ? G.me.x : q.x;
    pos.push({ pid: p[0], ch: p[2], x, fin: p[5] || (G.me && p[0] === PS.pid && PS.finPlace) || 0 });
  }
  pos.sort((a, b) => (a.fin || 999) - (b.fin || 999) || b.x - a.x);
  const pl = $("#hPlace b"); if (pl) { const i = pos.findIndex((p) => p.pid === PS.pid); pl.textContent = `${i < 0 ? "-" : i + 1}/${st.pl.length}`; }
  const heads = $("#heads");
  if (heads) {
    let lead = 0; for (const p of pos) lead = Math.max(lead, G.progress(p.x));
    const myProg = G.me ? G.progress(G.me.x) : lead;
    $("#pfill").style.width = (100 * (GAME.projector ? lead : myProg)).toFixed(1) + "%";
    const shown = pos.slice(0, 30).reverse();
    heads.innerHTML = shown.map((p) => { const c = CHAR_COLORS[p.ch] || CHAR_COLORS.zik; const me = p.pid === PS.pid && !GAME.projector; return `<span class="av hd ${me ? "me" : ""}" style="left:${(100 * G.progress(p.x)).toFixed(1)}%;--c1:${c[0]};--c2:${c[1]}"><img src="${IMG_BASE}head-${p.ch}.png" alt=""></span>`; }).join("");
  }
}

/* ---------- results to the Englishia account (logged-in players only, from their own device) ---------- */
function recordAnswer(words, ok) {
  try {
    if (!window.EnglishiaAuth || !EnglishiaAuth.user) return;
    const s = pretty(words), alt = ok ? null : findOrder(words);
    EnglishiaAuth.recordAnswer(GAME_ID, { item: "sentence:" + s.slice(0, 60), topic: "בניית משפטים", level: GAME ? GAME.st.set.l : "", prompt: `Build an English sentence (${words.length} words)`,
      correct: ok, given: s, expected: ok ? s : alt ? pretty(alt) : "any correct sentence" });
  } catch (e) {}
}
function recordEnd(m) {
  try {
    if (!window.EnglishiaAuth || !EnglishiaAuth.user || m.mode === "present" && PS.local) return;
    const key = "end:" + m.race; if (PS.recorded[key]) return; PS.recorded[key] = 1;
    const me = m.pl.find((p) => p[0] === PS.pid); if (!me) return;
    EnglishiaAuth.recordSession(GAME_ID, me[3], Math.max(1, Math.round((now() - (PS.sessionStart || now())) / 1000)));
    if (EnglishiaAuth.flushAnswers) EnglishiaAuth.flushAnswers();
  } catch (e) {}
}
const waitScreen = () => lobbyScreen();

/* ================= 06 RESULTS ================= */
function resultsScreen(st, projector) {
  if (!st) return;
  show("results", () => {
    const order = st.pl.slice().sort((a, b) => a[9] - b[9]);
    const me = projector ? null : order.find((p) => p[0] === PS.pid);
    const top3 = [order[0], order[1], order[2]];
    const rest = order.length > 3 ? order.slice(3) : order;
    const W = MOBILE ? 360 : 640, ih = Math.round(W * 313 / 800);
    // physical spots on the podium image: bronze left, gold middle, silver right
    const spots = [{ i: 0, cx: 0.491, top: 0.005, c: "gold" }, { i: 1, cx: 0.79, top: 0.2 }, { i: 2, cx: 0.193, top: 0.337 }];
    const baseB = MOBILE ? 0 : 40;
    const pod = spots.map((s) => {
      const p = top3[s.i]; const blockTop = baseB + Math.round((1 - s.top) * ih);
      const left = Math.round(s.cx * W);
      const chH = Math.round((MOBILE ? (s.i ? 104 : 120) : (s.i ? 172 : 196)));
      const label = `<div class="pod" style="left:${left}px;top:${(MOBILE ? ih + 130 : 560) - blockTop + (MOBILE ? 10 : 18)}px;width:${MOBILE ? 100 : 160}px"><div class="pl en" style="${MOBILE ? "font-size:34px" : ""}">${s.i + 1}</div>
        ${p ? `<div class="pn" translate="no" style="${MOBILE ? "font-size:15px" : ""}">${esc(p[1])}${p[0] === PS.pid && !projector ? ` <span class="me">${esc(T_("אני"))}</span>` : ""}</div><div class="pp"><span class="en">${p[3]}</span> <span>${MOBILE ? "נק׳" : "נקודות"}</span></div>` : ""}</div>`;
      const ch = p ? `<div class="podc" style="left:${left}px;bottom:${blockTop - Math.round(chH * 0.035)}px">${s.i === 0 ? `<span class="crown" style="bottom:${chH + 4}px">${ico("crown", MOBILE ? 30 : 44, 2.4, "#c98a00", "#ffc83a")}</span>` : ""}<img src="${IMG_BASE}cheer-${p[2]}.png" alt="" style="height:${chH}px"></div>` : "";
      return label + ch;
    }).join("");
    const podium = `<div class="podium" style="${MOBILE ? `left:15px;width:${W}px;top:${Math.max(118, Math.min(170, MH - 690))}px;height:${ih + 130}px;bottom:auto` : ""}"><img class="pimg" src="${IMG_BASE}podium.png" alt="" style="width:${W}px;bottom:${baseB}px">${pod}</div>`;
    const list = rest.slice(0, MOBILE ? 4 : 12).map((p) => `<div class="rr ${p[0] === PS.pid && !projector ? "me" : ""}"><span class="rk">${p[9]}</span>${av(p[2], 34)}<span class="n" translate="no">${esc(p[1])}</span><span class="s">${p[3]} <small>נק׳</small></span></div>`).join("") || `<div class="sub" style="justify-content:center">${esc(T_("רק רץ אחד במירוץ"))}</div>`;
    const myPl = me ? `<div class="mypl">${ico("medal", 20, 2.6)}<span>סיימת במקום</span> <b>${me[9]}</b> <span>מתוך</span> <b>${order.length}</b></div>` : "";
    const stats = me ? `<div class="sub" style="margin-top:2px">התוצאות שלי</div><div class="stats">
      <div class="stat"><span class="hi green">${ico("check", 16, 3, "#fff")}</span><b>${me[6]}</b><span>משפטים נכונים</span></div>
      <div class="stat"><span class="hi blue">${ico("book", 16, 2.6, "#fff")}</span><b>${me[7]}</b><span>מילים שנאספו</span></div>
      <div class="stat"><span class="hi orange">${ico("zap", 16, 2.6, "#fff")}</span><b>${me[8]}</b><span>כוחות-על</span></div></div>` : "";
    const restT = order.length > 3 ? "שאר הרצים" : "כל הרצים";
    const btns = `<div class="res-btns"><button class="btn orange" id="bAgain">${ico("rotate", 22, 2.8, "#fff")}<span>מירוץ חוזר</span></button><button class="btn wbtn" id="bMenu2">${ico("home", 22, 2.6)}<span>לתפריט</span></button></div>`;
    if (MOBILE) {
      stage.innerHTML = `<section class="scr" id="s-res">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}</div></div>
        <div class="ttl res-title" style="top:62px;font-size:40px">סוף המירוץ!</div>
        ${podium}
        <div class="card mcard" id="resCard" style="top:${Math.max(118, Math.min(170, MH - 690)) + ih + 150}px;bottom:96px;display:flex;flex-direction:column;gap:7px;padding:12px">${myPl}<div class="rlist">${list}</div>${stats.replace('class="stats"', 'class="stats" style="grid-template-columns:repeat(3,1fr)"')}</div>
        <div style="position:absolute;left:16px;right:16px;bottom:16px">${btns.replace('class="res-btns"', 'class="res-btns" style="gap:12px"')}</div>
      </section>`;
    } else {
      stage.innerHTML = `<section class="scr" id="s-res">${bgDiv()}
        <div class="topbar">${topLeft()}<div class="grp">${backHub()}</div></div>
        <div class="ttl res-title" style="font-size:58px;pointer-events:none">סוף המירוץ!</div>
        <div class="card res-card" id="resCard" style="top:92px">${myPl}<div class="sub" style="font-size:19px"><span class="hi purple" style="width:30px;height:30px;border-radius:9px">${ico("trophy", 17, 2.6, "#fff")}</span>${restT}</div><div class="rlist">${list}</div>${stats}${btns}</div>
        ${podium}
      </section>`;
    }
    wireTop();
    $("#bAgain").onclick = () => { SFX.tap(); if (H) hostRematch(); else { PS.dismissed = st.race; lobbyScreen(); } };
    $("#bMenu2").onclick = () => { if (H && H.players.size && !confirm(T_("לסגור את החדר?"))) return; LS.set("ss-join", null); homeScreen(); };
    const hb = $("#bHub"); if (hb && H) hb.onclick = (e) => { if (H.players.size && !confirm(T_("לסגור את החדר?"))) e.preventDefault(); };
    if (!projector && me && me[9] <= 3) SFX.win();
  });
}

/* ================= BOOT ================= */
window.addEventListener("pagehide", () => { try { if (PS.net && !PS.local) PS.net.send({ t: "bye" }); if (H && H.net) H.net.broadcast({ t: "closed" }); } catch (e) {} });
document.addEventListener("visibilitychange", () => { if (!document.hidden && PS.code && !PS.local && PS.net && now() - PS.lastMsg > 6000) reconnectSoon(); });
function boot() {
  fit();
  loadImages(IMG_BASE);
  const code = (URLP.get("code") || "").replace(/\D/g, "").slice(0, 6);
  if (code.length === 6) {
    const r = LS.get("ss-join", null);
    if (r && r.code === code && r.name && now() - (r.at || 0) < 3 * 3600e3) playerJoin(code, r.name, CH[r.ch] ? r.ch : "zik");
    else characterScreen({ code });
  } else homeScreen();
}
/* hooks used by the automated tests only */
window.__SS = {
  get H() { return H; }, get PS() { return PS; }, get GAME() { return GAME; }, get VIEW() { return VIEW.name; },
  check: (w) => check(w), findOrder: (w) => findOrder(w),
  fill(words) { if (!TEST || !GAME) return false; PS.bar = words.map((w, i) => ({ w, id: i })); PS.sel = -1; renderBar(); return true; },
  submit() { submitSentence(); }, use() { usePower(); }, jump() { PS.G && PS.G.jump(); },
  give(k) { if (!TEST) return; PS.held = k; if (H) { const me = [...H.players.values()].find((p) => p.local); if (me) me.held = k; } renderPower(); },
  setX(x) { if (TEST && PS.G && PS.G.me) PS.G.me.x = x; },
  recv(m, cid) { if (TEST && H) hostRecv(m, cid); },
  missing() { try { return EnglishiaLang.missing(); } catch (e) { return []; } }
};
boot();
