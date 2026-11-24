/* Word Race 1.0 — question builder. Reuses the Mila Quest word banks (same files, same he/ar/ru translations
   through englishia-lang.js swapData). Runs on the HOST only: the answer index never leaves the host
   before the round is over. © 2026 Amir · Englishia */
import { WORDS } from "../../mila-quest/js/data.js";
import { wordsForAge } from "../../mila-quest/js/age.js";

/* Same six levels, names and score multipliers as Mila Quest (settings.js DIFFS). */
export const LEVELS = [
  { k: "veryeasy", he: "קל מאוד", mul: 0.5, opts: 2, time: 1.5, lv: [1, 1], say: true, color: "#22b573" },
  { k: "easy", he: "קל", mul: 1, opts: 3, time: 1.25, lv: [1, 2], say: true, color: "#7bc63a" },
  { k: "normal", he: "רגיל", mul: 1.5, opts: 4, time: 1, lv: [1, 2], say: false, color: "#ffc21a" },
  { k: "hard", he: "קשה", mul: 2, opts: 4, time: 1, lv: [2, 3], say: false, color: "#ff9a1f", similar: true },
  { k: "veryhard", he: "קשה מאוד", mul: 3, opts: 4, time: 0.85, lv: [3, 3], say: false, color: "#ff5a4f", similar: true },
  { k: "master", he: "אלוף", mul: 4, opts: 4, time: 0.75, lv: [3, 3], say: false, color: "#8b5cf6", similar: true, long: true }
];
export const levelOf = (k) => LEVELS.find((l) => l.k === k) || LEVELS[2];
export const AGES = [
  { k: "de", he: "ד׳–ה׳" }, { k: "vz", he: "ו׳–ז׳" }, { k: "ht", he: "ח׳–ט׳" }, { k: "y12", he: "י׳–י״ב" }
];
/* Question types (the design's "תמונה ומילה" is left out: the word pictures in the banks are emoji). */
export const QTYPES = [
  { k: "en2n", he: "תרגום לעברית", ico: "languages", color: "#2f7bff", on: true },
  { k: "n2en", he: "תרגום לאנגלית", ico: "languages", color: "#0f7a62", on: true },
  { k: "missing", he: "אות חסרה", ico: "missing", color: "#8b5cf6", on: false },
  { k: "listen", he: "האזנה", ico: "volume", color: "#14b8c9", on: false },
  { k: "grammar", he: "דקדוק (Grammar)", ico: "pen", color: "#ff7a1a", on: true },
  { k: "vocab", he: "אוצר מילים", ico: "book", color: "#b4415b", on: true }
];
export const CAT = { en2n: "תרגום", n2en: "תרגום", missing: "אות חסרה", listen: "האזנה", grammar: "דקדוק", vocab: "אוצר מילים" };

