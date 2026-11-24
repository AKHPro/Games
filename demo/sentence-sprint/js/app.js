/* Sentence Sprint 1.1 · ספרינט המשפטים — online, real-time multiplayer platformer for building English sentences.
   1.1: three game modes (room setting): Sentence Building, Balloons (questions) and Translation.
   Rooms work like Word Race: online room or presentation mode (code + QR on the projector), host-authoritative
   over the same PeerJS / signaling relay / ntfy transport (net.js). Each device runs its own runner; the host
   checks sentences, gives points and power-ups, aims attacks at the player directly ahead and relays positions.
   © 2026 Amir · Englishia · All rights reserved */
import { check, pretty, disp, gloss, knownWord, GEN, LENS, findOrder } from "./grammar.js?v=1.1";
import { buildLevel } from "./level.js?v=1.1";
import { createGame, loadImages, img, PU, PU_KEYS, DUR, F, CHAR_COLORS } from "./game.js?v=1.1";

const VERSION = "1.1", GAME_ID = "sentence-sprint", MAX_PLAYERS = 30;
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
  "arrow-left": '<path d="m15 18-6-6 6-6"/>', "arrow-right": '<path d="m9 18 6-6-6-6"/>',
  backspace: '<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="m18 9-6 6"/><path d="m12 9 6 6"/>',
  "arrow-down": '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>', help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  max: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  min: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  speak: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  balloon: '<path d="M12 16c-3.3 0-6-3.1-6-7a6 6 0 0 1 12 0c0 3.9-2.7 7-6 7z"/><path d="m12 16-1.6 2.2h3.2z"/><path d="M12 18.2c0 1.8-1.6 2.2-1.6 3.8"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
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
const WLS = [{ k: "s", he: "2–4" }, { k: "m", he: "3–6" }, { k: "l", he: "5–8" }];
const TIMES = [{ k: 0, he: "אוטומטי" }, { k: 2, he: "2 דק׳" }, { k: 3, he: "3 דק׳" }, { k: 5, he: "5 דק׳" }];
const DENS = [{ k: "f", he: "מעט מילים" }, { k: "n", he: "רגיל" }];
/* 1.1 game modes */
const MODES = [{ k: "b", he: "בניית משפטים", ico: "puzzle", col: "orange" }, { k: "q", he: "בלונים", ico: "balloon", col: "pink" }, { k: "t", he: "תרגום", ico: "languages", col: "blue" }];
const modeOf = (k) => MODES.find((m) => m.k === k) || MODES[0];
const QLEAD = { gap: "השלימו את המשפט", def: "איזו מילה מתאימה?", opp: "מה ההפך של", syn: "מילה עם אותה משמעות כמו", v2: "צורת העבר של", v3: "צורת V3 של", tr: "איך אומרים באנגלית?" };
const Q_BASE = 6;
const qPts = (mul, combo, gold) => Math.max(2, Math.round(Q_BASE * mul * comboMul(combo) * (gold ? 2 : 1)));
/* the question banks load only when a Balloons / Translation room needs them (Mila Quest + Word Detective files) */
let QZ = null, QZP = null;
function ensureQuiz() {
  if (QZ) return Promise.resolve(QZ);
  if (!QZP) QZP = new Promise((res) => { if (window.WD) return res(); const sc = document.createElement("script"); sc.src = "../word-detective/js/data.js"; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); })
    .then(() => import("./quiz.js?v=1.1")).then((m) => (QZ = m)).catch((e) => { QZP = null; throw e; });
  return QZP;
}
/* points: clearly progressive by length (2 words = 4, each extra word worth more), times level, combo and golden word */
const BASE_PTS = (n) => (n * (n + 1)) / 2 + 1;
const comboMul = (c) => (c >= 3 ? 2 : c === 2 ? 1.5 : 1);
const sentencePts = (n, mul, combo, gold) => Math.max(2, Math.round(BASE_PTS(n) * mul * comboMul(combo) * (gold ? 2 : 1)));
const bars = (n, on) => `<span class="bars">${[0, 1, 2, 3, 4, 5].map((i) => `<i style="height:${5 + i * 2.4}px;opacity:${i < n ? 1 : on ? 0.4 : 0.3}"></i>`).join("")}</span>`;

const PREF = Object.assign({ md: "b", level: "normal", len: "medium", wl: "m", pu: true, tm: 0, dens: "n", gold: true }, LS.get("ss-settings", {}));
if (!TIMES.some((t) => t.k === PREF.tm)) PREF.tm = 0;
if (!DENS.some((t) => t.k === PREF.dens)) PREF.dens = "n";
PREF.gold = PREF.gold !== false;
if (!LEVELS.some((l) => l.k === PREF.level)) PREF.level = "normal";
if (!TRACKS.some((l) => l.k === PREF.len)) PREF.len = "medium";
if (!WLS.some((l) => l.k === PREF.wl)) PREF.wl = "m";
const gfxPref = LS.get("ss-gfx", null);
let LOW = URLP.get("gfx") === "low" ? true : gfxPref === "low" ? true : gfxPref === "normal" ? false : (navigator.hardwareConcurrency || 4) <= 2;
let MUTE = !!LS.get("ss-mute", false);
let VOICE = LS.get("ss-voice", true) !== false;
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
  drop: () => beep(330, 0.1, "sine", 0.05), combo: () => [784, 988, 1319].forEach((fr, i) => beep(fr, 0.1, "triangle", 0.08, i * 0.07)),
  roll: () => beep(700 + Math.random() * 300, 0.03, "square", 0.025), win: () => [523, 659, 784, 1047].forEach((fr, i) => beep(fr, 0.18, "triangle", 0.1, i * 0.12))
};
const CAN_SPEAK = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
function speak(text) {
  if (!CAN_SPEAK || !text || MUTE || !VOICE) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.85;
    const vs = speechSynthesis.getVoices(), v = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) {}
}

/* ---------- layout: menus on a fixed stage scaled to fit; the race is full screen ---------- */
const stage = $("#stage"), vp = $("#vp");
stage.classList.toggle("ltr", DIR === "ltr");
let MOBILE = false, SCALE = 1, MH = 844;
function fit() {
  const vv = window.visualViewport, vw = Math.round(vv ? Math.min(window.innerWidth, vv.width) : window.innerWidth), vh = Math.round(vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight);
  document.documentElement.style.setProperty("--vh", vh + "px");
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
let lastMH = 0;
const onRsz = () => { clearTimeout(rsz); rsz = setTimeout(() => { const ch = fit(); if (VIEW.name === "game") gameLayout(); else if ((ch || (MOBILE && MH !== lastMH)) && VIEW.render) VIEW.render(); lastMH = MH; }, 120); };
window.addEventListener("resize", onRsz);
window.addEventListener("orientationchange", onRsz);
if (window.visualViewport) window.visualViewport.addEventListener("resize", onRsz);
/* fullscreen + landscape where the browser allows it (Android, desktop); iPhone Safari has neither, so we scroll the bars away and show the rotate hint */
const IOS = /iP(hone|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1 && !/iPad/.test(navigator.userAgent) && window.innerWidth < 500);
const FS_API = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !/iP(hone|od)/.test(navigator.userAgent);
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches) || navigator.standalone === true;
async function toggleFull() {
  SFX.tap();
  if (FS_API) {
    try {
      if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const el = document.documentElement;
      await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen());
      try { if (screen.orientation && screen.orientation.lock && window.innerWidth < 900) await screen.orientation.lock("landscape"); } catch (e) {}
      return;
    } catch (e) {}
  }
  // no Fullscreen API (iPhone): hide what we can and explain
  try { window.scrollTo(0, 1); } catch (e) {}
  fsTip();
}
/* scale a dialog card so it always fits the visible screen (short Safari landscape included) */
function fitDlg(dlg) {
  const c = dlg.firstElementChild; if (!c) return;
  const vv = window.visualViewport, W = vv ? Math.min(innerWidth, vv.width) : innerWidth, Hh = vv ? Math.min(innerHeight, vv.height) : innerHeight;
  c.style.setProperty("--k2", "1");
  const k = Math.min(1.15, (W * 0.95) / c.offsetWidth, (Hh * 0.95) / c.offsetHeight);
  c.style.setProperty("--k2", k.toFixed(3));
}
function fsTip() {
  const old = $("#fsTip"); if (old) { old.remove(); return; }
  const d = document.createElement("div"); d.id = "fsTip"; d.className = "menu-dlg";
  d.innerHTML = `<div class="card fs-tip" style="--k2:${Math.min(1.15, Math.max(0.7, Math.min(window.innerWidth, window.innerHeight) / 400))}"><h3>${ico("max", 24, 2.8)}<span>מסך מלא</span></h3>
    <p>${ico("phone-rot", 20, 2.6)}<span>סובבו את הטלפון לרוחב</span></p>
    <p>${ico("arrow-up", 20, 2.8)}<span>באייפון: לחצו על כפתור השיתוף ובחרו "הוספה למסך הבית". המשחק ייפתח משם במסך מלא, בלי סרגלי הדפדפן.</span></p>
    <button class="btn green" id="fsOk">${ico("check", 22, 3)}<span>הבנתי</span></button></div>`;
  (document.getElementById("game") || document.body).appendChild(d); fitDlg(d);
  $("#fsOk", d).onclick = () => d.remove();
}
const fullBtn = (cls = "pill iconbtn") => STANDALONE ? "" : `<button class="${cls} fsbtn" id="bFull" aria-label="מסך מלא" title="מסך מלא" style="padding:0;justify-content:center">${ico(isFull() ? "min" : "max", 22, 2.6)}</button>`;
document.addEventListener("fullscreenchange", () => { const b = $("#bFull"); if (b) b.innerHTML = ico(isFull() ? "min" : "max", 22, 2.6); onRsz(); });
document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest("#bFull"); if (b) { e.preventDefault(); toggleFull(); } });

