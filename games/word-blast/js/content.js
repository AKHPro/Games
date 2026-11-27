/* Word Blast 1.0 - prompts and answers.
   Sources (existing Englishia banks, same files the other games use):
   - Mila Quest word banks by age (../../mila-quest/js/data.js + age.js): vocabulary and gap sentences;
   - Word Detective content (../word-detective/js/data.js, classic script -> window.WD): word-family gaps and the irregular verb table;
   - the teacher's own list (see parseTeacher).
   Native text (he/ar/ru) comes already swapped by englishia-lang.js. (c) 2026 Amir - Englishia */
import { WORDS } from "../../mila-quest/js/data.js";
import { wordsForAge } from "../../mila-quest/js/age.js";

/* six difficulty levels, same names and score multipliers as the other Englishia games */
export const LEVELS = [
  { k: "veryeasy", he: "קל מאוד", mul: 0.5, choices: 3, shots: 35, drop: 6, rows: 2, colors: 4, hints: 3, lv: [1, 1], wd: [1, 2], v3: false, aimHelp: true, color: "#22b573" },
  { k: "easy", he: "קל", mul: 1, choices: 3, shots: 32, drop: 5, rows: 2, colors: 4, hints: 3, lv: [1, 2], wd: [1, 2], v3: false, aimHelp: true, color: "#7bc63a" },
  { k: "normal", he: "רגיל", mul: 1.5, choices: 4, shots: 30, drop: 4, rows: 2, colors: 5, hints: 2, lv: [1, 2], wd: [1, 3], v3: true, aimHelp: true, color: "#2f7bff" },
  { k: "hard", he: "קשה", mul: 2, choices: 4, shots: 26, drop: 3, rows: 2, colors: 5, hints: 2, lv: [2, 3], wd: [2, 4], v3: true, aimHelp: false, similar: true, color: "#ff9a1f" },
  { k: "veryhard", he: "קשה מאוד", mul: 3, choices: 5, shots: 22, drop: 2, rows: 3, colors: 6, hints: 1, lv: [3, 3], wd: [3, 5], v3: true, aimHelp: false, similar: true, color: "#ff5a4f" },
  { k: "master", he: "אלוף", mul: 4, choices: 5, shots: 20, drop: 1, rows: 3, colors: 6, hints: 1, lv: [3, 3], wd: [4, 5], v3: true, aimHelp: false, similar: true, timer: 20, color: "#8b5cf6" }
];
export const levelOf = (k) => LEVELS.find((l) => l.k === k) || LEVELS[2];
export const AGES = [{ k: "de", he: "ד׳–ה׳" }, { k: "vz", he: "ו׳–ז׳" }, { k: "ht", he: "ח׳–ט׳" }, { k: "y12", he: "י׳–י״ב" }];
export const TYPES = [
  { k: "gap", he: "השלמת משפט", ico: "missing", ex: "She ___ to school.", lead: "השלימו את המשפט" },
  { k: "question", he: "שאלות", ico: "question", ex: "What is the past tense of go?", lead: "ענו על השאלה" },
  { k: "trans", he: "מילה ותרגום", ico: "languages", ex: "dog", lead: "איך אומרים באנגלית?" },
  { k: "teacher", he: "רשימה של המורה", ico: "book", ex: "", lead: "" }
];
export const typeOf = (k) => TYPES.find((t) => t.k === k) || TYPES[0];
export const PROMPTS_PER_LEVEL = 10;
export const MAXLEN = 12; // longest word allowed on a bubble (longer words get a wider label, see app.js)

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clean = (s) => String(s == null ? "" : s).replace(/\s*\(\d+\)\s*$/, "").trim();
const PROPER = /^(English|Hebrew|Arabic|Russian|French|Israel|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|I|TV|OK)$/;
const lc = (w) => (PROPER.test(w) ? w : w.toLowerCase());
const okWord = (s) => !!s && s.length <= MAXLEN && /^[A-Za-z][A-Za-z' -]*[A-Za-z]$|^[A-Za-z]$/.test(s) && s.split(" ").length <= 2;
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- verb forms for the question type ---------- */
function ing(v) {
  if (/ie$/.test(v)) return v.slice(0, -2) + "ying";
  if (/[^e]e$/.test(v) && v !== "be") return v.slice(0, -1) + "ing";
  if (/^(begin|forget|run|win|get|sit|swim|put|cut|stop|shop|plan)$/.test(v)) return v + v.slice(-1) + "ing";
  return v + "ing";
}
function third(v) {
  if (v === "have") return "has"; if (v === "be") return "is";
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + "es";
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + "ies";
  return v + "s";
}

/* ---------- pools ---------- */
function milaVocab(age) {
  return wordsForAge(age, WORDS).filter((w) => (!w.kind || w.kind === "vocab") && w.en && w.he && okWord(clean(w.en)))
    .map((w) => ({ en: lc(clean(w.en)), n: String(w.he).trim(), lvl: w.lvl || 1, w: w.w || 1 }));
}
function milaGaps(age) {
  let g = wordsForAge(age, WORDS).filter((w) => w.kind === "gap" && w.gap && w.gapAns);
  if (!g.length) g = wordsForAge("vz", WORDS).filter((w) => w.kind === "gap" && w.gap && w.gapAns && (w.lvl || 1) <= 2);
  return g.map((w) => ({ text: w.gap, ans: w.gapAns, wrong: (w.gapOpts || []).filter((x) => x && norm(x) !== norm(w.gapAns)), lvl: w.lvl || 1, he: w._he || w.he, say: w.sentence || w.speak || "" }))
    .filter((q) => okWord(q.ans) && q.wrong.every(okWord) && q.wrong.length);
}
function wdGaps() {
  const WD = window.WD; if (!WD || !WD.SECTIONS) return [];
  const out = [];
  for (const s of WD.SECTIONS) {
    if (s.type !== "mc") continue;
    for (const it of s.items || []) {
      if (!it || !it.s || !it.o) continue;
      const ans = it.o[it.a], wrong = it.o.filter((_, i) => i !== it.a);
      if (!okWord(ans) || !wrong.every(okWord)) continue;
      out.push({ text: it.s, ans, wrong, wlv: it.lv || 1, sec: s.key, say: it.s.replace(/_{2,}/, ans) });
    }
  }
  return out;
}
function irregular() {
  const WD = window.WD; const list = (WD && WD.IRREG) || [];
  return list.map((r) => ({ v1: r[0], v2: r[1].split(" / ")[0], v3: r[2].split(" / ")[0] })).filter((r) => r.v1 !== "be");
}

/* ---------- prompt builders. A prompt: {type, lead, text, ans, wrong[], item, topic, say, native?} ---------- */
function gapPrompt(g, L, rnd) {
  const text = g.text.replace(/_{2,}/g, "___");
  return { type: "gap", lead: "השלימו את המשפט", text, ans: g.ans, wrong: shuffle(g.wrong.slice(), rnd).slice(0, L.choices - 1), item: text, topic: "השלמת משפט", say: g.say || text.replace("___", g.ans) };
}
function verbPrompt(r, L, rnd) {
  const askV3 = L.v3 && rnd() < 0.4 && r.v3 !== r.v2;
  const ans = askV3 ? r.v3 : r.v2;
  const text = askV3 ? `What is the V3 (past participle) of "${r.v1}"?` : `What is the past tense of "${r.v1}"?`;
  const pool = [r.v1, askV3 ? r.v2 : r.v3, third(r.v1), ing(r.v1)].filter((w, i, a) => w && norm(w) !== norm(ans) && a.indexOf(w) === i);
  return { type: "question", lead: "ענו על השאלה", text, ans, wrong: shuffle(pool, rnd).slice(0, L.choices - 1), item: (askV3 ? "V3 " : "V2 ") + r.v1, topic: "צורות פועל", say: "" };
}
function transPrompt(w, pool, L, rnd) {
  const seenN = new Set([w.n]), seenE = new Set([norm(w.en)]);
  let cand = shuffle(pool.filter((x) => x !== w), rnd);
  if (L.similar) {
    const sc = (x) => (x.en[0].toLowerCase() === w.en[0].toLowerCase() ? 2 : 0) + (Math.abs(x.en.length - w.en.length) <= 1 ? 1 : 0) + (x.w === w.w ? 1 : 0);
    cand.sort((a, b) => sc(b) - sc(a));
  }
  const wrong = [];
  for (const x of cand) { if (wrong.length >= L.choices - 1) break; if (seenN.has(x.n) || seenE.has(norm(x.en))) continue; seenN.add(x.n); seenE.add(norm(x.en)); wrong.push(x.en); }
  return { type: "trans", lead: "איך אומרים באנגלית?", text: w.n, native: true, ans: w.en, wrong, item: w.en, topic: "תרגום", say: "" };
}
function byLv(pool, lo, hi, min, key = "lvl") {
  let p = pool.filter((x) => x[key] >= lo && x[key] <= hi);
  while (p.length < min && (lo > 1 || hi < 5)) { lo = Math.max(1, lo - 1); hi = Math.min(5, hi + 1); p = pool.filter((x) => x[key] >= lo && x[key] <= hi); }
  return p.length ? p : pool;
}

/* teacher list: one prompt per line  "prompt | answer | wrong1, wrong2"  (wrong answers optional) */
export const TEACHER_SAMPLE = "She ___ to school every day. | goes | go, going, went\nWhat is the past tense of buy? | bought | buyed, buys\nכלב | dog | cat, bird";
export function parseTeacher(txt) {
  const items = [], bad = [];
  String(txt || "").split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim(); if (!raw) return;
    const p = raw.split(/\s*[|\t]\s*/);
    if (p.length < 2 || !p[0] || !p[1]) { bad.push({ n: i + 1, line: raw, why: "חסר | בין השאלה לתשובה" }); return; }
    const ans = p[1].trim(), wrong = (p[2] || "").split(/\s*[,;]\s*/).map((s) => s.trim()).filter((s) => s && norm(s) !== norm(ans));
    if (ans.length > 16 || wrong.some((w) => w.length > 16)) { bad.push({ n: i + 1, line: raw, why: "מילה ארוכה מדי (עד 16 אותיות)" }); return; }
    items.push({ text: p[0].replace(/_{2,}|…|\.\.\./g, "___"), ans, wrong });
  });
  return { items: items.slice(0, 40), bad };
}
function teacherPrompts(list, n, rnd, L) {
  const items = shuffle(list.slice(), rnd).slice(0, n);
  const allAns = list.map((x) => x.ans);
  return items.map((it) => {
    let wrong = it.wrong.slice(0, 5); // the teacher's own wrong answers are used as they are
    if (!wrong.length) {
      for (const a of shuffle(allAns.slice(), rnd)) { if (wrong.length >= L.choices - 1) break; if (norm(a) !== norm(it.ans) && !wrong.some((w) => norm(w) === norm(a))) wrong.push(a); }
    }
    if (!wrong.length) wrong = shuffle(milaVocab("vz").map((w) => w.en), rnd).filter((w) => norm(w) !== norm(it.ans)).slice(0, Math.max(1, L.choices - 1));
    const isGap = it.text.includes("___"), native = /[\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF]/.test(it.text);
    return { type: isGap ? "gap" : native ? "trans" : "question", lead: isGap ? "השלימו את המשפט" : native ? "איך אומרים באנגלית?" : "ענו על השאלה",
      text: it.text, native, ans: it.ans, wrong: it.wrong.length ? shuffle(wrong, rnd) : shuffle(wrong, rnd).slice(0, Math.max(L.choices - 1, 1)), item: it.text, topic: "רשימה של המורה", say: isGap ? it.text.replace("___", it.ans) : "" };
  });
}

