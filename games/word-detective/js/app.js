/* Word Detective – game logic. © 2026 Amir · Englishia */
(function () {
"use strict";
var $ = function (s) { return document.querySelector(s); }, $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
var GAME_ID = "word-detective";
var POS = WD.POS, TENSE = WD.TENSE;

/* ---------- drawn icons (no emoji: classroom PCs show squares) ---------- */
var IC = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M8 7h7M8 11h7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/>',
  exam: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="M8.5 12l2 2 4-4M8.5 17h7"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/>',
  team: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0"/>',
  teacher: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 20l2-4M17 20l-2-4"/><path d="M7 9h6M7 12h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  magnify: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  tree: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="12" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M12 7.5v8M12 11H5v4.5M12 11h7v4.5"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M13.5 6.5l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M6 13c0-3 4-4 10-4"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9z" fill="currentColor"/>',
  starO: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5l-5.5 2.9 1-6.3L3 9.7l6.2-.9z"/>',
  fire: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.3 2.6-5.3 3.6-8.8 2.4 1.7 3 3.7 2.9 5.4 1-.8 1.7-2 1.8-3.4 2.3 1.8 2.7 4.3 2.7 6.8 0 3.5-2.5 6.2-4.5 6.2z" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  del: '<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8 3l4 6 4-6"/><path d="M12 12.5v5"/>'
};
function icon(n, cls) { return '<svg class="i' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || "") + "</svg>"; }
function paintIcons(root) { (root || document).querySelectorAll("[data-ic]").forEach(function (e) { if (!e.dataset.icDone) { e.insertAdjacentHTML("afterbegin", icon(e.dataset.ic)); e.dataset.icDone = 1; } }); }

/* ---------- sound ---------- */
var SND = { on: LS.get("wd-sound", true), ctx: null };
function beep(kind) {
  if (!SND.on) return;
  try {
    var C = SND.ctx || (SND.ctx = new (window.AudioContext || window.webkitAudioContext)());
    var seq = kind === "ok" ? [[660, 0, .09], [880, .09, .14]] : kind === "partial" ? [[600, 0, .12], [600, .14, .1]] : kind === "win" ? [[523, 0, .1], [659, .1, .1], [784, .2, .1], [1047, .3, .25]] : kind === "tick" ? [[1000, 0, .04]] : [[220, 0, .22]];
    seq.forEach(function (s) {
      var o = C.createOscillator(), g = C.createGain(); o.type = kind === "wrong" ? "sawtooth" : "triangle"; o.frequency.value = s[0];
      g.gain.setValueAtTime(.0001, C.currentTime + s[1]); g.gain.exponentialRampToValueAtTime(.18, C.currentTime + s[1] + .01); g.gain.exponentialRampToValueAtTime(.0001, C.currentTime + s[1] + s[2]);
      o.connect(g); g.connect(C.destination); o.start(C.currentTime + s[1]); o.stop(C.currentTime + s[1] + s[2] + .02);
    });
  } catch (e) {}
}
function paintSound() { var b = $("#soundBtn"); b.innerHTML = icon(SND.on ? "sound" : "mute"); b.setAttribute("aria-label", SND.on ? "השתקה" : "הפעלת צליל"); }
$("#soundBtn").onclick = function () { SND.on = !SND.on; LS.set("wd-sound", SND.on); paintSound(); if (SND.on) beep("ok"); };

/* ---------- items ---------- */
var ITEMS = [], BY_ID = {};
function addItem(it) { ITEMS.push(it); BY_ID[it.id] = it; return it; }
WD.SECTIONS.forEach(function (S) {
  S.list = [];
  S.items.forEach(function (a, i) {
    var it = { id: "s" + S.id + "-" + (i + 1), sec: S.id, S: S, t: S.type };
    if (S.type === "pos") { it.s = a[0]; it.a = a[1]; it.lv = a[2]; it.why = a[3] || null; it.suf = a[4] || null; it.opts = S.opts; }
    else if (S.type === "tense") { it.s = a[0]; it.a = a[1]; it.lv = a[2]; it.f = a[3]; }
    else { Object.keys(a).forEach(function (k) { it[k] = a[k]; }); if (S.type === "type" && typeof it.a === "string") it.a = [it.a]; }
    it.fu = S.fu;
    S.list.push(addItem(it));
  });
});
var EXAM_ITEMS = WD.EXAM.map(function (e, i) {
  var it = { id: "x-" + (i + 1), sec: 0, S: null, exam: true, lv: 5 };
  Object.keys(e).forEach(function (k) { it[k] = e[k]; });
  if (it.t === "pos") { it.opts = WD.POS8; it.fu = it.suf ? "suf" : "cf"; }
  else if (it.t === "mc") it.fu = it.p ? "need" : null;
  else if (it.t === "type") it.fu = it.pf ? "pfx" : "need";
  else if (it.t === "tense") it.fu = "build";
  return addItem(it);
});
function itemById(id) { return BY_ID[id] || null; }

/* ---------- display helpers ---------- */
function sentHTML(it, fill) {
  var h = esc(it.s).replace(/\*\*(.+?)\*\*/g, '<b class="hl">$1</b>');
  h = h.replace("___", '<span class="gap">' + (fill ? esc(fill) : "&nbsp;") + "</span>");
  if (it.t === "type") h += ' <span class="base">(' + esc(it.w) + (it.h ? " – " + '<span dir="rtl">' + esc(it.h) + "</span>" : "") + ")</span>";
  return h;
}
function promptOf(it) {
  if (it.t === "pos") return "מה חלק הדיבר של המילה המודגשת?";
  if (it.t === "mc") return "בחרו את המילה המתאימה למשפט:";
  if (it.t === "tense") return "באיזה זמן הפועל המודגש?";
  if (it.pf) return "הוסיפו תחילית למילה שבסוגריים וכתבו אותה:";
  return "כתבו את הצורה הנכונה של המילה שבסוגריים:";
}
function posLabel(k) { var p = POS[k]; return '<span class="en">' + p.en + "</span> · " + p.he; }
function answerText(it) {
  if (it.t === "pos") return POS[it.a].en + " (" + POS[it.a].he + ")";
  if (it.t === "tense") return TENSE[it.a].en + " (" + TENSE[it.a].he + ")";
  if (it.t === "mc") return it.o[it.a];
  return it.a[0];
}
function answerHTML(it, cls) { return '<span class="ans' + (cls ? " " + cls : "") + '">' + esc(answerText(it)) + "</span>"; }
function boldWords(it) { var m = it.s.match(/\*\*(.+?)\*\*/g) || []; return m.map(function (x) { return x.slice(2, -2); }).join(" … "); }
function tenseOptsFor(it, lv) {
  var max = Math.max(it.lv || 1, lv || 1); if (it.exam || (G && (G.mode === "comp" || G.mode === "team"))) max = 5;
  var list = WD.TENSE_ORDER.filter(function (k) { return TENSE[k].lv <= max; });
  if (list.indexOf(it.a) < 0) list.push(it.a);
  return list;
}

