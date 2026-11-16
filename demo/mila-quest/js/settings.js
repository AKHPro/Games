/* Mila Quest v9 — player settings, one exercise type per world, and a difficulty model where
   EVERY stage is harder than the one before it, every world is a clear jump, and the three
   difficulty levels (easy / normal / hard) feel really different. */

export const QTYPES = [
  // key in settings.types, internal runner mode, Hebrew label (settings + map)
  { key: "en2he", mode: "en2he", label: "רואים מילה באנגלית ובוחרים תרגום" },
  { key: "he2en", mode: "tr", label: "רואים מילה בעברית ובוחרים באנגלית" },
  { key: "picture", mode: "picw", label: "תמונה ← מילה באנגלית" },
  { key: "missing", mode: "let", label: "אות חסרה" },
  { key: "listen", mode: "rev", label: "שומעים ובוחרים פירוש בעברית" },
  { key: "hear", mode: "hear", label: "שומעים בלבד ובוחרים את המילה באנגלית" },
  { key: "build", mode: "build", label: "איות: איסוף אותיות" }
];
/* short labels (stage tiles, map chips, intro) */
export const MODE_LABEL = {
  en2he: "תרגום לעברית", tr: "תרגום לאנגלית", picw: "תמונה ומילה", let: "אות חסרה",
  rev: "האזנה ופירוש", hear: "האזנה בלבד", build: "איות באותיות", mix: "סיבוב מהיר – הכול"
};
export const MODE_DESC = {
  en2he: "רואים מילה באנגלית ורצים אל התרגום בעברית",
  tr: "רואים מילה בעברית ורצים אל המילה באנגלית",
  picw: "רואים תמונה ורצים אל המילה באנגלית",
  let: "משלימים את האות החסרה במילה באנגלית",
  rev: "שומעים מילה באנגלית (בלי לראות אותה) ורצים אל הפירוש בעברית",
  hear: "שומעים מילה באנגלית ורצים אל אותה מילה באנגלית – בלי עברית ובלי רמזים כתובים",
  build: "מאייתים את המילה באנגלית: אוספים את האותיות לפי הסדר",
  mix: "כל סוגי התרגילים מתחלפים, במהירות הכי גבוהה"
};
export const LISTEN_MODES = ["rev", "hear"];
export const isListenMode = (m) => m === "rev" || m === "hear";

/* v9: one exercise type per world (index = world id - 1). World 8 mixes everything. */
export const WORLD_MODE = ["en2he", "tr", "picw", "let", "rev", "hear", "build", "mix"];
/* similar fallbacks when the world's own type is switched off in the settings */
const FALLBACK = {
  en2he: ["tr", "picw", "rev"], tr: ["en2he", "picw", "let"], picw: ["tr", "en2he"], let: ["build", "tr", "en2he"],
  rev: ["hear", "en2he", "tr"], hear: ["rev", "tr", "en2he"], build: ["let", "tr", "en2he"]
};

export const DIFFS = {
  easy: {
    label: "קל", mul: 0.75, hearts: 5, timeMul: 1.3, timeAdd: 0.6, densMul: 0.6, spaceMul: 1.35, simMul: 0.45,
    options: 2, hints: true, reveal: true, boss: -1, lvlShift: -0.25, comboCap: 0.12, rate: 0.72,
    desc: "איטי מאוד, 5 לבבות, הרבה זמן לענות, רק 2 תשובות לבחירה, פחות מכשולים ורמזים מהינשוף."
  },
  normal: {
    label: "רגיל", mul: 1, hearts: 4, timeMul: 1, timeAdd: 0, densMul: 1, spaceMul: 1, simMul: 1,
    options: 3, hints: true, reveal: false, boss: 0, lvlShift: 0, comboCap: 0.3, rate: 0.82,
    desc: "מהירות רגילה, 4 לבבות, 3 תשובות לבחירה. כל שלב קצת יותר קשה מהקודם."
  },
  hard: {
    label: "קשה", mul: 1.3, hearts: 3, timeMul: 0.8, timeAdd: 0, densMul: 1.3, spaceMul: 0.88, simMul: 1.6,
    options: 3, hints: false, reveal: false, boss: 2, lvlShift: 0.25, comboCap: 0.42, rate: 0.92,
    desc: "מהיר מאוד, 3 לבבות, פחות זמן לענות, תשובות דומות ומבלבלות, מילים קשות, יותר מכשולים ובלי רמזים."
  }
};
export const SPEEDS = [
  { v: 0.75, label: "איטי מאוד" },
  { v: 0.9, label: "איטי" },
  { v: 1, label: "רגיל" },
  { v: 1.15, label: "מהיר" }
];
export const GFX_OPTS = [
  { v: "auto", label: "אוטומטי" },
  { v: "low", label: "נמוכה (פיקסלים)" },
  { v: "medium", label: "בינונית" },
  { v: "high", label: "גבוהה" }
];

