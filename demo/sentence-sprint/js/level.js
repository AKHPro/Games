/* Sentence Sprint 1.1 — the level: three floors built from Imagina's level art (bg tile 1280x720,
   every second tile mirrored so the seams match), word bubbles placed from a seed so every device
   builds the same track without sending it. © 2026 Amir · Englishia */
import { makeGenerator, wordPool, LENS, GEN, rng } from "./grammar.js?v=1.1";

export const TILE = 1280;
export const VIEW_TOP = -80, VIEW_H = 720;           // world rows shown on screen (as in the mockup)
export const PHYS = { g: 2400, jump: 1060, jump2: 900, maxFall: 1500, step: 18 };
// walkable surfaces of one (unmirrored) tile: [x0, x1, y]
const TOP = [[118, 590, 144], [590, 1186, 153]];
const MID = [[75, 590, 344], [590, 985, 350], [985, 1231, 362]];
const GROUND = 510;
export const FLOOR_Y = [GROUND, 348, 148];          // nominal y of floor 0 (ground), 1 (middle), 2 (top)
export const LENGTHS = { short: 10, medium: 15, long: 21 };   // tiles to the finish line

function tileFloors(i) {
  const flip = i % 2 === 1, ox = i * TILE, out = [];
  const put = (segs, fl) => segs.forEach(([a, b, y]) => out.push(flip ? { x0: ox + TILE - b, x1: ox + TILE - a, y, fl } : { x0: ox + a, x1: ox + b, y, fl }));
  put(TOP, 2); put(MID, 1);
  return out;
}

export function buildLevel(set, seed) {
  const tiles = (LENGTHS[set.len] || LENGTHS.medium);
  const finish = tiles * TILE + 300;
  const total = tiles + 3;
  const floors = [];
  for (let i = 0; i < total; i++) floors.push(...tileFloors(i));
  floors.push({ x0: -2000, x1: total * TILE + 4000, y: GROUND, fl: 0 });
  floors.sort((a, b) => a.x0 - b.x0);
  // floors that cover x (with a small margin)
  const at = (x, m = 0) => floors.filter((f) => x >= f.x0 - m && x <= f.x1 + m);
  const has = (x, fl) => at(x, -40).some((f) => f.fl === fl);
  const yOf = (x, fl) => { const f = at(x).find((f) => f.fl === fl); return f ? f.y : FLOOR_Y[fl]; };

  // 1.1: Balloons / Translation modes have no word bubbles; the answer balloons come with each question
  if (set.md === "q" || set.md === "t") return { floors, bubbles: [], finish, tiles: total, lo: 1, hi: 1, at, start: 260 };
  // word bubbles: two "streams" of generated sentences move between floors (one floor up at most per column),
  // plus a distractor now and then on the free floor
  const [lo, hi] = LENS[set.wl] || LENS.m;
  const gen = makeGenerator(set.level, seed), R = rng((seed ^ 0x9e3779b9) >>> 0);
  const pool = wordPool(set.level);
  const FUNC = ["the", "a", "my", "is", "are", "in", "to", "with", "and"].filter((w) => w !== "and");
  const streams = [{ q: [], fl: 0 }, { q: [], fl: 1 }];
  const bubbles = [];
  const COLORS = 8;
  let id = 0;
  const few = set.dens === "f";
  const gap = Math.round((GEN[set.level] && GEN[set.level].tier === 1 ? 250 : 235) * (few ? 1.4 : 1));
  for (let x = 820; x < finish - 260; x += gap) {
    const used = new Set();
    for (const s of streams) {
      if (!s.q.length) s.q = gen(lo, hi).slice();
      // choose the next floor: stay, any floor down, or one floor up
      let opts = [0, 1, 2].filter((f) => f <= s.fl + 1 && has(x, f) && !used.has(f));
      if (!opts.length) continue;
      let fl = opts.includes(s.fl) && R() < 0.55 ? s.fl : opts[Math.floor(R() * opts.length)];
      s.fl = fl; used.add(fl);
      const w = s.q.shift();
      const b = { id: id++, x: x + Math.round((R() - 0.5) * 50), y: yOf(x, fl) - 82, w, c: Math.floor(R() * COLORS), fl };
      if (R() < 0.07 && set.gold !== false) b.g = 1;          // golden word: a sentence with it scores double
      bubbles.push(b);
    }
    if (R() < (few ? 0.2 : 0.45)) {
      const free = [0, 1, 2].filter((f) => !used.has(f) && has(x, f));
      if (free.length) {
        const fl = free[Math.floor(R() * free.length)];
        const w = R() < 0.35 ? FUNC[Math.floor(R() * FUNC.length)] : pool[Math.floor(R() * pool.length)];
        bubbles.push({ id: id++, x: x + Math.round((R() - 0.5) * 60), y: yOf(x, fl) - 82, w, c: Math.floor(R() * COLORS), fl });
      }
    }
  }
  return { floors, bubbles, finish, tiles: total, lo, hi, at, start: 260 };
}

/* one physics step for a runner (shared by players; the host never simulates other people) */
export function step(L, r, dt, speed) {
  r.x += speed * dt;
  const wasY = r.y;
  r.vy = Math.min(PHYS.maxFall, r.vy + PHYS.g * dt);
  let ny = r.y + r.vy * dt;
  r.ground = false;
  const cand = L.at(r.x, 6);
  if (r.vy >= 0) {
    let best = null;
    for (const f of cand) {
      // land on a surface we were above (one-way platforms), or walk onto a slightly higher one (steps)
      if (r.dropY != null && (f.y <= r.dropY + 2 || f.fl >= r.dropFl)) continue;          // dropping through this platform
      if (wasY <= f.y + 2 && ny >= f.y) { if (!best || f.y < best.y) best = f; }
      else if (r.onY != null && Math.abs(f.y - r.onY) <= PHYS.step && Math.abs(ny - f.y) <= PHYS.step && wasY <= f.y + PHYS.step) { if (!best || f.y < best.y) best = f; }
    }
    if (best) { ny = best.y; r.vy = 0; r.ground = true; r.onY = best.y; r.fl = best.fl; r.air = 0; r.jumps = 0; }
  }
  if (r.ground || (r.dropY != null && ny > r.dropY + 60)) r.dropY = null;
  if (!r.ground) { r.onY = null; r.air = (r.air || 0) + dt; }
  r.y = ny;
  if (r.y > 760) { r.y = GROUND; r.vy = 0; r.ground = true; r.onY = GROUND; r.fl = 0; }
}