/* ---------- explanations ---------- */
function ltrRuns(html) {
  /* wrap each stretch with no Hebrew letters (tags allowed) that starts and ends with Latin text in one LTR isolate,
     so mixed explanations like "If + V1, <b>will + V1</b>" keep their English order inside RTL text */
  var U = [], HEB = /[\u0590-\u05FF]/, LAT = /[A-Za-z0-9]/, END = /[A-Za-z0-9_.!?)]/;
  String(html).split(/(<[^>]+>)/).forEach(function (s) { if (!s) return; if (s.charAt(0) === "<") U.push({ tag: s }); else for (var k = 0; k < s.length; k++) U.push({ ch: s[k] }); });
  function prevCh(i) { for (var k = i - 1; k >= 0; k--) if (U[k].ch != null) return U[k].ch; return ""; }
  function nextCh(i) { for (var k = i + 1; k < U.length; k++) if (U[k].ch != null) return U[k].ch; return ""; }
  var out = "", i = 0;
  while (i < U.length) {
    var u = U[i];
    var starts = u.ch != null && (LAT.test(u.ch) || (u.ch === "-" && /[A-Za-z]/.test(nextCh(i)) && !HEB.test(prevCh(i))));
    if (!starts) { out += u.tag || u.ch; i++; continue; }
    var pre = "", j = i, last = i, par = 0;
    while (/(<(b|i|span|strong|em)[^>]*>)$/i.test(out)) { var mm = out.match(/(<(b|i|span|strong|em)[^>]*>)$/i)[1]; pre = mm + pre; out = out.slice(0, -mm.length); }
    var depth0 = (pre.match(/</g) || []).length;
    while (j < U.length && !(U[j].ch != null && HEB.test(U[j].ch)) && !(U[j].tag && /^<br/i.test(U[j].tag))) { var c = U[j].ch; if (c === "(") par++; if (c === ")") { if (!par) break; par--; } if (c != null && END.test(c) && !(c === ")" && par < 0)) last = j; j++; }
    var seg = U.slice(i, last + 1), depth = depth0, bad = false;
    seg.forEach(function (x) { if (!x.tag) return; if (/^<\//.test(x.tag)) { depth--; if (depth < 0) bad = true; } else depth++; });
    var k2 = last + 1; while (!bad && depth > 0 && k2 < U.length && U[k2].tag && /^<\//.test(U[k2].tag)) { seg.push(U[k2]); depth--; k2++; }
    if (bad || depth) out += pre + seg.map(function (x) { return x.tag || x.ch; }).join("").split(/(<[^>]+>)/).map(function (s) { return s.charAt(0) === "<" || !/[A-Za-z]/.test(s) ? s : '<span class="en">' + s + "</span>"; }).join("");
    else out += '<span class="en">' + pre + seg.map(function (x) { return x.tag || x.ch; }).join("") + "</span>";
    i = i + seg.length;
  }
  return out;
}
function explain(it) { return ltrRuns(explain0(it)); }
function explain0(it) {
  if (it.t === "pos") {
    var P = POS[it.a], w = boldWords(it), h = "<b>" + esc(w) + "</b> = <b>" + P.en + "</b> (" + P.he + "). " + P.d;
    if (it.why) h = it.why + "<br>" + "<b>" + P.en + "</b> – " + P.d;
    if (it.suf) h += "<br>רמז: הסיומת <b>" + it.suf + "</b> מסמנת " + POS[WD.SUF[it.suf]].he + ".";
    return h;
  }
  if (it.t === "tense") {
    var T = TENSE[it.a], txt = "<b>" + esc(boldWords(it)) + "</b> – " + T.en + " (" + T.he + ").<br>המבנה: <b>" + T.b + "</b>";
    var sig = findSignal(it);
    if (sig) txt += "<br>מילת סימן במשפט: <b>" + esc(sig) + "</b>";
    if (it.f) txt += "<br>צורות הפועל: <b>" + esc(it.f) + "</b>";
    return txt;
  }
  return it.why || "";
}
var SIGNALS = ["every morning", "every evening", "every week", "every day", "every", "right now", "now", "Look!", "Look", "yesterday", "last night", "last weekend", "last month", "last week", "tomorrow", "Next year", "next month", "since", "for ten years", "already", "just", "never", "ever", "while", "While", "when", "When", "By the time", "Before", "before", "ago", "at the moment", "on Friday", "At eight o'clock last night"];
function findSignal(it) { var s = it.s.replace(/\*\*/g, ""); for (var i = 0; i < SIGNALS.length; i++) { var re = new RegExp("(^|[^A-Za-z])" + SIGNALS[i].replace(/[.*+?^${}()|[\]\\!]/g, "\\$&") + "([^A-Za-z]|$)"); if (re.test(s)) return SIGNALS[i]; } return null; }

/* ---------- follow-up questions (שאלת המשך) ---------- */
var FU_SUF_POOL = Object.keys(WD.SUF);
var STRUCT_POOL = WD.TENSE_ORDER;
function followUp(it, r) {
  r = r || Math.random;
  var k = it.fu; if (!k) return null;
  if (k === "cf") return { q: "האם זו מילת תוכן או מילת תפקוד?", o: ["מילת תוכן (Content word)", "מילת תפקוד (Function word)"], a: POS[it.a].fn ? 0 : 1, why: "Noun, Verb, Adjective, Adverb = מילות תוכן (נושאות משמעות). Pronoun, Preposition, Conjunction, Determiner = מילות תפקוד." };
  if (k === "suf" && it.suf) {
    var want = WD.SUF[it.suf], others = FU_SUF_POOL.filter(function (s) { return WD.SUF[s] !== want; });
    others = shuffle(others, r).slice(0, 2); var o = shuffle([it.suf].concat(others), r);
    return { q: "איזו סיומת רומזת על חלק הדיבר?", o: o, a: o.indexOf(it.suf), ltr: true, why: "הסיומת <b>" + it.suf + "</b> = " + POS[want].en + "." };
  }
  if (k === "need" && it.p) { var o2 = WD.POS4C.map(function (p) { return POS[p].en + " · " + POS[p].he; }); return { q: "איזה חלק דיבר היה צריך בחסר?", o: o2, a: WD.POS4C.indexOf(it.p), why: "בחסר היה צריך <b>" + POS[it.p].en + "</b>." }; }
  if (k === "pfx" && it.pf) { var keys = Object.keys(WD.PFX); return { q: "מה המשמעות של התחילית?", o: keys.map(function (x) { return WD.PFX[x]; }), a: keys.indexOf(it.pf), why: "" }; }
  if (k === "build") {
    var others2 = shuffle(STRUCT_POOL.filter(function (x) { return x !== it.a; }), r).slice(0, 2), o3 = shuffle([it.a].concat(others2), r);
    return { q: "איך בנוי הזמן הזה?", o: o3.map(function (x) { return TENSE[x].b; }), a: o3.indexOf(it.a), ltr: true, why: TENSE[it.a].en + " = <b>" + TENSE[it.a].b + "</b>" };
  }
  return null;
}

/* ---------- answer checking ---------- */
function norm(s) { return String(s || "").toLowerCase().replace(/[\u2018\u2019`]/g, "'").replace(/\s+/g, " ").trim(); }
function lev(a, b) { var m = a.length, n = b.length, d = []; for (var i = 0; i <= m; i++) { d[i] = [i]; } for (var j = 0; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function evaluate(it, v) {
  if (it.t === "type") {
    var x = norm(v);
    if (!x) return { status: "wrong", msg: "לא נכתבה תשובה." };
    if (it.a.some(function (a) { return norm(a) === x; })) return { status: "ok" };
    if (x === norm(it.w)) return { status: "wrong", msg: "כתבתם את המילה כמו שהיא – צריך לשנות את הצורה שלה." };
    if (x.length >= 4 && it.a.some(function (a) { return lev(norm(a), x) === 1; })) return { status: "partial", msg: "כמעט! המילה נכונה, אבל יש טעות איות קטנה." };
    return { status: "wrong" };
  }
  if (it.t === "mc") return { status: +v === it.a ? "ok" : "wrong" };
  return { status: v === it.a ? "ok" : "wrong" };
}
function formsOf(it) { var f = (it.f || "").split(" · "); return f.length === 3 ? f : null; }
function formOk(target, v) { var x = norm(v); if (!x) return false; return target.split("/").some(function (t) { return norm(t) === x; }); }

/* ---------- rng ---------- */
function hash32(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { r = r || Math.random; var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function mixed(pools, count, r) { pools = pools.map(function (p) { return shuffle(p, r); }).filter(function (p) { return p.length; }); var order = shuffle(pools.map(function (_, i) { return i; }), r), out = [], k = 0;
  while (out.length < count && k < 5000) { var p = pools[order[k % order.length]]; if (p.length) out.push(p.shift()); k++; if (!pools.some(function (q) { return q.length; })) break; } return shuffle(out, r); }
var COMP_N = 15, SALT = "word-detective-v1";
var normName = function (s) { return String(s || "").replace(/[|\n\r]/g, " ").replace(/\s+/g, " ").trim(); };
function compQueue(code) { var r = rng(hash32("wd-comp|" + code)); return mixed(WD.SECTIONS.map(function (S) { return S.list; }), COMP_N, r); }
var B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function verCode(name, code, score, correct, secs) { var h = hash32([normName(name), code, score, correct, secs, SALT].join("|")), s = ""; for (var i = 0; i < 5; i++) { s += B32[h & 31]; h >>>= 5; } return s; }
var mmss = function (s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };

/* ---------- navigation ---------- */
var cur = { screen: "home" }, HOOKS = {};
function show(id) {
  $$(".screen").forEach(function (e) { e.classList.toggle("on", e.id === id); });
  $("#app").scrollTop = 0; cur.screen = id;
  document.body.classList.toggle("wide", /^host/.test(id));
  if (id === "sections") renderSections(); if (id === "teacher") renderTeacher(); if (id === "home") renderHome();
  if (id === "compJoin") { var me = LS.get("wd-me", {}); if (!$("#cName").value) $("#cName").value = me.name || accountName() || ""; }
  if (HOOKS[id]) HOOKS[id]();
}
document.addEventListener("click", function (e) {
  var g = e.target.closest("[data-go]"); if (!g) return;
  var to = g.dataset.go;
  if (to === "exam") startGame("exam"); else if (to === "tensesGo") startGame("forms"); else if (to === "ref") openRef(); else show(to);
});
function toast(t, ms) { var el = $("#toast"); el.textContent = t; el.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(function () { el.style.display = "none"; }, ms || 3000); }
$("#toast").onclick = function () { $("#toast").style.display = "none"; };

/* ---------- level ---------- */
var LV_HE = { 1: "מתחילים", 2: "קלה", 3: "בסיסית", 4: "בינונית", 5: "מתקדמת" };
(function migrateLevel() {
  if (LS.get("wd-lvmap", 0) >= 1) return;
  var cur = null;
  try { var raw = localStorage.getItem("wd-level"); if (raw) cur = JSON.parse(raw); } catch (e) {}
  if (cur === 1 || cur === 2 || cur === 3) LS.set("wd-level", cur + 2);
  LS.set("wd-lvmap", 1);
})();
function level() { var v = +LS.get("wd-level", 4); return (v >= 1 && v <= 5) ? v : 4; }
function setLevel(v) { LS.set("wd-level", v); $$("#levels .chip").forEach(function (c) { c.classList.toggle("on", +c.dataset.lv === v); }); }
$$("#levels .chip").forEach(function (c) { c.onclick = function () { setLevel(+c.dataset.lv); }; });
function secItems(S, lv) { return S.list.filter(function (it) { return it.lv <= lv; }); }

/* ---------- home ---------- */
var MODES = [
  { go: "sections", ic: "book", c: "blue", b: "תרגול לפי נושא", s: "9 נושאים: חלקי דיבר, סיומות, משפחות מילים, תחיליות, זמנים – עם רמז והסבר" },
  { go: "tensesGo", ic: "clock", c: "green", b: "V1 · V2 · V3 וזמנים", s: "15 פעלים: כותבים את שלוש הצורות של הפועל, ואז מזהים את הזמן" },
  { go: "ref", ic: "doc", c: "navy", b: "דף עזר", s: "טבלאות: חלקי דיבר, סיומות, תחיליות, זמנים, סביל, תנאי ופעלים חריגים" },
  { go: "exam", ic: "exam", c: "yellow", b: "מבחן מסכם", s: "30 שאלות בסגנון בגרות מכל הנושאים, בלי רמזים, ציון באחוזים" },
  { go: "compJoin", ic: "trophy", c: "red", b: "תחרות כיתתית", s: "מקלידים שם וקוד מהמורה – כולם מקבלים אותן שאלות" },
  { go: "teamsHub", ic: "team", c: "purple", b: "משחק קבוצות", s: "כל אחד מהטלפון שלו – הקבוצה שעונה נכון ראשונה מקבלת את הנקודות" },
  { go: "teacher", ic: "teacher", c: "teal", b: "למורה", s: "יצירת קוד תחרות וטבלת מובילים" }
];
$("#modes").innerHTML = MODES.map(function (m) { return '<button class="mode c-' + m.c + '" data-go="' + m.go + '"><span class="ic">' + icon(m.ic) + "</span><span><b>" + m.b + "</b><small>" + m.s + "</small></span></button>"; }).join("");
function renderHome() { setLevel(level()); }

/* ---------- sections ---------- */
function starsHTML(b) { if (b == null) return ""; var n = b >= .9 ? 3 : b >= .7 ? 2 : b >= .4 ? 1 : 0, h = ""; for (var i = 0; i < 3; i++) h += icon(i < n ? "star" : "starO"); return h; }
function renderSections() {
  var best = LS.get("wd-best", {}), lv = level();
  $("#secLvl").textContent = "רמה " + LV_HE[lv] + " · אפשר לשנות במסך הראשי";
  $("#secList").innerHTML = WD.SECTIONS.map(function (S) {
    var n = secItems(S, lv).length, lock = (S.minLv && lv < S.minLv) || !n;
    return '<button class="secbtn c-' + S.color + '" data-sec="' + S.id + '"' + (lock ? " disabled" : "") + '><span class="num bg-' + S.color + '">' + icon(S.icon) + '</span><span class="nm"><b>' + S.id + ". " + S.name + '</b><small><span class="en">' + S.en + "</span> · " + (lock ? "מרמה בינונית" : n + " שאלות") + '</small></span><span class="stars">' + starsHTML(best[S.id]) + "</span></button>";
  }).join("");
  $$("#secList .secbtn").forEach(function (b) { b.onclick = function () { openIntro(+b.dataset.sec); }; });
}
var pendingSec = null;
function openIntro(id) {
  var S = WD.SECTIONS[id - 1]; pendingSec = id;
  $("#introTitle").textContent = S.id + ". " + S.name; $("#introEn").textContent = S.en;
  var box = $("#introRule"); box.className = "box rule c-" + S.color; box.innerHTML = ltrRuns(S.rule);
  $("#introCount").textContent = secItems(S, level()).length + " שאלות ברמה " + LV_HE[level()] + ". לכל תשובה – משוב והסבר, ולפעמים שאלת המשך.";
  $("#introForms").hidden = S.type !== "tense"; $("#introFormsCb").checked = !!LS.get("wd-forms", false);
  show("intro");
}
$("#introFormsCb").onchange = function (e) { LS.set("wd-forms", e.target.checked); };
$("#introStart").onclick = function () { startGame("practice", { sec: pendingSec }); };

/* ---------- game ---------- */
var G = null;
function startGame(mode, opt) {
  opt = opt || {}; var q, lv = level();
  if (mode === "practice") q = shuffle(secItems(WD.SECTIONS[opt.sec - 1], lv));
  else if (mode === "exam") q = EXAM_ITEMS.slice();
  else if (mode === "comp") q = compQueue(opt.code);
  else if (mode === "forms") { var pool = ITEMS.filter(function (it) { return it.t === "tense" && formsOf(it); }); q = mixed(WD.TENSE_ORDER.map(function (k) { return pool.filter(function (it) { return it.a === k && (it.lv <= Math.max(lv, 4) || it.exam); }); }), 15, Math.random); }
  G = { mode: mode, opt: opt, q: q, idx: 0, score: 0, streak: 0, best: 0, results: [], start: Date.now(), lv: lv, recorded: false,
    bd: { base: 0, speed: 0, streak: 0, fu: 0, partial: 0, forms: 0 } };
  G.withForms = mode === "forms" || (mode === "practice" && WD.SECTIONS[opt.sec - 1].type === "tense" && LS.get("wd-forms", false));
  clearInterval(cur.tick);
  var timed = mode === "comp" || mode === "exam";
  $("#timerPill").hidden = !timed;
  if (timed) { var tk = function () { $("#timerPill").innerHTML = icon("clock") + " " + mmss(Math.floor((Date.now() - G.start) / 1000)); }; tk(); cur.tick = setInterval(tk, 500); }
  nextQ();
}
function lblFor() {
  var it = G.it, n = G.idx + 1 + "/" + G.q.length;
  if (G.mode === "practice") return it.S.name + " · " + n;
  if (G.mode === "forms") return "V1 · V2 · V3 וזמנים · " + n;
  if (G.mode === "exam") return "מבחן מסכם · שאלה " + n;
  return "שאלה " + n;
}
function nextQ() {
  var it = G.q[G.idx]; G.it = it; G.answered = false; G.formsDone = !G.withForms || !formsOf(it); G.fuDone = false;
  $("#playLbl").textContent = lblFor(); $("#progBar").style.width = (G.idx / G.q.length * 100) + "%";
  $("#qTag").innerHTML = it.exam ? '<span class="srctag">שאלה בסגנון בגרות</span>' : "";
  $("#qSent").innerHTML = sentHTML(it); $("#qSent").className = "sent";
  $("#fbArea").innerHTML = ""; $("#nextArea").hidden = true;
  updScore();
  $("#qPrompt").textContent = promptOf(it);
  if (!G.formsDone) renderForms(it); else renderAnswer(it, $("#answerArea"), { hint: G.mode === "practice", onAnswer: check });
  show("play"); G.qStart = Date.now();
}
function updScore() { $("#scorePill").innerHTML = (G.streak >= 2 ? '<span class="streak">' + icon("fire") + G.streak + "</span> " : "") + G.score; }

/* generic answer UI – also used by the team game (teams.js) */
var input = { val: "", active: null, forms: null };
var KB_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
function kbHTML() {
  return '<div class="kb" id="kb">' + KB_ROWS.map(function (r, i) { return '<div class="kr">' + (i === 2 ? '<button class="fn" data-k="⌫" aria-label="מחיקה">' + icon("del") + "</button>" : "") + r.split("").map(function (k) { return '<button data-k="' + k + '">' + k + "</button>"; }).join("") + (i === 2 ? '<button class="fn" data-k="-">-</button>' : "") + "</div>"; }).join("") +
    '<div class="kr"><button class="fn" data-k="\'">\'</button><button class="fn" data-k=" " style="max-width:260px;flex:5">space</button></div></div>';
}
var ui = { onAnswer: null, typing: false, mcLocked: false };
function renderAnswer(it, area, o) {
  ui.onAnswer = o.onAnswer; ui.typing = it.t === "type"; ui.mcLocked = false; input.val = ""; input.forms = null; ui.formsMode = false;
  var h = "";
  if (it.t === "type") {
    h = '<div class="ansline empty" id="ansLine">הקלידו את התשובה</div>' + kbHTML() +
      '<div class="actions">' + (o.hint ? '<button class="btn sec" id="hintBtn" style="flex:.6">' + icon("bulb") + " רמז</button>" : "") + '<button class="btn grn" id="checkBtn" disabled>בדיקה ' + icon("check") + "</button></div>";
  } else {
    var opts = it.t === "pos" ? it.opts : it.t === "tense" ? tenseOptsFor(it, G ? G.lv : 4) : it.o.map(function (_, i) { return i; });
    h = '<div class="opts' + (opts.length > 4 && it.t !== "pos" ? "" : "") + '" id="opts">' + opts.map(function (v, i) {
      var lab = it.t === "pos" ? '<span class="en">' + POS[v].en + "</span><small>" + POS[v].he + "</small>" : it.t === "tense" ? '<span class="en">' + TENSE[v].en + "</span><small>" + TENSE[v].he + "</small>" : '<span class="en">' + esc(it.o[v]) + "</span>";
      return '<button class="opt" data-v="' + v + '" data-n="' + (i + 1) + '">' + lab + "</button>";
    }).join("") + "</div>" + (o.hint ? '<div class="actions"><button class="btn sec" id="hintBtn">' + icon("bulb") + " רמז</button></div>" : "");
  }
  area.innerHTML = h;
  if (it.t === "type") { $("#kb").onclick = function (e) { var b = e.target.closest("button"); if (b) press(b.dataset.k); }; $("#checkBtn").onclick = submitTyped; renderLine(); }
  else area.querySelectorAll(".opt").forEach(function (b) { b.onclick = function () { pickOpt(b); }; });
  if (o.hint && $("#hintBtn")) $("#hintBtn").onclick = function () { openHint(it); };
}
function pickOpt(b) {
  if (ui.mcLocked || !ui.onAnswer) return; ui.mcLocked = true; b.classList.add("sel");
  var v = b.dataset.v; ui.onAnswer(G && G.it && G.it.t === "mc" ? +v : v, b);
}
function markOpts(it, picked) {
  $$("#opts .opt").forEach(function (b) {
    b.disabled = true; var v = it.t === "mc" ? +b.dataset.v : b.dataset.v;
    if (v === it.a) b.classList.add("right"); else if (picked != null && v === picked) b.classList.add("wrong");
  });
}
function press(k) {
  if (!ui.typing && !ui.formsMode) return;
  if (k === "⌫" || k === "Backspace") input.val = input.val.slice(0, -1);
  else if (k.length === 1 && /[a-zA-Z' \-]/.test(k)) { if (input.val.length < 24 && !(k === " " && (!input.val || / $/.test(input.val)))) input.val += k.toLowerCase(); }
  if (ui.formsMode) { input.forms[input.active] = input.val; renderFormLines(); } else renderLine();
}
function renderLine() {
  var el = $("#ansLine"); if (!el) return;
  if (!input.val) { el.className = "ansline empty"; el.textContent = "הקלידו את התשובה"; }
  else { el.className = "ansline"; el.innerHTML = esc(input.val) + '<span class="cur"></span>'; }
  var c = $("#checkBtn"); if (c) c.disabled = !input.val.trim();
  if (G && G.it && G.it.t === "type" && !G.answered) $("#qSent").innerHTML = sentHTML(G.it, input.val);
}
function submitTyped() { if (!ui.typing || !input.val.trim() || !ui.onAnswer) return; ui.typing = false; var c = $("#checkBtn"); if (c) c.disabled = true; ui.onAnswer(input.val); }
document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  var tg = e.target && e.target.tagName; if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  if ($("#refModal").classList.contains("on")) { if (e.key === "Escape") closeRef(); return; }
  if ($("#hintModal").classList.contains("on")) { if (e.key === "Escape" || e.key === "Enter") closeHint(); return; }
  if (cur.screen !== "play") return;
  if (e.key === "Enter") { e.preventDefault(); if (!$("#nextArea").hidden) $("#nextBtn").click(); else if (ui.formsMode) checkForms(); else if (ui.typing) submitTyped(); return; }
  if (ui.formsMode || ui.typing) { if (e.key === "Backspace") { e.preventDefault(); press("⌫"); } else if (e.key === "Tab" && ui.formsMode) { e.preventDefault(); setActiveForm((input.active + 1) % 3); } else if (e.key.length === 1) { e.preventDefault(); press(e.key); } return; }
  if (/^[1-9]$/.test(e.key)) { var b = document.querySelector('#opts .opt[data-n="' + e.key + '"]'); if (b && !b.disabled) b.click(); }
});

/* V1 · V2 · V3 step */
var FORM_LBL = ["V1<small>base</small>", "V2<small>past</small>", "V3<small>past participle</small>"];
function renderForms(it) {
  ui.formsMode = true; ui.typing = false; input.forms = ["", "", ""]; input.active = 0; input.val = "";
  $("#qPrompt").innerHTML = "כתבו את שלוש הצורות של הפועל המודגש <span class=\"en\">(V1 · V2 · V3)</span>:";
  $("#answerArea").innerHTML = '<div class="forms">' + [0, 1, 2].map(function (i) { return '<div class="formf"><div class="lab en">' + FORM_LBL[i] + '</div><div class="ansline" id="fl' + i + '" data-i="' + i + '"></div></div>'; }).join("") + "</div>" + kbHTML() +
    '<div class="actions"><button class="btn sec" id="formsSkip" style="flex:.6">דילוג</button><button class="btn grn" id="formsCheck">בדיקת הצורות ' + icon("check") + "</button></div>";
  $$(".formf .ansline").forEach(function (el) { el.onclick = function () { setActiveForm(+el.dataset.i); }; });
  $("#kb").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; if (b.dataset.k === " " && input.active < 2 && input.val) { setActiveForm(input.active + 1); return; } press(b.dataset.k); };
  $("#formsCheck").onclick = checkForms; $("#formsSkip").onclick = function () { G.formRes = null; afterForms(); };
  renderFormLines();
}
function setActiveForm(i) { input.active = i; input.val = input.forms[i]; renderFormLines(); }
function renderFormLines() { [0, 1, 2].forEach(function (i) { var el = $("#fl" + i); if (!el) return; el.className = "ansline" + (i === input.active ? " act" : ""); el.innerHTML = esc(input.forms[i]) + (i === input.active ? '<span class="cur"></span>' : ""); }); }
function checkForms() {
  if (!ui.formsMode) return; ui.formsMode = false; var it = G.it, f = formsOf(it), ok = f.map(function (t, i) { return formOk(t, input.forms[i]); }), n = ok.filter(Boolean).length, pts = n * 2;
  G.score += pts; G.bd.forms += pts; G.formRes = { ok: ok, vals: input.forms.slice(), n: n }; updScore(); wdReport(it, input.forms.join(" / "), n === 3, { item: it.id + " forms " + f.join("/"), topic: "צורות הפועל (V1 V2 V3)", given: input.forms.join(" / "), expected: f.join(" / ") }); beep(n === 3 ? "ok" : n ? "partial" : "wrong");
  [0, 1, 2].forEach(function (i) { var el = $("#fl" + i); el.className = "ansline " + (ok[i] ? "good" : "bad"); el.innerHTML = ok[i] ? esc(f[i]) : (input.forms[i] ? '<s style="opacity:.6">' + esc(input.forms[i]) + "</s>&nbsp; " : "") + esc(f[i]); });
  var kb = $("#kb"); if (kb) kb.remove(); var act = $("#answerArea .actions"); if (act) act.remove();
  $("#fbArea").innerHTML = '<div class="fb ' + (n === 3 ? "ok" : n ? "partial" : "wrong") + '"><h3>' + icon(n === 3 ? "check" : "x") + " " + n + "/3 צורות נכונות" + (pts ? ' <span class="pts">+' + pts + "</span>" : "") + '</h3><div class="en" style="font-size:20px;font-weight:700">' + esc(it.f) + "</div></div>";
  $("#nextArea").hidden = false; $("#nextBtn").innerHTML = "עכשיו: איזה זמן? " + icon("arrow"); $("#nextNote").textContent = ""; G.toTense = true;
}
function afterForms() { G.formsDone = true; G.toTense = false; $("#fbArea").innerHTML = ""; $("#nextArea").hidden = true; $("#qPrompt").textContent = promptOf(G.it); renderAnswer(G.it, $("#answerArea"), { hint: G.mode === "practice", onAnswer: check }); }

/* v12.6: Englishia performance report (signed-in players): item, section, level, given vs right answer */
function wdGiven(it, v) { return v == null || v === "" ? "" : it.t === "pos" ? (POS[v] ? POS[v].en : String(v)) : it.t === "tense" ? (TENSE[v] ? TENSE[v].en : String(v)) : it.t === "mc" ? (it.o[v] != null ? it.o[v] : String(v)) : String(v); }
function wdReport(it, v, ok, extra) {
  try {
    var A = window.EnglishiaAuth; if (!A || !A.recordAnswer || !A.user || !it) return;
    var sent = String(it.s || "").replace(/\*\*/g, "");
    A.recordAnswer(GAME_ID, Object.assign({ item: it.id + (boldWords(it) ? " " + boldWords(it) : ""), prompt: sent, topic: it.S ? it.S.name : "מבחן מסכם",
      level: "רמה " + (it.lv || 1), correct: !!ok, given: wdGiven(it, v), expected: answerText(it) }, extra || {}));
  } catch (e) {}
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function check(v, btn) {
  if (G.answered) return; G.answered = true;
  var it = G.it, secs = (Date.now() - G.qStart) / 1000, ev = evaluate(it, v), comp = G.mode === "comp", pts = 0, bonus = [];
  if (ev.status === "ok") {
    G.streak++;
    if (comp) { var sp = Math.max(0, Math.min(50, Math.round(50 * (35 - secs) / 30))), st = Math.min(40, 10 * (G.streak - 1)); pts = 100 + sp + st; G.bd.base += 100; G.bd.speed += sp; G.bd.streak += st; if (sp) bonus.push(icon("bolt") + " מהירות +" + sp); if (st) bonus.push(icon("fire") + " רצף +" + st); }
    else if (G.mode === "forms") { pts = 4; G.bd.base += 4; }
    else { pts = 10; G.bd.base += 10; }
  } else { G.streak = 0; if (ev.status === "partial") { pts = comp ? 50 : 5; G.bd.partial += pts; } }
  G.best = Math.max(G.best, G.streak); G.score += pts;
  var rec = { it: it, v: v, status: ev.status, pts: pts, secs: secs, forms: G.formRes || null }; G.results.push(rec); G.rec = rec; G.formRes = null; wdReport(it, v, ev.status === "ok");
  updScore(); beep(ev.status);
  if (it.t !== "type") markOpts(it, v); else { var kb = $("#kb"); if (kb) kb.remove(); var act = $("#answerArea .actions"); if (act) act.remove(); $("#ansLine").className = "ansline " + (ev.status === "ok" ? "" : ""); $("#qSent").innerHTML = sentHTML(it, ev.status === "ok" ? v : it.a[0]); }
  if (it.t !== "type") { var hb = $("#answerArea .actions"); if (hb) hb.remove(); }
  var title = ev.status === "ok" ? ["ok", icon("check") + " נכון! " + pick(["כל הכבוד", "מצוין", "בדיוק", "יפה מאוד"])] : ev.status === "partial" ? ["partial", "כמעט!"] : ["wrong", icon("x") + " לא נכון"];
  var h = '<div class="fb ' + title[0] + '"><h3>' + title[1] + (pts ? ' <span class="pts">+' + pts + "</span>" : "") + "</h3>";
  if (bonus.length) h += '<div class="bonus">' + bonus.join(" ") + "</div>";
  if (ev.status !== "ok") h += '<div class="cmp">' + (it.t === "type" ? "<span>כתבתם:</span>" + '<span class="ans bad">' + esc(v) + "</span>" : "") + "<span>התשובה הנכונה:</span>" + answerHTML(it) + "</div>" + (ev.msg ? "<div>" + ev.msg + "</div>" : "");
  h += '<div class="why"><span class="h">הסבר:</span> ' + explain(it) + "</div>";
  var F = followUp(it); G.F = F;
  if (F) h += '<div class="fu"><div class="q">' + icon("star") + " שאלת המשך: " + F.q + "</div>" + (ev.status !== "ok" ? '<div class="muted">(נקודות על שאלת ההמשך רק כשהתשובה הראשית נכונה)</div>' : "") + '<div class="opts' + (F.o.length === 2 ? "" : " one") + '" id="fuOpts">' + F.o.map(function (o, i) { return '<button class="opt" data-i="' + i + '"><span' + (F.ltr ? ' class="en"' : "") + ">" + esc(o) + "</span></button>"; }).join("") + '</div><div id="fuWhy"></div></div>';
  h += "</div>";
  $("#fbArea").innerHTML = h;
  if (F) $$("#fuOpts .opt").forEach(function (b) { b.onclick = function () { fuAnswer(+b.dataset.i); }; });
  $("#nextArea").hidden = false; $("#nextBtn").innerHTML = (G.idx + 1 >= G.q.length ? "לסיכום" : "לשאלה הבאה") + " " + icon("arrow");
  $("#nextNote").textContent = F ? "אפשר לענות על שאלת ההמשך או להמשיך" : "";
  setTimeout(function () { var fb = $("#fbArea"); if (fb && fb.getBoundingClientRect().top > window.innerHeight * .7) fb.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
}
function fuAnswer(i) {
  if (G.fuDone) return; G.fuDone = true; var F = G.F, ok = i === F.a, main = G.rec.status === "ok", p = ok && main ? (G.mode === "comp" ? 20 : 5) : 0;
  G.score += p; G.bd.fu += p; G.rec.fu = ok ? "ok" : "no"; updScore(); beep(ok ? "ok" : "wrong");
  $$("#fuOpts .opt").forEach(function (b) { b.disabled = true; var k = +b.dataset.i; if (k === F.a) b.classList.add("right"); else if (k === i) b.classList.add("wrong"); });
  $("#fuWhy").innerHTML = '<div class="why">' + (ok ? icon("check") + " נכון" + (p ? " +" + p : "") : icon("x") + " לא נכון") + (F.why ? " · " + ltrRuns(F.why) : "") + "</div>";
  $("#nextNote").textContent = "";
}
$("#nextBtn").onclick = function () { if (G.toTense) return afterForms(); advance(); };
function advance() { G.idx++; if (G.idx >= G.q.length) return finish(); nextQ(); }
$("#quitBtn").onclick = function () { if (G && G.results.length && !confirm("לצאת מהמשחק? ההתקדמות בסבב הזה תישמר בחשבון כמשחק חלקי.")) return; clearInterval(cur.tick); if (G && G.results.length) record(); show("home"); };

function openHint(it) { var S = it.S; $("#hintBody").innerHTML = S ? "<b>" + S.name + "</b><br>" + ltrRuns(S.rule) : ""; $("#hintModal").classList.add("on"); }
function closeHint() { $("#hintModal").classList.remove("on"); }
$("#hintClose").onclick = closeHint; $("#hintModal").onclick = function (e) { if (e.target.id === "hintModal") closeHint(); };

/* ---------- finish ---------- */
function reviewHTML(list) {
  var bad = list.filter(function (r) { return r.status !== "ok" || (r.forms && r.forms.n < 3); });
  if (!bad.length) return '<div class="box green center"><b>' + icon("star") + " אין טעויות – מושלם!</b></div>";
  return bad.map(function (r) {
    var it = r.it, h = '<div class="ritem"><div class="sent">' + sentHTML(it, it.t === "type" || it.t === "mc" ? answerText(it) : null) + "</div>";
    if (r.status !== "ok") h += '<div class="cmp">' + (r.v != null && r.v !== "" ? "<span>ענית:</span>" + '<span class="ans bad">' + esc(it.t === "pos" ? POS[r.v] && POS[r.v].en : it.t === "tense" ? TENSE[r.v] && TENSE[r.v].en : it.t === "mc" ? it.o[r.v] : r.v) + "</span>" : "") + "<span>נכון:</span>" + answerHTML(it) + "</div>";
    if (r.forms && r.forms.n < 3) h += '<div class="cmp"><span>צורות:</span><span class="ans">' + esc(it.f) + "</span></div>";
    return h + '<div class="why">' + explain(it) + "</div></div>";
  }).join("");
}
function bdHTML(bd, comp) { var a = []; if (comp) { a.push("בסיס " + bd.base); if (bd.speed) a.push("מהירות " + bd.speed); if (bd.streak) a.push("רצף " + bd.streak); } if (bd.forms) a.push("צורות " + bd.forms); if (bd.fu) a.push("שאלות המשך " + bd.fu); if (bd.partial) a.push("כמעט " + bd.partial); return a.map(function (x) { return "<span>" + x + "</span>"; }).join(""); }
function record() {
  if (!G || G.recorded) return; G.recorded = true;
  var secs = Math.round((Date.now() - G.start) / 1000);
  try { if (window.EnglishiaAuth && EnglishiaAuth.user) EnglishiaAuth.recordSession(GAME_ID, G.score, secs); } catch (e) {}
}
function finish() {
  clearInterval(cur.tick); var secs = Math.round((Date.now() - G.start) / 1000);
  var correct = G.results.filter(function (r) { return r.status === "ok"; }).length, total = G.q.length;
  record(); beep("win");
  if (G.mode === "comp") {
    var name = normName(G.opt.name), code = G.opt.code, ver = verCode(name, code, G.score, correct, secs);
    var att = LS.get("wd-att", {}), key = code + "|" + name; att[key] = (att[key] || 0) + 1; LS.set("wd-att", att);
    $("#ceCode").textContent = code; $("#ceName").textContent = name; $("#ceScore").textContent = G.score; $("#ceCorrect").textContent = correct + "/" + total;
    $("#ceTime").textContent = mmss(secs); $("#ceBest").innerHTML = icon("fire") + G.best; $("#ceVer").textContent = ver;
    var now = new Date(); $("#ceMeta").textContent = "ניסיון " + att[key] + " · " + now.toLocaleDateString("he-IL") + " " + now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    var line = "Word Detective | קוד " + code + " | " + name + " | " + G.score + " נק' | " + correct + "/" + total + " | " + mmss(secs) + " | אימות " + ver + " | ניסיון " + att[key];
    $("#ceLine").textContent = line; G.line = line; $("#ceReview").innerHTML = reviewHTML(G.results); $("#ceReview").hidden = true; $("#ceBd").innerHTML = bdHTML(G.bd, true);
    show("compEnd"); return;
  }
  if (G.mode === "practice") { var best = LS.get("wd-best", {}), r = correct / total; best[G.opt.sec] = Math.max(best[G.opt.sec] || 0, r); LS.set("wd-best", best); syncProgress(); }
  var fuOk = G.results.filter(function (r) { return r.fu === "ok"; }).length, fuN = G.results.filter(function (r) { return r.fu; }).length;
  $("#endTitle").textContent = G.mode === "exam" ? "סיכום המבחן" : G.mode === "forms" ? "V1 · V2 · V3 וזמנים" : G.q[0].S.name;
  $("#endSub").textContent = G.mode === "exam" ? "ציון" : "נקודות";
  $("#endScore").textContent = G.mode === "exam" ? Math.round(correct / total * 100) : G.score;
  if (G.mode === "forms") { var fOk = G.results.reduce(function (a, r) { return a + (r.forms ? r.forms.n : 0); }, 0); $("#endGrid").innerHTML = "<div><b>" + fOk + "/" + (total * 3) + "</b><small>צורות נכונות</small></div><div><b>" + correct + "/" + total + "</b><small>זמנים נכונים</small></div><div><b>" + G.best + "</b><small>רצף שיא</small></div>"; }
  else $("#endGrid").innerHTML = "<div><b>" + correct + "/" + total + "</b><small>תשובות נכונות</small></div><div><b>" + fuOk + "/" + fuN + "</b><small>שאלות המשך</small></div><div><b>" + G.best + "</b><small>רצף שיא</small></div>";
  $("#endBd").innerHTML = (G.mode === "exam" ? "<span>הציון = אחוז התשובות הנכונות</span><span>סה״כ נקודות: " + G.score + "</span><span>זמן " + mmss(secs) + "</span>" : "") + bdHTML(G.bd, false);
  $("#endReview").innerHTML = reviewHTML(G.results);
  show("end");
}
$("#againBtn").onclick = function () { startGame(G.mode, G.opt); };
$("#ceReviewBtn").onclick = function () { var r = $("#ceReview"); r.hidden = !r.hidden; };
function copyText(t) { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(function () { toast("הועתק"); }, fallback); fallback(); function fallback() { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("הועתק"); } catch (e) { toast("סמנו והעתיקו ידנית"); } ta.remove(); } }
$("#ceCopy").onclick = function () { copyText(G.line); };
$("#ceShare").onclick = function () { if (navigator.share) navigator.share({ text: G.line }).catch(function () {}); else copyText(G.line); };

/* ---------- competition ---------- */
$("#cCode").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
$("#cStart").onclick = function () {
  var name = normName($("#cName").value), code = $("#cCode").value.trim();
  if (name.length < 2) { $("#cErr").textContent = "הקלידו שם מלא"; return; }
  if (!/^\d{4}$/.test(code)) { $("#cErr").textContent = "קוד התחרות הוא 4 ספרות"; return; }
  $("#cErr").textContent = ""; LS.set("wd-me", { name: name }); startGame("comp", { name: name, code: code });
};

/* ---------- teacher ---------- */
var TK = "wd-teacher";
function tData() { return LS.get(TK, { codes: [], entries: [] }); }
function tSave(d) { LS.set(TK, d); }
function renderTeacher() {
  var d = tData(), codes = d.codes.concat(d.entries.map(function (e) { return e.code; })).filter(function (c, i, a) { return a.indexOf(c) === i; });
  $("#tCode").textContent = d.cur || "----";
  $("#tFilter").innerHTML = codes.length ? codes.map(function (c) { return "<option" + (c === d.cur ? " selected" : "") + ">" + c + "</option>"; }).join("") : "<option value=\"\">אין עדיין</option>";
  renderBoard();
}
function renderBoard() {
  var d = tData(), code = $("#tFilter").value, list = d.entries.filter(function (e) { return e.code === code; });
  var bestBy = {}; list.forEach(function (e) { var k = normName(e.name).toLowerCase(); if (!bestBy[k] || e.score > bestBy[k].score) bestBy[k] = e; });
  var rows = Object.keys(bestBy).map(function (k) { return bestBy[k]; }).sort(function (a, b) { return b.score - a.score || a.secs - b.secs; });
  $("#tBoard").innerHTML = rows.length ? '<table class="board"><tr><th>#</th><th>שם</th><th>נק׳</th><th>נכונות</th><th>זמן</th><th>אימות</th></tr>' + rows.map(function (e, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(e.name) + '</td><td class="n">' + e.score + '</td><td class="n">' + e.correct + '</td><td class="n">' + mmss(e.secs) + '</td><td class="n" style="color:' + (e.ok ? "var(--ok)" : "var(--no)") + ';font-weight:800">' + (e.ok ? "V" : "X") + "</td></tr>"; }).join("") + "</table>" : '<p class="muted">אין עדיין תוצאות לקוד הזה.</p>';
}
$("#tFilter").onchange = renderBoard;
$("#tGen").onclick = function () { var d = tData(), c = String(1000 + Math.floor(Math.random() * 9000)); d.cur = c; if (d.codes.indexOf(c) < 0) d.codes.push(c); tSave(d); $("#tQList").hidden = true; renderTeacher(); };
$("#tShowQ").onclick = function () {
  var d = tData(), el = $("#tQList"); if (!d.cur) { toast("קודם יוצרים קוד"); return; }
  if (!el.hidden) { el.hidden = true; return; }
  el.innerHTML = compQueue(d.cur).map(function (it, i) { return '<div class="ritem"><b>' + (i + 1) + ".</b> " + '<div class="sent" style="font-size:17px">' + sentHTML(it, it.t === "type" || it.t === "mc" ? answerText(it) : null) + "</div><div>תשובה: " + answerHTML(it) + "</div></div>"; }).join(""); el.hidden = false;
};
function addEntry(e) { var d = tData(); e.ok = verCode(e.name, e.code, e.score, e.correct, e.secs) === e.ver; d.entries.push(e); if (d.codes.indexOf(e.code) < 0) d.codes.push(e.code); tSave(d); return e; }
function parseLines(txt) {
  var out = [], re = /קוד\s*(\d{4})\s*\|\s*([^|]+?)\s*\|\s*(\d+)\s*נק\S*\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\|\s*(\d+):(\d{2})\s*\|\s*אימות\s*([A-Z0-9]{5})/g, m;
  while ((m = re.exec(txt))) out.push({ code: m[1], name: normName(m[2]), score: +m[3], correct: +m[4], secs: (+m[6]) * 60 + (+m[7]), ver: m[8] });
  return out;
}
$("#tAdd").onclick = function () { var L = parseLines($("#tPaste").value); if (!L.length) { $("#tErr").textContent = "לא נמצאו שורות תוצאה. הדביקו את השורה כמו שהיא."; return; } $("#tErr").textContent = ""; L.forEach(addEntry); $("#tPaste").value = ""; var d = tData(); d.cur = L[0].code; tSave(d); toast("נוספו " + L.length + " תוצאות"); renderTeacher(); };
$("#mAdd").onclick = function () {
  var t = ($("#mTime").value || "").match(/(\d+):(\d{2})/), e = { name: normName($("#mName").value), code: $("#mCode").value.trim(), score: +$("#mScore").value, correct: +$("#mCorrect").value, secs: t ? (+t[1]) * 60 + (+t[2]) : 0, ver: ($("#mVer").value || "").trim().toUpperCase() };
  if (!e.name || !/^\d{4}$/.test(e.code) || !t) { $("#tErr").textContent = "חסר שם, קוד של 4 ספרות או זמן בפורמט 04:12"; return; }
  $("#tErr").textContent = ""; addEntry(e); var d = tData(); d.cur = e.code; tSave(d); renderTeacher();
};
$("#tClear").onclick = function () { var code = $("#tFilter").value; if (!code || !confirm("למחוק את כל התוצאות של קוד " + code + "?")) return; var d = tData(); d.entries = d.entries.filter(function (e) { return e.code !== code; }); tSave(d); renderTeacher(); };

/* ---------- reference page (דף עזר) ---------- */
function refHTML() {
  var P = WD.POS, h = "", nav = [];
  function sec(id, title, body) { nav.push([id, title]); h += '<section id="ref-' + id + '"><h2>' + title + "</h2>" + body + "</section>"; }
  sec("pos", "חלקי הדיבר <span class=\"en\">Parts of Speech</span>", '<table class="rtable"><tr><th>חלק דיבר</th><th>עברית</th><th>מה התפקיד?</th><th>דוגמאות</th></tr>' + WD.POS8.map(function (k) { return '<tr><td class="e">' + P[k].en + "</td><td>" + P[k].he + "</td><td>" + P[k].d + '</td><td class="e">' + P[k].ex + "</td></tr>"; }).join("") + "</table><p class=\"muted\">מילות תוכן: Noun, Verb, Adjective, Adverb. מילות תפקוד: Pronoun, Preposition, Conjunction, Determiner.</p>");
  var groups = { noun: [], adj: [], verb: [], adv: [] }; Object.keys(WD.SUF).forEach(function (s) { groups[WD.SUF[s]].push(s); });
  var sufEx = { noun: "decision, movement, kindness, ability, difference, teacher, musician", adj: "helpful, careless, dangerous, creative, comfortable, possible, national, scientific", verb: "organize, simplify, widen, create", adv: "quickly, carefully, happily, seriously" };
  sec("suf", "סיומות <span class=\"en\">Suffixes</span>", '<table class="rtable"><tr><th>חלק דיבר</th><th>סיומות</th><th>דוגמאות</th></tr>' + ["noun", "adj", "verb", "adv"].map(function (k) { return "<tr><td>" + P[k].en + " · " + P[k].he + '</td><td class="e">' + groups[k].join(", ") + '</td><td class="e">' + sufEx[k] + "</td></tr>"; }).join("") + "</table><p class=\"muted\">זהירות: lovely, friendly, lonely הן adjectives. fast, hard, well הם adverbs בלי ly.</p>");
  sec("fam", "משפחות מילים <span class=\"en\">Word Families</span>", '<table class="rtable"><tr><th>Noun</th><th>Verb</th><th>Adjective</th><th>Adverb</th></tr>' + [["success", "succeed", "successful", "successfully"], ["decision", "decide", "decisive", "decisively"], ["care", "care", "careful", "carefully"], ["difference", "differ", "different", "differently"], ["strength", "strengthen", "strong", "strongly"], ["danger", "endanger", "dangerous", "dangerously"], ["happiness", "–", "happy", "happily"], ["creation", "create", "creative", "creatively"], ["beauty", "beautify", "beautiful", "beautifully"], ["confidence", "–", "confident", "confidently"]].map(function (r) { return "<tr>" + r.map(function (c) { return '<td class="e">' + c + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>" +
    '<p><b>איך בוחרים?</b> the / a / my ___ ← noun · will / can / to ___ ← verb · be / very ___ או לפני שם עצם ← adjective · מתאר פועל ← adverb.<br><b>-ed / -ing:</b> I am <b class="en">bored</b> (איך אני מרגיש) · The film is <b class="en">boring</b> (מה גורם לזה).</p>');
  sec("pfx", "תחיליות <span class=\"en\">Prefixes</span>", '<table class="rtable"><tr><th>תחילית</th><th>משמעות</th><th>דוגמאות</th></tr>' + [["un-", "לא / ההפך", "unhappy, unfair, unlock"], ["in-", "לא", "incorrect, independent"], ["im-", "לא (לפני p, m)", "impossible, impatient, immature"], ["il-", "לא (לפני l)", "illegal, illegible"], ["ir-", "לא (לפני r)", "irregular, irresponsible"], ["dis-", "לא / ההפך", "disagree, dishonest, dislike"], ["re-", "שוב / מחדש", "restart, rebuild, rewrite"], ["mis-", "בטעות / לא נכון", "misunderstand, misread, misspell"], ["over-", "יותר מדי", "overcook, oversleep, overeat"], ["pre-", "לפני", "preview, prehistoric"]].map(function (r) { return '<tr><td class="e">' + r[0] + "</td><td>" + r[1] + '</td><td class="e">' + r[2] + "</td></tr>"; }).join("") + "</table>");
  var ex = { ps: "She plays tennis every Friday.", pp: "Look! It is raining.", pas: "We visited Eilat last summer.", fut: "I will call you tomorrow.", pap: "I was sleeping when you called.", prp: "They have lived here since 2015.", gt: "Look at the clouds! It is going to rain.", ppf: "The train had left before we arrived." };
  sec("tense", "זמנים <span class=\"en\">Tenses</span>", '<table class="rtable"><tr><th>זמן</th><th>עברית</th><th>מבנה</th><th>מילות סימן</th><th>דוגמה</th></tr>' + WD.TENSE_ORDER.map(function (k) { var T = WD.TENSE[k]; return '<tr><td class="e">' + T.en + "</td><td>" + T.he + '</td><td class="e">' + T.b + '</td><td class="e">' + T.sig + '</td><td class="e">' + ex[k] + "</td></tr>"; }).join("") + "</table>");
  sec("passive", "סביל <span class=\"en\">Passive</span>", '<table class="rtable"><tr><th>זמן</th><th>מבנה</th><th>דוגמה</th></tr>' + [["Present Simple", "am / is / are + V3", "English is spoken here."], ["Past Simple", "was / were + V3", "The house was built in 1920."], ["Future", "will be + V3", "A new school will be built."], ["Present Perfect", "have / has been + V3", "The work has been finished."], ["Modal", "must / can / should be + V3", "The homework must be finished."]].map(function (r) { return '<tr><td class="e">' + r[0] + '</td><td class="e">' + r[1] + '</td><td class="e">' + r[2] + "</td></tr>"; }).join("") + '</table><p class="muted">בסביל הנושא לא עושה את הפעולה – הפעולה נעשית עליו. מי שעשה מופיע אחרי <b class="en">by</b>.</p>');
  sec("cond", "משפטי תנאי <span class=\"en\">Conditionals</span>", '<table class="rtable"><tr><th>סוג</th><th>מתי?</th><th>מבנה</th><th>דוגמה</th></tr>' + [["Zero", "עובדה שתמיד נכונה", "If + V1, V1", "If you heat ice, it melts."], ["First", "אפשרי בעתיד", "If + V1, will + V1", "If it rains, we will stay home."], ["Second", "דמיוני בהווה", "If + V2, would + V1", "If I had money, I would travel."], ["Third", "דמיוני בעבר (כבר מאוחר)", "If + had V3, would have + V3", "If she had studied, she would have passed."]].map(function (r) { return '<tr><td class="e">' + r[0] + "</td><td>" + r[1] + '</td><td class="e">' + r[2] + '</td><td class="e">' + r[3] + "</td></tr>"; }).join("") + '</table><p class="muted"><b class="en">unless</b> = if not · <b class="en">If I were you</b> = תנאי 2.</p>');
  sec("irreg", "פעלים חריגים <span class=\"en\">Irregular Verbs</span>", '<table class="rtable irr"><tr><th>V1 base</th><th>V2 past</th><th>V3 past participle</th></tr>' + WD.IRREG.map(function (r) { return '<tr><td class="e">' + r[0] + '</td><td class="e">' + r[1] + '</td><td class="e">' + r[2] + "</td></tr>"; }).join("") + "</table>");
  return { nav: nav, body: h };
}
function openRef(key) {
  var m = $("#refModal");
  if (!m.dataset.r) { var R = refHTML(); $("#refBody").innerHTML = ltrRuns(R.body); $("#refNav").innerHTML = R.nav.map(function (n) { return '<button class="chip" data-ref="' + n[0] + '">' + n[1].replace(/<span.*?<\/span>/, "") + "</button>"; }).join(""); $$("#refNav .chip").forEach(function (b) { b.onclick = function () { var t = $("#ref-" + b.dataset.ref); $("#refBody").scrollTop = t.offsetTop - $("#refBody").offsetTop - 6; }; }); m.dataset.r = 1; }
  $$("#refBody table.rtable").forEach(function (tb) { var hs = Array.prototype.map.call(tb.querySelectorAll("th"), function (th) { return th.textContent; }); Array.prototype.forEach.call(tb.querySelectorAll("tr"), function (tr) { Array.prototype.forEach.call(tr.querySelectorAll("td"), function (td, i) { if (hs[i]) td.setAttribute("data-l", hs[i]); if (td.classList.contains("e")) td.innerHTML = '<span class="en">' + td.innerHTML + "</span>"; }); }); });
  m.classList.add("on"); if (key) { var t = $("#ref-" + key); if (t) $("#refBody").scrollTop = t.offsetTop - $("#refBody").offsetTop; }
}
function closeRef() { $("#refModal").classList.remove("on"); }
$("#refClose").onclick = closeRef;

/* ---------- Englishia account ---------- */
function accountName() { try { var u = window.EnglishiaAuth && EnglishiaAuth.user; return u ? (u.displayName || u.username || "") : ""; } catch (e) { return ""; } }
function syncProgress() { try { if (window.EnglishiaAuth && EnglishiaAuth.user) EnglishiaAuth.saveProgressSoon ? EnglishiaAuth.saveProgressSoon(GAME_ID, { best: LS.get("wd-best", {}) }) : EnglishiaAuth.saveProgress(GAME_ID, { best: LS.get("wd-best", {}) }); } catch (e) {} }
function onAuth() {
  try {
    EnglishiaAuth.ready().then(function (u) {
      if (!u) return; return EnglishiaAuth.loadProgress(GAME_ID).then(function (d) {
        if (!d || !d.best) return; var b = LS.get("wd-best", {}); Object.keys(d.best).forEach(function (k) { b[k] = Math.max(b[k] || 0, +d.best[k] || 0); }); LS.set("wd-best", b); if (cur.screen === "sections") renderSections();
      });
    }).catch(function () {});
  } catch (e) {}
}

/* ---------- init ---------- */
paintIcons(); paintSound(); renderHome();
window.WDApp = { $: $, $$: $$, esc: esc, LS: LS, icon: icon, paintIcons: paintIcons, beep: beep, toast: toast, show: show, HOOKS: HOOKS, cur: cur,
  ITEMS: ITEMS, EXAM_ITEMS: EXAM_ITEMS, itemById: itemById, sentHTML: sentHTML, promptOf: promptOf, renderAnswer: renderAnswer, markOpts: markOpts, evaluate: evaluate, explain: explain, answerHTML: answerHTML, answerText: answerText,
  shuffle: shuffle, mixed: mixed, normName: normName, accountName: accountName, onAuth: onAuth, GAME_ID: GAME_ID,
  setGame: function (g) { G = g; }, get G() { return G; }, compQueue: compQueue, verCode: verCode, parseLines: parseLines, followUp: followUp, startGame: startGame, openRef: openRef, level: level, setLevel: setLevel };
})();