export const DEFAULT_SETTINGS = () => ({
  difficulty: "normal",
  types: { en2he: true, he2en: true, picture: true, missing: true, listen: true, hear: true, build: true },
  speed: 1,
  gfx: "auto",
  sfx: 0.8,
  voice: 1,
  hints: true,
  showAnswer: true
});

export function normSettings(s) {
  const d = DEFAULT_SETTINGS();
  const o = Object.assign(d, s || {});
  o.types = Object.assign(DEFAULT_SETTINGS().types, (s && s.types) || {});
  if (!DIFFS[o.difficulty]) o.difficulty = "normal";
  if (!SPEEDS.some((x) => x.v === o.speed)) o.speed = 1;
  if (!GFX_OPTS.some((x) => x.v === o.gfx)) o.gfx = "auto";
  o.sfx = Math.max(0, Math.min(1, +o.sfx || 0));
  o.voice = Math.max(0, Math.min(1, o.voice == null ? 1 : +o.voice));
  if (!QTYPES.some((q) => o.types[q.key])) o.types.en2he = true; // at least one type stays on
  return o;
}
export function enabledModes(set) {
  return QTYPES.filter((q) => set.types[q.key]).map((q) => q.mode);
}
/* The world's exercise type after the settings toggles (a disabled type falls back to a similar one). */
export function worldMode(wid, set) {
  const m = WORLD_MODE[Math.max(0, Math.min(WORLD_MODE.length - 1, (wid || 1) - 1))];
  if (m === "mix") return "mix";
  const en = enabledModes(set);
  if (en.includes(m)) return m;
  const alt = (FALLBACK[m] || []).find((x) => en.includes(x));
  return alt || en[((wid || 1) - 1) % en.length] || "en2he";
}
/* Per-question modes for a stage: the world's type (boss included); the mixed world (and its boss)
   cycles through every enabled type. */
