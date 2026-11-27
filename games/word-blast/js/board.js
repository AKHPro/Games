/* Word Blast 1.0 - the bubble board (canvas). Hex grid, aiming, shots, popping, falling, baskets.
   All sizes come from the layout object passed in, so bubble and cannon size are one constant each (see LAYOUT in app.js).
   (c) 2026 Amir - Englishia */
import { sameWord } from "./content.js?v=1.0.1";

export const COLORS = ["red", "orange", "green", "teal", "blue", "violet"];
const RING = { ok: "#3dffa0", bad: "#ff4d6d", hint: "#ffe680" };

export function createBoard(canvas, IMG, hooks) {
  const ctx = canvas.getContext("2d");
  canvas.setAttribute("dir", "ltr");
  const B = {
    L: null, grid: [], shift: 0, cols: 9, maxR: 6, shot: null, loaded: null, next: null, aim: -0.0001, aiming: false,
    fx: [], falls: [], texts: [], basket: [0, 0], busy: false, answer: "", choices: [], shots: 0, shotsMax: 1,
    aimHelp: true, palette: COLORS.slice(0, 5), t: 0, frozen: false, hintUntil: 0
  };
  /* ---------- geometry ---------- */
  const D = () => B.L.D, RH = () => B.L.D * 0.866;
  const odd = (r) => ((r + B.shift) & 1) === 1;
  const width = (r) => (odd(r) ? B.cols - 1 : B.cols);
  const pos = (r, c) => ({ x: B.L.mx + D() / 2 + c * D() + (odd(r) ? D() / 2 : 0), y: B.L.top + D() / 2 + r * RH() });
  const cell = (r, c) => (B.grid[r] && c >= 0 && c < width(r) ? B.grid[r][c] : undefined);
  function nbrs(r, c) {
    const o = odd(r), out = [[r, c - 1], [r, c + 1]];
    for (const dr of [-1, 1]) { const rr = r + dr; if (rr < 0) continue; if (o) out.push([rr, c], [rr, c + 1]); else out.push([rr, c - 1], [rr, c]); }
    return out.filter(([rr, cc]) => rr >= 0 && rr < B.grid.length && cc >= 0 && cc < width(rr));
  }
  const ROWS = () => B.maxR + 3;
  function ensureRows() { while (B.grid.length < ROWS()) B.grid.push(new Array(B.cols).fill(null)); }
  function each(fn) { for (let r = 0; r < B.grid.length; r++) for (let c = 0; c < width(r); c++) if (B.grid[r][c]) fn(B.grid[r][c], r, c); }
  const count = () => { let n = 0; each(() => n++); return n; };
  const lowestRow = () => { let m = -1; each((b, r) => { if (r > m) m = r; }); return m; };
  const randColor = (rnd = Math.random) => B.palette[Math.floor(rnd() * B.palette.length)];
  const mk = (color, word) => ({ color, word: word === undefined ? (B.filler ? B.filler() : null) : word, st: "", stT: 0, born: B.t });

  /* ---------- setup ---------- */
  function layout(L) {
    B.L = L; B.cols = L.cols;
    B.maxR = Math.max(4, Math.floor((L.pivotY - L.D * L.dangerGap - L.top) / (L.D * 0.866)));
    const dpr = Math.min(2, window.devicePixelRatio || 1) * (L.scale || 1);
    canvas.width = Math.round(L.W * dpr); canvas.height = Math.round(L.H * dpr);
    canvas.style.width = L.W + "px"; canvas.style.height = L.H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ensureRows();
  }
  function reset(o) {
    B.grid = []; B.shift = 0; B.fx = []; B.falls = []; B.texts = []; B.basket = [0, 0]; B.shot = null; B.busy = false; B.frozen = false;
    B.palette = COLORS.slice(0, o.colors); B.aimHelp = o.aimHelp; B.shots = B.shotsMax = o.shots; B.filler = o.filler || null;
    ensureRows();
    const rows = Math.min(o.rows, B.maxR - 2);
    for (let r = 0; r < rows; r++) for (let c = 0; c < width(r); c++) {
      // a few gaps in the lowest row so the words have open lanes
      if (r === rows - 1 && r >= 1 && Math.random() < 0.3) continue;   // 1.0.1: gaps from the second row on
      B.grid[r][c] = mk(randColor());
    }
    B.loaded = randColor(); B.next = randColor();
  }
  function insertRow() {
    B.shift ^= 1; const row = new Array(B.cols).fill(null);
    B.grid.unshift(row); for (let c = 0; c < width(0); c++) row[c] = mk(randColor());
    ensureRows();
  }
  const danger = () => lowestRow() >= B.maxR;

  /* exposed = touches an empty cell that is connected to the open space under the grid */
  function exposed() {
    const open = new Set(), key = (r, c) => r * 64 + c, q = [];
    const last = B.grid.length - 1;
    for (let c = 0; c < width(last); c++) if (!B.grid[last][c]) { open.add(key(last, c)); q.push([last, c]); }
    while (q.length) { const [r, c] = q.pop(); for (const [rr, cc] of nbrs(r, c)) { if (B.grid[rr][cc] || open.has(key(rr, cc))) continue; open.add(key(rr, cc)); q.push([rr, cc]); } }
    const out = [];
    each((b, r, c) => { if (nbrs(r, c).some(([rr, cc]) => open.has(key(rr, cc)))) out.push({ r, c, b }); });
    return out;
  }
  /* bubbles a shot can really reach (straight or off a wall), with how many aim angles hit each one */
  function reach() {
    const m = new Map();
    for (let a = -1.34; a <= 1.34; a += 0.004) { const r = trace(a); if (r.hit) { const k = r.hit.r * 64 + r.hit.c; m.set(k, (m.get(k) || 0) + 1); } }
    return m;
  }
  function targets(minAngles) {
    const m = reach(), out = [];
    each((b, r, c) => { const n = m.get(r * 64 + c) || 0; if (n >= minAngles) out.push({ r, c, b, n }); });
    return out;
  }
  /* put the answer and the wrong answers on reachable bubbles, never two labels side by side */
  function setChoices(answer, wrong, copies = 1) {
    // keep enough bubbles to choose from
    let guard = 0;
    while ((count() < B.cols + 2 || targets(1).length < wrong.length + copies + 1) && lowestRow() + 2 < B.maxR && guard++ < 3) insertRow();
    B.answer = answer;
    // 1.0.1: only the chosen bubbles carry words (filler is off); the answer may appear only where we put it
    each((b) => { if (b.st !== "wrong") b.st = ""; if (b.shot) return; if (!b.word || sameWord(b.word, answer) || wrong.some((w) => sameWord(w, b.word))) b.word = B.filler ? B.filler(answer) : null; });
    const words = []; for (let i = 0; i < copies; i++) words.push(answer); words.push(...wrong);
    let ex = targets(4).filter((e) => !e.b.shot); if (ex.length < words.length) ex = targets(1).filter((e) => !e.b.shot); if (ex.length < words.length) ex = exposed().filter((e) => !e.b.shot);
    ex = ex.map((e) => Object.assign(e, { k: e.r * 10 + Math.min(e.n || 0, 12) + Math.random() * 25 })).sort((a, b) => b.k - a.k);
    const picked = [];
    const adj = (e) => picked.some((p) => nbrs(p.r, p.c).some(([r, c]) => r === e.r && c === e.c));
    for (const strict of [true, false]) for (const e of ex) { if (picked.length >= words.length) break; if (picked.includes(e) || (strict && adj(e))) continue; picked.push(e); }
    const order = picked.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((pi, wi) => { if (words[wi] != null) { picked[pi].b.word = words[wi]; picked[pi].b.flip = B.t; } });
    B.choices = words;
    if (Math.random() < 0.5) { const a = answerCells()[0]; if (a) { const nc = nbrs(a.r, a.c).map(([r, c]) => B.grid[r][c]).filter(Boolean).map((b) => b.color); if (nc.length) B.loaded = nc[Math.floor(Math.random() * nc.length)]; } }
    return picked.length >= Math.min(words.length, 2);
  }
  function estW(word) {
    const d = D(); ctx.font = `600 ${d * B.L.wordFs}px Fredoka, Heebo, sans-serif`;
    return Math.min(d * B.L.labelMax, Math.max(d * 0.86, ctx.measureText(String(word)).width + d * 0.2));
  }
  function answerCells() { const o = []; each((b, r, c) => { if (b.word && sameWord(b.word, B.answer)) o.push({ r, c, b }); }); return o; }
  function ensureAnswerVisible() {
    let ex = targets(3); if (!ex.length) ex = targets(1);
    ex = ex.filter((e) => !e.b.shot);
    if (ex.some((e) => e.b.word && sameWord(e.b.word, B.answer))) return;
    if (!ex.length) return;
    const e = ex[Math.floor(Math.random() * ex.length)]; e.b.word = B.answer; e.b.flip = B.t;
  }

  /* ---------- flight ---------- */
  const pivot = () => ({ x: B.L.W / 2, y: B.L.pivotY });
  const clampAim = (a) => Math.max(-1.36, Math.min(1.36, a));
  function aimAt(x, y) { const p = pivot(); if (y > p.y - 4) y = p.y - 4; B.aim = clampAim(Math.atan2(x - p.x, p.y - y)); }
  // walks a ball along the aim; returns path points, the bubble it hits and the cell it would stop in
  function trace(angle, stepFn) {
    const d = D(), p = pivot(), sp = d * 0.2;
    let x = p.x, y = p.y, vx = Math.sin(angle) * sp, vy = -Math.cos(angle) * sp;
    const minX = B.L.mx + d / 2, maxX = B.L.mx + B.cols * d - d / 2, pts = [];
    for (let i = 0; i < 4000; i++) {
      x += vx; y += vy;
      if (x < minX) { x = 2 * minX - x; vx = -vx; } else if (x > maxX) { x = 2 * maxX - x; vx = -vx; }
      if (stepFn) stepFn(x, y, i);
      pts.push([x, y]);
      if (y <= B.L.top + d / 2) return { pts, hit: null, x, y };
      let best = null, bd = 1e9;
      const rr = Math.round((y - B.L.top - d / 2) / RH());
      for (let r = Math.max(0, rr - 2); r <= Math.min(B.grid.length - 1, rr + 2); r++) for (let c = 0; c < width(r); c++) {
        if (!B.grid[r][c]) continue; const q = pos(r, c), dd = Math.hypot(q.x - x, q.y - y);
        if (dd < d * 0.84 && dd < bd) { bd = dd; best = { r, c }; }
      }
      if (best) return { pts, hit: best, x, y };
    }
    return { pts, hit: null, x, y };
  }
  function snapCell(res) {
    const cand = [];
    if (res.hit) nbrs(res.hit.r, res.hit.c).forEach(([r, c]) => { if (!B.grid[r][c]) cand.push([r, c]); });
    else for (let c = 0; c < width(0); c++) if (!B.grid[0][c]) cand.push([0, c]);
    // also any empty cell close by (corners)
    const rr = Math.round((res.y - B.L.top - D() / 2) / RH());
    for (let r = Math.max(0, rr - 1); r <= Math.min(B.grid.length - 1, rr + 1); r++) for (let c = 0; c < width(r); c++) if (!B.grid[r][c]) cand.push([r, c]);
    let best = null, bd = 1e9;
    for (const [r, c] of cand) { const q = pos(r, c), dd = Math.hypot(q.x - res.x, q.y - res.y); if (dd < bd) { bd = dd; best = { r, c }; } }
    return best;
  }
  function fire() {
    if (B.busy || B.frozen || B.shots <= 0) return false;
    B.busy = true; B.shots--;
    const res = trace(B.aim);
    B.shot = { color: B.loaded, res, i: 0 };
    B.loaded = B.next; B.next = randColor();
    hooks.sound && hooks.sound("shoot");
    return true;
  }
  function swap() { if (B.busy) return; const t = B.loaded; B.loaded = B.next; B.next = t; }
  function land(shot) {
    const res = shot.res, hit = res.hit ? B.grid[res.hit.r][res.hit.c] : null;
    const hp = res.hit ? pos(res.hit.r, res.hit.c) : { x: res.x, y: res.y };
    if (hit && hit.word && sameWord(hit.word, B.answer)) {
      // correct: the word and every touching bubble of the shot's colour pop, then loose bubbles fall
      const seen = new Set([res.hit.r * 64 + res.hit.c]), list = [res.hit], q = [res.hit];
      while (q.length) { const { r, c } = q.pop(); for (const [rr, cc] of nbrs(r, c)) { const b = B.grid[rr][cc]; const k = rr * 64 + cc; if (!b || seen.has(k) || b.color !== shot.color) continue; seen.add(k); list.push({ r: rr, c: cc }); q.push({ r: rr, c: cc }); } }
      const word = hit.word; hit.st = "ok"; hit.stT = B.t;
      B.fx.push({ k: "burst", x: res.x, y: res.y, color: shot.color, t: B.t });
      list.forEach((p, i) => { const b = B.grid[p.r][p.c], q2 = pos(p.r, p.c); B.fx.push({ k: "burst", x: q2.x, y: q2.y, color: b.color, t: B.t + 0.06 + i * 0.05, word: i === 0 ? b.word : null, ok: i === 0 }); B.grid[p.r][p.c] = null; });
      const fell = dropFloating();
      B.busy = false;
      hooks.result({ kind: "correct", word, popped: list.length - 1, fell, x: hp.x, y: hp.y });
      return;
    }
    if (!(hit && hit.word)) {
      // a miss (the ceiling or a word-less ball) fizzles out instead of sticking, so misses never push the grid down
      B.fx.push({ k: "burst", x: res.x, y: res.y, color: shot.color, t: B.t });
      hooks.sound && hooks.sound("stick");
      B.busy = false;
      hooks.result({ kind: "miss", word: null, x: hp.x, y: hp.y, danger: danger() });
      return;
    }
    const sc = snapCell(res);
    if (sc) { B.grid[sc.r][sc.c] = mk(shot.color, null); B.grid[sc.r][sc.c].shot = true; B.grid[sc.r][sc.c].st = "new"; B.grid[sc.r][sc.c].stT = B.t; }
    hooks.sound && hooks.sound("stick");
    if (hit && hit.word) { hit.st = "wrong"; hit.stT = B.t; answerCells().forEach((a) => { a.b.st = "teach"; a.b.stT = B.t; }); }
    ensureAnswerVisible();
    B.busy = false;
    hooks.result({ kind: hit && hit.word ? "wrong" : "miss", word: hit && hit.word, x: hp.x, y: hp.y, danger: danger() });
  }
  function dropFloating() {
    const keep = new Set(), q = [];
    for (let c = 0; c < width(0); c++) if (B.grid[0][c]) { keep.add(c); q.push([0, c]); }
    while (q.length) { const [r, c] = q.pop(); for (const [rr, cc] of nbrs(r, c)) { const k = rr * 64 + cc; if (!B.grid[rr][cc] || keep.has(k)) continue; keep.add(k); q.push([rr, cc]); } }
    let n = 0;
    each((b, r, c) => {
      if (keep.has(r * 64 + c)) return;
      const p = pos(r, c), side = p.x < B.L.W / 2 ? 0 : 1, bx = B.L.baskets[side];
      B.falls.push({ x: p.x, y: p.y, vx: (bx.x - p.x) * 0.9 + (Math.random() - 0.5) * 40, vy: -D() * 2 - Math.random() * D(), color: b.color, word: b.word, side, t: B.t + n * 0.04 });
      B.grid[r][c] = null; n++;
    });
    return n;
  }
  function addDropRow() { insertRow(); if (B.answer) ensureAnswerVisible(); return danger(); }
  function flashHint() { B.hintUntil = B.t + 2.2; answerCells().forEach((a) => { a.b.st = "hint"; a.b.stT = B.t; }); }

  /* ---------- drawing ---------- */
  const im = (k) => IMG[k];
  function ball(x, y, d, color, alpha) {
    const i = im(`ball-${color}-plain`); if (!i) return;
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(i, x - d / 2, y - d / 2, d, d);
    ctx.globalAlpha = 1;
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function label(x, y, d, word, st) {
    const L = B.L, inner = d * 0.8;
    let fs = d * L.wordFs;
    ctx.font = `600 ${fs}px Fredoka, Heebo, sans-serif`;
    let tw = ctx.measureText(word).width;
    if (tw > inner) { fs = Math.max(L.wordMin, fs * inner / tw); ctx.font = `600 ${fs}px Fredoka, Heebo, sans-serif`; tw = ctx.measureText(word).width; }
    const w = Math.min(d * L.labelMax, Math.max(d * 0.86, tw + d * 0.12)), h = Math.max(d * 0.36, fs * 1.28);
    if (tw > w - d * 0.06) { fs *= (w - d * 0.06) / tw; ctx.font = `600 ${fs}px Fredoka, Heebo, sans-serif`; tw = ctx.measureText(word).width; }
    const lo = L.mx + w / 2 - d * 0.04, hi = L.mx + B.cols * d - w / 2 + d * 0.04;
    if (w > d && lo < hi) x = Math.max(lo, Math.min(hi, x));
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    const good = st === "ok" || st === "teach" || st === "hint";
    g.addColorStop(0, good ? "#e2ffec" : st === "wrong" ? "#ffe6eb" : "#ffffff"); g.addColorStop(1, good ? "#c9f7da" : st === "wrong" ? "#ffd3db" : "#e9ebfb");
    ctx.save(); ctx.shadowColor = "rgba(20,10,60,.3)"; ctx.shadowBlur = d * 0.05; ctx.shadowOffsetY = d * 0.025;
    rr(x - w / 2, y - h / 2, w, h, h * 0.45); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.fillStyle = st === "wrong" ? "#a3162a" : good ? "#0b6a33" : "#1b1446";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(word, x, y + fs * 0.04);
    return { fs, x: x - w / 2, y: y - h / 2, w, h, tw };
  }
  function ring(x, y, d, color, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = d * 0.07; ctx.shadowColor = color; ctx.shadowBlur = d * 0.25;
    ctx.beginPath(); ctx.arc(x, y, d * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function badge(x, y, d, ok) {
    const r = d * 0.15, bx = x + d * 0.34, by = y - d * 0.34;
    ctx.fillStyle = ok ? "#16c060" : "#ff2d55"; ctx.strokeStyle = "#fff"; ctx.lineWidth = d * 0.035;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = d * 0.04; ctx.lineCap = "round"; ctx.beginPath();
    if (ok) { ctx.moveTo(bx - r * 0.45, by); ctx.lineTo(bx - r * 0.1, by + r * 0.38); ctx.lineTo(bx + r * 0.5, by - r * 0.35); }
    else { ctx.moveTo(bx - r * 0.4, by - r * 0.4); ctx.lineTo(bx + r * 0.4, by + r * 0.4); ctx.moveTo(bx + r * 0.4, by - r * 0.4); ctx.lineTo(bx - r * 0.4, by + r * 0.4); }
    ctx.stroke();
  }
  B.labelSizes = [];
  function drawGrid() {
    const d = D(); B.labelSizes = [];
    const labels = [];
    each((b, r, c) => {
      const p = pos(r, c); let s = 1;
      if (b.st === "new") { const k = Math.min(1, (B.t - b.stT) / 0.18); s = 0.85 + 0.15 * k; if (k >= 1) b.st = ""; }
      if (b.word && b.flip != null && B.t - b.flip < 0.25) s *= 0.8 + 0.2 * ((B.t - b.flip) / 0.25);
      ball(p.x, p.y, d * s, b.color);
      if (b.word) labels.push([p, b, s]);
    });
    for (const [p, b, s] of labels) {
      let st = b.st, age = B.t - b.stT;
      if (st === "wrong" && age > 1.0) { b.st = st = ""; }
      if ((st === "teach" && age > 2.0) || (st === "hint" && age > 2.4)) { b.st = st = ""; }
      if (st === "wrong") { ring(p.x, p.y, d, RING.bad, 1 - age); }
      if (st === "teach" || st === "hint") { ring(p.x, p.y, d, st === "hint" ? RING.hint : RING.ok, 0.45 + 0.55 * Math.abs(Math.sin(age * 6))); }
      const lr = label(p.x, p.y + d * 0.02, d * s, b.word, st);
      B.labelSizes.push(Object.assign({ word: b.word }, lr));
      if (st === "wrong") badge(p.x, p.y, d, false);
      if (st === "teach" || st === "hint") badge(p.x, p.y, d, true);
    }
  }
  function drawAim() {
    if (B.busy || B.frozen || !B.L.showAim) return;
    const d = D(), res = trace(B.aim), gap = d * B.L.dotGap;
    let acc = 0, last = [pivot().x, pivot().y], n = 0;
    ctx.fillStyle = "#bfefff";
    const total = res.pts.length;
    for (let i = 0; i < total; i++) {
      const [x, y] = res.pts[i]; acc += Math.hypot(x - last[0], y - last[1]); last = [x, y];
      if (acc >= gap) { acc = 0; n++; if (n < 2) continue; const k = 1 - Math.min(0.6, i / total * 0.6); ctx.globalAlpha = 0.9 * k; ctx.beginPath(); ctx.arc(x, y, d * 0.065 * k, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    const sc = snapCell(res);
    if (sc) { const p = pos(sc.r, sc.c); ctx.save(); ctx.setLineDash([d * 0.08, d * 0.07]); ctx.strokeStyle = "rgba(190,240,255,.85)"; ctx.lineWidth = d * 0.03; ctx.beginPath(); ctx.arc(p.x, p.y, d * 0.48, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (B.aimHelp && res.hit) { const b = B.grid[res.hit.r][res.hit.c]; if (b) { const p = pos(res.hit.r, res.hit.c); ring(p.x, p.y, d, "#bfefff", 0.8); } }
    B.lastTrace = res;
  }
  function drawShooter() {
    const L = B.L, p = pivot(), s = (L.D * L.cannon) / 168, kc = L.cannon / 0.8; // 168 = loaded ball diameter in the 600x450 base sprite
    const base = im("shooter-base"), barrel = im("shooter-barrel"), ctr = im("shot-counter");
    if (barrel) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(B.aim); ctx.drawImage(barrel, -120 * s, -375 * s, 240 * s, 480 * s); ctx.restore(); }
    if (base) ctx.drawImage(base, p.x - 300 * s, p.y - 195 * s, 600 * s, 450 * s);
    if (!B.shot || B.shot.i < 2) ball(p.x, p.y, L.D * L.loaded, B.loaded);
    const cx = p.x, cy = p.y + L.D * 0.92 * kc, cr = L.D * 0.42 * kc;
    if (ctr) ctx.drawImage(ctr, cx - cr, cy - cr, cr * 2, cr * 2);
    const k = B.shotsMax ? B.shots / B.shotsMax : 0;
    ctx.save(); ctx.strokeStyle = B.shots <= 5 ? "#ff5a78" : "#39e1ff"; ctx.lineWidth = cr * 0.12; ctx.lineCap = "round"; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = cr * 0.2;
    ctx.beginPath(); ctx.arc(cx, cy, cr * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); if (k > 0) ctx.stroke(); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = `700 ${cr * 0.72}px Fredoka, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(B.shots), cx, cy + cr * 0.04);
  }
  function drawBaskets(layer) {
    const L = B.L, colors = ["cyan", "pink"];
    L.baskets.forEach((bk, i) => {
      const w = bk.w, h = w * 300 / 390, x = bk.x - w / 2, y = bk.y - h * 0.4;
      if (layer === "back") { const b = im(`basket-${colors[i]}-back`); if (b) ctx.drawImage(b, x, y, w, h); const n = Math.min(B.basket[i], 6); for (let j = 0; j < n; j++) ball(bk.x - w * 0.22 + (j % 3) * w * 0.22, y + h * 0.3 - Math.floor(j / 3) * w * 0.08, w * 0.2, COLORS[(j * 2 + i) % 6]); }
      else { const f = im(`basket-${colors[i]}-front`); if (f) ctx.drawImage(f, x, y, w, h);
        const tw = w * 0.34, th = w * 0.13, ty = y + h * 0.58; ctx.fillStyle = "rgba(10,8,40,.75)"; rr(bk.x - tw / 2, ty - th / 2, tw, th, th / 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `700 ${th * 0.7}px Fredoka, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("+" + L.basketPts, bk.x, ty + 1); }
    });
  }
  function drawDanger() {
    const L = B.L, y = pos(B.maxR, 0).y - D() * 0.5;
    ctx.save(); ctx.setLineDash([D() * 0.14, D() * 0.1]); ctx.strokeStyle = "rgba(255,95,150,.55)"; ctx.lineWidth = Math.max(2, D() * 0.025);
    ctx.beginPath(); ctx.moveTo(L.mx, y); ctx.lineTo(L.mx + B.cols * D(), y); ctx.stroke(); ctx.restore();
    B.dangerY = y;
  }
  function step(dt) {
    B.t += dt;
    if (B.shot) {
      const s = B.shot, n = s.res.pts.length;
      s.i = Math.min(n - 1, s.i + Math.max(1, Math.round(dt * B.L.speed)));
      if (s.i >= n - 1) { B.shot = null; land(s); }
    }
    for (const f of B.falls) { if (B.t < f.t) continue; f.vy += D() * 14 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const bk = B.L.baskets[f.side]; if (!f.done && f.vy > 0 && f.y > bk.y - bk.w * 0.1) { f.done = true; B.basket[f.side]++; hooks.sound && hooks.sound("basket"); B.texts.push({ x: bk.x, y: bk.y - bk.w * 0.35, txt: "+" + B.L.basketPts, t: B.t, c: "#ffe680" }); } }
    B.falls = B.falls.filter((f) => !f.done && f.y < B.L.H + 100);
    B.fx = B.fx.filter((f) => B.t - f.t < 0.5);
    B.texts = B.texts.filter((f) => B.t - f.t < 1.2);
  }
  function draw() {
    const L = B.L; ctx.clearRect(0, 0, L.W, L.H);
    drawDanger();
    drawBaskets("back");
    drawGrid();
    drawAim();
    drawShooter();
    if (B.shot) { const [x, y] = B.shot.res.pts[B.shot.i]; ball(x, y, D(), B.shot.color); }
    for (const f of B.falls) { if (B.t < f.t) continue; ball(f.x, f.y, D() * 0.92, f.color); }
    drawBaskets("front");
    for (const f of B.fx) {
      const a = B.t - f.t; if (a < 0) continue;
      const fr = Math.min(3, 1 + Math.floor(a / 0.09)), img = im(`burst-${f.color}-${fr}`), s = D() * 2;
      ctx.globalAlpha = Math.max(0, 1 - a / 0.5); if (img) ctx.drawImage(img, f.x - s / 2, f.y - s / 2, s, s); ctx.globalAlpha = 1;
    }
    for (const t of B.texts) {
      const a = B.t - t.t, fs = t.fs || D() * 0.42; ctx.globalAlpha = Math.max(0, 1 - a / 1.2);
      ctx.font = `700 ${fs}px Fredoka, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = "rgba(20,10,60,.8)"; ctx.strokeText(t.txt, t.x, t.y - a * D() * 0.6);
      ctx.fillStyle = t.c || "#ffe680"; ctx.fillText(t.txt, t.x, t.y - a * D() * 0.6); ctx.globalAlpha = 1;
    }
  }
  function floatText(x, y, txt, c, fs) { B.texts.push({ x, y, txt, t: B.t, c, fs }); }
  Object.assign(B, { layout, reset, setChoices, aimAt, fire, swap, step, draw, insertRow: addDropRow, canDrop: () => lowestRow() + 2 < B.maxR, danger, flashHint, floatText, exposed, reach, answerCells, pos, trace, count, clampAim, pivot,
    get idle() { return !B.busy && !B.shot; } });
  return B;
}