/* one level = PROMPTS_PER_LEVEL prompts (teacher list: all its lines, up to 40).
   out.fillers = words for the other bubbles (this level's answers and wrong answers, plus short vocabulary words) */
export const SHORT = 8;
const short = (q) => [q.ans, ...(q.wrong || [])].every((w) => String(w).length <= SHORT);
export function buildLevel(o) {
  const out = buildPrompts(o), rnd = rng((o.seed || 1) + 17);
  const f = new Set(); out.forEach((p) => [p.ans, ...p.wrong].forEach((w) => f.add(w)));
  if (f.size < 30) for (const w of shuffle(milaVocab(o.type === "teacher" ? "vz" : o.age || "vz").map((x) => x.en).filter((w) => w.length <= 7), rnd)) { if (f.size >= 30) break; f.add(w); }
  out.fillers = [...f].filter((w) => o.type === "teacher" || String(w).length <= 10);
  return out;
}
function buildPrompts({ type, level, age, seed, teacher }) {
  const rnd = rng(seed || Date.now()), L = levelOf(level), N = PROMPTS_PER_LEVEL;
  if (type === "teacher") return teacherPrompts((teacher && teacher.items) || [], 40, rnd, L);
  let out = [];
  if (type === "gap") {
    const mila = byLv(milaGaps(age), L.lv[0], L.lv[1], 8);
    const wd = byLv(wdGaps(), L.wd[0], L.wd[1], 8, "wlv");
    const all = shuffle(mila.concat(wd), rnd), sh = all.filter((g) => short({ ans: g.ans, wrong: g.wrong }));
    const pool = sh.length >= N ? sh : sh.concat(all.filter((g) => !sh.includes(g))); const seen = new Set();
    for (const g of pool) { if (out.length >= N) break; if (seen.has(g.text)) continue; seen.add(g.text); out.push(gapPrompt(g, L, rnd)); }
  } else if (type === "question") {
    const pool = shuffle(irregular(), rnd);
    for (const r of pool) { if (out.length >= N) break; const q = verbPrompt(r, L, rnd); q.wrong = q.wrong.filter((w) => w.length <= SHORT + 2); if (q.wrong.length) out.push(q); }
  } else {
    const all0 = milaVocab(age), all8 = all0.filter((w) => w.en.length <= SHORT), all = all8.length >= 40 ? all8 : all0, V = byLv(all, L.lv[0], L.lv[1], 24);
    const pool = shuffle(V.slice(), rnd); const seen = new Set();
    for (const w of pool) { if (out.length >= N) break; if (seen.has(norm(w.en))) continue; seen.add(norm(w.en)); out.push(transPrompt(w, V.length >= 10 ? V : all, L, rnd)); }
  }
  return out;
}
export const sameWord = (a, b) => norm(a) === norm(b);
