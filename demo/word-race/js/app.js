/* Word Race 1.0 · מירוץ המילים — online multiplayer English quiz race.
   Host-authoritative room over the Word Detective transport (net.js). Screens follow the Imagina mockups.
   © 2026 Amir · Englishia · All rights reserved */
import { LEVELS, levelOf, AGES, QTYPES, buildRace, publicQ, localize } from "./questions.js";

const VERSION = "1.0", GAME_ID = "word-race", MAX_PLAYERS = 30;
const DEMO = /\/demo\//.test(location.pathname);
const HUB = DEMO ? "../" : "../../";
const URLP = new URLSearchParams(location.search);
const LANG = (window.EnglishiaLang && EnglishiaLang.lang) || "he";
const CHARS = window.WR_CHARS || [];
const CH = Object.fromEntries(CHARS.map((c) => [c.id, c]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const now = () => Date.now();

/* ---------- icons (Lucide-style, from the design's icons.py) ---------- */
const P = {
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  projector: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/>',
  "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  "volume-on": '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  "volume-x": '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  languages: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  missing: '<path d="M4 7V5h7v2"/><path d="M7.5 5v12"/><path d="M6 17h3"/><rect x="13" y="9" width="8" height="10" rx="1.5" stroke-dasharray="2.4 2"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  crown: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M5 20h14"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  cap: '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  sliders: '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/>',
  medal: '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'
};
const ico = (n, s = 24, sw = 2.4, c = "currentColor", f = "none") =>
  `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
const SHAPES = { tri: '<path d="M12 3 22 20H2z"/>', dia: '<path d="M12 2 22 12 12 22 2 12z"/>', cir: '<circle cx="12" cy="12" r="9.5"/>', sq: '<rect x="3" y="3" width="18" height="18" rx="2.5"/>' };
const SH = ["tri", "dia", "cir", "sq"], ACLS = ["aa", "ab", "ac", "ad"], SHNAME = ["red triangle", "blue diamond", "yellow circle", "green square"];
const shape = (n, s = 30, c = "#fff") => `<svg class="shp" width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true">${SHAPES[n]}</svg>`;

/* ---------- characters ---------- */
function chSVG(id, kind, num, w) {
  const c = CH[id] || CHARS[0]; if (!c) return "";
  const hh = Math.round(w * 152 / 120);
  return c.svg[kind].replace("%W", Math.round(w)).replace("%H", hh).replace(/§/g, String(num || ""));
}
const front = (id, num, w, cheer) => chSVG(id, cheer ? "c" : "f", num, w);
const shirt = (id) => (CH[id] ? CH[id].shirt : "#ff9a1f");
const logo = (size, st, sh, stack) => `<div class="logo" style="font-size:${size}px;--st:${st}px;--sh:${sh}px"><span class="w">Word</span>${stack ? "<br>" : " "}<span class="r">Race</span></div>`;
const clouds = (spec) => spec.map(([x, y, w, o]) => `<div class="cloud" style="left:${x}px;top:${y}px;width:${w}px;height:${Math.round(w * 0.32)}px;opacity:${o}"></div>`).join("");
function timerHTML(size, stroke, fs) {
  const r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r;
  return `<div class="timer" style="width:${size}px;height:${size}px" data-c="${c.toFixed(1)}"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r + stroke / 2 + 1}" fill="#fff" stroke="#2b2140" stroke-width="3.5"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#f1e9dc" stroke-width="${stroke}"/>` +
    `<circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#ff9a1f" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><b style="font-size:${fs}px">0</b></div>`;
}
const bars = (level, color) => `<span style="display:inline-flex;align-items:flex-end;gap:2px;height:22px;direction:ltr">${[0, 1, 2, 3, 4, 5].map((i) => `<i style="display:block;width:4px;height:${6 + i * 3}px;border-radius:2px;background:${color};opacity:${i < level ? 1 : 0.3}"></i>`).join("")}</span>`;

/* ---------- perspective track (port of the design's track.py) ---------- */
class Track {
  constructor(W, H, y0, y1, bw, tw, lanes, cx) {
    Object.assign(this, { W, H, y0, y1, bw, tw, n: lanes });
    this.cx = cx == null ? W / 2 : cx; this.a = bw / tw - 1;
    const s1 = tw / bw; this.yH = (y1 - y0 * s1) / (1 - s1);
  }
  sc(t) { return 1 / (1 + this.a * t); }
  tAt(y) { return (1 / ((y - this.yH) / (this.y0 - this.yH)) - 1) / this.a; }   // progress value whose ground line is at screen y
  y(t) { return this.yH + (this.y0 - this.yH) * this.sc(t); }
  x(t, u) { return this.cx + (u - 0.5) * this.bw * this.sc(t); }
  pt(t, u) { return this.x(t, u).toFixed(1) + "," + this.y(t).toFixed(1); }
  quad(t0, t1, u0, u1) { return `${this.pt(t0, u0)} ${this.pt(t0, u1)} ${this.pt(t1, u1)} ${this.pt(t1, u0)}`; }
  svg(questions, low, tmax = 1.25) {
    const { W, H } = this, INK = "#2b2140", o = [], f = (v) => v.toFixed(1);
    const tmin = Math.max(-0.6, -0.7 / this.a);
    o.push(`<svg class="track-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`);
    o.push('<defs><linearGradient id="wrsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd0ff"/><stop offset="1" stop-color="#c9f1ff"/></linearGradient><linearGradient id="wrtrk" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f0623f"/><stop offset="1" stop-color="#e2533a"/></linearGradient><linearGradient id="wrfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".35" stop-color="#000" stop-opacity="0"/></linearGradient></defs>');
    o.push(`<rect width="${W}" height="${H}" fill="#5cc43f"/>`);
    for (let t = tmin, k = 0; t < tmax; t += 0.12, k++) if (k % 2 === 0) o.push(`<polygon points="-2000,${f(this.y(t))} ${W + 2000},${f(this.y(t))} ${W + 2000},${f(this.y(t + 0.12))} -2000,${f(this.y(t + 0.12))}" fill="#6fd14d"/>`);
    const sy = this.y(tmax), cols = ["#ff7a1a", "#ffc21a", "#ff4f8b", "#22b573", "#ffffff", "#8b5cf6", "#2fb5ff"];
    o.push(`<rect x="0" y="0" width="${W}" height="${f(sy)}" fill="url(#wrsky)"/>`);
    const st = Math.min(70, sy - 6);
    if (st > 20) {
      const by = sy - st;
      o.push(`<rect x="0" y="${f(by)}" width="${W}" height="${f(st)}" fill="#3b4fa8"/>`);
      const rows = Math.floor(st / 13);
      for (let r = 0; r < rows; r++) {
        const yy = by + 8 + r * 13;
        o.push(`<rect x="0" y="${f(yy + 4)}" width="${W}" height="5" fill="#2d3d8a"/>`);
        if (!low) for (let i = 0; i <= Math.floor(W / 15); i++) o.push(`<circle cx="${i * 15 + (r % 2 ? 7 : 0)}" cy="${f(yy)}" r="4.6" fill="${cols[(i * 3 + r * 5 + (i * r) % 4) % 7]}"/>`);
      }
      o.push(`<rect x="0" y="${f(sy - 6)}" width="${W}" height="6" fill="${INK}"/>`);
      if (!low) for (let i = 0; i < W; i += 40) o.push(`<path d="M${i} ${f(by)} l20 16 l20 -16 z" fill="${cols[(i / 40) % 7]}" stroke="${INK}" stroke-width="1.5"/>`);
      o.push(`<path d="M0 ${f(by)} H${W}" stroke="${INK}" stroke-width="2"/>`);
    }
    o.push(`<polygon points="${this.quad(tmin, tmax, -0.06, 1.06)}" fill="#ffffff"/>`);
    o.push(`<polygon points="${this.quad(tmin, tmax, -0.04, 1.04)}" fill="url(#wrtrk)"/>`);
    o.push(`<polygon points="${this.quad(tmin, tmax, -0.04, 1.04)}" fill="url(#wrfade)"/>`);
    for (let q = 1; q < questions; q++) { const tq = q / questions; o.push(`<polygon points="${this.quad(tq - 0.004, tq + 0.004, 0, 1)}" fill="#ffffff" opacity=".16"/>`); }
    for (let i = 0; i <= this.n; i++) {
      const u = i / this.n, w0 = 4.2 * this.sc(tmin), w1 = 4.2 * this.sc(tmax);
      o.push(`<polygon points="${f(this.x(tmin, u) - w0 / 2)},${f(this.y(tmin))} ${f(this.x(tmin, u) + w0 / 2)},${f(this.y(tmin))} ${f(this.x(tmax, u) + w1 / 2)},${f(this.y(tmax))} ${f(this.x(tmax, u) - w1 / 2)},${f(this.y(tmax))}" fill="#fff"/>`);
    }
    o.push(`<polygon points="${this.quad(-0.012, 0.012, 0, 1)}" fill="#fff"/>`);
    if (this.n <= 16) for (let i = 0; i < this.n; i++) { const u = (i + 0.5) / this.n, t = -0.12; o.push(`<text x="${f(this.x(t, u))}" y="${f(this.y(t))}" font-family="Fredoka,Heebo,Arial" font-weight="700" font-size="${f(34 * this.sc(t) * Math.min(1, 8.4 / this.n))}" fill="#fff" opacity=".85" text-anchor="middle">${i + 1}</text>`); }
    const cn = Math.max(8, Math.min(this.n * 4, 48)), dt = 0.035;
    for (let r = 0; r < 2; r++) for (let c = 0; c < cn; c++) { const t0 = 1 + r * dt - dt; o.push(`<polygon points="${this.quad(t0, t0 + dt, c / cn, (c + 1) / cn)}" fill="${(r + c) % 2 === 0 ? INK : "#fff"}"/>`); }
    const yA = this.y(1), xl = this.x(1, -0.07), xr = this.x(1, 1.07), scA = this.sc(1), ph = this.tw * 0.17, bh = Math.max(18, this.tw * 0.068);
    for (const xx of [xl, xr]) o.push(`<rect x="${f(xx - 5 * scA * 1.4)}" y="${f(yA - ph)}" width="${f(10 * scA * 1.4)}" height="${f(ph)}" rx="3" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`);
    o.push(`<rect x="${f(xl - 12)}" y="${f(yA - ph - bh * 0.6)}" width="${f(xr - xl + 24)}" height="${f(bh)}" rx="${f(bh / 2)}" fill="#ffc21a" stroke="${INK}" stroke-width="3"/>`);
    o.push(`<text x="${f((xl + xr) / 2)}" y="${f(yA - ph - bh * 0.6 + bh * 0.74)}" font-family="Fredoka,Heebo,Arial" font-weight="700" font-size="${f(bh * 0.78)}" fill="${INK}" text-anchor="middle" letter-spacing="3">FINISH</text>`);
    for (const xx of [xl, xr]) o.push(`<path d="M${f(xx)} ${f(yA - ph - bh * 0.6)} v-22 l22 7 l-22 7" fill="#ff4f8b" stroke="${INK}" stroke-width="2"/>`);
    const bushes = low ? [[0.15, 0], [0.45, 1], [0.75, 0]] : [[0.15, 0], [0.45, 1], [0.75, 0], [0.95, 1], [0.3, 1], [0.6, 0]];
    for (const [t, side] of bushes) {
      const u = side === 0 ? -0.2 : 1.2, sc = this.sc(t), xx = this.x(t, u), yy = this.y(t), r = 22 * sc * 1.6;
      if (!low) o.push(`<ellipse cx="${f(xx)}" cy="${f(yy + r * 0.55)}" rx="${f(r * 1.3)}" ry="${f(r * 0.35)}" fill="#3fa32e" opacity=".6"/>`);
      o.push(`<circle cx="${f(xx - r * 0.7)}" cy="${f(yy)}" r="${f(r * 0.8)}" fill="#2f9a3e" stroke="${INK}" stroke-width="2.5"/>`);
      o.push(`<circle cx="${f(xx + r * 0.6)}" cy="${f(yy - r * 0.1)}" r="${f(r * 0.85)}" fill="#36ab45" stroke="${INK}" stroke-width="2.5"/>`);
      o.push(`<circle cx="${f(xx)}" cy="${f(yy - r * 0.5)}" r="${f(r)}" fill="#43bf52" stroke="${INK}" stroke-width="2.5"/>`);
      if (!low) o.push(`<circle cx="${f(xx - r * 0.3)}" cy="${f(yy - r * 0.8)}" r="${f(r * 0.25)}" fill="#7fe08a"/>`);
    }
    o.push("</svg>");
    return o.join("");
  }
}

/* ---------- settings / prefs ---------- */
const PREF = Object.assign({ level: "normal", age: "vz", types: QTYPES.filter((t) => t.on).map((t) => t.k), n: 15, time: 20 }, LS.get("wr-settings", {}));
if (!LEVELS.some((l) => l.k === PREF.level)) PREF.level = "normal";
if (!Array.isArray(PREF.types) || !PREF.types.length) PREF.types = QTYPES.filter((t) => t.on).map((t) => t.k);
const gfxPref = LS.get("wr-gfx", null);
let LOW = URLP.get("gfx") === "low" ? true : gfxPref === "low" ? true : gfxPref === "normal" ? false : (navigator.hardwareConcurrency || 4) <= 2;
let MUTE = !!LS.get("wr-mute", false);
const ageLabel = (k) => (AGES.find((a) => a.k === k) || AGES[1]).he;
const setSummary = (s) => `<span>${levelOf(s.level).he}</span> · <span>${ageLabel(s.age)}</span> · <span>${s.n} שאלות</span>${s.time ? ` · <span>${s.time} שניות</span>` : ""}`;
let CID = LS.get("wr-cid", "");
if (!/^[a-z0-9]{12}$/.test(CID)) { CID = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + "000000000000").replace(/[^a-z0-9]/g, "").slice(0, 12); LS.set("wr-cid", CID); }

/* ---------- sound + speech (no files; tiny WebAudio blips) ---------- */
let AC = null;
function beep(fr, d = 0.12, type = "sine", v = 0.12, delay = 0) {
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
  tap: () => beep(520, 0.06, "triangle", 0.08), ok: () => { beep(660, 0.1, "triangle"); beep(990, 0.16, "triangle", 0.12, 0.09); },
  no: () => beep(200, 0.25, "sawtooth", 0.06), tick: () => beep(880, 0.05, "square", 0.04), go: () => beep(1180, 0.3, "triangle", 0.14),
  win: () => [523, 659, 784, 1047].forEach((fr, i) => beep(fr, 0.18, "triangle", 0.12, i * 0.12))
};
const CAN_SPEAK = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
function speak(text) {
  if (!CAN_SPEAK || !text || MUTE) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = 0.85;
    const vs = speechSynthesis.getVoices(), v = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- layout: fixed design sizes, scaled to fit ---------- */
const stage = $("#stage");
const DIR = (window.EnglishiaLang && EnglishiaLang.dir) || "rtl";
stage.style.direction = DIR; stage.classList.toggle("ltr", DIR === "ltr");
const FWD = DIR === "ltr" ? "arrow-right" : "arrow-left", BACK = DIR === "ltr" ? "arrow-left" : "arrow-right";
let MOBILE = false, SCALE = 1, MH = 844;
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const m = vw < 700 || vw / vh < 0.75;
  const changed = m !== MOBILE; MOBILE = m;
  stage.classList.toggle("m", m); stage.classList.toggle("d", !m); stage.classList.toggle("low", LOW);
  if (m) {
    SCALE = Math.min(vw / 390, vh / 700); MH = Math.max(700, Math.round(vh / SCALE));
    stage.style.height = MH + "px"; stage.style.setProperty("--H", MH + "px");
    stage.style.left = Math.round((vw - 390 * SCALE) / 2) + "px"; stage.style.top = "0px";
  } else {
    SCALE = Math.min(vw / 1280, vh / 800); stage.style.height = "";
    stage.style.left = Math.round((vw - 1280 * SCALE) / 2) + "px"; stage.style.top = Math.round((vh - 800 * SCALE) / 2) + "px";
  }
  stage.style.transform = `scale(${SCALE})`;
  return changed;
}
let VIEW = { name: "", render: null };
function show(name, render) { VIEW = { name, render }; render(); stage.scrollTop = 0; stage.scrollLeft = 0; }
let rsz = 0;
window.addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(() => { if (fit() && VIEW.render) { if (VIEW.name === "race" && PS.st) raceScreen(PS.st, RACE && RACE.projector); else VIEW.render(); } }, 120); });
const T_ = (s) => { try { return window.EnglishiaLang ? EnglishiaLang.t(s) : s; } catch (e) { return s; } };
/* count words that follow a number in another element: Hebrew as in the design, ar/ru from their own dictionary key */
const W_OK = () => (LANG === "he" ? "נכונות" : T_("מספר תשובות נכונות")), W_PL = () => (LANG === "he" ? "שחקנים" : T_("מספר שחקנים"));

