/* Sentence Sprint 1.1 — canvas engine: draws the level, word bubbles and runners, runs the local
   runner's physics, and smooths the other runners from the host's snapshots (interpolation with
   dead-reckoning, so slow links still look smooth). Light by design: one background image per tile,
   pre-rendered bubbles and name tags, 30 fps and 1x pixels in low graphics. © 2026 Amir · Englishia */
import { VIEW_TOP, VIEW_H, TILE, PHYS, step } from "./level.js?v=1.1.1";
import { disp } from "./grammar.js?v=1.1.1";
import { RUN_FRAMES } from "./frames.js?v=1.1.1";

export const CHAR_COLORS = {
  zik: ["#ffd84a", "#ffb800", "#b97f00"], gal: ["#5cb2ff", "#1f6fff", "#1449b5"], ale: ["#52e08a", "#14b05a", "#0b7a3c"],
  saar: ["#b08cff", "#7c4dff", "#4f2bc0"], fox: ["#5fe3e0", "#13b3c2", "#0a7c88"], bear: ["#ff7a6b", "#f2392c", "#a81c13"]
};
let MCTX = null;
const BUBBLE_GOLD = ["#fff3a3", "#ffc400", "#b88400"];
const BUBBLE = [["#ff7fb7", "#ff3d8a", "#c01e61"], ["#5cb2ff", "#1f6fff", "#1449b5"], ["#ffb43a", "#ff7a00", "#c4560a"], ["#5fe3e0", "#13b3c2", "#0a7c88"],
  ["#b08cff", "#7c4dff", "#4f2bc0"], ["#52e08a", "#14b05a", "#0b7a3c"], ["#ffe066", "#ffb800", "#b97f00"], ["#ff7a6b", "#f2392c", "#a81c13"]];
export const PU = {
  speed: { img: "pu-boost-speed", boost: 1, he: "מהירות" }, shield: { img: "pu-boost-shield", boost: 1, he: "מגן" },
  magnet: { img: "pu-boost-magnet", boost: 1, he: "מגנט מילים" }, dj: { img: "pu-boost-double-jump", boost: 1, he: "קפיצה כפולה" },
  lightning: { img: "pu-attack-lightning", boost: 0, he: "ברק" }, freeze: { img: "pu-attack-freeze", boost: 0, he: "הקפאה" },
  trap: { img: "pu-attack-trap", boost: 0, he: "מלכודת" }, rocket: { img: "pu-attack-rocket", boost: 0, he: "טיל" }
};
export const PU_KEYS = Object.keys(PU);
// how long each effect lasts (s)
export const DUR = { speed: 3.2, magnet: 6, dj: 9, shield: 12, lightning: 2.6, freeze: 1.6, trap: 1.3, rocket: 1.2, wrong: 0.5, cheer: 0.9 };
// snapshot flag bits
export const F = { shield: 1, speed: 2, stun: 4, slow: 8, magnet: 16, dj: 32, air: 64, fin: 128, frozen: 256, drop: 512, cheer: 1024, rise: 2048, left: 4096, walk: 8192 };