/* the outline is a separate layer behind the gradient letters, so it can never eat into them */
const logoW = (cls, t) => `<span class="lw"><span class="bk" aria-hidden="true">${t}</span><span class="${cls}">${t}</span></span>`;
const logo = (size, st = 9, sh = 7, stack) => `<div class="logo" translate="no" style="font-size:${size}px;--st:${st}px;--sh:${sh}px">${logoW("s1", "Sentence")}${stack ? "<br>" : " "}${logoW("s2", "Sprint")}</div>`;
const backHub = () => `<a class="pill" id="bHub" href="${HUB}" title="חזרה לאנגלישיה">${ico(BACK, 20, 2.8)}<span>${MOBILE ? "אנגלישיה" : "חזרה לאנגלישיה"}</span></a>`;
const soundBtn = () => `<button class="pill iconbtn" id="bSound" aria-label="צליל" title="צליל" style="padding:0;justify-content:center">${ico(MUTE ? "volume-x" : "volume-on", 22, 2.6)}</button>`;
const gfxBtn = () => `<button class="pill iconbtn" id="bGfx" aria-pressed="${LOW}" aria-label="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}" title="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}" style="padding:0;justify-content:center">${ico(LOW ? "gauge" : "image", 22, 2.6, LOW ? "#ff7a00" : "#1d2350")}</button>`;
function topLeft() { return `<div class="grp">${soundBtn()}${gfxBtn()}${fullBtn()}<span id="langSlot"></span>${MOBILE ? "" : '<span class="brand" id="engSlot"><i></i>Englishia</span>'}</div>`; }
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
    // phone: logo, buttons, the "how to" strip and the runners are stacked top to bottom, so nothing can overlap at any height
    const top = Math.max(204, Math.min(300, MH - 430)), howTop = top + 168;
    const how = `<div class="howto" style="${MOBILE ? "top:" + howTop + "px" : ""}"><span><i class="hi orange">${ico("arrow-up", 16, 3, "#fff")}</i>קופצים בין הקומות</span><span><i class="hi pink">${ico("puzzle", 16, 2.6, "#fff")}</i>אוספים מילים ובונים משפט</span><span><i class="hi yellow">${ico("zap", 16, 2.6, "#fff")}</i>זוכים בכוח-על</span></div>`;
    if (MOBILE) {
      const charH = Math.min(210, MH - howTop - 120);
      stage.innerHTML = `<section class="scr" id="s-home">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span>${fullBtn()}</div><div class="grp">${backHub()}</div></div>
        <div class="home-logo" style="top:${Math.max(62, top - 232)}px">${logo(top < 250 ? 50 : 58, 5, 4, true)}<div style="margin-top:10px"><span class="ribbon" style="font-size:20px">ספרינט המשפטים</span></div></div>
        <div class="mbtns" style="top:${top}px">
          <button class="btn green" id="go-join">${ico("hash", 24, 3)}<span>הצטרפות עם קוד</span></button>
          <button class="btn blue" id="go-online">${ico("globe", 24, 2.8)}<span>פתיחת חדר אונליין</span></button>
        </div>
        ${how}
        ${charH >= 70 ? `<div class="m-chars" style="height:${charH}px;align-items:flex-end;bottom:${MH - howTop - 52 - charH > 60 ? 50 : 44}px">${["gal", "zik", "fox"].map((c) => `<img src="${IMG_BASE}cheer-${c}.png" alt="" style="height:${charH}px">`).join("")}</div>` : ""}
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
    startAt: 0, endAt: 0, firstFin: 0, finCount: 0, feed: [], lastN: 0, lastSnN: 0, L: null, qid: 0 };
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
function resetStats(p) { Object.assign(p, { combo: 0, pts: 0, sents: 0, words: 0, pus: 0, fin: 0, finT: 0, x: 260, y: 510, f: 0, posT: 0, held: null, shieldUntil: 0, lastSent: 0, seen: new Set(), q: null, used: new Set(), lastAns: 0 }); }
function hostRecv(m, cid) {
  if (!H || !m || typeof m !== "object" || typeof cid !== "string" || cid.length > 40) return;
  const p = H.players.get(cid);
  if (m.t === "hello") {
    const name = cleanName(m.name) || "Player", ch = CH[m.ch] ? m.ch : "zik";
    const r = addPlayer(cid, name, ch, false);
    if (r === "late" || r === "full") { H.net.send(cid, { t: r }); H.net.forget(cid); return; }
    H.net.send(cid, { t: "you", pid: r.pid, x: Math.round(r.x), y: Math.round(r.y), race: H.race, held: r.held });
    if (H.ph === "race" && r.q && !r.q.done) setTimeout(() => { if (H && r.q && !r.q.done) H.net.send(cid, pubQ(r.q)); }, 400);
    hostBroadcast(); hostView();
  } else if (m.t === "p") hostPos(p, m);
  else if (m.t === "sent") hostSentence(p, m);
  else if (m.t === "use") hostUse(p, m);
  else if (m.t === "ans") hostAnswer(p, m);
  else if (m.t === "mq") hostMoveQ(p, m);
  else if (m.t === "qq") hostResendQ(p, m);
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
  p.x = Math.max(p.x - 400, x); p.y = Math.max(-200, Math.min(760, y)); p.f = (Number(m.f) | 0) & 16383; p.posT = t;
  if (p.shieldUntil > t) p.f |= F.shield;
  if (!p.fin && p.x >= H.L.finish && t >= H.startAt) { hostFinish(p); if (p.q) { p.q = null; toPlayer(p, { t: "q", r: H.race, q: 0 }); projQ(p); } }
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
  if (!p || H.ph !== "race" || now() < H.startAt || (H.set.md || "b") !== "b") return;
  const k = m.k | 0;
  const words = Array.isArray(m.w) ? m.w.slice(0, 12).map((w) => String(w).toLowerCase().slice(0, 20)) : [];
  if (now() - p.lastSent < 500) return toPlayer(p, { t: "sr", k, ok: 0, why: "fast" });
  p.lastSent = now();
  const [lo, hi] = LENS[H.set.wl] || LENS.m;
  let ok = words.length >= lo && words.length <= hi && words.every(knownWord) && check(words).ok;
  const key = words.join(" ");
  if (ok && p.seen.has(key)) return toPlayer(p, { t: "sr", k, ok: 0, why: "dup" });
  if (!ok) { p.combo = 0; return toPlayer(p, { t: "sr", k, ok: 0, why: words.length < lo ? "short" : "bad" }); }
  p.seen.add(key);
  // golden word: the client names the bubble ids; the host checks them against its own copy of the track
  let gold = 0;
  if (H.set.gold && Array.isArray(m.g)) for (const id of m.g.slice(0, 12)) { const b = H.L && H.L.bubbles[id | 0]; if (b && b.g && b.id === (id | 0) && words.includes(b.w)) { gold = 1; break; } }
  p.combo = (p.combo || 0) + 1;
  const pts = sentencePts(words.length, levelOf(H.set.level).mul, p.combo, gold);
  p.pts += pts; p.sents++; p.words += words.length;
  let pu = null;
  if (H.set.pu) {
    const ahead = [...H.players.values()].some((q) => q !== p && !q.fin && q.x > p.x && (q.on || q.local));
    const pool = ahead ? PU_KEYS : PU_KEYS.filter((x) => PU[x].boost);
    pu = pool[Math.floor(Math.random() * pool.length)];
    p.held = pu;
  }
  toPlayer(p, { t: "sr", k, ok: 1, pts, pu, n: words.length, base: BASE_PTS(words.length), cm: comboMul(p.combo), c: p.combo, gd: gold });
  H.feed.push({ n: p.name, ch: p.ch, s: pretty(words), pts, gd: gold, c: p.combo }); if (H.feed.length > 6) H.feed.shift();
  broadcastFx({ t: "fx", k: "yay", a: p.pid, b: p.pid, gd: gold });
  hostBroadcast(); hostView();
}
/* ---------- 1.1 Balloons / Translation: the host keeps every player's question and its answer ---------- */
const pubQ = (q) => ({ t: "q", r: H.race, q: q.id, k: q.k, tx: q.tx, te: q.te, tc: q.tc, o: q.o, x: q.x, g: q.g });
function projQ(p) { if (H && H.mode === "present" && PROJ) PROJ.setQ(p.pid, p.q && !p.q.done ? { id: p.q.id, o: p.q.o, x: p.q.x, g: p.q.g } : null); }
function hostNextQ(p, ax) {
  if (!QZ || !H || H.ph !== "race" || (H.set.md || "b") === "b") return;
  if (p.fin) { p.q = null; toPlayer(p, { t: "q", r: H.race, q: 0 }); projQ(p); return; }
  const q = QZ.makeQuestion(H.set.md, H.set.level, H.rnd || Math.random, p.used);
  const n = H.set.dens === "f" ? 3 : q.o.length;                 // "few": 1 right + 2 wrong balloons
  while (q.o.length > n) { let j; do j = Math.floor(Math.random() * q.o.length); while (j === q.a); q.o.splice(j, 1); if (j < q.a) q.a--; }
  q.id = ++H.qid; q.x = Math.round(Math.max(H.L.start + 300, Math.min(ax, H.L.finish - 160)));
  q.g = H.set.gold && Math.random() < 0.1 ? 1 : 0;                // golden balloons: double points
  p.q = q;
  toPlayer(p, pubQ(q)); projQ(p);
}
function qFeedText(q) {
  const a = q.o[q.a];
  if (q.k === "gap") return q.tx.replace("___", a);
  if (q.k === "def") return a;
  return `${q.tx} ${q.k === "opp" ? "↔" : q.k === "syn" ? "=" : "→"} ${a}`;
}
function hostAnswer(p, m) {
  if (!p || H.ph !== "race" || now() < H.startAt || !p.q || p.q.done || (m.q | 0) !== p.q.id) return;
  if (now() - p.lastAns < 250) return;
  const q = p.q, i = m.i | 0; if (i < 0 || i >= q.o.length) return;
  p.lastAns = now(); q.done = 1; p.words++;
  const ok = i === q.a; let pts = 0, pu = null;
  if (ok) {
    p.combo = (p.combo || 0) + 1;
    pts = qPts(levelOf(H.set.level).mul, p.combo, q.g); p.pts += pts; p.sents++;
    if (H.set.pu) {
      const ahead = [...H.players.values()].some((o) => o !== p && !o.fin && o.x > p.x && (o.on || o.local));
      const pool = (ahead ? PU_KEYS : PU_KEYS.filter((x) => PU[x].boost)).filter((x) => x !== "magnet");   // a magnet would grab a wrong balloon
      pu = pool[Math.floor(Math.random() * pool.length)]; p.held = pu;
    }
    H.feed.push({ n: p.name, ch: p.ch, s: qFeedText(q).slice(0, 70), pts, gd: q.g, c: p.combo }); if (H.feed.length > 6) H.feed.shift();
    broadcastFx({ t: "fx", k: "yay", a: p.pid, b: p.pid, gd: q.g });
  } else p.combo = 0;
  toPlayer(p, { t: "ar", q: q.id, ok: ok ? 1 : 0, i, a: q.a, pts, pu, cm: comboMul(p.combo), c: p.combo, gd: q.g });
  if (H.mode === "present" && PROJ) { const set = PROJ.qbs.get(p.pid); if (set && set.id === q.id) PROJ.popBalloons(set, ok ? null : i, ok); }
  // the next question floats in ahead of the runner (the device's own position, kept believable)
  let x = Number(m.x); x = isFinite(x) ? Math.max(p.x - 150, Math.min(p.x + 900, x)) : p.x;
  const race = H.race, qid = q.id;
  setTimeout(() => { if (H && H.race === race && H.ph === "race" && p.q && p.q.id === qid) hostNextQ(p, x + 360); }, ok ? 650 : 450);
  hostBroadcast(); hostView();
}
/* a device that waits too long for its next question (a lost message) asks again */
function hostResendQ(p, m) {
  if (!p || H.ph !== "race" || (H.set.md || "b") === "b" || p.fin || now() < H.startAt) return;
  const id = m.q | 0;
  if (!p.q) return hostNextQ(p, p.x + 360);
  if (!p.q.done) return toPlayer(p, pubQ(p.q));
  if (p.q.id === id && now() - p.lastAns > 900) hostNextQ(p, p.x + 360);
}
function hostMoveQ(p, m) {
  if (!p || H.ph !== "race" || !p.q || p.q.done || (m.q | 0) !== p.q.id) return;
  const x = Number(m.x); if (!isFinite(x)) return;
  p.q.x = Math.round(Math.max(p.x - 200, Math.min(p.x + 1200, Math.min(x, H.L.finish - 160)))); projQ(p);
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
    broadcastFx({ t: "fx", k: "yay", a: p.pid, b: p.pid });
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
  return { t: "st", ph: H.ph, code: H.code, mode: H.mode, set: setMsg(), seed: H.seed, race: H.race, pl,
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
const setMsg = () => ({ md: H.set.md || "b", l: H.set.level, len: H.set.len, wl: H.set.wl, pu: H.set.pu ? 1 : 0, tm: H.set.tm | 0, dn: H.set.dens === "f" ? "f" : "n", gd: H.set.gold ? 1 : 0 });
const levelSet = (s) => ({ md: s.md || "b", level: s.l, len: s.len, wl: s.wl, dens: s.dn || "n", gold: s.gd !== 0 });
function hostStart() {
  if (!H || H.ph !== "lobby") return;
  if ((H.set.md || "b") !== "b" && !QZ) { ensureQuiz().then(() => hostStart()).catch(() => alert(T_("לא הצלחנו לטעון את השאלות. בדקו את החיבור ונסו שוב"))); return; }
  H.race++; H.seed = (Math.random() * 2 ** 31) >>> 0 || 7;
  H.L = buildLevel(levelSet(setMsg()), H.seed);
  for (const p of H.players.values()) resetStats(p);
  H.finCount = 0; H.firstFin = 0; H.feed = [];
  const speed = (GEN[H.set.level] || GEN.normal).speed;
  H.startAt = now() + 4200;
  H.endAt = H.startAt + (H.set.tm ? H.set.tm * 60000 : Math.round(((H.L.finish - H.L.start) / speed) * 1.7 + 25) * 1000);
  H.ph = "race";
  LS.set("ss-settings", H.set);
  hostBroadcast(); hostView();
  if ((H.set.md || "b") !== "b") { H.rnd = QZ.rng(H.seed ^ 0x51ab); for (const p of H.players.values()) hostNextQ(p, H.L.start + 420); }
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
  if (H) return { code: H.code, set: setMsg(), pl: [...H.players.values()].sort((a, b) => a.pid - b.pid).map((p) => [p.pid, p.name, p.ch, 0, p.on || p.local ? 1 : 0]), host: true, present: H.mode === "present" };
  const st = PS.st || { set: { md: "b", l: "normal", len: "medium", wl: "m", pu: 1, tm: 0, dn: "n", gd: 1 }, pl: [] };
  return { code: PS.code, set: st.set, pl: st.pl, host: false };
}
function settingsHTML(d, compact) {
  const s = d.set, dis = d.host ? "" : "disabled";
  const lv = LEVELS.map((l, i) => `<button class="chip lvl ${s.l === l.k ? "on" : ""}" data-lv="${l.k}" aria-pressed="${s.l === l.k}" ${dis}>${bars(i + 1, s.l === l.k)}<span>${l.he}</span></button>`).join("");
  const tr = TRACKS.map((t) => `<button class="chip ${s.len === t.k ? "on orange" : ""}" data-len="${t.k}" aria-pressed="${s.len === t.k}" ${dis}>${t.he}</button>`).join("");
  const wl = WLS.map((t) => `<button class="chip ${s.wl === t.k ? "on teal" : ""}" data-wl="${t.k}" aria-pressed="${s.wl === t.k}" ${dis}><span class="en">${t.he}</span></button>`).join("");
  const tm = TIMES.map((t) => `<button class="chip ${(s.tm | 0) === t.k ? "on purple" : ""}" data-tm="${t.k}" aria-pressed="${(s.tm | 0) === t.k}" ${dis}>${t.he}</button>`).join("");
  const dn = DENS.map((t) => `<button class="chip ${(s.dn || "n") === t.k ? "on blue" : ""}" data-dn="${t.k}" aria-pressed="${(s.dn || "n") === t.k}" ${dis}>${t.he}</button>`).join("");
  const tog = (id, on, icon, col, label) => `<div class="set-row"><span class="sub"><span class="hi ${col}" style="width:28px;height:28px;border-radius:9px">${ico(icon, 16, 2.6, "#fff")}</span>${label}</span><button class="tog ${on ? "on" : ""}" id="${id}" role="switch" aria-checked="${!!on}" aria-label="${label}" ${dis}></button></div>`;
  const md = s.md || "b", qm = md !== "b";
  const mds = MODES.map((m) => `<button class="chip mode ${md === m.k ? "on " + m.col : ""}" data-md="${m.k}" aria-pressed="${md === m.k}" ${dis}>${ico(m.ico, 17, 2.6)}<span>${m.he}</span></button>`).join("");
  return `<div class="set-lbl">מצב משחק</div><div class="chips c3 modes">${mds}</div>
    <div class="set-lbl">רמת קושי</div><div class="chips lvls">${lv}</div>
    <div class="set-lbl">אורך המסלול</div><div class="chips">${tr}</div>
    ${qm ? "" : `<div class="set-lbl">מילים במשפט</div><div class="chips">${wl}</div>`}
    <div class="set-lbl">זמן המירוץ</div><div class="chips c4">${tm}</div>
    <div class="set-lbl">${qm ? "בלונים לכל שאלה" : "מילים על המסלול"}</div><div class="chips c2">${qm ? dn.replace(">מעט מילים<", ">3<").replace(">רגיל<", ">3–4<") : dn}</div>
    <div class="set-tg">${tog("tPu", s.pu, "zap", "yellow", "כוחות-על")}${tog("tGd", s.gd !== 0, "star", "orange", qm ? "בלונים זהובים" : "מילים זהובות")}</div>`;
}
function wireSettings() {
  if (!H) return;
  const upd = () => { LS.set("ss-settings", H.set); hostBroadcast(); VIEW.render(); };
  $$("[data-lv]").forEach((b) => (b.onclick = () => { H.set.level = b.dataset.lv; SFX.tap(); upd(); }));
  $$("[data-len]").forEach((b) => (b.onclick = () => { H.set.len = b.dataset.len; SFX.tap(); upd(); }));
  $$("[data-wl]").forEach((b) => (b.onclick = () => { H.set.wl = b.dataset.wl; SFX.tap(); upd(); }));
  const t = $("#tPu"); if (t) t.onclick = () => { H.set.pu = !H.set.pu; SFX.tap(); upd(); };
  wireExtra(document, upd);
}
function wireExtra(root, upd) {
  $$("[data-md]", root).forEach((b) => (b.onclick = () => { H.set.md = b.dataset.md; SFX.tap(); if (H.set.md !== "b") ensureQuiz().catch(() => {}); upd(); }));
  $$("[data-tm]", root).forEach((b) => (b.onclick = () => { H.set.tm = +b.dataset.tm; SFX.tap(); upd(); }));
  $$("[data-dn]", root).forEach((b) => (b.onclick = () => { H.set.dens = b.dataset.dn; SFX.tap(); upd(); }));
  const g = $("#tGd", root); if (g) g.onclick = () => { H.set.gold = !H.set.gold; SFX.tap(); upd(); };
}
/* the chosen settings, shown to everyone in the lobby */
function setSummary(s) {
  const lvl = levelOf(s.l), tr = TRACKS.find((t) => t.k === s.len) || TRACKS[1], wl = WLS.find((t) => t.k === s.wl) || WLS[1], tm = TIMES.find((t) => t.k === (s.tm | 0)) || TIMES[0];
  const md = modeOf(s.md), qm = md.k !== "b";
  return `<span class="chip on ${md.col}">${ico(md.ico, 15, 2.6)}<span>${md.he}</span></span><span class="chip on blue">${bars(LEVELS.indexOf(lvl) + 1, true)}<span>רמה: ${lvl.he}</span></span><span class="chip">${ico("flag-fin", 15, 2.4)}<span>מסלול: ${tr.he}</span></span>
    ${qm ? "" : `<span class="chip">${ico("puzzle", 15, 2.6)}<span>מילים במשפט:</span> <span class="en">${wl.he}</span></span>`}<span class="chip">${ico("clock", 15, 2.6)}<span>זמן: ${tm.he}</span></span>
    <span class="chip">${ico("layers", 15, 2.6)}<span>${qm ? ((s.dn || "n") === "f" ? "3 בלונים לשאלה" : "3–4 בלונים לשאלה") : (s.dn || "n") === "f" ? "מעט מילים" : "מילים: רגיל"}</span></span>
    <span class="chip">${ico("zap", 15, 2.6)}<span>${s.pu ? "כוחות-על" : "בלי כוחות-על"}</span></span><span class="chip ${s.gd !== 0 ? "gold" : ""}">${ico("star", 15, 2.6)}<span>${s.gd !== 0 ? (qm ? "בלונים זהובים" : "מילים זהובות") : (qm ? "בלי בלונים זהובים" : "בלי מילים זהובות")}</span></span>`;
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
      const top = 66, short = MH < 780;   // short Safari screens: drop the title so the players list keeps its room
      stage.innerHTML = `<section class="scr ${short ? "short" : ""}" id="s-lobby">${bgDiv()}
        <div class="topbar"><div class="grp"><span id="langSlot"></span></div><div class="grp">${backHub()}</div></div>
        ${short ? "" : `<div class="ttl" style="position:absolute;top:${top}px;left:0;right:0;text-align:center;font-size:30px">חדר המשחק</div>`}
        <div class="card mcard" id="joinCard" style="top:${short ? 70 : top + 58}px">
          <div style="text-align:center;font:800 15px var(--ui)">קוד החדר</div>
          <div class="code en" translate="no" id="roomCode" style="margin:4px 0 10px">${digits}</div>
          <div class="qrrow"><div class="qrt" style="flex:1">הזמינו חברים<small>שיסרקו את הקוד או ייכנסו ל־</small><div class="en" style="font:700 13px var(--fred);color:var(--b2);margin-top:3px;word-break:break-all" translate="no">${esc(shown)}</div></div><div class="qrbox">${qr}</div></div>
          ${d.host ? `<button class="btn purple setbtn" id="bSet">${ico("sliders", 22, 2.6)}<span>הגדרות המירוץ</span></button>` : ""}
          <div class="chips sum" style="justify-content:center;margin-top:8px">${setSummary(d.set)}</div>
        </div>
        <div class="card mcard" id="plCard" style="top:400px;bottom:${d.host ? 104 : 118}px;overflow:hidden">
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
        <div class="card lob-col set-c" id="setCard"><h3><span class="hi purple">${ico("sliders", 20, 2.6, "#fff")}</span><span>הגדרות המירוץ</span>${d.host ? "" : '<small class="ro">נבחרו ע״י המורה</small>'}</h3><div class="set-scroll">${settingsHTML(d)}</div></div>
        ${startBtn}
        ${d.host ? `<span class="pill maxpill">${ico("users", 18, 2.6)}<span>עד 30 שחקנים בחדר</span></span>` : `<div class="pill" style="position:absolute;bottom:22px;left:50%;transform:translateX(-50%);font-size:19px">${ico("clock", 20, 2.6)}<span>מחכים שהמורה יתחיל את המירוץ</span></div>
          <button class="btn sm wbtn" id="bChange" style="position:absolute;bottom:22px;right:40px">${ico("shirt", 20, 2.6)}<span>החלפת רץ ושם</span></button>`}
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
  const k3 = Math.min(k2, (window.visualViewport ? visualViewport.height : window.innerHeight) / 760);
  dlg.innerHTML = `<div class="card set-c" style="position:relative;inset:auto;width:388px;padding:18px;transform:scale(${k3})"><h3 style="font:900 21px var(--ui);display:flex;gap:9px;align-items:center"><span class="hi purple">${ico("sliders", 20, 2.6, "#fff")}</span><span>הגדרות המירוץ</span></h3><div id="setBody">${settingsHTML(lobbyData())}</div>
    <button class="btn green" id="bSetOk" style="margin-top:14px;width:100%">${ico("check", 22, 3)}<span>סגירה</span></button></div>`;
  document.body.appendChild(dlg);
  const rewire = () => {
    const re = () => { LS.set("ss-settings", H.set); hostBroadcast(); $("#setBody").innerHTML = settingsHTML(lobbyData()); rewire(); };
    $$("#setBody [data-lv]").forEach((b) => (b.onclick = () => { H.set.level = b.dataset.lv; re(); }));
    $$("#setBody [data-len]").forEach((b) => (b.onclick = () => { H.set.len = b.dataset.len; re(); }));
    $$("#setBody [data-wl]").forEach((b) => (b.onclick = () => { H.set.wl = b.dataset.wl; re(); }));
    const t = $("#setBody #tPu"); if (t) t.onclick = () => { H.set.pu = !H.set.pu; re(); };
    wireExtra($("#setBody"), re);
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
  if (m.t === "q") { if (TEST && PS.dropQ > 0) { PS.dropQ--; return; } return onQuestion(m); }
  if (m.t === "ar") return onAnswerResult(m);
  if (m.t === "ur") return onUseResult(m);
  if (m.t === "fin") { PS.finPlace = m.place; PS.finBonus = m.bonus; showFinish(); return; }
  if (m.t !== "st") return;
  const prev = PS.st; PS.st = m;
  if (m.set && m.set.md && m.set.md !== "b" && !QZ) ensureQuiz().catch(() => {});
  if (!local && !PS.pid) return;
  if (!local && !m.pl.some((x) => x[0] === PS.pid)) { PS.pid = 0; sendHello(); return; }
  clearBanner();
  if (m.race !== PS.race) { PS.race = m.race; PS.recorded = {}; PS.sessionStart = now(); }
  if (m.ph === "lobby") {
    if (VIEW.name !== "lobby" || !prev || !prev.set || JSON.stringify(prev.set) !== JSON.stringify(m.set)) lobbyScreen(); else renderLobbyPlayers();
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
  window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp);
  GAME.el.remove(); GAME = null; PS.G = null; PROJ = null;
  document.body.classList.remove("ingame");
}
function playersMap(st) { const m = new Map(); for (const p of st.pl) m.set(p[0], { name: p[1], ch: p[2], rank: p[9] }); return m; }
function gameScreen(st, projector) {
  stopGame();
  VIEW = { name: "game", render: null };
  vp.style.display = "none";
  const set = levelSet(st.set);
  const L = buildLevel(set, st.seed);
  const el = document.createElement("div"); el.id = "game"; el.className = DIR === "ltr" ? "ltr" : "";
  document.body.appendChild(el); document.body.classList.add("ingame");
  el.innerHTML = `<canvas id="cv" aria-label="Sentence Sprint"></canvas><div id="hud"></div>`;
  const me = st.pl.find((p) => p[0] === PS.pid);
  const G = createGame($("#cv", el), {
    level: L, myPid: projector ? 0 : PS.pid, players: playersMap(st), projector, low: LOW, speed: (GEN[set.level] || GEN.normal).speed,
    meLabel: T_("אני"), rtl: DIR === "rtl", slowLink, myCh: me ? me[2] : PS.ch, sfx: (k) => (k === "jump" ? SFX.jump() : k === "drop" ? SFX.drop() : 0),
    onCollect: (b) => { PS.bar.push({ w: b.w, id: b.id, g: b.g ? 1 : 0 }); if (b.g) { SFX.combo(); G.addFx("gold", PS.pid); } else SFX.word(); renderBar(); return true; },
    canCollect: () => PS.bar.length < L.hi,
    onFull: () => { const sb = $("#sbar"); if (sb) { sb.classList.remove("full"); void sb.offsetWidth; sb.classList.add("full"); } toast(T_("הפס מלא: שלחו את המשפט או מחקו מילה"), "", 1400); },
    onFinish: () => { toHost({ t: "p", x: Math.round(G.me.x), y: Math.round(G.me.y), f: G.flags() }); },
    onBalloon: (set, i) => { SFX.tap(); toHost({ t: "ans", q: set.id, i, x: Math.round(G.me.x) }); },
    onMoveQ: (set) => toHost({ t: "mq", q: set.id, x: set.x })
  });
  G.race = st.race;
  GAME = { el, G, projector, st, L, qm: set.md !== "b" ? set.md : "", startPerf: performance.now() + st.go, endPerf: performance.now() + st.left, lastCd: null };
  if (projector) PROJ = G; else PS.G = G;
  Object.assign(PS, { bar: [], sel: -1, held: null, pending: null, finPlace: 0, seq: 0, combo: 0 });
  if (PS.q && PS.q.r !== st.race) PS.q = null;
  if (projector && H) for (const p of H.players.values()) if (p.q && !p.q.done) G.setQ(p.pid, { id: p.q.id, o: p.q.o, x: p.q.x, g: p.q.g });
  if (!projector && PS.resume && PS.resume.race === st.race) { G.me.x = PS.resume.x; G.me.y = Math.min(510, PS.resume.y); PS.held = PS.resume.held || null; PS.resume = null; }
  gameLayout(); buildHud(); gameLayout(); setTimeout(gameLayout, 500); setTimeout(gameLayout, 1500); G.start(GAME.startPerf);
  if (GAME.qm && !projector) applyQ();
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
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", () => { if (PS.G) PS.G.input = { l: 0, r: 0 }; });
    const cv = $("#cv", el); cv.addEventListener("pointerdown", (e) => { e.preventDefault(); G.jump(); });
  }
  gameState(st);
}
function gameLayout() {
  if (!GAME) return;
  const vv = window.visualViewport, el = GAME.el;
  const vw = Math.round(vv ? Math.min(window.innerWidth, vv.width) : window.innerWidth), vh = Math.round(vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight);
  el.style.height = vh + "px";
  const portrait = vh > vw, phone = Math.min(vw, vh) < 560;
  let k;
  if (portrait) k = Math.min(vw / 720, vh / 900);
  else if (phone) k = Math.min(vw / 1100, vh / 560);
  else k = Math.min(vw / 1280, vh / 720);
  el.style.setProperty("--k", k.toFixed(4));
  el.classList.toggle("gp", portrait); el.classList.toggle("gm", phone && !portrait); el.classList.toggle("gd", !phone && !portrait);
  // usable width of the sentence bar in base px (between the power and jump buttons)
  const baseW = vw / k;
  el.style.setProperty("--bw", Math.max(420, Math.min(960, baseW - (portrait ? 20 : phone ? 2 * 240 : 2 * 232))) + "px");
  // portrait: the track gets its own band between the top HUD and the sentence bar + buttons, so nothing covers the runners
  GAME.G.band = portrait && !GAME.projector ? { top: Math.round(212 * k), bottom: Math.round(268 * k) } : portrait ? { top: Math.round(180 * k), bottom: Math.round(120 * k) } : null;
  el.style.setProperty("--bandTop", (GAME.G.band ? GAME.G.band.top : 0) + "px");
  // projector: the progress bar shrinks so it never runs under the top-right buttons (long ar/ru labels)
  const pr = GAME.projector && !portrait && el.querySelector("#prog"), trB = pr && el.querySelector(".hud.tr"), tlB = pr && el.querySelector(".hud.tl");
  if (pr && trB) { const cx = vw / 2, l = tlB ? tlB.getBoundingClientRect().right : 0, r = trB.getBoundingClientRect().left;
    pr.style.width = Math.max(300, Math.min(620, (2 * Math.min(cx - l, r - cx) - 24 * k) / k)) + "px"; }
  GAME.G.resize();
  if (GAME.built) { renderBar(); fitRou(); }
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
    $("#gHub").insertAdjacentHTML("beforebegin", fullBtn("gbtn ic"));
  } else {
    hud.innerHTML = `<div class="hud tl"><div class="row"><span class="hp" id="hPts"><span>ניקוד</span> <b class="en o">0</b></span><span class="hp" id="hPlace"><span>מקום</span> <b class="en">1/1</b></span></div><span class="hp" id="hTime">${ico("clock", 18, 2.6)}<b class="en">0:00</b></span></div>
      <div class="hud tc"><div class="prog" id="prog"><span class="fl s">${ico("flag", 20, 2.6)}</span><div class="tr"><div class="fill" id="pfill"></div><div id="heads"></div></div><span class="fl e">${ico("flag-fin", 20, 2.4)}</span></div></div>
      <div class="hud tr"><div class="row"><a class="gbtn" id="gHub" href="${HUB}">${ico(BACK, 18, 2.8)}<span>אנגלישיה</span></a>${fullBtn("gbtn ic")}<button class="gbtn ic" id="bHelp" aria-label="איך משחקים" title="איך משחקים">${ico("help", 22, 2.6)}</button><button class="gbtn ic" id="bMenu" aria-label="תפריט" title="תפריט">${ico("pause", 22, 2.6, "currentColor", "currentColor")}</button></div></div>
      <div class="hud bl"><button class="pwr empty" id="bPwr" aria-label="הפעל כוח-על"><img id="pwrImg" src="${IMG_BASE}pu-boost-speed.png" alt=""><span class="e"><span>הפעל</span><kbd>E</kbd></span></button>
        <div class="pads" dir="ltr"><button class="btn orange pad" id="bLeft" aria-label="שמאלה">${ico("arrow-left", 58, 3.6)}</button><button class="btn orange pad" id="bRight" aria-label="ימינה">${ico("arrow-right", 58, 3.6)}</button></div></div>
      <div class="hud bc">${GAME.qm ? `<div class="sbar qbar" id="sbar"><div class="lab"><div class="a" id="qLead">${ico(modeOf(GAME.qm).ico, 14, 2.6)}<span></span></div><div class="b" id="sHint"></div></div>
        <div class="qtx" id="qTx"></div><span class="hp combo" id="hCombo" style="display:none" title="קומבו"><span>קומבו</span><b class="en">x1</b></span><span class="spts" id="spts"></span></div>`
        : `<div class="sbar" id="sbar"><div class="lab"><div class="a">${ico("puzzle", 14, 2.6)}<span>בנו משפט באנגלית</span></div><div class="b" id="sHint"></div></div>
        <div class="slots" id="slots"></div><span class="scount" id="scount"></span><span class="hp combo" id="hCombo" style="display:none" title="קומבו"><span>קומבו</span><b class="en">x1</b></span><span class="spts" id="spts"></span>
        <div class="sact"><button class="btn red del" id="bUndo" aria-label="מחק מילה" title="מחק מילה (Backspace)">${ico("backspace", 26, 2.6)}<span>מחק</span></button><button class="btn green go" id="bSend" title="Enter">${ico("check", 24, 3.2)}<span>שלח</span></button></div></div>`}</div>
      <div class="hud br"><div class="keys"><span class="gbtn">${ico("arrow-right", 15, 3)}<span>ריצה</span><kbd>← → / A D</kbd></span><span class="gbtn">${ico("arrow-up", 15, 3)}<span>קפיצה</span><kbd>SPACE</kbd></span><span class="gbtn">${ico("arrow-up", 15, 3)}<span>קפיצה כפולה</span><kbd>×2</kbd></span><span class="gbtn">${ico("arrow-down", 15, 3)}<span>ירידה קומה</span><kbd>↓ / S</kbd></span>${GAME.qm ? `<span class="gbtn">${ico("balloon", 15, 2.6)}<span>קופצים לבלון הנכון</span></span>` : `<span class="gbtn">${ico("check", 15, 3)}<span>שלח</span><kbd>ENTER</kbd></span><span class="gbtn">${ico("backspace", 15, 2.6)}<span>מחק מילה</span><kbd>⌫</kbd></span>`}</div>
        <div class="jcol"><button class="btn blue down" id="bDown" aria-label="ירידה קומה">${ico("arrow-down", 34, 3.4)}<span>ירידה</span></button>
        <button class="btn green jump" id="bJump" aria-label="קפיצה">${ico("arrow-up", 54, 3.4)}<span>קפיצה</span></button></div></div>
      <div class="rot">${ico("phone-rot", 16, 2.6, "#fff")}<span>לרוחב נוח יותר</span></div>
      <div class="ov" id="ov"></div>`;
    $("#bJump").addEventListener("pointerdown", (e) => { e.preventDefault(); PS.G && PS.G.jump(); });
    $("#bDown").addEventListener("pointerdown", (e) => { e.preventDefault(); doDrop(); });
    // hold-to-run pads (multi-touch: one thumb runs while the other jumps)
    for (const [id, k] of [["#bLeft", "l"], ["#bRight", "r"]]) {
      const b = $(id), on = (v) => (e) => { e.preventDefault(); if (PS.G) PS.G.input[k] = v; b.classList.toggle("held", !!v); if (v && b.setPointerCapture) try { b.setPointerCapture(e.pointerId); } catch (x) {} };
      b.addEventListener("pointerdown", on(1)); for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, on(0));
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    $("#bHelp").onclick = () => helpDlg();
    $("#bPwr").onclick = () => usePower();
    if ($("#bUndo")) $("#bUndo").onclick = () => undoWord();
    if ($("#bSend")) $("#bSend").onclick = () => submitSentence();
    $("#bMenu").onclick = () => gameMenu();
    $("#gHub").onclick = (e) => { if (!confirm(T_("לצאת מהמירוץ?"))) e.preventDefault(); };
    renderBar(); renderPower();
  }
  GAME.built = true;
}
function onKey(e) {
  if (!PS.G || $(".menu-dlg")) { if (e.code === "Escape") { const d = $(".menu-dlg"); if (d && d.id !== "setDlg") d.remove(); } return; }
  const c = e.code;
  if (c === "Space" || c === "ArrowUp" || c === "KeyW") { e.preventDefault(); if (!e.repeat) PS.G.jump(); }
  else if (c === "ArrowDown" || c === "KeyS") { e.preventDefault(); if (!e.repeat) doDrop(); }
  else if (c === "ArrowLeft" || c === "KeyA") { e.preventDefault(); PS.G.input.l = 1; }
  else if (c === "ArrowRight" || c === "KeyD") { e.preventDefault(); PS.G.input.r = 1; }
  else if (c === "KeyE") { e.preventDefault(); usePower(); }
  else if (GAME && GAME.qm) return;
  else if (c === "Enter" || c === "NumpadEnter") { e.preventDefault(); submitSentence(); }
  else if (c === "Backspace" || c === "Delete") { e.preventDefault(); undoWord(); }
  else if (/^Digit[1-8]$/.test(c)) { e.preventDefault(); tapTile(+c.slice(5) - 1); }
}
function onKeyUp(e) {
  if (!PS.G) return;
  if (e.code === "ArrowLeft" || e.code === "KeyA") PS.G.input.l = 0;
  else if (e.code === "ArrowRight" || e.code === "KeyD") PS.G.input.r = 0;
}
function doDrop() { if (PS.G && !PS.G.drop()) { const b = $("#bDown"); if (b && PS.G.me && PS.G.me.ground && !PS.G.me.fl) { b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); } } }
/* ---------- sentence bar ---------- */
function liveValid() { const L = GAME && GAME.L; if (!L) return false; const w = PS.bar.map((b) => b.w); return w.length >= L.lo && check(w).ok; }
function renderBar() {
  if (GAME && GAME.qm) return renderQ();
  const sl = $("#slots"); if (!sl || !GAME) return;
  const L = GAME.L, cfg = GEN[GAME.st.set.l] || GEN.normal, n = PS.bar.length;
  const col = ["pink", "blue", "orange", "teal", "purple", "green", "yellow", "red"];
  let html = PS.bar.map((b, i) => `<button class="tile ${b.g ? "goldt" : col[(b.id || i) % 8]} ${PS.sel === i ? "sel" : ""}" data-i="${i}" translate="no">${esc(disp(b.w))}${cfg.glossBar ? `<small>${esc(gloss(b.w, LANG))}</small>` : ""}</button>`).join("");
  for (let i = n; i < L.hi; i++) html += `<span class="slot ${i === n ? "next" : ""} ${i >= L.lo ? "opt" : ""}">${i === n ? "?" : ""}</span>`;
  sl.innerHTML = html;
  sl.className = "slots";
  $("#scount").textContent = `${n}/${L.hi}`;
  // what this sentence is worth right now (length, level, combo, golden word)
  const sp = $("#spts");
  if (sp) { const gold = GAME.st.set.gd !== 0 && PS.bar.some((b) => b.g); const v = sentencePts(Math.max(n, L.lo), levelOf(GAME.st.set.l).mul, (PS.combo || 0) + 1, gold);
    sp.className = "spts" + (gold ? " gold" : "") + (n >= L.lo ? "" : " dim"); sp.innerHTML = `${gold ? ico("star", 16, 2.6, "currentColor", "currentColor") : ""}<span class="en">+${v}</span>`; }
  const ok = cfg.liveOk && liveValid();
  const hint = $("#sHint");
  if (ok) { hint.className = "b good"; hint.textContent = T_("משפט נכון! לחצו שלח"); }
  else { hint.className = "b"; hint.textContent = n < L.lo ? T_("אספו מילים מהמסלול") : T_("סדרו את המילים ושלחו"); }
  $("#bSend").classList.toggle("ready", !!ok); $("#bSend").disabled = !!PS.pending;
  $$(".tile", sl).forEach((t) => {
    const i = +t.dataset.i; let lp = 0, long = false;
    t.onpointerdown = () => { long = false; clearTimeout(lp); lp = setTimeout(() => { long = true; pickTile(i); }, 420); };
    t.onpointerup = t.onpointerleave = t.onpointercancel = () => clearTimeout(lp);
    t.oncontextmenu = (e) => e.preventDefault();
    t.onclick = () => { if (long) { long = false; return; } if (PS.sel >= 0) pickTile(i); else removeTile(i); };
  });
  // shrink the tiles until they fit
  const bar = $("#sbar");
  for (const cls of ["t1", "t2"]) { if (bar.scrollWidth <= bar.clientWidth + 1 && sl.scrollWidth <= sl.clientWidth + 1) break; sl.classList.add(cls); }
}
/* tap a word = take it out of the bar; long-press one word, then tap another = swap them */
function removeTile(i) { if (i >= PS.bar.length) return; PS.bar.splice(i, 1); PS.sel = -1; SFX.tap(); renderBar(); }
function pickTile(i) { tapTile(i); }
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
  if (!GAME || GAME.projector || PS.pending || GAME.qm) return;
  const L = GAME.L, w = PS.bar.map((b) => b.w);
  if (performance.now() < GAME.startPerf) return;
  if (w.length < L.lo) { toast(T_("צריך לפחות") + " " + L.lo + " " + T_("מילים במשפט"), "bad", 1500); SFX.no(); return; }
  PS.seq++; PS.pending = { k: PS.seq, w, t: now() };
  toHost({ t: "sent", w, k: PS.seq, g: PS.bar.filter((b) => b.g).map((b) => b.id) });
  renderBar();
  setTimeout(() => { if (PS.pending && PS.pending.k === PS.seq) { PS.pending = null; renderBar(); } }, 4000);
}
function onSentenceResult(m) {
  const p = PS.pending; if (!p || p.k !== m.k) return;
  PS.pending = null;
  const words = p.w, level = GAME ? GAME.st.set.l : "normal";
  if (m.ok) {
    PS.combo = m.c || (PS.combo || 0) + 1;
    PS.bar = []; PS.sel = -1; renderBar(); SFX.ok(); if ((m.cm || 1) > 1 || m.gd) setTimeout(SFX.combo, 180);
    speak(pretty(words));                     // every correct sentence is read aloud, on every level
    recordAnswer(words, true);
    bumpScore(m.pts); renderCombo();
    if (PS.G) PS.G.apply("cheer");
    const extra = [m.n ? `${m.n} ${T_("מילים")}` : "", (m.cm || 1) > 1 ? `${T_("קומבו")} x${m.cm}` : "", m.gd ? `${T_("מילה זהובה")} x2` : ""].filter(Boolean).join(" · ");
    if (m.pu) roulette(words, m.pts, m.pu, extra); else toast(`+${m.pts} · ${T_("משפט נכון!")}${extra ? " · " + extra : ""}`, "good", 1800);
  } else if (m.why === "dup") { toast(T_("כבר בניתם את המשפט הזה. נסו משפט אחר"), "bad", 1800); SFX.no(); renderBar(); }
  else if (m.why === "fast") renderBar();
  else {
    SFX.no(); if (PS.G) PS.G.apply("wrong");
    if (PS.combo) { PS.combo = 0; renderCombo(); }
    const sb = $("#sbar"); if (sb) { sb.classList.remove("shake"); void sb.offsetWidth; sb.classList.add("shake"); }
    toast(T_("זה עדיין לא משפט נכון. סדרו או החליפו מילים"), "bad", 1900);
    recordAnswer(words, false); renderBar();
  }
}
/* ---------- 1.1 Balloons / Translation: the question panel and the answers ---------- */
function onQuestion(m) {
  const cur = PS.G && PS.G.qb;
  if (m && m.q && cur && cur.id === m.q && !cur.done) cur.wait = 0;     // the same question again: my answer was lost, touch again
  PS.q = m && m.q ? m : null;
  if (PS.q && PS.q.te && !QZ) ensureQuiz().then(() => { if (PS.q === m) renderQ(); }).catch(() => {});
  applyQ();
}
function applyQ() {
  if (!GAME || GAME.projector || !PS.G || !GAME.qm) return;
  const m = PS.q && PS.q.r === GAME.st.race ? PS.q : null;
  const cur = PS.G.qb;
  if (!m) { if (cur && !cur.done) PS.G.setQ(PS.pid, null); }
  else if (!cur || cur.id !== m.q) PS.G.setQ(PS.pid, { id: m.q, o: m.o, x: m.x, g: m.g });
  renderQ();
}
const qLocal = (m) => (m && m.te && QZ ? QZ.localize(m) : m);
function renderQ() {
  const tx = $("#qTx"); if (!tx || !GAME) return;
  const m = qLocal(PS.q && PS.q.r === GAME.st.race ? PS.q : null), lead = $("#qLead span"), hint = $("#sHint"), sp = $("#spts");
  if (!m) { lead.textContent = T_(GAME.qm === "t" ? "תרגום" : "בלונים"); tx.className = "qtx wait"; tx.textContent = PS.finPlace ? T_("סיימתם!") : "…"; hint.className = "b"; hint.textContent = ""; if (sp) sp.innerHTML = ""; return; }
  lead.textContent = T_(QLEAD[m.k] || "");
  const native = m.k === "tr" || m.k === "def";
  if (m.k === "gap") tx.innerHTML = `<span class="en" translate="no">${esc(m.tx).replace("___", '<i class="blank"></i>')}</span>`;
  else if (native) tx.innerHTML = `<span class="nat" dir="auto">${esc(m.tx)}</span>`;
  else tx.innerHTML = `<span dir="ltr"><b class="en" translate="no">${esc(m.tx)}</b>${m.k === "opp" || m.k === "syn" ? "<span>?</span>" : ""}</span>`;
  tx.className = "qtx" + (native ? " n" : "") + (m.tx.length > 34 ? " long" : "");
  hint.className = "b"; hint.textContent = T_("קפצו לבלון עם התשובה הנכונה");
  if (sp) { const v = qPts(levelOf(GAME.st.set.l).mul, (PS.combo || 0) + 1, m.g); sp.className = "spts" + (m.g ? " gold" : ""); sp.innerHTML = `${m.g ? ico("star", 16, 2.6, "currentColor", "currentColor") : ""}<span class="en">+${v}</span>`; }
}
function onAnswerResult(m) {
  const G = PS.G, q = PS.q; if (!q || m.q !== q.q) return;
  const set = G && G.qb, ans = q.o[m.a];
  if (set && set.id === m.q) { set.done = 1; set.doneT = performance.now(); set.wait = performance.now() + 20000; G.popBalloons(set, m.ok ? null : m.i, !!m.ok); }
  const lq = qLocal(q);
  if (m.ok) {
    PS.combo = m.c || (PS.combo || 0) + 1; SFX.ok(); if ((m.cm || 1) > 1 || m.gd) setTimeout(SFX.combo, 180);
    speak(q.k === "gap" ? q.tx.replace("___", ans) : ans);
    recordQ(lq, ans, true, ans);
    bumpScore(m.pts); renderCombo();
    if (G) G.apply("cheer");
    const extra = [(m.cm || 1) > 1 ? `${T_("קומבו")} x${m.cm}` : "", m.gd ? `${T_("בלון זהוב")} x2` : ""].filter(Boolean).join(" · ");
    if (m.pu) roulette([q.k === "gap" ? q.tx.replace("___", ans) : ans], m.pts, m.pu, extra, "תשובה נכונה!"); else toast(`+${m.pts} · ${T_("תשובה נכונה!")}${extra ? " · " + extra : ""}`, "good", 1600);
  } else {
    SFX.no(); if (G) G.apply("wrong", 1.1);
    if (PS.combo) { PS.combo = 0; renderCombo(); }
    const sb = $("#sbar"); if (sb) { sb.classList.remove("shake"); void sb.offsetWidth; sb.classList.add("shake"); }
    toast(`${T_("לא נכון. התשובה:")} ${ans}`, "bad", 2000);
    recordQ(lq, q.o[m.i], false, ans);
  }
}
function renderCombo() { const c = $("#hCombo"); if (!c) return; const m = comboMul(PS.combo || 0); c.style.display = m > 1 ? "" : "none"; $("b", c).textContent = "x" + m; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); renderBar(); }
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
  if (m.k === "yay") { G.addFx(m.gd ? "gold" : "yay", m.a); if (GAME.projector) feedBurst(m); return; }
  if (!PU[m.k]) return;
  if (PU[m.k].boost) return;   // boosts are drawn from the owner's flags
  G.addFx(m.bl ? "blocked" : m.k, m.a, m.b);
  if (mine) {
    if (m.bl) { G.shield = false; toast(T_("המגן חסם התקפה!"), "good", 1500); return; }
    setTimeout(() => { G.apply(m.k); SFX.hit(); }, m.k === "rocket" ? 600 : 0);
    toast(`${T_(PU[m.k].he)}! (${m.an || ""})`, "bad", 1500);
  }
}
/* projector: a short burst next to the newest feed line (SVG sparkles, no emoji) */
function feedBurst(m) {
  const fd = $("#feed"); if (!fd || LOW) return;
  const b = document.createElement("div"); b.className = "fburst" + (m.gd ? " gold" : "");
  b.innerHTML = [0, 1, 2, 3, 4, 5].map((i) => `<i style="--a:${i * 60}deg">${ico("star", 22, 2, "currentColor", "currentColor")}</i>`).join("");
  fd.appendChild(b); setTimeout(() => b.remove(), 1100);
}
function onSnap(m, G) {
  const t = performance.now();
  for (const [pid, x, y, f] of m.p) G.sample(pid, x, y, f, t);
}
function fitRou() {
  const box = $("#ov .ovk"); if (!box || !box.querySelector(".rou") || !GAME) return;
  const needH = box.scrollHeight + 24, k = parseFloat(getComputedStyle(GAME.el).getPropertyValue("--k")) || 1, vv = window.visualViewport;
  const W = vv ? Math.min(innerWidth, vv.width) : innerWidth, Hh = vv ? Math.min(innerHeight, vv.height) : innerHeight;
  box.style.transform = `translate(-50%,-50%) scale(${Math.min(k, Hh / needH, W / 1240).toFixed(3)})`;
}
function roulette(words, pts, pu, extra, head) {
  const ov = $("#ov"); if (!ov) return;
  const keys = GAME && GAME.qm ? PU_KEYS.filter((k) => k !== "magnet") : PU_KEYS, items = [];
  for (let i = 0; i < 26; i++) items.push(keys[Math.floor(Math.random() * keys.length)]);
  const win = 21; items[win] = pu;
  const ch = PS.ch;
  ov.innerHTML = `<div class="ovk"><div class="rou">
    <div class="head"><span class="hi green" style="width:46px;height:46px;border-radius:50%">${ico("check", 28, 3.4, "#fff")}</span><span class="ttl" style="font-size:44px">${head || "משפט נכון!"}</span><span class="plus en">+${pts}</span></div>${extra ? `<div class="rx">${esc(extra)}</div>` : ""}
    <div class="sent">${words.map((w) => `<span class="tile">${esc(disp(w))}</span>`).join("")}</div>
    <div class="arr d"></div>
    <div class="strip"><div class="rail" id="rail">${items.map((k) => `<div class="it"><img src="${IMG_BASE}${PU[k].img}.png" alt=""><i style="background:${PU[k].boost ? "#14b05a" : "#f2392c"}"></i></div>`).join("")}</div><div class="win"></div></div>
    <div class="arr u"></div>
    <div class="lbl" id="rlbl">${ico("shuffle", 30, 2.8, "#fff")}<span>מגריל כוח-על…</span></div>
    <div class="legend"><span><i style="background:#14b05a"></i>עוזר לי</span><span><i style="background:#f2392c"></i>פוגע ביריבים</span></div>
    ${MOBILE || LOW ? "" : `<img class="cheer" src="${IMG_BASE}cheer-${ch}.png" alt="">`}
  </div></div>`;
  ov.classList.add("dim"); ov.classList.toggle("lowfx", LOW); GAME.el.classList.add("rouon");
  fitRou();
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
  if (PS.G) PS.G.input = { l: 0, r: 0 };
  const dlg = document.createElement("div"); dlg.className = "menu-dlg";
  const vh0 = window.visualViewport ? visualViewport.height : window.innerHeight;
  dlg.innerHTML = `<div class="card" style="--k2:${Math.min(1.2, Math.max(0.5, Math.min(window.innerWidth / 420, vh0 / 560)))}"><h3>תפריט</h3>
    <button class="btn wbtn" id="mSound">${ico(MUTE ? "volume-x" : "volume-on", 22, 2.6)}<span>${MUTE ? "צליל: כבוי" : "צליל: פועל"}</span></button>
    <button class="btn wbtn" id="mVoice">${ico(VOICE ? "speak" : "volume-x", 22, 2.6)}<span>${VOICE ? "הקראת משפטים: פועלת" : "הקראת משפטים: כבויה"}</span></button>
    <button class="btn wbtn" id="mHelp">${ico("help", 22, 2.6)}<span>איך משחקים</span></button>
    <button class="btn wbtn" id="mGfx">${ico(LOW ? "gauge" : "image", 22, 2.6)}<span>${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}</span></button>
    ${H ? `<button class="btn orange" id="mEnd">${ico("flag-fin", 22, 2.4)}<span>סיים את המירוץ לכולם</span></button>` : ""}
    <button class="btn red" id="mLeave">${ico("door", 22, 2.6)}<span>יציאה מהמירוץ</span></button>
    <button class="btn green" id="mClose">${ico("play", 22, 2.6, "#fff", "#fff")}<span>חזרה למירוץ</span></button></div>`;
  GAME.el.appendChild(dlg); fitDlg(dlg);
  const close = () => dlg.remove();
  $("#mClose", dlg).onclick = close;
  $("#mSound", dlg).onclick = () => { MUTE = !MUTE; LS.set("ss-mute", MUTE); close(); };
  $("#mVoice", dlg).onclick = () => { VOICE = !VOICE; LS.set("ss-voice", VOICE); if (!VOICE) try { speechSynthesis.cancel(); } catch (e) {} close(); };
  $("#mHelp", dlg).onclick = () => { close(); helpDlg(); };
  $("#mGfx", dlg).onclick = () => { LOW = !LOW; LS.set("ss-gfx", LOW ? "low" : "normal"); document.body.classList.toggle("low", LOW); if (GAME) { GAME.G.low = LOW; GAME.G.resize(); } close(); };
  if ($("#mEnd", dlg)) $("#mEnd", dlg).onclick = () => { close(); hostEnd(); };
  $("#mLeave", dlg).onclick = () => { if (confirm(T_("לצאת מהמירוץ?"))) { LS.set("ss-join", null); homeScreen(); } };
}
/* in-game help: controls, points by length, golden words, combo, power-ups */
function helpDlg() {
  const old = $("#helpDlg"); if (old) { old.remove(); return; }
  const st = GAME ? GAME.st : null, mul = st ? levelOf(st.set.l).mul : 1, L = GAME ? GAME.L : { lo: 2, hi: 8 }, qm = GAME ? GAME.qm : "";
  const rows = []; for (let n = Math.max(2, L.lo); n <= L.hi; n++) rows.push(`<span><b class="en">${n}</b> ${T_("מילים")}</span><span class="en">+${sentencePts(n, mul, 1, 0)}</span>`);
  const dlg = document.createElement("div"); dlg.className = "menu-dlg"; dlg.id = "helpDlg";
  dlg.innerHTML = `<div class="card help" style="--k2:${1}"><h3>${ico("help", 24, 2.6)}<span>איך משחקים</span></h3>
    <div class="hgrid">
      <div class="hsec"><h4>שליטה</h4>
        <p>${ico("arrow-right", 18, 3)}<span>ריצה: לוחצים ומחזיקים את החיצים (במחשב ← → או A D). עוזבים = עוצרים. אפשר לחזור קצת אחורה כדי לתפוס מילה</span></p>
        <p>${ico("arrow-up", 18, 3)}<span>קפיצה: כפתור הקפיצה, מקש רווח או ↑ (פעמיים = קפיצה כפולה)</span></p>
        <p>${ico("arrow-down", 18, 3)}<span>ירידה קומה: כפתור הירידה, ↓ או S. יורדים דרך הפלטפורמה לקומה שמתחת (לא דרך הקרקע)</span></p>
        ${qm ? `<p>${ico(qm === "t" ? "languages" : "balloon", 18, 2.6)}<span>${qm === "t" ? "בפס למטה מופיעה מילה בשפה שלכם. קופצים לבלון עם המילה הנכונה באנגלית" : "בפס למטה מופיעה שאלה: השלמת משפט, הגדרה, הפכים, מילים נרדפות או צורות פועל. קופצים לבלון עם התשובה הנכונה"}</span></p>
        <p>${ico("arrow-up", 18, 3)}<span>הבלונים מרחפים מעל הראש: הליכה עוברת מתחתם, קפיצה נוגעת בבלון. חץ בצד המסך מראה איפה הבלונים</span></p>
        <p>${ico("zap", 18, 2.6)}<span>תשובה נכונה מגרילה כוח-על. מפעילים בכפתור הכוח או במקש E</span></p></div>
      <div class="hsec"><h4>ניקוד</h4><div class="ptab"><span>תשובה נכונה</span><span class="en">+${qPts(mul, 1, 0)}</span><span>קומבו x2</span><span class="en">+${qPts(mul, 3, 0)}</span></div>
        <p class="gold">${ico("star", 18, 2.4, "currentColor", "currentColor")}<span>בלונים זהובים: ניקוד כפול</span></p>
        <p>${ico("zap", 18, 2.6)}<span>קומבו: 2 תשובות נכונות ברצף x1.5, שלוש ומעלה x2. תשובה שגויה מאפסת את הקומבו</span></p>
        <p>${ico("x", 18, 2.8)}<span>תשובה שגויה: הבלון מתפוצץ, האטה קצרה ושאלה חדשה</span></p></div>`
        : `<p>${ico("puzzle", 18, 2.6)}<span>רצים לתוך בועות מילים ובונים מהן משפט בפס. לחיצה על מילה מוציאה אותה, כפתור "מחק" מוחק את האחרונה. להחלפת סדר: לחיצה ארוכה על מילה ואז לחיצה על מילה אחרת. שולחים ב"שלח" (Enter)</span></p>
        <p>${ico("zap", 18, 2.6)}<span>משפט נכון מגריל כוח-על. מפעילים בכפתור הכוח או במקש E</span></p></div>
      <div class="hsec"><h4>ניקוד: כל מילה נוספת שווה יותר</h4><div class="ptab">${rows.join("")}</div>
        <p class="gold">${ico("star", 18, 2.4, "currentColor", "currentColor")}<span>מילה זהובה במשפט: ניקוד כפול</span></p>
        <p>${ico("zap", 18, 2.6)}<span>קומבו: 2 משפטים נכונים ברצף x1.5, שלושה ומעלה x2. משפט שגוי מאפס את הקומבו</span></p>
        <p>${ico("x", 18, 2.8)}<span>משפט שגוי: האטה קצרה. המילים נשארות בפס כדי לתקן</span></p></div>`}
    </div>
    <button class="btn green" id="hOk">${ico("play", 22, 2.6, "#fff", "#fff")}<span>הבנתי</span></button></div>`;
  (GAME ? GAME.el : document.body).appendChild(dlg); fitDlg(dlg);
  $("#hOk", dlg).onclick = () => dlg.remove();
  dlg.onclick = (e) => { if (e.target === dlg) dlg.remove(); };
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
  const fd = $("#feed"); if (fd) fd.innerHTML = (st.feed || []).slice(-3).map((f) => `<div class="fi">${av(f.ch, 34)}<span translate="no">${esc(f.n)}</span><span class="en" translate="no">${esc(f.s)}</span><b>+${f.pts}</b>${f.gd ? `<span class="fg">${ico("star", 18, 2.4, "currentColor", "currentColor")}x2</span>` : ""}${f.c > 1 ? `<span class="fc en">x${comboMul(f.c)}</span>` : ""}</div>`).join("");
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
  // Balloons / Translation: no reply or no next question for a while (a lost message) -> ask the host again
  if (GAME.qm && !GAME.projector && PS.G && t > GAME.startPerf + 2500 && !PS.finPlace && !(PS.G.me && PS.G.me.fin)) {
    const q = PS.G.qb, since = !q ? t - (PS.noQT || (PS.noQT = t)) : q.done ? t - q.doneT : q.wait ? t - q.wait : 0;
    if (q) PS.noQT = 0;
    if (since > 2500 && (!PS.qqT || t - PS.qqT > 2500)) { PS.qqT = t; toHost({ t: "qq", q: q ? q.id : 0 }); }
  }
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
function recordQ(q, given, ok, expected) {
  try {
    if (!window.EnglishiaAuth || !EnglishiaAuth.user || !q) return;
    const md = GAME ? GAME.qm : "q";
    EnglishiaAuth.recordAnswer(GAME_ID, { item: q.k + ":" + String(q.te || q.tx).slice(0, 60), topic: md === "t" ? "תרגום" : "בלונים", level: GAME ? GAME.st.set.l : "",
      prompt: `${QLEAD[q.k] || ""}: ${q.tx}`.slice(0, 160), correct: ok, given: String(given || ""), expected: String(expected || "") });
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
    const order = st.pl.slice().sort((a, b) => a[9] - b[9]), qmR = st.set && st.set.md && st.set.md !== "b";
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
      <div class="stat"><span class="hi green">${ico("check", 16, 3, "#fff")}</span><b>${me[6]}</b><span>${qmR ? "תשובות נכונות" : "משפטים נכונים"}</span></div>
      <div class="stat"><span class="hi blue">${ico(qmR ? "balloon" : "book", 16, 2.6, "#fff")}</span><b>${me[7]}</b><span>${qmR ? "שאלות" : "מילים שנאספו"}</span></div>
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
  answer(i) { if (!TEST || !PS.G || !PS.G.qb || PS.G.qb.wait) return false; const q = PS.G.qb; q.wait = performance.now(); toHost({ t: "ans", q: q.id, i, x: Math.round(PS.G.me.x) }); return true; },
  hostQ(pid) { if (!TEST || !H) return null; const p = [...H.players.values()].find((x) => x.pid === pid); return p && p.q ? { id: p.q.id, a: p.q.a, o: p.q.o, k: p.q.k, x: p.q.x, done: !!p.q.done } : null; },
  dropQ(n) { if (TEST) PS.dropQ = n; }, quiz: () => QZ, renderQ: () => TEST && renderQ(),
  missing() { try { return EnglishiaLang.missing(); } catch (e) { return []; } }
};
boot();