function topIcons() {
  return `<button class="iconbtn" id="bSound" aria-label="Sound" title="צליל">${ico(MUTE ? "volume-x" : "volume-on", 28, 2.6)}</button>` +
    `<button class="iconbtn" id="bFull" aria-label="Fullscreen" title="מסך מלא">${ico("maximize", 28, 2.6)}</button>`;
}
function wireTop() {
  const s = $("#bSound"), fl = $("#bFull"), g = $("#bGfx");
  if (s) s.onclick = () => { MUTE = !MUTE; LS.set("wr-mute", MUTE); s.innerHTML = ico(MUTE ? "volume-x" : "volume-on", 28, 2.6); if (!MUTE) SFX.tap(); else try { speechSynthesis.cancel(); } catch (e) {} };
  if (fl) fl.onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
  if (g) g.onclick = () => { LOW = !LOW; LS.set("wr-gfx", LOW ? "low" : "normal"); fit(); VIEW.render && VIEW.render(); };
}
const gfxBtn = (iconOnly) => `<button class="${iconOnly ? "iconbtn" : "pillbtn"}" id="bGfx" aria-pressed="${LOW}" title="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}" aria-label="${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}">${ico(LOW ? "gauge" : "image", 24, 2.6, LOW ? "#ff9a1f" : "#2b2140")}${iconOnly ? "" : `<span>${LOW ? "גרפיקה: חסכונית" : "גרפיקה: רגילה"}</span>`}</button>`;
function mountShared() {
  try { if (window.EnglishiaLang && $("#langSlot")) EnglishiaLang.mount("#langSlot"); } catch (e) {}
  try { if (window.EnglishiaAuth && $("#engSlot") && !$("#engSlot").children.length) EnglishiaAuth.mountMenu("#engSlot"); } catch (e) {}
}
window.WRApp = { onAuth() { if (VIEW.name === "home") mountShared(); } };
function credit() {
  const l1 = `© 2026 Amir · Englishia · All rights reserved · Word Race ${DEMO ? "Demo version " : "Version "}${VERSION}`;
  const l2 = `© 2026 אמיר · אינגלישיה · כל הזכויות שמורות · ${DEMO ? "גרסת דמו " : "גרסה "}${VERSION}`;
  return `<div class="credit" id="wr-credit"><div dir="ltr">${esc(l1)}</div><div dir="rtl">${esc(l2)}</div></div>`;
}