function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const clean = (s) => String(s == null ? "" : s).replace(/\s*\(\d+\)\s*$/, "").trim();
const isWord = (s) => /^[A-Za-z][A-Za-z' -]{1,18}$/.test(s);

function vocabPool(age) {
  const all = wordsForAge(age, WORDS).filter((w) => (!w.kind || w.kind === "vocab") && w.en && w.he && isWord(clean(w.en)));
  return all.map((w) => ({ en: clean(w.en), n: String(w.he).trim(), he: w._he || w.he, clue: w.clue || "", lvl: w.lvl || 1, w: w.w || 1 }));
}
function grammarPool(age) {
  let g = wordsForAge(age, WORDS).filter((w) => (w.kind === "gap" || w.kind === "grammar") && w.gap && w.gapAns);
  if (!g.length) g = wordsForAge("vz", WORDS).filter((w) => (w.kind === "gap" || w.kind === "grammar") && w.gap && w.gapAns && (w.lvl || 1) <= 2);
  return g.map((w) => ({ gap: w.gap, ans: w.gapAns, wrong: (w.gapOpts || []).filter((x) => x && x !== w.gapAns), lvl: w.lvl || 1, he: w._he || w.he, speak: w.speak || w.sentence || "" }));
}
function byLevel(pool, L, min) {
  let p = pool.filter((w) => w.lvl >= L.lv[0] && w.lvl <= L.lv[1]);
  if (L.long) { const lp = p.filter((w) => (w.en || w.gap || "").length >= 6); if (lp.length >= min) p = lp; }
  let lo = L.lv[0], hi = L.lv[1];
  while (p.length < min && (lo > 1 || hi < 3)) { lo = Math.max(1, lo - 1); hi = Math.min(3, hi + 1); p = pool.filter((w) => w.lvl >= lo && w.lvl <= hi); }
  return p.length ? p : pool;
}
/* distractors: different English and different native text; on hard levels prefer similar words */
function distract(pool, item, n, key, rnd, similar) {
  const seen = new Set([item[key].toLowerCase()]), seenN = new Set([item.n, item.en.toLowerCase()]);
  let cand = shuffle(pool.filter((w) => w !== item), rnd);
  if (similar) {
    const sc = (w) => (w.en[0].toLowerCase() === item.en[0].toLowerCase() ? 2 : 0) + (Math.abs(w.en.length - item.en.length) <= 1 ? 1 : 0) + (w.w === item.w ? 1 : 0);
    cand.sort((a, b) => sc(b) - sc(a));
  }
  const out = [];
  for (const w of cand) {
    if (out.length >= n) break;
    const v = w[key]; if (!v || seen.has(v.toLowerCase()) || seenN.has(w.n) || seenN.has(w.en.toLowerCase())) continue;
    seen.add(v.toLowerCase()); seenN.add(w.n); seenN.add(w.en.toLowerCase()); out.push(w);
  }
  return out;
}
let ALLEN = null;
function missingQ(w, nOpts, rnd) {
  const s = w.en; if (!/^[A-Za-z]{3,12}$/.test(s)) return null;
  if (!ALLEN) ALLEN = new Set(["de", "vz", "ht", "y12"].flatMap((a) => vocabPool(a).map((x) => x.en.toLowerCase())));
  const idx = 1 + Math.floor(rnd() * (s.length - 2));
  const ch = s[idx].toLowerCase();
  // a wrong letter must not make another real word (e.g. B?ll -> ball / bell)
  const ok = (c) => c !== ch && !ALLEN.has((s.slice(0, idx) + c + s.slice(idx + 1)).toLowerCase());
  const letters = shuffle("aeioustrnlmdkbcgpwhy".split("").filter(ok), rnd).slice(0, nOpts - 1);
  const opts = shuffle([ch, ...letters], rnd);
  return { type: "missing", lead: "Choose the missing letter:", text: s.slice(0, idx) + "\u2009?\u2009" + s.slice(idx + 1), gapText: true, hint: w.n, opts, ans: opts.indexOf(ch), optsEn: true, speak: s, item: s };
}
/* Build the whole race: n questions, mixing the chosen types. Returns full questions (with ans) for the host. */
export function buildRace({ types, level, age, n, seed }) {
  const rnd = rng(seed || Date.now()), L = levelOf(level);
  const on = QTYPES.map((t) => t.k).filter((k) => types.includes(k));
  const kinds = on.length ? on : ["en2n", "n2en"];
  const V = byLevel(vocabPool(age), L, 24), G = byLevel(grammarPool(age), L, 6);
  const usedV = new Set(), usedG = new Set(), out = [];
  const pickV = () => { let c = V.filter((w) => !usedV.has(w.en)); if (!c.length) { usedV.clear(); c = V; } const w = c[Math.floor(rnd() * c.length)]; usedV.add(w.en); return w; };
  const pickG = () => { let c = G.filter((w) => !usedG.has(w.gap)); if (!c.length) { usedG.clear(); c = G; } const w = c[Math.floor(rnd() * c.length)]; usedG.add(w.gap); return w; };
  const order = shuffle(Array.from({ length: n }, (_, i) => kinds[i % kinds.length]), rnd);
  for (let i = 0; i < n; i++) {
    const k = order[i]; let q = null;
    if (k === "grammar" && G.length) {
      const w = pickG(); const opts = shuffle([w.ans, ...w.wrong.slice(0, Math.max(1, L.opts - 1))], rnd);
      q = { type: "grammar", lead: "Choose the correct word:", text: w.gap.replace(/_{2,}/g, "\u0001"), opts, ans: opts.indexOf(w.ans), optsEn: true, speak: "", item: w.gap, he: w.he };
    } else if (k === "missing") {
      for (let t = 0; t < 6 && !q; t++) q = missingQ(pickV(), L.opts, rnd);
    } else {
      const w = pickV();
      const key = k === "en2n" ? "n" : "en";
      const ds = distract(V.length >= 8 ? V : vocabPool(age), w, L.opts - 1, key, rnd, L.similar);
      const optsW = shuffle([w, ...ds], rnd);
      if (k === "en2n") q = { type: k, lead: "What does it mean?", text: w.en, opts: optsW.map((x) => x.n), oe: optsW.map((x) => x.en), ans: optsW.indexOf(w), optsEn: false, speak: w.en, item: w.en };
      else if (k === "n2en") q = { type: k, lead: "How do you say it in English?", text: w.n, textNative: true, te: w.en, opts: optsW.map((x) => x.en), ans: optsW.indexOf(w), optsEn: true, speak: "", sayOpts: true, item: w.en };
      else if (k === "listen") q = { type: k, lead: "Listen and choose the word:", text: "", listen: true, opts: optsW.map((x) => x.en), ans: optsW.indexOf(w), optsEn: true, speak: w.en, item: w.en };
      else q = { type: "vocab", lead: "Which word is it?", text: w.clue ? w.clue : w.n, textNative: true, te: w.en, tc: w.clue ? 1 : 0, opts: optsW.map((x) => x.en), ans: optsW.indexOf(w), optsEn: true, speak: "", sayOpts: true, item: w.en };
    }
    if (!q) { const w = pickV(); const ds = distract(V, w, L.opts - 1, "n", rnd); const o = shuffle([w, ...ds], rnd); q = { type: "en2n", lead: "What does it mean?", text: w.en, opts: o.map((x) => x.n), oe: o.map((x) => x.en), ans: o.indexOf(w), optsEn: false, speak: w.en, item: w.en }; }
    q.cat = CAT[q.type]; q.i = i;
    out.push(q);
  }
  return out;
}
/* each device shows the native text in its own language (players in one room may differ) */
let NATIVE = null;
export function nativeOf(en) {
  if (!NATIVE) { NATIVE = new Map(); for (const a of ["de", "vz", "ht", "y12"]) for (const w of vocabPool(a)) if (!NATIVE.has(w.en)) NATIVE.set(w.en, w); }
  return NATIVE.get(en) || null;
}
export function localize(p) {
  if (!p) return p;
  const q = Object.assign({}, p);
  if (p.oe) q.opts = p.oe.map((e, i) => { const w = nativeOf(e); return w ? w.n : p.opts[i]; });
  if (p.te) { const w = nativeOf(p.te); if (w) q.text = p.tc && w.clue ? w.clue : w.n; }
  return q;
}
/* what the players may see while the question is open (no answer) */
export function publicQ(q) {
  const p = { type: q.type, cat: q.cat, lead: q.lead, text: q.text, opts: q.opts, optsEn: !!q.optsEn };
  if (q.textNative) p.tn = 1; if (q.oe) p.oe = q.oe; if (q.te) { p.te = q.te; if (q.tc) p.tc = 1; } if (q.listen) p.listen = 1; if (q.speak) p.speak = q.speak; if (q.sayOpts) p.sayOpts = 1;
  return p;
}