const IMG = {};
export function loadImages(base, low) {
  const names = ["level", "level-low", "seam-l", "seam-r", "podium"];
  for (const c of Object.keys(CHAR_COLORS)) names.push("run-" + c, "cheer-" + c, "head-" + c);
  for (const k of PU_KEYS) names.push(PU[k].img);
  for (const c of RUN_FRAMES.chars || []) names.push("run-cycle/" + c);
  return Promise.all(names.map((n) => new Promise((res) => {
    if (IMG[n]) return res();
    const im = new Image(); im.decoding = "async";
    im.onload = () => { IMG[n] = im; res(); }; im.onerror = () => res();
    im.src = base + n + (/^level|^menu/.test(n) ? ".jpg" : /^run-cycle\//.test(n) ? ".webp" : ".png");
  })));
}
export const img = (n) => IMG[n];

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

export function createGame(canvas, o) {
  const ctx = canvas.getContext("2d", { alpha: false });
  const G = {
    L: o.level, low: !!o.low, projector: !!o.projector, myPid: o.myPid || 0, players: o.players, // Map pid -> {name, ch, rank}
    me: null, remote: new Map(), got: new Set(), fx: [], items: [], t0: 0, running: false, finAt: 0,
    k: 1, W: 0, H: 0, dpr: 1, camX: 0, eff: {}, held: null, onCollect: o.onCollect || (() => true), onFinish: o.onFinish || (() => {}),
    canCollect: o.canCollect || (() => true), qb: null, qbs: new Map(), buf: 0, coyote: 0, startAt: 0, stopped: false, tick: 0, speed: o.speed || 255
  };
  const L = G.L;
  if (!G.projector) G.me = { x: L.start, y: 510, vx: 0, vy: 0, ground: true, onY: 510, fl: 0, jumps: 0, air: 0, fin: false, face: 1, maxX: L.start };
  /* 1.0.1: the runner moves only while the player holds left/right (keys, pads); -1..1 */
  G.input = { l: 0, r: 0 };
  G.dir = () => { const i = G.input; return Math.max(-1, Math.min(1, (i.r ? 1 : 0) - (i.l ? 1 : 0))); };

  /* ---------- size ---------- */
  G.resize = function () {
    const r = canvas.getBoundingClientRect();
    G.dpr = G.low ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    G.W = Math.max(1, Math.round(r.width * G.dpr)); G.H = Math.max(1, Math.round(r.height * G.dpr));
    canvas.width = G.W; canvas.height = G.H;
    G.k = G.H / VIEW_H; G.vw = G.W / G.k; G.oy = 0;
    // portrait phones: fit a wide slice of the track into the free band between the top HUD and the controls
    if (G.W < G.H) {
      const b = G.band || { top: 0, bottom: 0 }, top = b.top * G.dpr, avail = Math.max(100, G.H - top - b.bottom * G.dpr);
      G.k = Math.min(G.W / 760, avail / VIEW_H); G.vw = G.W / G.k;
      G.oy = top + Math.max(0, (avail - VIEW_H * G.k) * 0.35);
    }
    cache.clear();
  };
  const cache = new Map();

  /* ---------- pre-rendered pieces ---------- */
  function bubbleCanvas(word, ci) {
    const key = "b" + word + ci;
    let cv = cache.get(key); if (cv) return cv;
    const s = G.k, fs = 32, padX = 18, h = 54;
    const c0 = document.createElement("canvas").getContext("2d");
    c0.font = `600 ${fs * s}px Fredoka, Heebo, Arial`;
    const tw = c0.measureText(disp(word)).width / s;
    const w = Math.max(64, tw + padX * 2), tail = 12, sh = 6;
    cv = document.createElement("canvas"); cv.width = Math.ceil((w + 8) * s); cv.height = Math.ceil((h + tail + sh + 6) * s);
    const c = cv.getContext("2d"); c.scale(s, s); c.translate(4, 2);
    const [c1, c2, cd] = ci === 8 ? BUBBLE_GOLD : BUBBLE[ci % BUBBLE.length];
    // shadow + tail
    c.fillStyle = cd; rr(c, 0, sh, w, h, 22); c.fill();
    c.beginPath(); c.moveTo(w * 0.32 - 10, h + sh - 2); c.lineTo(w * 0.32 + 10, h + sh - 2); c.lineTo(w * 0.32 - 2, h + sh + tail); c.closePath(); c.fill();
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    c.fillStyle = gr; rr(c, 0, 0, w, h, 22); c.fill();
    if (!G.low) { const hl = c.createLinearGradient(0, 3, 0, h * 0.45); hl.addColorStop(0, "rgba(255,255,255,.5)"); hl.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = hl; rr(c, 8, 3, w - 16, h * 0.42, 16); c.fill(); }
    c.font = `600 ${fs}px Fredoka, Heebo, Arial`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "rgba(0,0,0,.18)"; c.fillText(disp(word), w / 2, h / 2 + 2.5);
    c.fillStyle = "#fff"; c.fillText(disp(word), w / 2, h / 2);
    cv._w = w + 8; cv._h = h + tail + sh + 6;
    cache.set(key, cv); return cv;
  }
  function balloonCanvas(word, ci) {
    const key = "q" + word + ci;
    let cv = cache.get(key); if (cv) return cv;
    const s = G.k, fs = word.length > 9 ? 26 : 30;
    const c0 = document.createElement("canvas").getContext("2d");
    c0.font = `600 ${fs * s}px Fredoka, Heebo, Arial`;
    const tw = c0.measureText(word).width / s;
    const w = Math.max(92, tw + 40), h = 82, pad = 6;
    cv = document.createElement("canvas"); cv.width = Math.ceil((w + pad * 2) * s); cv.height = Math.ceil((h + 18 + pad * 2) * s);
    const c = cv.getContext("2d"); c.scale(s, s); c.translate(pad, pad);
    const [c1, c2, cd] = ci === 8 ? BUBBLE_GOLD : BUBBLE[ci % BUBBLE.length];
    // knot
    c.fillStyle = cd; c.beginPath(); c.moveTo(w / 2 - 8, h + 9); c.lineTo(w / 2 + 8, h + 9); c.lineTo(w / 2, h - 3); c.closePath(); c.fill();
    // body: a rounded balloon (ellipse when the word is short, a pill-ellipse for long words)
    c.fillStyle = cd; c.beginPath(); c.ellipse(w / 2, h / 2 + 4, w / 2, h / 2, 0, 0, 7); c.fill();
    const gr = c.createRadialGradient(w * 0.36, h * 0.3, 4, w / 2, h / 2, w * 0.62); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    c.fillStyle = gr; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 7); c.fill();
    if (!G.low) { c.fillStyle = "rgba(255,255,255,.45)"; c.beginPath(); c.ellipse(w * 0.3, h * 0.27, Math.min(22, w * 0.14), 9, -0.5, 0, 7); c.fill(); }
    c.font = `600 ${fs}px Fredoka, Heebo, Arial`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "rgba(0,0,0,.22)"; c.fillText(word, w / 2, h / 2 + 2.5);
    c.fillStyle = ci === 8 ? "#5a3b00" : "#fff"; c.fillText(word, w / 2, h / 2);
    cv._w = w + pad * 2; cv._h = h + 18 + pad * 2; cv._bh = h;
    cache.set(key, cv); return cv;
  }
  function drawSet(c, set, t, x0, x1, alpha) {
    if (!set || !set.o) return;
    for (let i = 0; i < set.o.length; i++) {
      if (set.pop.has(i)) continue;
      const p = bPos(set, i, t); if (p.x < x0 - 140 || p.x > x1 + 140) continue;
      const ci = set.g ? 8 : (set.id + i) % 8, cv = balloonCanvas(set.o[i], ci);
      c.globalAlpha = alpha;
      // string
      c.strokeStyle = "rgba(29,35,80,.55)"; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y + cv._bh / 2 + 10);
      c.quadraticCurveTo(p.x + Math.sin(t * 2 + i) * 10, p.y + cv._bh / 2 + 30, p.x - 4, p.y + cv._bh / 2 + 52); c.stroke();
      if (set.g) { c.save(); c.globalAlpha = alpha * (0.3 + 0.2 * Math.sin(t * 5 + i)); c.fillStyle = "#ffe066"; c.beginPath(); c.ellipse(p.x, p.y, cv._w * 0.6, cv._bh * 0.75, 0, 0, 7); c.fill(); c.restore(); c.globalAlpha = alpha; }
      c.drawImage(cv, p.x - cv._w / 2, p.y - cv._bh / 2 - 6, cv._w, cv._h);
      if (set.g) for (let q = 0; q < (G.low ? 2 : 3); q++) { const a = t * 2.2 + q * 2.1 + i; sparkle(c, p.x + Math.cos(a) * cv._w * 0.55, p.y + Math.sin(a) * 40, 7 + 3 * Math.sin(t * 6 + q)); }
      c.globalAlpha = 1;
    }
  }
  /* arrow at the screen edge when my balloons are out of view */
  function drawArrow(c, set, t) {
    if (!set || set.wait) return;
    let left = 0, right = 0, inView = 0; const x0 = G.camX, x1 = G.camX + G.vw;
    for (let i = 0; i < set.o.length; i++) { if (set.pop.has(i)) continue; const p = bPos(set, i, t); if (p.x > x1 - 30) right++; else if (p.x < x0 + 30) left++; else inView++; }
    if (inView || (!left && !right)) return;
    const dir = right ? 1 : -1, ax = dir > 0 ? x1 - 46 : x0 + 46, ay = 260 + Math.sin(t * 4) * 6, k = 1 + 0.08 * Math.sin(t * 6);
    c.save(); c.translate(ax, ay); c.scale(dir * k, k);
    c.fillStyle = set.g ? "#ffc400" : "#ff3d8a"; c.strokeStyle = "#fff"; c.lineWidth = 5; c.lineJoin = "round";
    c.beginPath(); c.moveTo(-26, -16); c.lineTo(4, -16); c.lineTo(4, -32); c.lineTo(34, 0); c.lineTo(4, 32); c.lineTo(4, 16); c.lineTo(-26, 16); c.closePath(); c.stroke(); c.fill();
    c.restore();
  }
  function tagCanvas(p, me) {
    const key = "t" + p.name + "|" + p.rank + "|" + p.ch + (me ? "m" : "");
    let cv = cache.get(key); if (cv) return cv;
    const s = G.k, [c1, c2, cd] = CHAR_COLORS[p.ch] || CHAR_COLORS.zik;
    const c0 = document.createElement("canvas").getContext("2d");
    const fs = G.projector ? 24 : 19;
    c0.font = `800 ${fs * s}px Heebo, Arial, sans-serif`;
    const nameW = c0.measureText(p.name).width / s;
    c0.font = `800 ${(fs - 4) * s}px Heebo, Arial, sans-serif`;
    const meTxt = me ? (o.meLabel || "אני") : "", meW = me ? c0.measureText(meTxt).width / s + 14 : 0;
    const h = fs + 14, rk = h - 8, w = rk + 10 + nameW + (me ? meW + 6 : 0) + 14;
    cv = document.createElement("canvas"); cv.width = Math.ceil((w + 4) * s); cv.height = Math.ceil((h + 14) * s);
    const c = cv.getContext("2d"); c.scale(s, s); c.translate(2, 1);
    c.fillStyle = cd; rr(c, 0, 4, w, h, h / 2); c.fill();
    c.beginPath(); c.moveTo(w / 2 - 7, h + 2); c.lineTo(w / 2 + 7, h + 2); c.lineTo(w / 2, h + 11); c.closePath(); c.fill();
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); c.fillStyle = gr; rr(c, 0, 0, w, h, h / 2); c.fill();
    // rank circle on the reading-start side (right in RTL)
    const rtl = o.rtl !== false;
    const rx = rtl ? w - 4 - rk : 4;
    c.fillStyle = p.rank === 1 ? "#ffc83a" : p.rank === 2 ? "#cfd6e4" : p.rank === 3 ? "#e0905a" : "#fff";
    c.beginPath(); c.arc(rx + rk / 2, h / 2, rk / 2, 0, 7); c.fill();
    c.fillStyle = "#1d2350"; c.font = `700 ${fs - 4}px Fredoka, Heebo, Arial`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(p.rank || ""), rx + rk / 2, h / 2 + 1);
    c.font = `800 ${fs}px Heebo, Arial, sans-serif`; c.fillStyle = p.ch === "zik" ? "#1d2350" : "#fff"; c.textAlign = rtl ? "right" : "left";   // dark text on the yellow tag
    const nx = rtl ? rx - 8 : rx + rk + 8;
    c.fillText(p.name, nx, h / 2 + 1);
    if (me) {
      c.font = `800 ${fs - 4}px Heebo, Arial, sans-serif`;
      const ex = rtl ? nx - nameW - 6 - meW : nx + nameW + 6;
      c.fillStyle = "#fff"; rr(c, ex, 5, meW, h - 10, (h - 10) / 2); c.fill();
      c.fillStyle = "#1d2350"; c.textAlign = "center"; c.fillText(meTxt, ex + meW / 2, h / 2 + 1);
    }
    cv._w = w + 4; cv._h = h + 14; cache.set(key, cv); return cv;
  }

  /* ---------- remote runners (interpolation + dead-reckoning) ---------- */
  G.sample = function (pid, x, y, f, t) {
    if (pid === G.myPid && !G.projector) return;
    let R = G.remote.get(pid);
    if (!R) { R = { s: [], dx: x, dy: y, f, v: G.speed }; G.remote.set(pid, R); }
    const last = R.s[R.s.length - 1];
    if (last && t - last.t > 30) { const v = (x - last.x) / ((t - last.t) / 1000); if (v > -900 && v < 900) R.v = R.v * 0.5 + v * 0.5; }
    R.s.push({ t, x, y, f }); if (R.s.length > 8) R.s.shift();
    R.f = f;
  };
  function remotePos(R, now, dt) {
    const s = R.s; if (!s.length) return;
    const delay = o.slowLink && o.slowLink() ? 0 : 140, rt = now - delay;
    let tx, ty;
    let i = s.length - 1;
    while (i > 0 && s[i - 1].t > rt) i--;
    if (rt >= s[s.length - 1].t) {
      const a = s[s.length - 1], ahead = Math.min(o.slowLink && o.slowLink() ? 2.6 : 0.3, (rt - a.t) / 1000);
      const moving = (a.f & F.walk) && !(a.f & (F.stun | F.fin | F.frozen));
      tx = a.x + (moving ? R.v * ahead * ((a.f & F.slow) ? 0.5 : 1) : 0); ty = a.y;
    } else if (i === 0) { tx = s[0].x; ty = s[0].y; }
    else { const a = s[i - 1], b = s[i], u = (rt - a.t) / Math.max(1, b.t - a.t); tx = a.x + (b.x - a.x) * u; ty = a.y + (b.y - a.y) * u; }
    if (Math.abs(tx - R.dx) > 500) { R.dx = tx; R.dy = ty; }
    const a = Math.min(1, dt * 14);
    R.dx += (tx - R.dx) * a; R.dy += (ty - R.dy) * Math.min(1, dt * 18);
  }

  /* ---------- effects ---------- */
  G.apply = function (k, secs) { const t = performance.now() / 1000; G.eff[k] = Math.max(G.eff[k] || 0, t + (secs || DUR[k] || 1)); };
  G.active = (k) => (G.eff[k] || 0) > performance.now() / 1000;
  G.addFx = function (kind, a, b) { G.fx.push({ kind, a, b, t: performance.now() / 1000 }); };
  /* ---------- 1.1 balloons (Balloons / Translation modes): one set of 3-4 answer balloons per player and question.
     The host sends {id, o: words, x: anchor, g: golden}; every device lays the set out the same way from the id. ---------- */
  G.setQ = function (pid, set) {
    if (set) { set.pop = set.pop || new Set(); set.born = performance.now() / 1000; }
    if (G.me && pid === G.myPid) G.qb = set; else if (set) G.qbs.set(pid, set); else G.qbs.delete(pid);
  };
  function slots(set) {
    if (set._s && set._sx === set.x) return set._s;
    const out = [], n = set.o.length, h = (i) => (((set.id * 2654435761 + i * 40503) >>> 0) % 1000) / 1000;
    // spacing from the balloon widths, so long words never touch even while they drift
    if (!MCTX) MCTX = document.createElement("canvas").getContext("2d");
    MCTX.font = "600 30px Fredoka, Heebo, Arial";
    const bw = set.o.map((w) => Math.max(92, MCTX.measureText(w).width * (w.length > 9 ? 26 / 30 : 1) + 40));
    const xs = [0]; for (let i = 1; i < n; i++) xs.push(xs[i - 1] + Math.max(175, (bw[i - 1] + bw[i]) / 2 + 64));
    const x0 = Math.min(set.x, L.finish - 140 - xs[n - 1]);
    for (let i = 0; i < n; i++) {
      const x = x0 + xs[i] + (h(i) - 0.5) * 30;
      const fl = [...new Set(L.at(x, -30).map((f) => f.fl))].filter((q) => q < 2).sort();   // ground + middle floor (a top-floor balloon would sit under the HUD)
      const pickFl = fl.length ? fl[(set.id + i * 2) % fl.length] : 0;
      const f = L.at(x, -30).find((q) => q.fl === pickFl);
      out.push({ x, y: (f ? f.y : 510) - 152, ph: h(i + 7) * 6.28 });   // above head height: walking passes under, a jump touches it
    }
    set._s = out; set._sx = set.x; return out;
  }
  function bPos(set, i, t) {
    const s = slots(set)[i], a = t - (set.born || 0);
    const rise = Math.max(0, 1 - a / 0.45);          // new balloons float up into place
    return { x: s.x + Math.sin(t * 0.7 + s.ph) * 26, y: s.y + Math.sin(t * 1.25 + s.ph * 1.7) * 14 + rise * rise * 120 };
  }
  G.balloonAt = function (set, i) { const p = bPos(set, i, performance.now() / 1000); return p; };
  G.popBalloons = function (set, which, good) {
    if (!set) return; const t = performance.now() / 1000;
    for (let i = 0; i < set.o.length; i++) { if (set.pop.has(i) || (which != null && which !== i)) continue; const p = bPos(set, i, t); set.pop.add(i); G.fx.push({ kind: "bpop", x: p.x, y: p.y, c: set.g ? 8 : (set.id + i) % 8, t, good }); }
  };
  G.qMaxX = function (set) { const sl = slots(set); return Math.max(...sl.map((q) => q.x)); };
  function posOf(pid) {
    if (G.me && pid === G.myPid) return { x: G.me.x, y: G.me.y };
    const R = G.remote.get(pid); return R ? { x: R.dx, y: R.dy } : null;
  }
  G.flags = function () {
    let f = 0; const me = G.me; if (!me) return 0;
    if (G.shield) f |= F.shield; if (G.active("speed")) f |= F.speed; if (G.active("magnet")) f |= F.magnet; if (G.active("dj")) f |= F.dj;
    if (G.active("trap") || G.active("rocket")) f |= F.stun; if (G.active("freeze")) f |= F.frozen; if (G.active("lightning") || G.active("wrong")) f |= F.slow;
    if (!me.ground) f |= F.air; if (me.fin) f |= F.fin; if (me.dropY != null) f |= F.drop; if (!me.ground && me.vy < 0) f |= F.rise;
    if (G.active("cheer")) f |= F.cheer; if (me.face < 0) f |= F.left; if (Math.abs(me.vx) > 20) f |= F.walk;
    return f;
  };

  /* ---------- input ---------- */
  G.jump = function () { if (!G.me || G.me.fin) return; G.buf = 0.14; };
  /* drop through the platform under you to the floor below (not through the ground floor) */
  G.drop = function () {
    const me = G.me; if (!me || me.fin || !G.running || performance.now() < G.startAt) return false;
    if (!me.ground || !me.fl) { if (!me.ground && me.vy < 0) me.vy = 0; return false; }
    me.dropY = me.onY; me.dropFl = me.fl; me.ground = false; me.onY = null; me.vy = 260; me.y += 4; me.jumps = 1; o.sfx && o.sfx("drop");
    return true;
  };
  function doJump(me) {
    const canGround = me.ground || (me.air < 0.1 && me.jumps === 0 && me.vy >= 0);
    if (canGround) { me.vy = -PHYS.jump; me.ground = false; me.onY = null; me.jumps = 1; G.buf = 0; o.sfx && o.sfx("jump"); return; }
    if (G.active("dj") && me.jumps < 2) { me.vy = -PHYS.jump2; me.jumps = 2; G.buf = 0; o.sfx && o.sfx("jump"); }
  }

  /* ---------- update ---------- */
  function speedNow() {
    if (G.active("freeze") || G.active("trap") || G.active("rocket")) return 0;
    let v = G.speed;
    if (G.active("lightning")) v *= 0.5; else if (G.active("wrong")) v *= 0.85;   // 1.0.1: shorter, milder slowdown
    if (G.active("speed")) v *= 1.5;
    return v;
  }
  function update(dt, now) {
    const me = G.me, t = now / 1000;
    if (me) {
      const started = now >= G.startAt && G.running;
      let rem = dt;
      while (rem > 0) {
        const h = Math.min(rem, 1 / 120); rem -= h;
        if (G.buf > 0) { G.buf -= h; if (started) doJump(me); }
        let v = started ? speedNow() : 0, target;
        if (me.fin) target = Math.max(0, Math.min(v, (L.finish + 360 - me.x) * 2));
        else {
          const d = G.dir();
          target = d > 0 ? v * d : d < 0 ? -v * 0.8 : 0;                 // backwards a little slower
          if (d < 0 && me.x <= Math.max(L.start - 150, me.maxX - 900)) target = 0;   // only a bit back (to grab a missed word)
        }
        me.vx += (target - me.vx) * Math.min(1, h * (target === 0 ? 14 : 9));
        if (Math.abs(me.vx) < 2 && target === 0) me.vx = 0;
        if (me.vx > 5) me.face = 1; else if (me.vx < -5) me.face = -1;
        step(L, me, h, me.vx);
        if (me.x > me.maxX) me.maxX = me.x;
      }
      if (!me.fin && me.x >= L.finish) { me.fin = true; G.finAt = now; G.onFinish(); }
      // word bubbles
      if (started && !me.fin) {
        const mag = G.active("magnet"), cx = me.x, cy = me.y - 58;
        for (const b of L.bubbles) {
          if (b.x < cx - 300) continue; if (b.x > cx + 400) break;
          if (G.got.has(b.id)) continue;
          const by = b.y + Math.sin(t * 2 + b.id) * 5;
          let dx = b.x - cx, dy = by - cy;
          if (mag && Math.abs(dx) < 260 && Math.abs(dy) < 260) { b.mx = (b.mx || 0) + (-dx - (b.mx || 0)) * Math.min(1, dt * 5); b.my = (b.my || 0) + (-dy - (b.my || 0)) * Math.min(1, dt * 5); dx += b.mx; dy += b.my; }
          const rx = mag ? 120 : 52, ry = mag ? 120 : 64;
          if (Math.abs(dx) < rx && Math.abs(dy) < ry) {
            if (!G.canCollect(b)) { if (!b.full) { b.full = 1; o.onFull && o.onFull(); } continue; }
            G.got.add(b.id); G.onCollect(b); G.fx.push({ kind: "pop", x: b.x + (b.mx || 0), y: by + (b.my || 0), c: b.g ? 8 : b.c, t: t });
          }
        }
      }
    }
    // answer balloons: touching one answers the question (once; the host replies with the next question)
    const qs = G.qb;
    if (me && qs && !qs.wait && now >= G.startAt && G.running && !me.fin) {
      const cx = me.x, cy = me.y - 58;      // no magnet here: it would grab a wrong balloon (the host leaves it out of these modes)
      for (let i = 0; i < qs.o.length; i++) {
        if (qs.pop.has(i)) continue;
        const p = bPos(qs, i, t), dx = p.x - cx, dy = (p.y + 10) - cy;
        if (Math.abs(dx) < 58 && Math.abs(dy) < 62) { qs.wait = performance.now(); o.onBalloon && o.onBalloon(qs, i); break; }
      }
      // ran past every balloon: the set floats ahead again (the host is told, so the projector agrees)
      if (!qs.wait && me.x > G.qMaxX(qs) + 260 && (!qs.moved || now - qs.moved > 1500)) { qs.x = Math.round(me.x + 330); qs.moved = now; o.onMoveQ && o.onMoveQ(qs); }
    }
    if (qs && qs.wait && performance.now() - qs.wait > 4000) qs.wait = 0;   // no reply: allow another try
    for (const R of G.remote.values()) remotePos(R, now, dt);
    // camera
    let fx;
    if (G.projector) { let lead = -1e9; for (const R of G.remote.values()) lead = Math.max(lead, R.dx); fx = lead === -1e9 ? L.start : Math.min(lead, L.finish + 200) - G.vw * 0.62; }
    else fx = me.x - G.vw * (G.W < G.H ? 0.25 : 0.3);
    fx = Math.max(-200, fx);
    G.camX += (fx - G.camX) * Math.min(1, dt * (G.projector ? 3 : 10));
    if (Math.abs(fx - G.camX) > 1200) G.camX = fx;
  }

  /* ---------- draw ---------- */
  function draw(now) {
    const c = ctx, k = G.k, t = now / 1000;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#4dadf5"; c.fillRect(0, 0, G.W, G.H);
    c.setTransform(k, 0, 0, k, -G.camX * k, G.oy - VIEW_TOP * k);
    const skyTop = VIEW_TOP - G.oy / k - 4, below = (G.H - G.oy) / k + VIEW_TOP + 4;
    const bg = (G.low && IMG["level-low"]) || IMG.level;
    const x0 = G.camX, x1 = G.camX + G.vw;
    const ti0 = Math.floor(x0 / TILE) - 1, ti1 = Math.floor(x1 / TILE) + 1;
    for (let i = ti0; i <= ti1; i++) {
      const ox = i * TILE, flip = ((i % 2) + 2) % 2 === 1;
      if (!bg) break;
      const sw = bg.width, sh = bg.height;
      c.save();
      if (flip) { c.translate(ox + TILE, 0); c.scale(-1, 1); } else c.translate(ox, 0);
      c.drawImage(bg, 0, 0, sw, sh, 0, 0, TILE + 0.6, 720);
      c.drawImage(bg, 0, 0, sw, 1, 0, skyTop, TILE + 0.6, -skyTop + 0.5);   // extend the sky upwards
      if (below > 720) {   // portrait: mirror the bottom of the picture downwards, darkened, under the track band
        const mh = Math.min(below - 720, 300), srcH = mh * sh / 720;
        c.save(); c.translate(0, 720 * 2); c.scale(1, -1); c.drawImage(bg, 0, sh - srcH, sw, srcH, 0, 720 - mh, TILE + 0.6, mh + 0.5); c.restore();
        const gr = c.createLinearGradient(0, 720, 0, 720 + mh); gr.addColorStop(0, "rgba(20,30,70,.18)"); gr.addColorStop(1, "rgba(20,30,70,.6)"); c.fillStyle = gr; c.fillRect(0, 720, TILE + 0.6, mh + 0.5);
        if (below - 720 > mh) { c.fillStyle = "#2b3a4f"; c.fillRect(0, 720 + mh, TILE + 0.6, below - 720 - mh); }
      }
      c.restore();
    }
    // ground seams between tiles
    for (let i = ti0; i <= ti1; i++) {
      const sx = i * TILE; if (sx <= 0) continue;
      const odd = ((i % 2) + 2) % 2 === 1, sm = odd ? IMG["seam-r"] : IMG["seam-l"];   // the joins are mirror images, so the gap in the ground is closed with a slice from that edge
      if (sm) c.drawImage(sm, sx - 32, 470, 64, 170);
    }
    // start + finish lines
    drawLine(c, L.start - 40, false, t); drawLine(c, L.finish, true, t);
    // bubbles
    const show = (b) => G.projector || !G.got.has(b.id);
    for (const b of L.bubbles) {
      if (b.x < x0 - 120) continue; if (b.x > x1 + 120) break;
      if (!show(b)) continue;
      const cv = bubbleCanvas(b.w, b.g ? 8 : b.c);
      const fy = G.low ? 0 : Math.sin(t * 2 + b.id) * 5;
      const bx = b.x + (b.mx || 0) - cv._w / 2, by = b.y + (b.my || 0) - cv._h / 2 + fy - 8;
      if (b.g) { c.save(); c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5 + b.id); c.fillStyle = "#ffe066"; c.beginPath(); c.ellipse(bx + cv._w / 2, by + cv._h / 2 - 6, cv._w * 0.62, cv._h * 0.62, 0, 0, 7); c.fill(); c.restore(); }
      c.drawImage(cv, bx, by, cv._w, cv._h);
      if (b.g) for (let q = 0; q < (G.low ? 2 : 4); q++) { const a = t * 2.2 + q * 1.57 + b.id; sparkle(c, bx + cv._w / 2 + Math.cos(a) * (cv._w * 0.55), by + cv._h / 2 - 6 + Math.sin(a) * 34, 7 + 3 * Math.sin(t * 6 + q)); }
    }
    // answer balloons: mine (players) or everybody's (projector, the newest sets in view)
    if (G.qb) drawSet(c, G.qb, t, x0, x1, 1);
    if (G.projector && G.qbs.size) { let n = 0; for (const set of G.qbs.values()) { if (n++ > 12) break; drawSet(c, set, t, x0, x1, 0.92); } }
    // runners
    const list = [];
    for (const [pid, R] of G.remote) { const p = G.players.get(pid); if (p && R.s.length) { R.vy = (R.vy || 0) * 0.7 + ((R.dy - (R.py == null ? R.dy : R.py)) * 60) * 0.3; R.py = R.dy; R.vxe = (R.vxe || 0) * 0.8 + ((R.dx - (R.px == null ? R.dx : R.px)) * 60) * 0.2; R.px = R.dx; list.push([pid, R.dx, R.dy, R.f, p, 0, R.vy, (R.f & F.walk) ? (R.f & F.left ? -1 : 1) * Math.max(60, Math.abs(R.vxe)) : 0]); } }
    if (G.me) { const p = G.players.get(G.myPid) || { name: "", ch: o.myCh || "zik", rank: 0 }; list.push([G.myPid, G.me.x, G.me.y, G.flags(), p, 1, G.me.vy, G.me.vx]); }
    for (const it of list) drawRunner(c, it, t);
    for (const it of list) { if (it[1] < x0 - 100 || it[1] > x1 + 100) continue; const cv = tagCanvas(it[4], !!it[5]); c.drawImage(cv, it[1] - cv._w / 2, it[2] - 150, cv._w, cv._h); }
    // fx
    G.fx = G.fx.filter((e) => t - e.t < 1.25);
    for (const e of G.fx) drawFx(c, e, t);
    if (G.qb && G.me && !G.me.fin) drawArrow(c, G.qb, t);
  }
  function drawLine(c, x, fin, t) {
    if (x < G.camX - 200 || x > G.camX + G.vw + 200) return;
    const sq = 16;
    for (let y = VIEW_TOP; y < 520; y += sq) for (let j = 0; j < 2; j++) { c.fillStyle = ((y / sq + j) | 0) % 2 ? "#1d2350" : "#fff"; c.fillRect(x + j * sq - sq, y, sq, sq); }
    c.globalAlpha = 1;
    if (fin) {
      c.fillStyle = "#ffc83a"; rr(c, x - 110, VIEW_TOP + 16, 220, 46, 18); c.fill(); c.strokeStyle = "#1d2350"; c.lineWidth = 4; c.stroke();
      c.fillStyle = "#1d2350"; c.font = "700 30px Fredoka, Heebo, Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("FINISH", x, VIEW_TOP + 40);
    }
  }
  /* sprite split into body + two legs (cached per character) for the built-in run cycle */
  const PARTS = new Map();
  function parts(im, ch) {
    let P = PARTS.get(ch); if (P) return P;
    const W0 = im.naturalWidth || im.width, H0 = im.naturalHeight || im.height, hipY = Math.round(H0 * 0.715), midX = Math.round(W0 * 0.5);
    const cut = (x0, y0, w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, x0, y0, w, h, 0, 0, w, h); return cv; };
    P = { W0, H0, hipY, midX, body: cut(0, 0, W0, hipY + 6), back: cut(0, hipY, midX, H0 - hipY), front: cut(midX, hipY, W0 - midX, H0 - hipY) };
    PARTS.set(ch, P); return P;
  }
  function drawRunner(c, [pid, x, y, f, p, me, vy, vx], t) {
    if (x < G.camX - 100 || x > G.camX + G.vw + 100) return;
    const fin = (f & F.fin) && (!me || (G.me && G.me.x >= L.finish + 300));
    const cheer = fin || (f & F.cheer);
    const im = IMG[(cheer ? "cheer-" : "run-") + p.ch] || IMG["run-zik"];
    const h = 112, w = h * 0.8, air = f & F.air, stun = f & (F.stun | F.frozen), rising = air && ((f & F.rise) || (vy || 0) < -80);
    c.save();
    c.translate(x, y + 5);
    if (!G.low && !air) { c.fillStyle = "rgba(20,30,70,.22)"; c.beginPath(); c.ellipse(0, -2, 30, 7, 0, 0, 7); c.fill(); }
    if (f & F.speed && !G.low) { c.strokeStyle = "rgba(255,190,60,.85)"; c.lineWidth = 4; for (let i = 0; i < 3; i++) { const yy = -30 - i * 18, len = 40 + ((t * 9 + i) % 1) * 30; c.beginPath(); c.moveTo(-34, yy); c.lineTo(-34 - len, yy); c.stroke(); } }
    // phase from the distance run, so every device animates the same runner the same way
    const ph = ((f & F.left) ? -x : x) / 26 + pid * 1.7;
    let rot = 0, bob = 0, sx = 1, sy = 1, legF = 0, legB = 0;
    if (cheer) { bob = Math.abs(Math.sin(t * 9)) * 7; sy = 1 + Math.sin(t * 18) * 0.03; }
    else if (stun) { if (f & F.stun) rot = 0.35 * Math.sin(t * 20) * 0.5 + 0.25; }
    else if (air) {
      if (rising) { rot = -0.16; sy = 1.07; sx = 0.95; legF = -0.55; legB = 0.35; }       // jump: stretched, knees up
      else { rot = 0.07; sy = 0.98; sx = 1.02; legF = 0.25; legB = -0.3; }               // fall: legs apart, ready to land
      if (f & F.drop) { rot = 0.12; legF = 0.1; legB = -0.1; }
    } else if (!(f & F.walk) && !fin) {
      bob = Math.abs(Math.sin(t * 2.2 + pid)) * 1.5; sy = 1 + Math.sin(t * 2.2 + pid) * 0.012;       // standing still: gentle breathing
    } else {
      const sn = Math.sin(ph);
      bob = Math.abs(Math.cos(ph)) * 6; rot = 0.04 + Math.sin(ph * 2) * 0.035;
      sy = 1 - Math.abs(Math.sin(ph)) * 0.045; sx = 1 + Math.abs(Math.sin(ph)) * 0.03;          // squash on each step
      legF = 0.36 + 0.42 * sn; legB = -0.36 - 0.42 * sn;                                           // scissor the legs
    }
    if (f & F.left && !cheer) { c.scale(-1, 1); }
    c.rotate(rot); c.scale(sx, sy);
    // Imagina's sprite atlas: run 1-8 (by distance, so speed and frames match), jump / land, idle 1-2-3-2 when standing
    const atlas = !cheer && IMG["run-cycle/" + p.ch];
    let cell = -1;
    if (atlas) {
      const RF = RUN_FRAMES, walking = (f & F.walk) || fin;
      if (air) cell = rising ? RF.jump : RF.land;
      else if (stun) cell = RF.land;
      else if (walking) { const n = G.low ? 4 : RF.run.length, i = Math.floor(((ph / (Math.PI * 2)) * 8) % 8 + 8) % 8; cell = RF.run[G.low ? (i >> 1) * 2 : i]; }
      else cell = G.low ? RF.idle[0] : RF.idle[Math.floor(t * RF.idleFps + pid) % RF.idle.length];
      if (!air && !stun) { rot = walking ? 0.02 : 0; sx = 1; sy = 1; bob = 0; }      // the frames already contain the motion
      else if (air) { rot *= 0.4; sx = 1; sy = 1; }
    }
    if (atlas) { c.restore(); c.save(); c.translate(x, y + 5); if (f & F.left) c.scale(-1, 1); c.rotate(rot); c.drawImage(atlas, cell * 320, 0, 320, 400, -w / 2, -h * 0.9625, w, h);
    } else if (im && !cheer && im.complete) {
      const P = parts(im, p.ch), k = w / P.W0, top = -h * 0.9625 - bob, hy = top + P.hipY * k;
      const leg = (cv, x0, hipXs, ang) => { c.save(); c.translate(-w / 2 + hipXs * k, hy); c.rotate(ang); c.drawImage(cv, (x0 - hipXs) * k, -2, cv.width * k, cv.height * k); c.restore(); };
      leg(P.back, 0, P.W0 * 0.4, legB); leg(P.front, P.midX, P.W0 * 0.56, legF);
      c.drawImage(P.body, -w / 2, top, w, P.body.height * k);
    } else if (im) c.drawImage(im, -w / 2, -h * 0.9625 - bob, w, h);
    c.restore();
    c.save(); c.translate(x, y);
    if (f & F.frozen) { c.fillStyle = "rgba(150,220,255,.55)"; rr(c, -36, -112, 72, 112, 12); c.fill(); c.strokeStyle = "rgba(255,255,255,.9)"; c.lineWidth = 3; c.stroke(); }
    if (f & F.shield) { c.strokeStyle = "rgba(95,227,224,.95)"; c.fillStyle = "rgba(95,227,224,.18)"; c.lineWidth = 4; c.beginPath(); c.ellipse(0, -56, 50, 66, 0, 0, 7); c.fill(); c.stroke(); }
    const icon = (n, dx, dy, s) => { const im2 = IMG[n]; if (im2) c.drawImage(im2, dx - s / 2, dy - s / 2, s, s); };
    if (f & F.slow) icon("pu-attack-lightning", 30, -110, 30);
    if (f & F.magnet) icon("pu-boost-magnet", -34, -110, 28);
    if (f & F.dj) icon("pu-boost-double-jump", -30, -14, 26);
    if (f & F.stun) icon("pu-attack-trap", 22, -12, 30);
    c.restore();
  }
  function sparkle(c, x, y, r) {
    c.fillStyle = "#fffbe0"; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr2 = i % 2 ? r * 0.32 : r; c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    c.closePath(); c.fill();
  }
  const CONF = ["#ff3d8a", "#1f6fff", "#ffb800", "#14b05a", "#7c4dff", "#13b3c2", "#ff7a00"];
  function drawFx(c, e, t) {
    const u = (t - e.t);
    if (e.kind === "yay" || e.kind === "gold") {
      const P = posOf(e.a); if (!P || u > 1.15) return;
      const n = G.low ? 10 : e.kind === "gold" ? 30 : 20;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (e.a || 0), sp = 170 + ((i * 37) % 90), px = P.x + Math.cos(a) * sp * u, py = P.y - 80 + Math.sin(a) * sp * u * 0.8 + 260 * u * u;
        c.globalAlpha = Math.max(0, 1 - u / 1.15);
        if (e.kind === "gold" && i % 3 === 0) sparkle(c, px, py, 10);
        else { c.fillStyle = CONF[i % CONF.length]; c.save(); c.translate(px, py); c.rotate(u * 9 + i); c.fillRect(-5, -3, 10, 6); c.restore(); }
      }
      c.globalAlpha = 1; return;
    }
    if (e.kind === "bpop") {
      if (u > 0.7) return; const [c1, c2] = e.c === 8 ? BUBBLE_GOLD : BUBBLE[e.c % BUBBLE.length];
      c.globalAlpha = Math.max(0, 1 - u / 0.7);
      for (let i = 0; i < (G.low ? 6 : 12); i++) { const a = (i / (G.low ? 6 : 12)) * 6.283 + e.c, r = 30 + u * 170; c.fillStyle = i % 2 ? c1 : c2; c.save(); c.translate(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8 + 90 * u * u); c.rotate(a + u * 6); c.fillRect(-9, -4, 18, 8); c.restore(); }
      if (e.good) { c.strokeStyle = "#14b05a"; c.lineWidth = 6; c.beginPath(); c.arc(e.x, e.y, 26 + u * 90, 0, 7); c.stroke(); }
      c.globalAlpha = 1; return;
    }
    if (e.kind === "pop") {
      const [c1] = e.c === 8 ? BUBBLE_GOLD : BUBBLE[e.c % BUBBLE.length]; c.strokeStyle = c1; c.lineWidth = 4; c.globalAlpha = Math.max(0, 1 - u * 3);
      c.beginPath(); c.arc(e.x, e.y, 20 + u * 120, 0, 7); c.stroke(); c.globalAlpha = 1; return;
    }
    const A = posOf(e.a), B = posOf(e.b); if (!B) return;
    if (e.kind === "rocket" && A) {
      const v = Math.min(1, u / 0.6); const x = A.x + (B.x - A.x) * v, y = (A.y - 60) + (B.y - 60 - (A.y - 60)) * v - Math.sin(v * Math.PI) * 80;
      if (v < 1) { const im = IMG["pu-attack-rocket"]; if (im) c.drawImage(im, x - 24, y - 24, 48, 48); }
      else boom(c, B, u - 0.6, "#ff7a00");
    } else if (e.kind === "lightning") {
      if (u < 0.5) { c.strokeStyle = "#ffe066"; c.lineWidth = 7; c.beginPath(); let x = B.x, y = VIEW_TOP; c.moveTo(x, y); while (y < B.y - 70) { y += 40; x += (Math.random() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    } else if (e.kind === "freeze") boom(c, B, u, "#bfeaff");
    else if (e.kind === "trap") { const im = IMG["pu-attack-trap"]; if (im && u < 1) c.drawImage(im, B.x - 20, B.y - 34, 40, 40); }
    else if (e.kind === "blocked") { c.strokeStyle = "#5fe3e0"; c.lineWidth = 6; c.globalAlpha = Math.max(0, 1 - u * 2); c.beginPath(); c.arc(B.x, B.y - 56, 60 + u * 60, 0, 7); c.stroke(); c.globalAlpha = 1; }
  }
  function boom(c, B, u, col) { if (u > 0.6) return; c.fillStyle = col; c.globalAlpha = Math.max(0, 0.8 - u); c.beginPath(); c.arc(B.x, B.y - 50, 20 + u * 140, 0, 7); c.fill(); c.globalAlpha = 1; }

  /* ---------- loop ---------- */
  let last = 0, raf = 0, acc = 0;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    if (G.low) { acc += dt; if (acc < 1 / 31) return; dt = acc; acc = 0; }
    last = ts; dt = Math.min(0.05, dt);
    const now = performance.now();
    update(dt, now); draw(now);
    G.tick++;
  }
  G.start = function (startAt) { G.startAt = startAt; G.running = true; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  G.stop = function () { G.running = false; cancelAnimationFrame(raf); raf = 0; };
  G.progress = function (x) { return Math.max(0, Math.min(1, (x - L.start) / (L.finish - L.start))); };
  G.posOf = posOf;
  G.resize();
  return G;
}