/* ================= SCREENS ================= */
function homeScreen() {
  leaveAll();
  if (location.search.includes("code=")) try { history.replaceState(null, "", location.pathname); } catch (e) {}
  show("home", () => {
    const btns = [["online", "globe", "#2f7bff", "פתח חדר אונליין", "כל תלמיד משחק מהמכשיר שלו, מכל מקום"],
      ["present", "projector", "#ff4f8b", "פתח חדר במצב הצגה", "המירוץ על המקרן, התלמידים עונים בטלפון"],
      ["join", "hash", "#22b573", "הצטרף עם קוד", "קיבלתם קוד מהמורה? הכניסו אותו כאן"]];
    const cards = btns.map(([k, i, c, t, s]) => `<button class="card homebtn" data-go="${k}" id="go-${k}"><div class="hb-ic" style="background:${c}">${ico(i, MOBILE ? 32 : 46, 2.6, "#fff")}</div>
      <div class="hb-t">${t}</div><div class="hb-s">${s}</div><div class="hb-go" style="background:${c}">${ico(FWD, MOBILE ? 26 : 30, 3, MOBILE ? c : "#fff")}</div></button>`).join("");
    let runners, ground;
    if (MOBILE) {
      ground = `<svg class="home-ground" width="390" height="150" viewBox="0 0 390 150"><path d="M0 26 Q195 0 390 26 V150 H0Z" fill="#5cc43f" stroke="#2b2140" stroke-width="3"/><path d="M0 52 Q195 24 390 52 V150 H0Z" fill="#fff"/><path d="M0 58 Q195 30 390 58 V150 H0Z" fill="#f0623f"/>${[0, 1, 2].map((i) => `<path d="M0 ${80 + i * 26} Q195 ${52 + i * 27} 390 ${80 + i * 26}" fill="none" stroke="#fff" stroke-width="3"/>`).join("")}</svg>`;
      runners = [["zik", 14, 0], ["perah", 104, 1], ["fox", 206, 0], ["gal", 294, 1]].map(([c, x, ch], i) => `<div class="home-run" style="left:${x}px;bottom:16px">${front(c, i + 1, 84, ch)}</div>`).join("");
    } else {
      ground = `<svg class="home-ground" width="1280" height="250" viewBox="0 0 1280 250"><path d="M0 40 Q640 -10 1280 40 V250 H0Z" fill="#5cc43f" stroke="#2b2140" stroke-width="4"/><path d="M0 78 Q640 26 1280 78 V250 H0Z" fill="#fff"/><path d="M0 86 Q640 34 1280 86 V250 H0Z" fill="#f0623f"/>${[0, 1, 2, 3].map((i) => `<path d="M0 ${110 + i * 34} Q640 ${58 + i * 36} 1280 ${110 + i * 34}" fill="none" stroke="#fff" stroke-width="4" opacity=".9"/>`).join("")}</svg>`;
      const line = [["zik", 0], ["gal", 0], ["perah", 1], ["fox", 0], ["ale", 0], ["bear", 1], ["saar", 0], ["shemesh", 0]], xs = [40, 170, 300, 430, 730, 860, 990, 1120];
      runners = line.map(([c, ch], i) => `<div class="home-run" style="left:${xs[i]}px">${front(c, i + 1, 118, ch)}</div>`).join("");
    }
    stage.innerHTML = `<section class="scr on" id="s-home">
      ${LOW ? "" : clouds(MOBILE ? [[20, 96, 110, 0.8], [262, 150, 100, 0.8]] : [[70, 110, 170, 0.9], [1010, 70, 210, 0.95], [860, 230, 120, 0.8], [260, 250, 110, 0.7]])}
      ${ground}${runners}
      <div class="topbar"><div class="tb-r"><a class="pillbtn" id="bHub" href="${HUB}" title="חזרה לאינגלישיה">${ico("home", 24, 2.6)}<span class="fred" translate="no">Englishia</span></a>${MOBILE ? "" : '<span id="engSlot"></span>'}</div>
        <div class="tb-l"><span id="langSlot"></span>${MOBILE ? gfxBtn(true) : gfxBtn() + topIcons()}</div></div>
      ${MOBILE ? '<div class="m-auth"><span id="engSlot"></span></div>' : ""}
      <div class="home-c">${MOBILE ? logo(78, 10, 7, true) : logo(124, 14, 10)}<div style="margin-top:14px"><span class="ribbon" style="font-size:${MOBILE ? 28 : 40}px">מירוץ המילים</span></div></div>
      <div class="homebtns">${cards}</div>
      ${credit()}
    </section>`;
    wireTop(); mountShared();
    $$("[data-go]").forEach((b) => (b.onclick = () => { SFX.tap(); const k = b.dataset.go; if (k === "join") joinScreen(""); else settingsScreen(k); }));
  });
}

/* ---------- 02 room settings (teacher / room creator) ---------- */
function settingsScreen(mode) {
  const S = PREF;
  show("settings", () => {
    const lv = LEVELS.map((l, i) => { const on = S.level === l.k; return `<button class="chip lvl ${on ? "on" : ""} ${on && i === 2 ? "dark-text" : ""}" style="--c:${l.color}" data-lv="${l.k}" aria-pressed="${on}">${bars(i + 1, on ? (i === 2 ? "#2b2140" : "#fff") : l.color)}${l.he}</button>`; }).join("");
    const ages = AGES.map((a) => `<button class="chip age ${S.age === a.k ? "on" : ""}" style="--c:#2f5fbf" data-age="${a.k}" aria-pressed="${S.age === a.k}">${a.he}</button>`).join("");
    const qt = QTYPES.map((t) => { const on = S.types.includes(t.k); return `<button class="chip qt ${on ? "on" : "off"}" style="--c:${t.color}" data-qt="${t.k}" aria-pressed="${on}"><span class="ck">${ico("check", 15, 3.4)}</span>${ico(t.ico, 24, 2.4, on ? "#fff" : t.color)}${t.he}</button>`; }).join("");
    const seg = (opts, sel, unit, key) => opts.map((o) => `<button class="seg ${o === sel ? "on" : ""}" data-${key}="${o}" aria-pressed="${o === sel}"><b class="fred">${o}</b><span>${unit}</span></button>`).join("");
    const L = levelOf(S.level);
    const desc = `${L.opts} תשובות לבחירה · ניקוד x${L.mul}${L.say ? " · הקראה בקול" : ""}`;
    stage.innerHTML = `<section class="scr on" id="s-settings">${LOW ? "" : clouds([[1050, 96, 150, 0.7], [60, 700, 180, 0.5]])}
      <div class="topbar"><div class="tb-r"><button class="iconbtn" id="bBack" aria-label="חזרה">${ico(BACK, 30, 3)}</button><div class="title">הגדרות חדר</div>
        ${MOBILE ? "" : `<span class="hud" style="font-size:19px">${mode === "present" ? ico("projector", 22, 2.6, "#ff4f8b") + "<span>מצב הצגה</span>" : ico("globe", 22, 2.6, "#2f7bff") + "<span>חדר אונליין</span>"}</span>`}</div>${MOBILE ? "" : logo(40, 6, 4)}</div>
      <div class="set-grid"><div class="set-col">
        <div class="card pane"><h3><span class="hi" style="background:#ff9a1f">${ico("gauge", 24, 2.8, "#fff")}</span>רמת קושי</h3><div class="chips lv">${lv}</div><div class="lvdesc">${desc}</div></div>
        <div class="card pane"><h3><span class="hi" style="background:#2f5fbf">${ico("cap", 24, 2.6, "#fff")}</span>שכבת גיל</h3><div class="chips">${ages}</div></div>
        <div class="card pane" style="display:flex;gap:26px;flex-wrap:wrap">
          <div><h3><span class="hi" style="background:#22b573">${ico("flag", 22, 2.8, "#fff")}</span>אורך המירוץ</h3><div class="segs">${seg([10, 15, 20], S.n, "שאלות", "n")}</div></div>
          <div><h3><span class="hi" style="background:#ff4f8b">${ico("timer", 24, 2.8, "#fff")}</span>זמן לשאלה</h3><div class="segs">${seg([10, 15, 20, 30], S.time, "שניות", "tm")}</div></div>
        </div></div>
        <div class="set-col"><div class="card pane" style="height:100%"><h3><span class="hi" style="background:#8b5cf6">${ico("sliders", 22, 2.8, "#fff")}</span>סוגי שאלות<small>אפשר לבחור כמה</small></h3><div class="chips qts">${qt}</div></div></div>
      </div>
      <div class="set-bottom"><div class="sum">${ico("users", 26, 2.6)}<span>עד 30 שחקנים בחדר</span></div>
        <button class="btn orange" id="bCreate" style="font-size:32px;padding:14px 44px">צור חדר${ico(FWD, 32, 3.2)}</button></div>
    </section>`;
    $("#bBack").onclick = () => homeScreen();
    $$("[data-lv]").forEach((b) => (b.onclick = () => { S.level = b.dataset.lv; SFX.tap(); VIEW.render(); }));
    $$("[data-age]").forEach((b) => (b.onclick = () => { S.age = b.dataset.age; SFX.tap(); VIEW.render(); }));
    $$("[data-n]").forEach((b) => (b.onclick = () => { S.n = +b.dataset.n; SFX.tap(); VIEW.render(); }));
    $$("[data-tm]").forEach((b) => (b.onclick = () => { S.time = +b.dataset.tm; SFX.tap(); VIEW.render(); }));
    $$("[data-qt]").forEach((b) => (b.onclick = () => { const k = b.dataset.qt; if (S.types.includes(k)) { if (S.types.length > 1) S.types = S.types.filter((x) => x !== k); } else S.types = S.types.concat(k); SFX.tap(); VIEW.render(); }));
    $("#bCreate").onclick = () => { SFX.tap(); LS.set("wr-settings", S); createRoom(mode, Object.assign({}, S, { types: S.types.slice() })); };
  });
}

