/* Sentence Sprint 1.1 — questions for the Balloons and Translation modes.
   Sources (existing Englishia banks, the same files Word Race and Word Blast use):
   - Mila Quest word banks by age (../../mila-quest/js/data.js + age.js): vocabulary, clues and gap sentences;
   - Word Detective (../word-detective/js/data.js, classic script -> window.WD): word-family / passive gaps and the irregular verbs.
   - OPP / SYN below: a short list of common opposites and synonyms (new in 1.1, the banks have none).
   Native text (he/ar/ru) is swapped by englishia-lang.js on every device, so the host sends English keys
   (te) and each device shows the word or clue in its own language. Runs the checks on the HOST only:
   the answer index never leaves the host before the player answers. (c) 2026 Amir - Englishia */
import { WORDS } from "../../mila-quest/js/data.js";
import { wordsForAge } from "../../mila-quest/js/age.js";

/* same six level keys as the game; age bank, bank levels (lv), Word Detective levels (wd), balloons per question */
export const QLV = {
  veryeasy: { age: "de", lv: [1, 1], wd: [1, 1], n: 3, kinds: ["gap", "def", "opp"] },
  easy:     { age: "de", lv: [1, 2], wd: [1, 2], n: 3, kinds: ["gap", "def", "opp", "syn"] },
  normal:   { age: "vz", lv: [1, 2], wd: [1, 2], n: 4, kinds: ["gap", "gap", "def", "opp", "syn", "v2"] },
  hard:     { age: "vz", lv: [2, 3], wd: [2, 3], n: 4, kinds: ["gap", "gap", "def", "opp", "syn", "v2", "v3"], similar: true },
  veryhard: { age: "ht", lv: [2, 3], wd: [3, 4], n: 4, kinds: ["gap", "gap", "def", "opp", "syn", "v2", "v3"], similar: true },
  master:   { age: "y12", lv: [3, 3], wd: [4, 5], n: 4, kinds: ["gap", "gap", "gap", "def", "syn", "opp", "v3"], similar: true }
};
/* tier 1 = easy words, 2 = middle, 3 = harder */
const OPP = [
  ["big", "small", 1], ["hot", "cold", 1], ["happy", "sad", 1], ["up", "down", 1], ["open", "close", 1], ["day", "night", 1], ["old", "new", 1],
  ["fast", "slow", 1], ["tall", "short", 1], ["good", "bad", 1], ["yes", "no", 1], ["black", "white", 1], ["in", "out", 1], ["boy", "girl", 1],
  ["clean", "dirty", 1], ["wet", "dry", 1], ["full", "empty", 1], ["long", "short", 1], ["rich", "poor", 1], ["light", "dark", 1],
  ["early", "late", 2], ["easy", "difficult", 2], ["strong", "weak", 2], ["cheap", "expensive", 2], ["quiet", "loud", 2], ["buy", "sell", 2],
  ["first", "last", 2], ["win", "lose", 2], ["remember", "forget", 2], ["push", "pull", 2], ["arrive", "leave", 2], ["safe", "dangerous", 2],
  ["heavy", "light", 2], ["thick", "thin", 2], ["always", "never", 2], ["true", "false", 2], ["question", "answer", 2], ["inside", "outside", 2],
  ["polite", "rude", 3], ["ancient", "modern", 3], ["accept", "refuse", 3], ["increase", "decrease", 3], ["generous", "selfish", 3],
  ["victory", "defeat", 3], ["rare", "common", 3], ["temporary", "permanent", 3], ["brave", "cowardly", 3], ["innocent", "guilty", 3],
  ["success", "failure", 3], ["include", "exclude", 3], ["visible", "invisible", 3], ["borrow", "lend", 3]
];
const SYN = [
  ["big", "large", 1], ["small", "little", 1], ["happy", "glad", 1], ["begin", "start", 1], ["fast", "quick", 1], ["shut", "close", 1],
  ["pretty", "beautiful", 1], ["sick", "ill", 1], ["kid", "child", 1], ["talk", "speak", 1], ["look", "see", 1], ["gift", "present", 1],
  ["end", "finish", 2], ["help", "assist", 2], ["smart", "clever", 2], ["angry", "mad", 2], ["scared", "afraid", 2], ["easy", "simple", 2],
  ["choose", "pick", 2], ["hard", "difficult", 2], ["shout", "yell", 2], ["rich", "wealthy", 2], ["fix", "repair", 2], ["sad", "unhappy", 2],
  ["huge", "enormous", 3], ["tired", "exhausted", 3], ["correct", "accurate", 3], ["purchase", "buy", 3], ["reply", "respond", 3],
  ["brave", "courageous", 3], ["famous", "well-known", 3], ["strange", "unusual", 3], ["often", "frequently", 3], ["hide", "conceal", 3]
];
const VERB = { v2: 0, v3: 1 };
/* near-synonym groups: used to keep correct-looking words out of the wrong balloons */
const GROUPS = [["big", "large", "huge", "enormous"], ["small", "little"], ["happy", "glad"], ["begin", "start"], ["fast", "quick"], ["shut", "close"],
  ["pretty", "beautiful"], ["sick", "ill"], ["kid", "child"], ["talk", "speak"], ["look", "see"], ["gift", "present"], ["end", "finish", "last"],
  ["help", "assist"], ["smart", "clever"], ["angry", "mad"], ["scared", "afraid", "cowardly"], ["easy", "simple"], ["choose", "pick"], ["hard", "difficult"],
  ["shout", "yell", "loud"], ["rich", "wealthy"], ["fix", "repair"], ["sad", "unhappy"], ["tired", "exhausted"], ["correct", "accurate", "true"],
  ["purchase", "buy"], ["reply", "respond", "answer"], ["brave", "courageous"], ["famous", "well-known"], ["strange", "unusual", "rare"],
  ["often", "frequently", "always"], ["hide", "conceal"], ["new", "modern"], ["old", "ancient"], ["quiet", "silent"], ["leave", "go"], ["slow", "late"],
  ["dirty", "dark"], ["light", "white"], ["no", "never"], ["poor", "cheap"], ["short", "little"], ["fast", "early"], ["lose", "defeat", "failure"], ["win", "victory", "success"]];
