/* Mila Quest v10.2 — age bands +  player settings, one exercise type per world, and a difficulty model where
   EVERY stage is harder than the one before it, every world is a clear jump, and the six
   difficulty levels feel really different. Run speed is set by the difficulty (no separate speed control). */

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
  veryeasy: {
    label: "קל מאוד", scoreMul: 0.5, mul: 0.55, hearts: 5, timeMul: 1.45, timeAdd: 0.9, densMul: 0.45, spaceMul: 1.5, simMul: 0.3,
    options: 2, hints: true, reveal: true, boss: -1, lvlShift: -0.35, comboCap: 0.08, rate: 0.68, minAnswer: 2.8, tier: 0,
    desc: "ריצה איטית מאוד, 5 לבבות, הרבה זמן לענות, רק 2 תשובות, פחות מכשולים ורמזים מהינשוף. ניקוד ×0.5."
  },
  easy: {
    label: "קל", scoreMul: 1, mul: 0.75, hearts: 5, timeMul: 1.3, timeAdd: 0.6, densMul: 0.6, spaceMul: 1.35, simMul: 0.45,
    options: 2, hints: true, reveal: true, boss: -1, lvlShift: -0.25, comboCap: 0.12, rate: 0.72, minAnswer: 2.4, tier: 1,
    desc: "ריצה איטית, 5 לבבות, הרבה זמן לענות, 2 תשובות לבחירה, פחות מכשולים ורמזים מהינשוף. ניקוד ×1."
  },
  normal: {
    label: "רגיל", scoreMul: 1.5, mul: 1, hearts: 4, timeMul: 1, timeAdd: 0, densMul: 1, spaceMul: 1, simMul: 1,
    options: 3, hints: true, reveal: false, boss: 0, lvlShift: 0, comboCap: 0.3, rate: 0.82, minAnswer: 2.4, tier: 2,
    desc: "מהירות רגילה, 4 לבבות, 3 תשובות לבחירה. כל שלב קצת יותר קשה מהקודם. ניקוד ×1.5."
  },
  hard: {
    label: "קשה", scoreMul: 2, mul: 1.2, hearts: 3, timeMul: 0.85, timeAdd: 0, densMul: 1.2, spaceMul: 0.92, simMul: 1.4,
    options: 3, hints: false, reveal: false, boss: 1, lvlShift: 0.18, comboCap: 0.38, rate: 0.88, minAnswer: 2.15, tier: 3,
    desc: "ריצה מהירה, 3 לבבות, פחות זמן לענות, תשובות דומות, יותר מכשולים ובלי רמזים. ניקוד ×2."
  },
  veryhard: {
    label: "קשה מאוד", scoreMul: 3, mul: 1.35, hearts: 3, timeMul: 0.78, timeAdd: 0, densMul: 1.32, spaceMul: 0.86, simMul: 1.65,
    options: 3, hints: false, reveal: false, boss: 2, lvlShift: 0.25, comboCap: 0.42, rate: 0.92, minAnswer: 2.0, tier: 4,
    desc: "ריצה מהירה מאוד, 3 לבבות, מעט זמן לענות, מילים קשות, הרבה מכשולים ובלי רמזים. ניקוד ×3."
  },
  master: {
    label: "אלוף", scoreMul: 4, mul: 1.5, hearts: 3, timeMul: 0.72, timeAdd: 0, densMul: 1.4, spaceMul: 0.82, simMul: 1.8,
    options: 3, hints: false, reveal: false, boss: 2, lvlShift: 0.32, comboCap: 0.48, rate: 0.96, minAnswer: 2.0, tier: 5,
    desc: "הכי מהיר, 3 לבבות, הזמן הקצר ביותר לענות, שאלות קשות ומכשולים צפופים, בלי רמזים. ניקוד ×4."
  }
};
/* Old 4-speed control — kept only to migrate saves into the 6 difficulty levels. */
export const SPEEDS = [
  { v: 0.75, label: "איטי מאוד" },
  { v: 0.9, label: "איטי" },
  { v: 1, label: "רגיל" },
  { v: 1.15, label: "מהיר" }
];
function migrateDifficulty(diff, speed) {
  if (diff === "veryeasy" || diff === "veryhard" || diff === "master") return diff;
  const sp = (speed == null || speed === "") ? 1 : +speed;
  if (diff === "easy") return sp < 1 ? "veryeasy" : "easy";
  if (diff === "hard") return sp >= 1.15 ? "master" : (sp >= 1 ? "veryhard" : "hard");
  if (diff === "normal") return sp >= 1.15 ? "hard" : (sp <= 0.75 ? "easy" : "normal");
  return "normal";
}