/* ================= HOST (room creator: teacher's projector, or a student who opened an online room) ================= */
let H = null;
const newCode = () => String(100000 + Math.floor(Math.random() * 900000));
function createRoom(mode, set) {
  leaveAll();
  H = { code: newCode(), mode, set, ph: "lobby", qs: [], qi: -1, t0: 0, dur: 0, phEnd: 0, players: new Map(), net: null, status: "", race: 0, lastN: 0 };
  hostConnect();
  H.timer = setInterval(hostTick, 250);
  H.beat = setInterval(() => hostBroadcast(true), 2500);
  if (mode === "online") characterScreen({ host: true }); else lobbyScreen();
}
function hostConnect() {
  try { H.net && H.net.close(); } catch (e) {}
  H.net = WRNet.host(H.code, hostRecv, (k) => {
    if (!H) return;
    if (k === "taken") { H.code = newCode(); hostConnect(); if (VIEW.name === "lobby") VIEW.render(); return; }
    H.status = k; const el = $("#netst"); if (el) el.outerHTML = netBadge();
  });
}
function netBadge() {
  const k = H ? H.status : "";
  const txt = k === "peer" ? "מחובר" : k === "ntfy" ? "מחובר (גיבוי)" : "מתחבר…";
  return `<span class="netst ${k === "peer" ? "ok" : k ? "fb" : ""}" id="netst"><i></i>${txt}</span>`;
}
const joinURL = () => location.origin + location.pathname + "?code=" + (H ? H.code : "");
const cleanName = (s) => String(s || "").replace(/[<>&"'`\\\u0000-\u001f\u200b-\u200f\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim().slice(0, 12);
function freeLane() { const used = new Set([...H.players.values()].map((p) => p.lane)); let i = 0; while (used.has(i)) i++; return i; }
function addPlayer(cid, name, ch, local) {
  let p = H.players.get(cid);
  if (p) { p.on = true; p.last = now(); if (H.ph === "lobby") { p.name = name; p.ch = ch; } return p; }   // rejoin keeps lane + score
  if (H.ph !== "lobby") return "late";
  if (H.players.size >= MAX_PLAYERS) return "full";
  const pid = H.players.size ? Math.max(...[...H.players.values()].map((x) => x.pid)) + 1 : 1;
  p = { cid, pid, name, ch, lane: freeLane(), ok: 0, pts: 0, tsum: 0, ans: {}, on: true, last: now(), local: !!local };
  H.players.set(cid, p); SFX.tap();
  return p;
}
function hostRecv(m, cid) {
  if (!H || !m || typeof m !== "object" || typeof cid !== "string" || cid.length > 40) return;
  const p = H.players.get(cid);
  if (m.t === "hello") {
    const name = cleanName(m.name) || "Player", ch = CH[m.ch] ? m.ch : CHARS[0].id;
    const r = addPlayer(cid, name, ch, false);
    if (r === "late" || r === "full") { H.net.send(cid, { t: r }); H.net.forget(cid); return; }
    H.net.send(cid, { t: "you", pid: r.pid });
    hostBroadcast(); hostView();
  } else if (m.t === "ans") hostAnswer(p, m.qi, m.a);
  else if (m.t === "ping") { if (p) { const was = p.on; p.on = true; p.last = now(); if (!was) { hostBroadcast(); hostView(); } } }
  else if (m.t === "bye" || m.t === "_drop") {
    if (!p) return;
    if (m.t === "bye" && H.ph === "lobby") { H.players.delete(cid); H.net.forget(cid); }
    else p.on = false;
    hostBroadcast(); hostView();
  }
}
/* anti-cheat: only the host knows the answer; it checks phase, question, one answer each, the option range and the deadline */
function hostAnswer(p, qi, a) {
  if (!H || !p || H.ph !== "q" || qi !== H.qi || p.ans[qi]) return;
  const q = H.qs[qi]; a = Number(a);
  if (!Number.isInteger(a) || a < 0 || a >= q.opts.length) return;
  const ms = now() - H.t0; if (ms > H.dur + 1000) return;
  p.on = true; p.last = now();
  const ok = a === q.ans, L = levelOf(H.set.level);
  let pts = 0;
  if (ok) { pts = Math.round(10 * L.mul) + Math.round(5 * L.mul * Math.max(0, H.dur - ms) / H.dur); p.ok++; p.pts += pts; p.tsum += ms; }
  p.ans[qi] = { a, ok, ms, pts };
  if ([...H.players.values()].filter((x) => x.on || x.local).every((x) => x.ans[qi])) H.phEnd = Math.min(H.phEnd, now() + 800);
  hostBroadcast(); hostView();
}
const ranked = () => [...H.players.values()].sort((a, b) => b.ok - a.ok || a.tsum - b.tsum || b.pts - a.pts || a.lane - b.lane);
function stateMsg() {
  const rank = new Map(ranked().map((p, i) => [p.cid, i + 1]));
  const pl = [...H.players.values()].sort((a, b) => a.lane - b.lane).map((p) => {
    const an = H.ph === "q" || H.ph === "rev" ? p.ans[H.qi] : null;
    return [p.pid, p.name, p.ch, p.lane, p.ok, p.pts, p.on || p.local ? 1 : 0, an ? (an.ok ? 2 : 1) : 0, rank.get(p.cid), an ? an.a : -1];
  });
  const m = { t: "st", ph: H.ph, code: H.code, mode: H.mode, set: { l: H.set.level, a: H.set.age, n: H.set.n, tm: H.set.time }, n: H.set.n, qi: H.qi, race: H.race, pl, left: Math.max(0, H.phEnd - now()), dur: H.dur };
  if ((H.ph === "q" || H.ph === "rev") && H.qs[H.qi]) m.q = publicQ(H.qs[H.qi]);
  if (H.ph === "rev") m.ok = H.qs[H.qi].ans;
  return m;
}
/* one state message for everybody; while a question is open nobody sees which option others chose */
function hostBroadcast(beat) {
  if (!H) return;
  const m = stateMsg(), open = m.ph === "q";
  const pub = open ? Object.assign({}, m, { pl: m.pl.map((x) => { const y = x.slice(); y[9] = -1; return y; }) }) : m;
  const viaN = !beat || now() - H.lastN > 4000; if (viaN) H.lastN = now();
  if (H.net) H.net.broadcast(pub, viaN);
  H.lastState = m;
  const me = [...H.players.values()].find((p) => p.local);
  if (me) playerOnMsg(open ? Object.assign({}, pub, { pl: pub.pl.map((x, i) => (x[0] === me.pid ? m.pl[i] : x)) }) : m, true);
}
function hostTick() {
  if (!H) return;
  const t = now();
  for (const p of H.players.values()) if (!p.local && p.on && t - p.last > 12000) { p.on = false; hostBroadcast(); hostView(); }
  if (H.ph === "lobby") {
    for (const p of [...H.players.values()]) if (!p.local && !p.on && t - p.last > 20000) { H.players.delete(p.cid); H.net && H.net.forget(p.cid); hostBroadcast(); hostView(); }
    return;
  }
  if (H.ph === "end" || t < H.phEnd) return;
  if (H.ph === "count") hostQuestion(0);
  else if (H.ph === "q") { H.ph = "rev"; H.phEnd = t + 2400; hostBroadcast(); hostView(); }
  else if (H.ph === "rev") { if (H.qi + 1 >= H.qs.length) { H.ph = "end"; hostBroadcast(); hostView(); } else hostQuestion(H.qi + 1); }
}
function hostQuestion(i) {
  H.ph = "q"; H.qi = i; H.t0 = now(); H.dur = Math.round(H.set.time * levelOf(H.set.level).time * 1000); H.phEnd = H.t0 + H.dur;
  hostBroadcast(); hostView();
}
function hostStart() {
  if (!H || H.ph !== "lobby" || !H.players.size) return;
  H.qs = buildRace({ types: H.set.types, level: H.set.level, age: H.set.age, n: H.set.n, seed: (Math.random() * 4294967295) >>> 0 });
  [...H.players.values()].sort((a, b) => a.lane - b.lane).forEach((p, i) => { p.lane = i; p.ok = 0; p.pts = 0; p.tsum = 0; p.ans = {}; });
  H.race++; H.ph = "count"; H.qi = -1; H.phEnd = now() + 3200;
  hostBroadcast(); hostView();
}
function hostRematch() {
  if (!H) return;
  H.ph = "lobby"; H.qi = -1; H.qs = [];
  for (const p of [...H.players.values()]) { p.ok = 0; p.pts = 0; p.tsum = 0; p.ans = {}; if (!p.on && !p.local) H.players.delete(p.cid); }
  hostBroadcast();
  if (VIEW.name !== "lobby") lobbyScreen();
}
/* what the projector shows (in an online room the creator plays: playerOnMsg renders) */
function hostView() {
  if (!H || H.mode === "online") { if (H && H.ph === "lobby" && VIEW.name === "lobby") renderLobbyPlayers(); return; }
  if (H.ph === "lobby") { if (VIEW.name === "lobby") renderLobbyPlayers(); else lobbyScreen(); return; }
  if (H.ph === "end") { if (VIEW.name !== "podium") podiumScreen(H.lastState, null); return; }
  if (VIEW.name !== "race") raceScreen(H.lastState, true); else raceUpdate(H.lastState, true);
}

/* ---------- 03 lobby: join card (address, code, QR) + who is on the track ---------- */
function lobbyScreen() {
  show("lobby", () => {
    const code = H.code, url = joinURL();
    const shown = url.replace(/^https?:\/\//, "").replace(/\?.*$/, "").replace(/\/(index\.html)?$/, "");
    let qr = "";
    try { const q = qrcode(0, "M"); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) {}
    const digits = code.split("").map((c, i) => (i === 3 ? "<i></i>" : "") + `<span>${c}</span>`).join("");
    const present = H.mode === "present";
    stage.innerHTML = `<section class="scr on" id="s-lobby">${LOW ? "" : clouds([[560, 40, 160, 0.7], [1120, 620, 150, 0.5]])}
      <div class="topbar"><div class="tb-r"><button class="iconbtn" id="bBack" aria-label="חזרה">${ico(BACK, 30, 3)}</button>${MOBILE ? "" : logo(46, 7, 5)}
        <span class="hud" style="font-size:${MOBILE ? 16 : 20}px">${present ? ico("projector", 22, 2.6, "#ff4f8b") + "<span>מצב הצגה</span>" : ico("globe", 22, 2.6, "#2f7bff") + "<span>חדר אונליין</span>"}</span>${netBadge()}</div>
        ${MOBILE ? "" : `<div class="hud" style="font-size:20px">${ico("gauge", 22, 2.6, "#ff9a1f")}<span>${setSummary(H.set)}</span></div>`}</div>
      <div class="card joincard">
        <div class="jt">הצטרפו למירוץ!</div>
        <div class="step"><b>1</b>היכנסו לכתובת</div>
        <div class="url en" translate="no" style="font-size:${Math.round(Math.min(MOBILE ? 18 : 34, (MOBILE ? 560 : 820) / Math.max(10, shown.length)))}px">${ico("link", MOBILE ? 22 : 30, 3, "#2f7bff")}<span>${esc(shown)}</span></div>
        <div class="step"><b>2</b>הקלידו את קוד החדר</div>
        <div class="code en" translate="no" id="roomCode">${digits}</div>
        <div class="qr"><div class="qrbox" id="qr">${qr}</div><div class="qrt">${ico("zap", 24, 2.6, "#ff9a1f")}<span>או סרקו את הקוד<br>עם המצלמה</span></div></div>
      </div>
      <div class="card plcard"><div class="plh"><div class="jt" style="font-size:34px">מי כבר על המסלול?</div><div class="cnt" id="plCnt"></div></div><div class="ptg" id="ptg"></div></div>
      <button class="btn green startbtn" id="bStart">${ico("play", 34, 2.6, "#fff", "#fff")}התחל מירוץ</button>
    </section>`;
    if (MOBILE) $(".plcard").style.top = ($(".joincard").offsetHeight + 96) + "px";
    $("#bBack").onclick = () => { if (!H.players.size || confirm(T_("לסגור את החדר?"))) homeScreen(); };
    $("#bStart").onclick = () => { SFX.go(); hostStart(); };
    renderLobbyPlayers();
  });
}
function renderLobbyPlayers() {
  const g = $("#ptg"); if (!g || !H) return;
  const ps = [...H.players.values()].sort((a, b) => a.lane - b.lane), many = ps.length > 8 && !MOBILE;
  g.classList.toggle("many", many);
  const w = MOBILE ? 52 : many ? 62 : 78;
  let html = ps.map((p) => `<div class="pt ${p.on || p.local ? "" : "offl"}"><div class="pt-av">${front(p.ch, p.lane + 1, w)}</div><div class="pt-n" style="background:${shirt(p.ch)}" translate="no">${esc(p.name)}</div>${p.local ? "" : `<button class="pt-x" data-kick="${esc(p.cid)}" aria-label="הסר" title="הסר">${ico("x", 16, 3)}</button>`}</div>`).join("");
  const empties = Math.max(0, (MOBILE ? 4 : 8) - ps.length);
  for (let i = 0; i < empties; i++) html += `<div class="pt empty"><div class="pt-av">${ico("user", MOBILE ? 28 : 40, 2.4, "#b9aed0")}</div><div class="pt-n">ממתין…</div></div>`;
  g.innerHTML = html;
  $("#plCnt").innerHTML = `<b class="fred">${ps.length}</b> ${W_PL()}`;
  const b = $("#bStart"); if (b) b.disabled = !ps.length;
  $$("[data-kick]", g).forEach((x) => (x.onclick = () => { const cid = x.dataset.kick; if (H.ph !== "lobby") return; H.net.send(cid, { t: "kick" }); H.players.delete(cid); H.net.forget(cid); hostBroadcast(); renderLobbyPlayers(); }));
}

/* ================= PLAYER ================= */
const PS = { code: "", net: null, pid: 0, name: "", ch: "", st: null, local: false, lastMsg: 0, helloT: null, pingT: null, watch: null, recorded: {}, race: -1, sessionStart: 0 };
function leaveAll() {
  if (PS.net) { try { PS.net.send({ t: "bye" }); } catch (e) {} const n = PS.net; setTimeout(() => { try { n.close(); } catch (e) {} }, 300); }
  clearInterval(PS.helloT); clearInterval(PS.pingT); clearInterval(PS.watch); clearTimeout(PS._rc); PS._rc = null;
  Object.assign(PS, { code: "", net: null, pid: 0, st: null, local: false, recorded: {}, race: -1 });
  if (H) { const n = H.net; try { n && n.broadcast({ t: "closed" }); } catch (e) {} clearInterval(H.timer); clearInterval(H.beat); setTimeout(() => { try { n && n.close(); } catch (e) {} }, 400); H = null; }
  clearInterval(TIMER_IV); RACE = null;
  try { speechSynthesis.cancel(); } catch (e) {}
}

/* ---------- m02 join with a room code ---------- */
function joinScreen(code, err) {
  leaveAll();
  show("join", () => {
    const boxes = [0, 1, 2, 3, 4, 5].map((i) => `<span class="dg" data-i="${i}"></span>`).join("");
    stage.innerHTML = `<section class="scr on" id="s-join">${LOW ? "" : clouds([[250, 110, 110, 0.7], [900, 140, 150, 0.6]])}
      <div class="topbar"><div class="tb-r"><button class="iconbtn" id="bBack" aria-label="חזרה">${ico(BACK, 30, 3)}</button></div>${logo(MOBILE ? 30 : 40, 5, 3)}</div>
      <div style="position:absolute;top:${MOBILE ? 118 : 70}px;left:0;right:0;text-align:center"><div class="title" style="font-size:${MOBILE ? 36 : 48}px">הצטרפו למירוץ</div></div>
      <div class="card joinbox">
        <div style="font:800 22px var(--ui);display:flex;align-items:center;gap:8px">${ico("hash", 24, 2.8, "#22b573")}קוד החדר</div>
        <div class="digits" translate="no">${boxes}<input id="codeIn" type="tel" inputmode="numeric" maxlength="6" autocomplete="off" aria-label="קוד החדר" value="${esc(code || "")}"></div>
        <div class="joinhelp">את הקוד רואים על הלוח של המורה, או סרקו את ה-QR שעל המסך</div>
        <div class="err" id="joinErr" style="text-align:center;margin-top:8px">${err ? esc(err) : ""}</div>
        <button class="btn green mbtn" id="bJoin" style="margin-top:10px">הצטרף${ico(FWD, 28, 3.2, "#fff")}</button>
      </div>
      ${MOBILE && MH < 800 ? "" : `<div class="joinurl"><span class="hud" style="font-size:18px">${ico("link", 20, 2.8, "#2f7bff")}<span class="en fred" translate="no" style="font-weight:600">${esc((location.host + location.pathname).replace(/\/(index\.html)?$/, ""))}</span></span></div>`}
      ${MOBILE ? `<svg class="home-ground" width="390" height="170" viewBox="0 0 390 170"><path d="M0 26 Q195 0 390 26 V170 H0Z" fill="#5cc43f" stroke="#2b2140" stroke-width="3"/><path d="M0 52 Q195 24 390 52 V170 H0Z" fill="#fff"/><path d="M0 58 Q195 30 390 58 V170 H0Z" fill="#f0623f"/>${[0, 1, 2].map((i) => `<path d="M0 ${80 + i * 26} Q195 ${52 + i * 27} 390 ${80 + i * 26}" fill="none" stroke="#fff" stroke-width="3"/>`).join("")}</svg>
        <div class="home-run" style="left:40px">${front("fox", 7, 96)}</div><div class="home-run" style="right:40px">${front("bear", 8, 96, true)}</div>` : ""}
      ${credit()}
    </section>`;
    const inp = $("#codeIn");
    const paint = () => { const v = inp.value.replace(/\D/g, "").slice(0, 6); inp.value = v; $$(".dg").forEach((d, i) => { d.textContent = v[i] || ""; d.classList.toggle("cur", i === v.length); }); };
    const go = () => { const v = inp.value.replace(/\D/g, ""); if (v.length !== 6) { $("#joinErr").textContent = T_("קוד החדר הוא 6 ספרות"); return; } SFX.tap(); characterScreen({ code: v }); };
    inp.oninput = paint; paint();
    inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
    $("#bJoin").onclick = go;
    $("#bBack").onclick = () => homeScreen();
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
  });
}

/* ---------- 04 / m03 pick a runner and a name ---------- */
function characterScreen(o) {
  const saved = LS.get("wr-me", {}) || {};
  let name = saved.name || "", sel = CH[saved.ch] ? saved.ch : "perah";
  try { if (!name && window.EnglishiaAuth && EnglishiaAuth.user) name = cleanName(EnglishiaAuth.user.displayName || EnglishiaAuth.user.username); } catch (e) {}
  const code = o.code || (H && H.code) || "";
  show("char", () => {
    const idx = Math.max(0, CHARS.findIndex((c) => c.id === sel));
    const cards = CHARS.map((c, i) => `<button class="cc ${c.id === sel ? "sel" : ""}" style="--c:${c.shirt}" data-ch="${c.id}" aria-pressed="${c.id === sel}">${c.id === sel ? `<span class="okb">${ico("check", MOBILE ? 14 : 22, 3.6, "#fff")}</span>` : ""}<div class="cc-a">${front(c.id, i + 1, MOBILE ? 62 : 104)}</div><div class="cc-n" translate="no">${esc(c[LANG] || c.he)}</div></button>`).join("");
    stage.innerHTML = `<section class="scr on" id="s-char">${LOW ? "" : clouds([[80, 120, 150, 0.6], [560, 52, 120, 0.6]])}
      <div class="topbar"><div class="tb-r"><button class="iconbtn" id="bBack" aria-label="חזרה">${ico(BACK, 30, 3)}</button><div class="title">בחרו רץ ושם</div></div>
        ${MOBILE ? "" : `<div class="hud" style="font-size:20px"><span>חדר</span> <span class="num en" translate="no">${code.slice(0, 3)} ${code.slice(3)}</span></div>`}</div>
      <div class="card prev"><div class="spot"></div><div class="ptag" id="ptag" style="--c:${shirt(sel)}" translate="no">${esc(name || " ")}</div>
        <div class="big" id="bigCh">${front(sel, idx + 1, MOBILE ? 132 : 230, true)}</div>
        <div class="pv-form"><div class="lbl">השם שלי במירוץ</div>
        <label class="input">${ico("user", MOBILE ? 22 : 30, 2.6, "#8b5cf6")}<input id="nameIn" maxlength="12" autocomplete="off" spellcheck="false" translate="no" value="${esc(name)}" aria-label="השם שלי במירוץ"><span class="cnt" id="nameCnt">${name.length}/12</span></label>
        <div class="err" id="charErr"></div></div></div>
      <div class="card pick"><h3><span class="hi" style="background:#ff4f8b">${ico("shirt", 24, 2.6, "#fff")}</span>בחרו את הרץ שלכם</h3><div class="ccg">${cards}</div></div>
      <button class="btn green readybtn" id="bReady">${ico("zap", 34, 2.6, "#fff", "#fff")}מוכנים לזנק!</button>
    </section>`;
    const inp = $("#nameIn");
    inp.oninput = () => { const v = inp.value.replace(/[<>]/g, "").slice(0, 12); if (v !== inp.value) inp.value = v; name = v; $("#ptag").textContent = v || " "; $("#nameCnt").textContent = v.length + "/12"; };
    $$("[data-ch]").forEach((b) => (b.onclick = () => { sel = b.dataset.ch; SFX.tap(); name = inp.value; VIEW.render(); }));
    $("#bBack").onclick = () => { if (o.host) settingsScreen("online"); else joinScreen(code); };
    $("#bReady").onclick = () => {
      const nm = cleanName(inp.value);
      if (!nm) { $("#charErr").textContent = T_("כתבו שם (עד 12 אותיות)"); inp.focus(); return; }
      SFX.go(); LS.set("wr-me", { name: nm, ch: sel });
      if (o.host) hostJoinLocal(nm, sel); else playerJoin(code, nm, sel);
    };
  });
}

/* the online-room creator races too */
function hostJoinLocal(name, ch) {
  if (!H) return;
  const p = addPlayer("host-" + CID, name, ch, true);
  Object.assign(PS, { code: H.code, pid: p.pid, name, ch, local: true });
  lobbyScreen(); hostBroadcast();
}
function playerJoin(code, name, ch) {
  leaveAll();
  Object.assign(PS, { code, name, ch, pid: 0 });
  LS.set("wr-join", { code, name, ch, at: now() });
  try { history.replaceState(null, "", location.pathname + "?code=" + code); } catch (e) {}
  waitScreen(null, "מתחברים לחדר…");
  connectPlayer();
}
function connectPlayer() {
  try { PS.net && PS.net.close(); } catch (e) {}
  clearInterval(PS.helloT); clearInterval(PS.pingT); clearInterval(PS.watch);
  const code = PS.code;
  PS.net = WRNet.join(code, CID, (m) => playerOnMsg(m, false), (k) => {
    if (k === "ready") { sendHello(); clearInterval(PS.helloT); PS.helloT = setInterval(() => { if (!PS.pid) sendHello(); }, 2000); }
    else if (k === "noroom") { if (!PS.pid) { LS.set("wr-join", null); joinScreen(code, T_("לא נמצא חדר עם הקוד הזה")); } }
    else if (k === "lost") reconnectSoon();
  });
  PS.lastMsg = now();
  PS.pingT = setInterval(() => PS.net && PS.net.send({ t: "ping" }), 4000);
  PS.watch = setInterval(() => { if (now() - PS.lastMsg > 12000) { banner("מתחברים מחדש…"); PS.lastMsg = now(); reconnectSoon(); } }, 3000);
}
function reconnectSoon() { if (PS._rc || PS.local) return; PS._rc = setTimeout(() => { PS._rc = null; if (PS.code) { PS.pid = 0; connectPlayer(); } }, 1500); }
const sendHello = () => PS.net && PS.net.send({ t: "hello", name: PS.name, ch: PS.ch });
function banner(txt, ms) {
  let b = $("#banner"); if (!b) { b = document.createElement("div"); b.id = "banner"; b.className = "banner"; stage.appendChild(b); }
  b.textContent = T_(txt); clearTimeout(b._t); if (ms) b._t = setTimeout(() => b.remove(), ms);
}
const clearBanner = () => { const b = $("#banner"); if (b) b.remove(); };

function playerOnMsg(m, local) {
  if (!m || !m.t) return;
  PS.lastMsg = now();
  if (m.t === "you") { PS.pid = m.pid; clearInterval(PS.helloT); clearBanner(); if (PS.st) playerOnMsg(PS.st, false); return; }
  if (m.t === "late" || m.t === "full" || m.t === "kick" || m.t === "closed") {
    if (local) return;
    const msg = { late: "המירוץ כבר התחיל. חכו למירוץ הבא", full: "החדר מלא (30 שחקנים)", kick: "המורה הוציא אתכם מהחדר", closed: "החדר נסגר" }[m.t];
    const code = PS.code; LS.set("wr-join", null); joinScreen(code, T_(msg)); return;
  }
  if (m.t !== "st") return;
  PS.st = m;
  if (!local && !PS.pid) return;            // not (yet) a member of this room
  if (!local && !m.pl.some((x) => x[0] === PS.pid)) { PS.pid = 0; sendHello(); return; }
  clearBanner();
  if (m.race !== PS.race) { PS.race = m.race; PS.recorded = {}; PS.sessionStart = now(); }
  if (m.ph === "lobby") {
    if (PS.local) { if (VIEW.name !== "lobby") lobbyScreen(); else renderLobbyPlayers(); }
    else if (VIEW.name !== "wait") waitScreen(m); else waitUpdate(m);
    return;
  }
  if (m.ph === "end") { recordEnd(m); if (PS.dismissed === m.race) { if (VIEW.name !== "wait") waitScreen(null, "ממתינים למורה"); return; } if (VIEW.name !== "podium") { if (MOBILE) resultScreen(m); else podiumScreen(m, PS.pid); } return; }
  if (VIEW.name !== "race") raceScreen(m, false); else raceUpdate(m, false);
  if (m.ph === "rev") recordAnswer(m);
}

/* ---------- m04 waiting for the teacher ---------- */
function waitScreen(m, msg) {
  show("wait", () => {
    const code = PS.code;
    stage.innerHTML = `<section class="scr on" id="s-wait">${LOW ? "" : clouds([[24, 110, 100, 0.8], [270, 170, 90, 0.7], [900, 120, 160, 0.6]])}
      <div class="topbar"><div class="tb-r"><button class="iconbtn" id="bBack" aria-label="יציאה">${ico(BACK, 30, 3)}</button><div class="hud" style="font-size:${MOBILE ? 17 : 20}px"><span>חדר</span> <span class="num en" translate="no">${code.slice(0, 3)} ${code.slice(3)}</span></div></div>${MOBILE ? "" : logo(40, 5, 3)}</div>
      <div class="wait-t"><div class="title" style="font-size:${MOBILE ? 34 : 48}px" id="waitT">${msg || "ממתינים למורה"}</div><div class="dots3"><i></i><i></i><i></i></div></div>
      <div class="wait-me"><div class="ptag" style="--c:${shirt(PS.ch)};font-size:${MOBILE ? 26 : 32}px" translate="no">${esc(PS.name)}</div>
        <div style="position:relative;margin-top:6px;z-index:2">${front(PS.ch, CHARS.findIndex((c) => c.id === PS.ch) + 1, MOBILE ? 190 : 200, true)}</div><div class="spot"></div></div>
      <div class="card wait-card" style="${MOBILE ? "left:20px;right:20px;bottom:96px" : "left:240px;right:240px;bottom:100px"}">
        <div style="font:800 20px var(--ui);display:flex;align-items:center;gap:8px">${ico("users", 22, 2.6, "#2f7bff")}<span id="waitCnt"></span></div>
        <div class="avrow" id="avrow"></div>
        <div class="wait-note">המירוץ יתחיל כשהמורה ילחץ על "התחל מירוץ". השאלות יופיעו כאן.</div></div>
      <div class="sumbar" id="sumbar" style="${MOBILE ? "left:20px;right:20px;bottom:30px;font-size:17px" : "left:340px;right:340px;bottom:30px"}"></div>
    </section>`;
    $("#bBack").onclick = () => { LS.set("wr-join", null); homeScreen(); };
    if (m) waitUpdate(m);
  });
}
function waitUpdate(m) {
  if (!$("#waitCnt")) return;
  const t = $("#waitT"); if (t && PS.pid) t.textContent = T_("ממתינים למורה");
  $("#waitCnt").innerHTML = `<span class="fred" style="font-size:24px">${m.pl.length}</span> שחקנים בחדר`;
  $("#avrow").innerHTML = m.pl.filter((p) => p[0] !== PS.pid).slice(0, MOBILE ? 10 : 20).map((p) => `<span class="av" style="background:${shirt(p[2])}">${front(p[2], p[3] + 1, 44)}</span>`).join("");
  $("#sumbar").innerHTML = `${ico("gauge", 20, 2.6, "#ff9a1f")}<span>${setSummary({ level: m.set.l, age: m.set.a, n: m.set.n, time: m.set.tm })}</span>`;
}

/* ---------- 05 / 05b / m05 race ---------- */
let RACE = null, TIMER_IV = null;
function trackSpec(projector) {
  // feet: the lowest screen y where a runner at the start is still fully visible (the start line itself is below the view, as in the mockups)
  if (MOBILE) return { W: 390, H: 330, y0: 372, y1: 150, bw: 430, tw: 236, base: 64, tag: 13, tmax: 1.6, feet: 316 };
  if (projector) return { W: 1280, H: 800, y0: 880, y1: 300, bw: 1160, tw: 580, base: 150, tag: 22, feet: 772 };
  return { W: 1280, H: 520, y0: 560, y1: 118, bw: 980, tw: 500, base: 124, tag: 19, cx: 590, feet: 500 };
}
function raceScreen(m, projector) {
  show("race", () => {
    const sp = trackSpec(projector), L = Math.max(4, m.pl.length);
    const T = new Track(sp.W, sp.H, sp.y0, sp.y1, sp.bw, sp.tw, L, sp.cx);
    RACE = { T, sp, projector, L, t0: Math.max(0, T.tAt(sp.feet)), runners: new Map(), n: m.n, qkey: "", picked: -1, fbk: "", end: 0, dur: 0 };
    const trackH = MOBILE ? Math.round(MH * 0.39) : sp.H, k = trackH / sp.H;
    const trackWrap = `<div class="trackwrap" id="trk" style="width:${sp.W}px;height:${sp.H}px;${MOBILE ? `transform-origin:50% 0;transform:scale(${k.toFixed(4)})` : ""}">${T.svg(m.n, LOW, sp.tmax)}<div id="runners"></div></div>`;
    let body;
    if (projector) {
      body = `${trackWrap}
        <div class="card pq" id="pq" translate="no"><div style="display:flex;align-items:center;gap:18px;direction:ltr">${timerHTML(92, 10, 38)}
          <div style="flex:1;min-width:0"><div class="en qlead" style="font-size:22px" id="qLead"></div><div class="en qtext" id="qText" style="font-size:40px"></div></div><span id="qMeta"></span></div>
          <div class="answers" id="answers" style="margin-top:12px"></div></div>
        <div class="card ansd" id="ansd"><div style="font:800 20px var(--ui)" id="ansN"></div><div class="dotsp" id="dotsp"></div></div>
        <div class="hud" style="position:absolute;right:24px;bottom:24px;font-size:20px;z-index:1500">${ico("projector", 22, 2.6, "#ff4f8b")}<span>מצב הצגה · עונים בטלפון</span></div>`;
    } else {
      const qhead = MOBILE ? `<div class="qhead">${timerHTML(62, 7, 26)}<span class="qmeta" id="qMeta"></span></div>` : `<div class="qmeta" id="qMeta"></div>`;
      const hs = MOBILE ? "font-size:17px;padding:4px 12px" : "";
      body = `${trackWrap}
        ${MOBILE ? `<div style="position:absolute;left:0;right:0;top:0;height:44px;background:linear-gradient(rgba(111,208,255,.95),rgba(111,208,255,0));z-index:2999"></div>` : ""}
        <div class="topbar" style="height:auto;top:${MOBILE ? 10 : 14}px;align-items:flex-start;${MOBILE ? "padding:0 12px;z-index:3000" : ""}">
          <div class="hud" style="${hs}"><span class="fred" style="font-weight:600">שאלה</span><span class="num" style="font-size:${MOBILE ? 22 : 28}px" id="hQ">1</span><span style="opacity:.6">/ ${m.n}</span></div>
          <div class="hud dark" style="${hs}">${ico("trophy", MOBILE ? 20 : 24, 2.6, "#ffc21a")}<span>${MOBILE ? "מקום" : "אני במקום"}</span><span class="num" style="font-size:${MOBILE ? 22 : 28}px;color:#ffc21a" id="hR">1</span></div>
        </div>
        ${MOBILE ? "" : `<div class="card lb" id="lb"><div class="lbt">${ico("flag", 20, 2.8)}<span>מיקומים</span></div><div id="lbRows"></div></div>`}
        <div class="panel" id="panel">
          <div class="qrow"><div class="qbox card" translate="no">${qhead}<div class="qlead en" id="qLead"></div><div class="qtext en" id="qText"></div></div>${MOBILE ? "" : timerHTML(128, 13, 50)}</div>
          <div class="answers" id="answers" translate="no"></div>
        </div>`;
    }
    stage.innerHTML = `<section class="scr on" id="s-race" style="${MOBILE ? "background:#5cc43f" : ""}">${body}</section>`;
    if (MOBILE) { const pn = $("#panel"); pn.style.top = (trackH - 8) + "px"; pn.style.borderTop = "4px solid var(--ink)"; pn.style.display = "flex"; pn.style.flexDirection = "column"; }
    raceUpdate(m, projector);
  });
  clearInterval(TIMER_IV); TIMER_IV = setInterval(updateTimer, 200);
}
function placeRunners(m) {
  const { T, sp, L, projector } = RACE, box = $("#runners"); if (!box) return;
  const meP = m.pl.find((p) => p[0] === PS.pid && !projector);
  const base = Math.min(sp.base, (sp.bw / L) * 0.76), seen = new Set(), wk = Math.round(base);
  for (const p of m.pl) {
    const [pid, name, ch, lane, ok, , on, , rk] = p; seen.add(pid);
    const t = RACE.t0 + (1 - RACE.t0) * Math.min(1, ok / m.n), sc = T.sc(t), u = (lane + 0.5) / L;
    const w = base * sc, hh = w * 152 / 120, x = T.x(t, u), y = T.y(t);
    const me = !!meP && pid === meP[0];
    const showName = me || (!MOBILE && (L <= 10 || rk <= 3));
    let r = RACE.runners.get(pid);
    if (!r) {
      r = document.createElement("div"); r.className = "runner"; r.dataset.pid = pid; box.appendChild(r);
      r.innerHTML = `<div class="rv"></div><div class="tag"></div>`; RACE.runners.set(pid, r); r._ok = ok;
      r.style.transition = "none"; requestAnimationFrame(() => requestAnimationFrame(() => (r.style.transition = "")));
    }
    if (r._ch !== ch) {
      r._ch = ch;
      r.querySelector(".rv").innerHTML = chSVG(ch, "a", lane + 1, wk).replace('class="char"', 'class="char ph-a"') + (LOW ? "" : chSVG(ch, "b", lane + 1, wk).replace('class="char"', 'class="char ph-b"')) +
        (me ? `<div class="me-ring" style="width:${wk * 1.25}px;height:${wk * 0.42}px;left:${-wk * 0.125}px;top:${wk * 152 / 120 - wk * 0.25}px;z-index:-1"></div>` : "");
      r.style.width = wk + "px"; r.style.height = (wk * 152 / 120) + "px";
    }
    r.style.zIndex = Math.round(1000 - t * 500); r.classList.toggle("off", !on);
    r.style.transform = `translate(${(x - w / 2).toFixed(1)}px,${(y - hh).toFixed(1)}px) scale(${(w / wk).toFixed(4)})`;
    const tag = r.querySelector(".tag");
    const gained = ok > r._ok; if (gained && !LOW) stride(r);
    const ts = Math.max(13, sp.tag * (0.75 + 0.25 * sc / T.sc(0)));
    tag.style.cssText = `--c:${shirt(ch)};font-size:${(ts * wk / w).toFixed(1)}px`;
    tag.className = "tag" + (showName ? "" : " mini");
    const h = `<b class="rk rk${rk}">${rk}</b>` + (showName ? `<span translate="no">${esc(name)}</span>` : "") + (me ? "<em>אני</em>" : "");
    if (tag._h !== h || gained) { tag.innerHTML = h + (gained ? `<span class="plus">+${ok - r._ok}</span>` : ""); tag._h = h; }
    r._ok = ok;
  }
  for (const [pid, r] of RACE.runners) if (!seen.has(pid)) { r.remove(); RACE.runners.delete(pid); }
}
function stride(r) {
  let k = 0; clearInterval(r._iv);
  r._iv = setInterval(() => { r.classList.toggle("pb"); if (++k >= 6) { clearInterval(r._iv); r.classList.remove("pb"); } }, 150);
}
function qTextHTML(q) {
  if (q.listen) return `<button class="saybtn big" id="bListen" aria-label="Listen">${ico("volume", 44, 2.6, "#fff")}</button>`;
  let t = esc(q.text);
  if (q.type === "grammar") t = t.replace("\u0001", "<u>&nbsp;?&nbsp;</u>");
  if (q.type === "missing") t = t.replace("\u2009?\u2009", "<u style='min-width:44px'>?</u>");
  return t;
}
const CATICO = { grammar: "pen", missing: "missing", listen: "volume", vocab: "book" };
function raceUpdate(m, projector) {
  if (!RACE || !$("#answers")) return;
  placeRunners(m);
  const meP = projector ? null : m.pl.find((p) => p[0] === PS.pid);
  if ($("#hQ")) { $("#hQ").textContent = Math.max(1, m.qi + 1); $("#hR").textContent = meP ? meP[8] : "-"; }
  if ($("#lbRows")) {
    const order = m.pl.slice().sort((a, b) => a[8] - b[8]);
    let rows = order.slice(0, 6);
    if (meP && !rows.includes(meP)) rows = order.slice(0, 5).concat([meP]);
    $("#lbRows").innerHTML = rows.map((p) => `<div class="lb-r ${p === meP ? "me" : ""} ${p[6] ? "" : "off"}"><b class="rkb rk${p[8]}">${p[8]}</b><span class="lb-n" translate="no">${esc(p[1])}</span><span class="lb-bar"><i style="width:${Math.round(Math.min(1, p[4] / m.n) * 100)}%;background:${shirt(p[2])}"></i></span></div>`).join("");
  }
  const cd = $("#countdown");
  if (m.ph === "count") {
    RACE.cdEnd = now() + m.left;
    if (!cd) { const d = document.createElement("div"); d.id = "countdown"; d.className = "countdown"; d.innerHTML = "<b class='fred'></b>"; $("#s-race").appendChild(d); }
    tickCountdown(); return;
  }
  if (cd) cd.remove();
  if (!m.q) return;
  const q = localize(m.q), key = m.race + ":" + m.qi;
  if (RACE.qkey !== key) {
    RACE.qkey = key; RACE.picked = -1; RACE.end = now() + m.left; RACE.dur = m.dur || 1;
    $("#qLead").textContent = (projector ? `Question ${m.qi + 1} / ${m.n} · ` : "") + q.lead;
    const qt = $("#qText"); qt.innerHTML = qTextHTML(q);
    qt.className = "qtext en" + (q.tn ? " nat" : "") + (String(q.text || "").length > (MOBILE ? 22 : 34) ? " long" : "");
    qt.dir = q.tn ? "auto" : "ltr";
    $("#qMeta").innerHTML = (projector ? "" : `<span class="qcat">${ico(CATICO[q.type] || "languages", 18, 2.8, "#fff")}<span>${esc(q.cat)}</span></span>`) +
      (CAN_SPEAK && q.speak && !q.listen ? `<button class="saybtn" id="bSay" aria-label="Listen" style="width:40px;height:40px">${ico("volume", 20, 2.6, "#fff")}</button>` : "");
    const ans = $("#answers"); ans.style.gridTemplateColumns = MOBILE ? "1fr 1fr" : `repeat(${q.opts.length},1fr)`;
    const long = q.opts.some((o) => String(o).length > (MOBILE ? 9 : 12));
    ans.innerHTML = q.opts.map((o, i) => `<button class="ans ${ACLS[i]} ${long ? "long" : ""}" data-a="${i}" aria-label="${SHNAME[i]}: ${esc(o)}" ${projector ? "disabled" : ""}><span class="sb">${shape(SH[i], projector ? 22 : MOBILE ? 26 : 30, i === 2 ? "#2b2140" : "#fff")}</span><span class="at ${q.optsEn ? "" : "nat"}" dir="auto">${esc(o)}</span></button>`).join("");
    if (!projector) $$(".ans", ans).forEach((b) => (b.onclick = () => pickAnswer(+b.dataset.a)));
    const lst = $("#bListen"), sb = $("#bSay");
    if (lst) lst.onclick = () => speak(q.speak);
    if (sb) sb.onclick = () => speak(q.speak);
    const autoSay = m.ph === "q" && (q.listen || (levelOf(m.set.l).say && q.speak)) && (m.mode === "online" || projector);
    if (autoSay) setTimeout(() => speak(q.speak), 350);
    const fb = $("#fbk"); if (fb) fb.remove();
  }
  if (meP) {
    const st = meP[7];
    if (RACE.picked < 0 && meP[9] >= 0) RACE.picked = meP[9];
    $$(".ans").forEach((b) => { const i = +b.dataset.a; b.disabled = st > 0 || m.ph !== "q" || RACE.picked >= 0; b.classList.toggle("pick", i === RACE.picked); });
    if (st && RACE.fbk !== key + st) { RACE.fbk = key + st; feedback(st === 2 ? "ok" : "no"); if (st === 2) SFX.ok(); else SFX.no(); }
  }
  if (m.ph === "rev") {
    $$(".ans").forEach((b) => { const i = +b.dataset.a; b.disabled = true; b.classList.toggle("right", i === m.ok); b.classList.toggle("dim", i !== m.ok); });
    if (meP && !meP[7] && RACE.fbk !== key + "r") { RACE.fbk = key + "r"; feedback("late"); SFX.no(); }
    RACE.end = now();
  } else if (m.ph === "q") RACE.end = now() + m.left;
  if (projector) {
    const on = m.pl.filter((p) => p[6]), done = m.pl.filter((p) => p[7] > 0).length;
    $("#ansN").innerHTML = m.ph === "rev"
      ? `${ico("check", 22, 3, "#22b573")}<span>ענו נכון</span> <b class="fred" style="font-size:26px">${m.pl.filter((p) => p[7] === 2).length}</b> <span>מתוך</span> ${m.pl.length}`
      : `${ico("check", 22, 3, "#22b573")}<span>ענו</span> <b class="fred" style="font-size:26px">${done}</b> <span>מתוך</span> ${on.length}`;
    $("#dotsp").innerHTML = m.pl.slice(0, 16).map((p) => `<span class="dotp ${p[7] > 0 ? "done" : ""}" style="background:${shirt(p[2])}">${front(p[2], p[3] + 1, 30)}</span>`).join("") + (m.pl.length > 16 ? `<span class="fred" style="align-self:center;font-size:22px">+${m.pl.length - 16}</span>` : "");
  }
  updateTimer();
}
function pickAnswer(i) {
  if (!RACE || RACE.picked >= 0 || !PS.st || PS.st.ph !== "q") return;
  RACE.picked = i; SFX.tap();
  $$(".ans").forEach((b) => { b.disabled = true; b.classList.toggle("pick", +b.dataset.a === i); });
  feedback("wait");
  const qi = PS.st.qi;
  if (PS.local && H) hostAnswer(H.players.get("host-" + CID), qi, i);
  else if (PS.net) { PS.net.send({ t: "ans", qi, a: i }); setTimeout(() => { if (RACE && RACE.picked === i && PS.st && PS.st.qi === qi && PS.st.ph === "q") { const me = PS.st.pl.find((p) => p[0] === PS.pid); if (me && !me[7]) PS.net.send({ t: "ans", qi, a: i }); } }, 1500); }
}
function feedback(kind) {
  let f = $("#fbk");
  if (!f) { f = document.createElement("div"); f.id = "fbk"; ($("#panel") || $("#s-race") || stage).appendChild(f); }
  const txt = { ok: ico("check", 28, 3.4, "#fff") + "<span>נכון!</span>", no: ico("x", 28, 3.4, "#fff") + "<span>לא נכון</span>", wait: ico("timer", 26, 2.8, "#fff") + "<span>התשובה נשלחה</span>", late: ico("timer", 26, 2.8, "#fff") + "<span>נגמר הזמן</span>" }[kind];
  f.className = "fbk " + (kind === "ok" ? "ok" : kind === "wait" ? "wait" : "no");
  f.innerHTML = txt; f.style.top = "-30px";
}
function tickCountdown() {
  const cd = $("#countdown"); if (!cd || !RACE) return;
  const n = Math.ceil((RACE.cdEnd - now()) / 1000), label = n > 0 ? String(Math.min(3, n)) : "GO!";
  const b = cd.querySelector("b");
  if (b.textContent !== label) { b.textContent = label; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; if (label === "GO!") SFX.go(); else SFX.tick(); }
}
function updateTimer() {
  if (!RACE) return;
  if ($("#countdown")) tickCountdown();
  const el = $(".timer"); if (!el || !RACE.dur) return;
  const left = Math.max(0, RACE.end - now()), frac = Math.max(0, Math.min(1, left / RACE.dur));
  const c = +el.dataset.c, arc = el.querySelector(".arc");
  arc.setAttribute("stroke-dasharray", (c * frac).toFixed(1) + " " + c.toFixed(1));
  arc.setAttribute("stroke", frac < 0.25 ? "#ff5a4f" : "#ff9a1f");
  const s = Math.ceil(left / 1000), b = el.querySelector("b");
  if (b.textContent !== String(s)) { b.textContent = s; if (s <= 3 && s > 0 && RACE.projector) SFX.tick(); }
  el.classList.toggle("low5", s <= 5);
}

/* ---------- results to the Englishia account (logged-in players only, from their own device) ---------- */
function recordAnswer(m) {
  try {
    if (!window.EnglishiaAuth || !EnglishiaAuth.user || !m.q) return;
    const key = m.race + ":" + m.qi; if (PS.recorded[key]) return; PS.recorded[key] = 1;
    const meP = m.pl.find((p) => p[0] === PS.pid); if (!meP) return;
    const q = localize(m.q), given = meP[9] >= 0 ? q.opts[meP[9]] : "";
    const prompt = (q.lead + " " + (q.listen ? "(listen) " + (q.speak || "") : String(q.text || "").replace("\u0001", "___"))).slice(0, 200);
    const item = q.type + ":" + String(q.te || (q.oe ? q.oe[m.ok] : "") || q.speak || q.text || "").replace("\u0001", "___").slice(0, 60);
    EnglishiaAuth.recordAnswer(GAME_ID, { item, topic: q.cat, level: m.set.l, prompt, correct: meP[7] === 2, given: String(given), expected: String(q.opts[m.ok]) });
  } catch (e) {}
}
function recordEnd(m) {
  try {
    if (!window.EnglishiaAuth || !EnglishiaAuth.user) return;
    const key = "end:" + m.race; if (PS.recorded[key]) return; PS.recorded[key] = 1;
    const meP = m.pl.find((p) => p[0] === PS.pid); if (!meP) return;
    EnglishiaAuth.recordSession(GAME_ID, meP[5], Math.max(1, Math.round((now() - (PS.sessionStart || now())) / 1000)));
    if (EnglishiaAuth.flushAnswers) EnglishiaAuth.flushAnswers();
  } catch (e) {}
}

/* ---------- 06 podium (desktop / projector) and m06 phone result ---------- */
function confetti(n, W, top, H2) {
  if (LOW) return "";
  const cols = ["#ff7a1a", "#ffc21a", "#ff4f8b", "#22b573", "#2f7bff", "#8b5cf6", "#14b8c9"];
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; let o = "";
  for (let i = 0; i < n; i++) o += `<div class="cf" style="left:${Math.round(r() * W)}px;top:${Math.round(top + r() * H2)}px;width:${10 + Math.round(r() * 8)}px;height:${6 + Math.round(r() * 4)}px;background:${cols[Math.floor(r() * 7)]};transform:rotate(${Math.round(r() * 180)}deg);animation-delay:${(r() * 3).toFixed(2)}s"></div>`;
  return o;
}
function wireEnd() {
  $("#bMenu").onclick = () => { LS.set("wr-join", null); homeScreen(); };
  $("#bAgain").onclick = () => {
    SFX.tap();
    if (H) hostRematch();
    else if (PS.code && PS.net) { PS.dismissed = PS.race; waitScreen(PS.st && PS.st.ph === "lobby" ? PS.st : null, "ממתינים למורה"); }
    else homeScreen();
  };
}
function podiumScreen(m, myPid) {
  clearInterval(TIMER_IV); RACE = null;
  show("podium", () => {
    const order = m.pl.slice().sort((a, b) => a[8] - b[8]);
    const block = (p, h, cls, place) => !p ? `<div class="pod ${cls}" style="visibility:hidden"></div>` : `<div class="pod ${cls}"><div class="pod-tag" style="background:${shirt(p[2])}" translate="no">${esc(p[1])}</div><div class="pod-ch">${place === 1 ? `<div class="crown">${ico("crown", 54, 2.6, "#2b2140", "#ffc21a")}</div>` : ""}${front(p[2], p[3] + 1, place === 1 ? 150 : 130, true)}</div>
      <div class="pod-b" style="height:${h}px"><b class="fred">${place}</b><span><span class="fred">${p[4]}</span> ${W_OK()}</span></div></div>`;
    const pods = block(order[1], 170, "p2", 2) + block(order[0], 230, "p1", 1) + block(order[2], 126, "p3", 3);
    const row = (p, cls) => `<div class="rr ${cls}"><b class="rkb">${p[8]}</b><span class="rr-av" style="background:${shirt(p[2])}">${front(p[2], p[3] + 1, 44)}</span><span class="rr-n" translate="no">${esc(p[1])}</span><span class="rr-s"><span class="fred">${p[4]}</span> ${W_OK()}</span></div>`;
    const rest = order.slice(3).map((p) => row(p, p[0] === myPid ? "me" : "")).join("");
    const me = myPid ? order.find((p) => p[0] === myPid) : null;
    stage.innerHTML = `<section class="scr on" id="s-podium">${LOW ? "" : clouds([[90, 120, 140, 0.6], [980, 90, 170, 0.7]])}${confetti(46, 1260, 80, 480)}
      <div class="topbar" style="justify-content:center;top:10px"><div class="title" style="font-size:58px;-webkit-text-stroke:10px var(--ink);text-shadow:0 7px 0 var(--ink)">${me ? `סיימת במקום ${me[8]}!` : "המירוץ הסתיים!"}</div></div>
      <div class="stage-p">${pods}</div>
      <div class="card restc">
        ${rest ? `<div class="rt">${ico("medal", 26, 2.6, "#ff9a1f")}<span>שאר המשתתפים</span></div><div class="rlist">${rest}</div>` : ""}
        ${me ? `<div class="muted" style="font:800 22px var(--ui);color:var(--ink)">${ico("trophy", 22, 2.6, "#ff9a1f")}<span>הניקוד שלי:</span> <b class="fred">${me[5]}</b></div>` : ""}
        <div class="muted">${ico("flag", 18, 2.6)}<span>${setSummary({ level: m.set.l, age: m.set.a, n: m.n })}</span></div>
        <button class="btn orange" id="bAgain" style="width:100%;margin-top:16px;font-size:30px">${ico("rotate", 30, 3)}משחק חדש</button>
        <button class="btn" id="bMenu" style="width:100%;margin-top:16px;font-size:26px">${ico("home", 28, 2.8)}חזרה לתפריט</button>
      </div>
    </section>`;
    wireEnd();
  });
  SFX.win();
}
function resultScreen(m) {
  clearInterval(TIMER_IV); RACE = null;
  show("podium", () => {
    const order = m.pl.slice().sort((a, b) => a[8] - b[8]);
    const me = order.find((p) => p[0] === PS.pid) || order[0], place = me[8];
    const col = place === 1 ? "var(--gold)" : place === 2 ? "var(--silver)" : place === 3 ? "var(--bronze)" : "#c9bfe0";
    let list = order.slice(0, 4); if (!list.includes(me)) list = order.slice(0, 3).concat([me]);
    const rows = list.map((p) => `<div class="rr ${p === me ? "me" : ""}"><b class="rkb rk${p[8]}">${p[8]}</b><span class="rr-av" style="background:${shirt(p[2])}">${front(p[2], p[3] + 1, 36)}</span><span class="rr-n" translate="no">${esc(p[1])}</span>${p === me ? "<span class='rr-s'>(אני)</span>" : ""}<span class="rr-s"><span class="fred">${p[4]}</span> ${W_OK()}</span></div>`).join("");
    const small = MH < 780, listTop = Math.min(410, MH - 168 - list.length * 49 - 16);
    stage.innerHTML = `<section class="scr on" id="s-result">${confetti(22, 380, 60, 270)}
      <div style="position:absolute;top:${small ? 18 : 58}px;left:0;right:0;text-align:center"><div class="mt">סיימת במקום ${place}!</div></div>
      <div class="mres" style="top:${small ? 64 : 112}px"><div style="position:relative">${front(me[2], me[3] + 1, small ? 104 : 132, true)}<div style="position:absolute;right:-10px;top:${small ? 60 : 84}px;width:50px;height:50px;border-radius:50%;background:${col};border:3px solid var(--ink);display:grid;place-items:center">${ico("medal", 30, 2.6, "#2b2140")}</div></div>
        <div class="mblock" style="background:${col}"><b class="fred">${place}</b><span><span class="fred">${me[4]}</span> נכונות מתוך ${m.n}</span></div></div>
      <div class="card restc" style="top:${listTop}px">${rows}</div>
      <div class="mbtns"><button class="btn orange mbtn" id="bAgain">${ico("rotate", 26, 3)}משחק חדש</button><button class="btn mbtn" id="bMenu" style="height:62px;font-size:22px">${ico("home", 24, 2.8)}חזרה לתפריט</button></div>
    </section>`;
    wireEnd();
  });
  SFX.win();
}

/* ================= boot ================= */
fit();
{
  const urlCode = (URLP.get("code") || "").replace(/\D/g, "");
  const resume = LS.get("wr-join", null);
  if (urlCode.length === 6 && resume && resume.code === urlCode && now() - resume.at < 3 * 3600e3 && resume.name) playerJoin(urlCode, resume.name, resume.ch);
  else if (urlCode.length === 6) characterScreen({ code: urlCode });
  else homeScreen();
}
window.addEventListener("pagehide", () => { try { if (PS.net) PS.net.send({ t: "bye" }); } catch (e) {} });
// read-only status for the automated tests (nothing here can change a score)
window.__WR = { get host() { return H ? { code: H.code, ph: H.ph, qi: H.qi, n: H.players.size, status: H.status, ans: [...H.players.values()].map((p) => [p.pid, p.ans[H.qi] ? p.ans[H.qi].a : -1, p.ok]) } : null; }, get player() { return { pid: PS.pid, ph: PS.st && PS.st.ph, qi: PS.st && PS.st.qi, view: VIEW.name }; } };