export function stageModes(wid, st, boss, set) {
  const m = worldMode(wid, set);
  if (m === "mix") {
    const en = enabledModes(set);
    return en.length ? en : ["en2he"];
  }
  return [m];
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (v) => +v.toFixed(2);
/* obstacle kinds unlock stage by stage */
const STAGE_TYPES = [
  ["wall", "low"],
  ["wall", "hole", "low"],
  ["wall", "hole", "beam", "low"],
  ["wall", "hole", "beam", "roll", "low"],
  ["wall", "hole", "beam", "roll", "low"],
  ["wall", "hole", "beam", "roll"],
  ["wall", "hole", "beam", "roll"]
];
/* word-level mix (lvl 1 / 2 / 3) per world index 0..7 */
const LVL_MIX = [
  [1, 0, 0],
  [0.75, 0.25, 0],
  [0.5, 0.38, 0.12],
  [0.35, 0.4, 0.25],
  [0.25, 0.4, 0.35],
  [0.15, 0.4, 0.45],
  [0.1, 0.35, 0.55],
  [0.05, 0.3, 0.65]
];

/* v9 difficulty.  k = world progression (0 = world 1), p = stage progression 0..5 (boss = 5.6).
   Every value moves in one direction with both k and p, so stage n+1 is always harder than n
   and world n+1 starts harder than world n ended (at least in speed / answer time / words). */
export function difficultyFor(wid, st, boss, set) {
  const k = clamp((wid || 1) - 1, 0, 9);
  const dk = set.difficulty in DIFFS ? set.difficulty : "normal";
  const D = DIFFS[dk];
  const easy = dk === "easy", hard = dk === "hard";
  const i = boss ? 6 : clamp(st || 0, 0, 5);
  const p = boss ? 5.6 : i;
  const m = D.mul;
  // running speed (m/s): world jump +0.5, stage step +0.22
  const speed = r2((6.2 + 0.5 * k + 0.22 * p) * m);
  // seconds from the question appearing to reaching its gate
  const answerTime = r2(Math.max(hard ? 2.0 : 2.4, (5.2 - 0.3 * k - 0.12 * p) * D.timeMul + D.timeAdd));
  const lead = r2(clamp(answerTime * speed, 14, 70));              // metres (at the base speed setting)
  const density = r2(clamp((0.28 + 0.07 * k + 0.05 * p) * D.densMul, 0.1, hard ? 0.97 : 0.9));
  const spacing = r2(Math.max(8, 12.5 - 0.5 * k - 0.25 * p) * D.spaceMul); // metres between obstacle rows (+0..4 random)
  const doubleBlock = easy ? 0 : r2(clamp(0.05 + 0.06 * k + 0.02 * p + (hard ? 0.15 : 0), 0, 0.6));
  const similarity = r2(clamp((0.1 + 0.11 * k + 0.04 * p) * D.simMul, 0, 0.98));
  const bossHP = Math.max(3, 4 + Math.floor(k * 0.6) + D.boss);
  const options = D.options;                                         // answers on the gate (easy: 2 + a closed lane)
  let mix = LVL_MIX[Math.min(k, LVL_MIX.length - 1)].slice();
  const shift = D.lvlShift + 0.04 * p;
  if (k === 0 && easy) mix = [1, 0, 0];
  else {
    const move = clamp(shift, -mix[1] - mix[2], mix[0]);
    if (move >= 0) { mix[0] -= move; mix[1] += move * 0.6; mix[2] += move * 0.4; }
    else { const tot = mix[1] + mix[2] || 1; mix[0] -= move; mix[1] += move * mix[1] / tot; mix[2] += move * mix[2] / tot; }
  }
  mix = mix.map((x) => r2(Math.max(0, x)));
  // exercise variants that get harder inside a world
  const picRiddle = easy || p <= 2;                                  // picture stages 4+ show the picture only
  const letMissing = (!easy && p >= (hard ? 3 : 4)) ? 2 : 1;         // two missing letters late in the world
  const letAny = p >= 2 || hard;                                     // the missing letter can be the first / last one
  const spellModel = easy || (!hard && p <= 1);                      // faint model of the word while spelling
  // letter collection (spelling) stage
  const letterSpeed = r2(clamp(0.74 + 0.03 * k + 0.015 * p + (hard ? 0.06 : 0) - (easy ? 0.06 : 0), 0.66, 0.96));
  const letterGap = +clamp((16 - 0.6 * k - 0.3 * p) / m + (easy ? 2 : 0), 9, 19).toFixed(1);
  const letterFirst = 18 + (easy ? 4 : 0);
  const letterClear = +clamp(8 - 0.4 * k - 0.15 * p, 4.5, 9).toFixed(1);
  const letterObs = (easy || k <= 1) ? 0 : r2(clamp((0.06 * (k - 1) + 0.04 * p) * (hard ? 1.3 : 1), 0, 0.5));
  const letterReach = r2(clamp(1.35 - 0.05 * k - 0.02 * p + (easy ? 0.2 : 0) - (hard ? 0.1 : 0), 0.85, 1.55));
  const letterSim = r2(similarity * 0.7);
  const letterForgive = easy || (!hard && p <= 1);                   // a missed row re-spawns instead of costing a heart
  return {
    level: dk, speed, answerTime, lead, density, spacing, doubleBlock, similarity, bossHP, hearts: D.hearts, options,
    hints: D.hints, reveal: D.reveal, comboCap: D.comboCap, rate: D.rate, lvlMix: mix, types: STAGE_TYPES[i].slice(),
    picRiddle, letMissing, letAny, spellModel,
    letterSpeed, letterGap, letterFirst, letterClear, letterObs, letterReach, letterSim, letterForgive
  };
}