export const AGES = [
  { key: "de", label: "ד׳–ה׳", blurb: "התוכן הנוכחי: מילים, אותיות ותמונות." },
  { key: "vz", label: "ו׳–ז׳", blurb: "אוצר מילים ארוך יותר, משפטים קצרים, השלמת פערים, והווה פשוט בהתחלה." },
  { key: "ht", label: "ח׳–ט׳", blurb: "הווה פשוט (do/does, he/she +s), הווה ממושך, עבר פשוט, there is/are, מילות יחס, והבנת הנקרא במשפטים." },
  { key: "y12", label: "י׳–י״ב", blurb: "אוצר מילים וזמנים בסגנון בגרות: משפטים ארוכים יותר, מחברים, והבנת הנקרא." }
];
export const normAge = (v) => (AGES.some((a) => a.key === v) ? v : "de");

export const GFX_OPTS = [
  { v: "auto", label: "אוטומטי" },
  { v: "low", label: "חסכונית" },
  { v: "medium", label: "בינונית" },
  { v: "high", label: "גבוהה" }
];

export const DEFAULT_SETTINGS = () => ({
  difficulty: "normal",
  diffV: 2,
  types: { en2he: true, he2en: true, picture: true, missing: true, listen: true, hear: true, build: true },
  gfx: "auto",
  sfx: 0.8,
  voice: 1,
  hints: true,
  showAnswer: true,
  fx: true,
  age: "de"
});

export function normSettings(s) {
  const raw = s || {};
  const d = DEFAULT_SETTINGS();
  const o = Object.assign(d, raw);
  o.types = Object.assign(DEFAULT_SETTINGS().types, raw.types || {});
  if (raw.diffV !== 2) {
    o.difficulty = migrateDifficulty(raw.difficulty, raw.speed);
    o.diffV = 2;
  } else if (!DIFFS[o.difficulty]) {
    o.difficulty = "normal";
  }
  delete o.speed;
  if (!GFX_OPTS.some((x) => x.v === o.gfx)) o.gfx = "auto";
  o.sfx = Math.max(0, Math.min(1, +o.sfx || 0));
  o.voice = Math.max(0, Math.min(1, o.voice == null ? 1 : +o.voice));
  if (!QTYPES.some((q) => o.types[q.key])) o.types.en2he = true; // at least one type stays on
  o.age = normAge(o.age);
  o.fx = o.fx !== false;
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
  const easy = D.tier <= 1, hard = D.tier >= 4;
  const i = boss ? 6 : clamp(st || 0, 0, 5);
  const p = boss ? 5.6 : i;
  const m = D.mul;
  // running speed (m/s): world jump +0.5, stage step +0.22 — set only by difficulty
  const speed = r2((6.2 + 0.5 * k + 0.22 * p) * m);
  // seconds from the question appearing to reaching its gate
  const answerTime = r2(Math.max(D.minAnswer, (5.2 - 0.3 * k - 0.12 * p) * D.timeMul + D.timeAdd));
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
  const letterFirst = r2(Math.max(18, speed * 1.4) + (easy ? 4 : 0));
  const letterClear = +clamp(Math.max(8 - 0.4 * k - 0.15 * p, speed * 0.5 + 3), 4.5, 16).toFixed(1);
  const letterObs = (easy || k <= 1) ? 0 : r2(clamp((0.06 * (k - 1) + 0.04 * p) * (hard ? 1.3 : 1), 0, 0.5));
  const letterReach = r2(Math.max(clamp(1.35 - 0.05 * k - 0.02 * p + (easy ? 0.2 : 0) - (hard ? 0.1 : 0), 0.85, 1.55), 0.1 * speed, 1.15));
  const letterSim = r2(similarity * 0.7);
  const letterForgive = easy || (!hard && p <= 1);                   // a missed row re-spawns instead of costing a heart
  const types = STAGE_TYPES[i].slice();
  // animals from stage 1 on every difficulty; noticeably frequent, more weight at higher tiers
  types.push("animal", "animal");
  if (D.tier >= 2) types.push("animal");
  if (D.tier >= 4) types.push("animal");
  return {
    level: dk, scoreMul: D.scoreMul, speed, answerTime, lead, density, spacing, doubleBlock, similarity, bossHP, hearts: D.hearts, options,
    hints: D.hints, reveal: D.reveal, comboCap: D.comboCap, rate: D.rate, lvlMix: mix, types,
    picRiddle, letMissing, letAny, spellModel,
    letterSpeed, letterGap, letterFirst, letterClear, letterObs, letterReach, letterSim, letterForgive
  };
}