const group = (w) => { const out = new Set([w]); for (const g of GROUPS) if (g.includes(w)) g.forEach((x) => out.add(x)); return out; };
const ALLPAIR = [...new Set([...OPP, ...SYN].flatMap((p) => [p[0], p[1]]))];

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clean = (s) => String(s == null ? "" : s).replace(/\s*\(\d+\)\s*$/, "").trim();
const PROPER = /^(English|Hebrew|Arabic|Russian|French|Israel|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|I|TV|OK)$/;
const lc = (w) => (PROPER.test(w) ? w : w.toLowerCase());
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
const okWord = (s) => !!s && s.length <= 14 && /^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(s) && s.split(" ").length <= 2;

/* ---------- pools (built once per age) ---------- */
const CACHE = {};
function vocab(age) {
  const k = "v" + age; if (CACHE[k]) return CACHE[k];
  const seen = new Set();
  return (CACHE[k] = wordsForAge(age, WORDS).filter((w) => (!w.kind || w.kind === "vocab") && w.en && w.he && okWord(clean(w.en)))
    .map((w) => ({ en: lc(clean(w.en)), n: String(w.he).trim(), clue: w.clue ? String(w.clue).trim() : "", lvl: w.lvl || 1, w: w.w || 1 }))
    .filter((w) => !seen.has(norm(w.en)) && seen.add(norm(w.en))));
}
function gaps(age) {
  const k = "g" + age; if (CACHE[k]) return CACHE[k];
  let g = wordsForAge(age, WORDS).filter((w) => w.kind === "gap" && w.gap && w.gapAns);
  if (!g.length) g = wordsForAge("vz", WORDS).filter((w) => w.kind === "gap" && w.gap && w.gapAns);
  const mila = g.map((w) => ({ text: w.gap.replace(/_{2,}/g, "___"), ans: w.gapAns, wrong: (w.gapOpts || []).filter((x) => x && norm(x) !== norm(w.gapAns)), lvl: w.lvl || 1, say: w.sentence || w.speak || "" }))
    .filter((q) => okWord(q.ans) && q.wrong.length && q.wrong.every(okWord));
  return (CACHE[k] = mila);
}
function wdGaps() {
  if (CACHE.wd) return CACHE.wd;
  const WD = typeof window !== "undefined" && window.WD, out = [];
  if (WD && WD.SECTIONS) for (const s of WD.SECTIONS) {
    if (s.type !== "mc") continue;
    for (const it of s.items || []) {
      if (!it || !it.s || !it.o || !/_{2,}/.test(it.s)) continue;
      const ans = it.o[it.a], wrong = it.o.filter((_, i) => i !== it.a);
      if (!okWord(ans) || !wrong.every(okWord)) continue;
      out.push({ text: it.s.replace(/_{2,}/g, "___"), ans, wrong, lvl: it.lv || 1, say: it.s.replace(/_{2,}/, ans) });
    }
  }
  return (CACHE.wd = out);
}
function irregular() {
  if (CACHE.ir) return CACHE.ir;
  const WD = typeof window !== "undefined" && window.WD, list = (WD && WD.IRREG) || [];
  return (CACHE.ir = list.map((r) => ({ v1: r[0], v2: r[1].split(" / ")[0], v3: r[2].split(" / ")[0] })).filter((r) => r.v1 !== "be"));
}
function byLv(pool, lo, hi, min) {
  let p = pool.filter((x) => x.lvl >= lo && x.lvl <= hi);
  while (p.length < min && (lo > 1 || hi < 5)) { lo = Math.max(1, lo - 1); hi = Math.min(5, hi + 1); p = pool.filter((x) => x.lvl >= lo && x.lvl <= hi); }
  return p.length ? p : pool;
}
function ing(v) { if (/ie$/.test(v)) return v.slice(0, -2) + "ying"; if (/[^e]e$/.test(v)) return v.slice(0, -1) + "ing"; if (/^(begin|forget|run|win|get|sit|swim|put|cut|stop|shop|plan)$/.test(v)) return v + v.slice(-1) + "ing"; return v + "ing"; }
function third(v) { if (v === "have") return "has"; if (/(s|sh|ch|x|z|o)$/.test(v)) return v + "es"; if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies"; return v + "s"; }

/* distractor words: different English, different native text; similar-looking words on the hard levels */
function others(pool, ans, n, rnd, similar, avoid = []) {
  const seen = new Set([norm(ans), ...avoid.map(norm)]), seenN = new Set();
  const me = pool.find((w) => norm(w.en) === norm(ans)); if (me) seenN.add(me.n);
  let cand = shuffle(pool.slice(), rnd);
  if (similar) { const a = ans.toLowerCase(); const sc = (x) => (x.en[0] === a[0] ? 2 : 0) + (Math.abs(x.en.length - a.length) <= 1 ? 1 : 0) + (me && x.w === me.w ? 1 : 0); cand.sort((p, q) => sc(q) - sc(p)); }
  const out = [];
  for (const x of cand) { if (out.length >= n) break; if (seen.has(norm(x.en)) || seenN.has(x.n) || x.en.length > 12) continue; seen.add(norm(x.en)); seenN.add(x.n); out.push(x.en); }
  return out;
}

/* A question for the host: { k, tx, te?, tc?, o: [options], a: answer index, say, item } */
export function makeQuestion(mode, level, rnd, used) {
  const C = QLV[level] || QLV.normal, n = C.n, V = byLv(vocab(C.age), C.lv[0], C.lv[1], 24), all = vocab(C.age);
  const fresh = (key) => !used.has(key);
  const pick = (arr, keyf) => { let c = arr.filter((x) => fresh(keyf(x))); if (!c.length) { for (const x of arr) used.delete(keyf(x)); c = arr; } const x = c[Math.floor(rnd() * c.length)]; used.add(keyf(x)); return x; };
  const finish = (q, ans, wrong) => { const o = shuffle([ans, ...wrong.slice(0, n - 1)], rnd); q.o = o; q.a = o.indexOf(ans); return q; };
  if (mode === "t") {
    const w = pick(V, (x) => "t:" + x.en);
    return finish({ k: "tr", tx: w.n, te: w.en, say: w.en, item: w.en }, w.en, others(V.length >= 10 ? V : all, w.en, n - 1, rnd, C.similar));
  }
  const tier = C.lv[1] >= 3 && C.lv[0] >= 2 ? 3 : C.lv[1] >= 2 ? 2 : 1;
  for (let tries = 0; tries < 8; tries++) {
    const k = C.kinds[Math.floor(rnd() * C.kinds.length)];
    if (k === "gap") {
      const pool = byLv(gaps(C.age), C.lv[0], C.lv[1], 10).concat(level === "veryeasy" ? [] : byLv(wdGaps(), C.wd[0], C.wd[1], 6));
      if (!pool.length) continue;
      const g = pick(pool, (x) => "g:" + x.text);
      let wrong = shuffle(g.wrong.slice(), rnd);
      if (wrong.length < n - 1) wrong = wrong.concat(others(all, g.ans, n - 1 - wrong.length, rnd, false, wrong));
      return finish({ k: "gap", tx: g.text, say: g.say || g.text.replace("___", g.ans), item: g.text }, g.ans, wrong);
    }
    if (k === "def") {
      const pool = V.filter((w) => w.clue && w.clue.length <= 60); if (pool.length < 6) continue;
      const w = pick(pool, (x) => "d:" + x.en);
      return finish({ k: "def", tx: w.clue, te: w.en, tc: 1, say: w.en, item: w.en }, w.en, others(V, w.en, n - 1, rnd, C.similar));
    }
    if (k === "opp" || k === "syn") {
      const src = k === "opp" ? OPP : SYN, pool = src.filter((p) => p[2] <= tier && p[2] >= Math.max(1, tier - 1));
      const p = pick(pool, (x) => k + ":" + x[0] + x[1]);
      const flip = rnd() < 0.5, word = flip ? p[1] : p[0], ans = flip ? p[0] : p[1];
      // a wrong balloon must never be another right answer: leave out the near-synonyms of the word and of the answer,
      // and (opposites) every other opposite of the word
      const ban = new Set([...group(word), ...group(ans)]);
      if (k === "opp") for (const q of OPP) { if (q[0] === word) group(q[1]).forEach((x) => ban.add(x)); if (q[1] === word) group(q[0]).forEach((x) => ban.add(x)); }
      const wrong = shuffle(ALLPAIR.filter((x) => !ban.has(x) && x.length <= 12), rnd).slice(0, n - 1);
      return finish({ k, tx: word, say: ans, item: word }, ans, wrong);
    }
    if (k in VERB) {
      const pool = irregular().filter((r) => k === "v2" || r.v3 !== r.v2); if (!pool.length) continue;
      const r = pick(pool, (x) => k + ":" + x.v1), ans = k === "v2" ? r.v2 : r.v3;
      const wrong = shuffle([r.v1, k === "v2" ? r.v3 : r.v2, third(r.v1), ing(r.v1), /e$/.test(r.v1) ? r.v1 + "d" : r.v1 + "ed"].filter((w, i, a) => w && norm(w) !== norm(ans) && a.indexOf(w) === i), rnd);
      return finish({ k, tx: r.v1, say: ans, item: k + " " + r.v1 }, ans, wrong);
    }
  }
  const w = pick(V, (x) => "t:" + x.en);
  return finish({ k: "tr", tx: w.n, te: w.en, say: w.en, item: w.en }, w.en, others(V, w.en, n - 1, rnd, C.similar));
}
/* each device shows the native word / clue in its own language */
let NATIVE = null;
export function nativeOf(en) {
  if (!NATIVE) { NATIVE = new Map(); for (const a of ["de", "vz", "ht", "y12"]) for (const w of vocab(a)) if (!NATIVE.has(norm(w.en))) NATIVE.set(norm(w.en), w); }
  return NATIVE.get(norm(en)) || null;
}
export function localize(q) {
  if (!q || !q.te) return q;
  const w = nativeOf(q.te); if (!w) return q;
  return Object.assign({}, q, { tx: q.tc ? w.clue || q.tx : w.n });
}
