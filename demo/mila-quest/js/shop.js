/* v12: Englishia shop + wallet.
   - Wallet is platform-wide by design: one doc wallets/{uid} for ALL games (byGame keeps per-game earnings),
     item ids are namespaced ("mq.*" = Mila Quest; another game would add "wd.*", or "en.*" for platform items).
   - Signed-in players: Firestore wallets/{uid}; every change is one "op" that the security rules validate
     (earn: rate-limited and capped; buy: price table in the rules; use: only down; equip: only owned items).
   - Guests: localStorage (per local profile).
   - Buying coins with money: NOT active. Payments.provider is null, the panel only shows "בקרוב".
     Plug-in point: Payments.provider = { name, checkout(pack, uid) } whose server (with the Admin SDK, after it
     verified the payment with Stripe/PayPal/Apple Pay) adds to wallets/{uid}.bought. Clients can never write "bought". */

export const SHOP_VERSION = 1;
export const SLOTS = ["skin", "aura", "trail", "fx"];
export const CATS = [
  { key: "skin", label: "דמויות" },
  { key: "aura", label: "הילות" },
  { key: "trail", label: "שובלים" },
  { key: "fx", label: "אפקטים" },
  { key: "cons", label: "חיזוקים" },
  { key: "coins", label: "קניית מטבעות" }
];
// prices are mirrored in firestore.rules (shopPrice) — keep both in sync
export const CATALOG = [
  { id: "mq.skin.knight", cat: "skin", name: "אביר הכסף", desc: "שריון כסוף ומבריק", price: 1200, look: { model: "heroes/boss-soldier.glb" }, color: "#c9d6e6" },
  { id: "mq.skin.storm", cat: "skin", name: "לוחם הסערה", desc: "לוחם חזק עם גלימה", price: 1400, look: { model: "heroes/boss-pirate.glb" }, color: "#d9914e" },
  { id: "mq.skin.robot", cat: "skin", name: "רובו-רץ", desc: "רובוט קטן ומהיר", price: 1600, look: { model: "mini/character-robot.glb" }, color: "#5ad0e0" },
  { id: "mq.skin.shadow", cat: "skin", name: "נינג'ת הצל", desc: "שחור מבריק עם קווי סגול", price: 1600, look: { mat: "shadow" }, color: "#4b2d7a" },
  { id: "mq.skin.crystal", cat: "skin", name: "קריסטל קרח", desc: "שקוף למחצה ונוצץ", price: 1800, look: { mat: "crystal" }, color: "#8fe3ff" },
  { id: "mq.skin.gold", cat: "skin", name: "גיבור הזהב", desc: "כולו זהב מבריק", price: 2000, look: { mat: "gold" }, color: "#ffc83d" },
  { id: "mq.skin.neon", cat: "skin", name: "ניאון", desc: "זוהר בחושך", price: 2200, look: { mat: "neon" }, color: "#ff3fd0" },

  { id: "mq.aura.gold", cat: "aura", name: "הילת זהב", desc: "אור זהוב סביב הדמות", price: 600, color: "#ffc83d" },
  { id: "mq.aura.ice", cat: "aura", name: "הילת קרח", desc: "פתיתים כחולים", price: 700, color: "#6fd8ff" },
  { id: "mq.aura.fire", cat: "aura", name: "הילת אש", desc: "גצים כתומים עולים", price: 800, color: "#ff6a1a" },
  { id: "mq.aura.galaxy", cat: "aura", name: "הילת גלקסיה", desc: "כוכבים מסתובבים", price: 1000, color: "#8a5cff" },
  { id: "mq.aura.rainbow", cat: "aura", name: "הילת קשת", desc: "כל צבעי הקשת", price: 1300, color: "#ff66cc", rainbow: true },

  { id: "mq.trail.leaf", cat: "trail", name: "שובל עלים", desc: "ירוק ורענן", price: 400, color: "#5fd35a" },
  { id: "mq.trail.ice", cat: "trail", name: "שובל קרח", desc: "פס כחול קפוא", price: 500, color: "#3ab8ff" },
  { id: "mq.trail.fire", cat: "trail", name: "שובל אש", desc: "להבות מאחוריך", price: 650, color: "#ff5a1a" },
  { id: "mq.trail.stars", cat: "trail", name: "אבק כוכבים", desc: "כוכבים נוצצים", price: 750, color: "#b89cff" },
  { id: "mq.trail.rainbow", cat: "trail", name: "שובל קשת", desc: "קשת צבעונית", price: 900, color: "#ff66cc", rainbow: true },

  { id: "mq.fx.gold", cat: "fx", name: "גשם זהב", desc: "פיצוץ זהב בתשובה נכונה", price: 250, color: "#ffc83d", style: "gold" },
  { id: "mq.fx.love", cat: "fx", name: "לבבות", desc: "לבבות עפים בתשובה נכונה", price: 300, color: "#ff5b8a", style: "love" },
  { id: "mq.fx.electric", cat: "fx", name: "ברק", desc: "ניצוצות חשמל כחולים", price: 350, color: "#4a7bff", style: "electric" },
  { id: "mq.fx.stars", cat: "fx", name: "זיקוקים", desc: "זיקוקים צבעוניים", price: 450, color: "#ff9f1a", style: "fireworks" },

  { id: "mq.cons.hint", cat: "cons", name: "רמז קסם", desc: "מוחק תשובה שגויה אחת. עובד בכל רמת קושי.", price: 40, color: "#8a5cff" },
  { id: "mq.cons.super", cat: "cons", name: "סופר ריצה", desc: "מגן לשלב אחד: הטעות הראשונה לא מורידה לב.", price: 90, color: "#2fb8ff" },
  { id: "mq.cons.life", cat: "cons", name: "גלגל הצלה", desc: "כשהלבבות נגמרים — ממשיכים עם 2 לבבות.", price: 120, color: "#ff4d4d" }
];
export const COIN_PACKS = [
  { id: "pack.s", coins: 500, label: "שקית מטבעות" },
  { id: "pack.m", coins: 1200, label: "תיבת מטבעות", bonus: "+20%" },
  { id: "pack.l", coins: 3000, label: "אוצר מטבעות", bonus: "+50%" }
];
export const itemById = (id) => CATALOG.find((i) => i.id === id) || null;

/* ---------- payments: placeholder only ---------- */
export const Payments = {
  provider: null, // future: { name: "stripe" | "paypal", checkout(pack, uid) -> Promise } (server verifies + credits "bought")
  available() { return !!(this.provider && this.provider.checkout); },
  async buyPack(pack, uid) {
    if (!this.available()) { const e = new Error("coming-soon"); e.code = "coming-soon"; throw e; }
    return this.provider.checkout(pack, uid); // the wallet updates when the server credits wallets/{uid}.bought
  }
};

/* ---------- wallet ---------- */
const EARN_MAX = 600, EARN_GAP_MS = 21000, SEED_MAX = 3000;
const emptyWallet = () => ({ v: 1, earned: 0, spent: 0, bought: 0, byGame: {}, owned: {}, cons: {}, equip: {} });
const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const listeners = [];
export const Wallet = {
  mode: "local", key: "", uid: null, gameId: "mila-quest", st: emptyWallet(), pending: 0, ready: false, cloudErr: "",
  balance() { return Math.max(0, (this.st.earned || 0) + (this.st.bought || 0) - (this.st.spent || 0) + (this.mode === "cloud" ? this.pending : 0)); },
  owns(id) { const it = itemById(id); return !!(it && it.cat !== "cons" && this.st.owned && this.st.owned[id]); },
  count(id) { return (this.st.cons && this.st.cons[id]) || 0; },
  equipped(slot) { const v = this.st.equip && this.st.equip[slot]; return v && this.owns(v) ? v : ""; },
  onChange(cb) { listeners.push(cb); },
  emit() { listeners.forEach((f) => { try { f(this); } catch (e) {} }); }
};
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function saveLocal() { if (Wallet.mode === "local") lsSet(Wallet.key, Wallet.st); else lsSet(Wallet.key + ".pending", { n: Wallet.pending, last: Wallet.lastEarn || 0 }); }

let fbp = null;
function fb() {
  if (fbp) return fbp;
  fbp = Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-firestore.js")]).then(([appM, F]) => {
    const app = appM.getApps().find((a) => a.name === "englishia");
    if (!app) throw new Error("no-app");
    return { F, db: F.getFirestore(app) };
  });
  fbp.catch(() => { fbp = null; });
  return fbp;
}
function clean(d) {
  const w = emptyWallet();
  if (!d) return w;
  ["earned", "spent", "bought"].forEach((k) => { w[k] = Math.max(0, Math.round(+d[k] || 0)); });
  ["byGame", "owned", "cons", "equip"].forEach((k) => { if (d[k] && typeof d[k] === "object") w[k] = Object.assign({}, d[k]); });
  return w;
}
/* ctx: { uid, profileId, seed (coins this player already collected before v12) } */
export async function initWallet(ctx) {
  Wallet.ready = false;
  Wallet.uid = ctx.uid || null;
  Wallet.gameId = ctx.gameId || Wallet.gameId;
  const seed = Math.max(0, Math.round(+ctx.seed || 0));
  if (Wallet.uid) {
    Wallet.key = "englishia.wallet.v1.u." + Wallet.uid;
    try {
      const { F, db } = await fb();
      const ref = F.doc(db, "wallets", Wallet.uid);
      const snap = await F.getDoc(ref);
      if (!snap.exists()) {
        const first = Math.min(seed, SEED_MAX);
        await F.setDoc(ref, { v: 1, earned: first, spent: 0, bought: 0, byGame: { [Wallet.gameId]: first }, owned: {}, cons: {}, equip: {},
          op: "init", lastItem: "", qty: 0, updatedAt: F.serverTimestamp(), earnAt: F.serverTimestamp() });
        Wallet.st = clean({ earned: first, byGame: { [Wallet.gameId]: first } });
        Wallet.lastEarn = Date.now(); // the rules allow the next 'earn' 20 s after earnAt
      } else {
        const d = snap.data();
        Wallet.st = clean(d);
        Wallet.lastEarn = d.earnAt && d.earnAt.toMillis ? d.earnAt.toMillis() : 0;
      }
      Wallet.mode = "cloud";
      const p = lsGet(Wallet.key + ".pending");
      Wallet.pending = p && p.n > 0 ? Math.round(p.n) : 0;
      Wallet.cloudErr = "";
      Wallet.ready = true;
      Wallet.emit();
      if (Wallet.pending) flushEarn();
      return Wallet;
    } catch (e) {
      console.warn("wallet: cloud unavailable, using this device", e);
      Wallet.cloudErr = String((e && e.code) || e);
    }
  }
  Wallet.mode = "local";
  Wallet.key = Wallet.uid ? "englishia.wallet.v1.u." + Wallet.uid + ".local" : "englishia.wallet.v1.p." + (ctx.profileId || "guest");
  const saved = lsGet(Wallet.key);
  Wallet.st = saved ? clean(saved) : clean({ earned: seed, byGame: { [Wallet.gameId]: seed } });
  if (!saved) saveLocal();
  Wallet.pending = 0;
  Wallet.ready = true;
  Wallet.emit();
  return Wallet;
}
async function tx(fn) {
  const { F, db } = await fb();
  const ref = F.doc(db, "wallets", Wallet.uid);
  return F.runTransaction(db, async (t) => {
    const s = await t.get(ref);
    if (!s.exists()) throw new Error("no-wallet");
    const cur = clean(s.data());
    const patch = fn(cur, F);
    t.update(ref, Object.assign({ updatedAt: F.serverTimestamp() }, patch));
    return { cur, patch };
  });
}
/* coins earned in play: local = immediately; cloud = queued and sent in chunks the rules accept */
export function earn(n) {
  n = Math.max(0, Math.round(n || 0));
  if (!n) return;
  if (Wallet.mode === "local") {
    Wallet.st.earned += n;
    Wallet.st.byGame[Wallet.gameId] = (Wallet.st.byGame[Wallet.gameId] || 0) + n;
    saveLocal(); Wallet.emit(); return;
  }
  Wallet.pending += n; saveLocal(); Wallet.emit();
}
let flushing = null, flushTimer = 0;
export function flushEarn() {
  if (Wallet.mode !== "cloud" || !Wallet.pending) return Promise.resolve();
  if (flushing) return flushing;
  const wait = (Wallet.lastEarn || 0) + EARN_GAP_MS - Date.now();
  if (wait > 0) {
    clearTimeout(flushTimer);
    return new Promise((r) => { flushTimer = setTimeout(() => { flushEarn().then(r, r); }, wait + 50); });
  }
  const d = Math.min(EARN_MAX, Wallet.pending);
  flushing = tx((cur, F) => {
    const g = Wallet.gameId;
    const byGame = Object.assign({}, cur.byGame); byGame[g] = (byGame[g] || 0) + d;
    return { earned: cur.earned + d, byGame, op: "earn", lastItem: g, qty: d, earnAt: F.serverTimestamp() };
  }).then(({ cur }) => {
    Wallet.st = Object.assign(cur, { earned: cur.earned + d, byGame: Object.assign({}, cur.byGame, { [Wallet.gameId]: (cur.byGame[Wallet.gameId] || 0) + d }) });
    Wallet.pending -= d; Wallet.lastEarn = Date.now(); saveLocal(); Wallet.emit();
  }).catch((e) => {
    console.warn("wallet earn retry later", e && e.code);
    Wallet.lastEarn = Date.now();
  }).finally(() => {
    flushing = null;
    if (Wallet.pending > 0) setTimeout(flushEarn, EARN_GAP_MS + 200);
  });
  return flushing;
}
function err(heb) { const e = new Error(heb); e.heb = heb; return e; }
export async function buy(id, qty = 1) {
  const it = itemById(id);
  if (!it) throw err("פריט לא קיים.");
  qty = it.cat === "cons" ? Math.max(1, Math.min(10, qty | 0)) : 1;
  if (it.cat !== "cons" && Wallet.owns(id)) throw err("כבר יש לכם את זה.");
  const cost = it.price * qty;
  if (Wallet.balance() < cost) throw err("אין מספיק מטבעות. אספו עוד מטבעות במשחק!");
  if (Wallet.mode === "local") {
    Wallet.st.spent += cost;
    if (it.cat === "cons") Wallet.st.cons[id] = (Wallet.st.cons[id] || 0) + qty; else Wallet.st.owned[id] = true;
    saveLocal(); Wallet.emit(); return true;
  }
  if (Wallet.pending && (Wallet.st.earned + Wallet.st.bought - Wallet.st.spent) < cost) await flushEarn();
  const { cur } = await tx((cur) => {
    if (cur.earned + cur.bought - cur.spent < cost) throw err("המטבעות עוד נשמרים בחשבון. נסו שוב בעוד כמה שניות.");
    if (it.cat === "cons") { const cons = Object.assign({}, cur.cons); cons[id] = (cons[id] || 0) + qty; return { spent: cur.spent + cost, cons, op: "buy", lastItem: id, qty }; }
    if (cur.owned[id]) throw err("כבר יש לכם את זה.");
    const owned = Object.assign({}, cur.owned); owned[id] = true;
    return { spent: cur.spent + cost, owned, op: "buy", lastItem: id, qty: 1 };
  });
  Wallet.st = cur; Wallet.st.spent += cost;
  if (it.cat === "cons") Wallet.st.cons[id] = (Wallet.st.cons[id] || 0) + qty; else Wallet.st.owned[id] = true;
  saveLocal(); Wallet.emit(); return true;
}
export async function useItem(id, qty = 1) {
  if (Wallet.count(id) < qty) return false;
  Wallet.st.cons[id] -= qty; Wallet.emit();
  if (Wallet.mode === "local") { saveLocal(); return true; }
  try {
    await tx((cur) => {
      const cons = Object.assign({}, cur.cons); cons[id] = Math.max(0, (cons[id] || 0) - qty);
      if ((cur.cons[id] || 0) < qty) throw err("אין");
      return { cons, op: "use", lastItem: id, qty };
    });
  } catch (e) { console.warn("wallet use", e); }
  return true;
}
export async function equip(slot, id) {
  if (SLOTS.indexOf(slot) < 0) return;
  if (id && !Wallet.owns(id)) throw err("קודם צריך לקנות.");
  const prev = Object.assign({}, Wallet.st.equip);
  Wallet.st.equip = Object.assign({}, Wallet.st.equip, { [slot]: id || "" });
  Wallet.emit();
  if (Wallet.mode === "local") { saveLocal(); return; }
  try {
    await tx((cur) => {
      if (id && !cur.owned[id]) throw err("קודם צריך לקנות.");
      return { equip: Object.assign({}, cur.equip, { [slot]: id || "" }), op: "equip", lastItem: id || "", qty: 0 };
    });
  } catch (e) { Wallet.st.equip = prev; Wallet.emit(); throw e; }
}

/* ---------- icons (SVG, no emoji) ---------- */
export function coinSVG(size = 22) {
  return `<svg class="mq-coin-svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="cg${size}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#ffd23d"/><stop offset="1" stop-color="#c98a06"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#cg${size})" stroke="#8a5a00" stroke-width="1.3"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#a86f00" stroke-width="1" opacity=".7"/><text x="12" y="16.4" text-anchor="middle" font-size="11.5" font-weight="900" font-family="Arial,sans-serif" fill="#7a4b00">$</text></svg>`;
}
export function itemSVG(it) {
  const c = it.color || "#ffc83d";
  const rb = it.rainbow ? `<linearGradient id="rb-${it.id}" x1="0" x2="1"><stop offset="0" stop-color="#ff4d4d"/><stop offset=".25" stop-color="#ffd23d"/><stop offset=".5" stop-color="#3ddc84"/><stop offset=".75" stop-color="#3a8bff"/><stop offset="1" stop-color="#b05cff"/></linearGradient>` : "";
  const fill = it.rainbow ? `url(#rb-${it.id})` : c;
  const body = `<circle cx="32" cy="20" r="8" fill="#f2c9a0"/><path d="M20 52c0-12 5-20 12-20s12 8 12 20z" fill="${it.cat === "skin" ? c : "#6a7a9a"}"/>`;
  let art = "";
  if (it.cat === "skin") art = `<circle cx="32" cy="34" r="27" fill="${c}" opacity=".18"/>${body}<path d="M24 18a8 8 0 0 1 16 0" fill="${c}" opacity=".9"/>`;
  else if (it.cat === "aura") art = `<circle cx="32" cy="32" r="27" fill="${fill}" opacity=".22"/><circle cx="32" cy="32" r="22" fill="none" stroke="${fill}" stroke-width="4" opacity=".8"/>${body}<ellipse cx="32" cy="55" rx="18" ry="4" fill="none" stroke="${fill}" stroke-width="3"/>`;
  else if (it.cat === "trail") art = `<path d="M6 46 C20 40 30 30 46 26" stroke="${fill}" stroke-width="9" stroke-linecap="round" fill="none" opacity=".85"/><path d="M8 52 C22 46 32 38 46 34" stroke="${fill}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".45"/><circle cx="50" cy="26" r="7" fill="#fff" stroke="${c}" stroke-width="3"/>`;
  else if (it.cat === "fx") art = `<g transform="translate(32 32)">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 -6 L3 -26 L-3 -26z" fill="${c}" transform="rotate(${a})"/>`).join("")}<circle r="9" fill="#fff" stroke="${c}" stroke-width="3"/></g>`;
  else if (it.id === "mq.cons.life") art = `<circle cx="32" cy="32" r="22" fill="none" stroke="#ff4d4d" stroke-width="11"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fff" stroke-width="11" stroke-dasharray="11.5 11.5"/><circle cx="32" cy="32" r="27.5" fill="none" stroke="#8a1a1a" stroke-width="1.5"/><circle cx="32" cy="32" r="16.5" fill="none" stroke="#8a1a1a" stroke-width="1.5"/>`;
  else if (it.id === "mq.cons.hint") art = `<path d="M14 50 L42 22" stroke="#5b3a00" stroke-width="6" stroke-linecap="round"/><path d="M44 8 l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#ffd23d" stroke="#8a5a00" stroke-width="1.5"/><circle cx="20" cy="20" r="2.5" fill="#b89cff"/><circle cx="52" cy="40" r="3" fill="#b89cff"/>`;
  else if (it.id === "mq.cons.super") art = `<path d="M32 6 L54 14 V30 C54 44 44 53 32 58 C20 53 10 44 10 30 V14z" fill="#2fb8ff" stroke="#0b5c8a" stroke-width="2.5"/><path d="M35 16 L24 34 h8 l-3 14 12-19 h-8z" fill="#fff6a0" stroke="#8a6a00" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 64 64" class="shop-art" aria-hidden="true"><defs>${rb}</defs>${art}</svg>`;
}

/* ---------- UI ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let H = {}, tab = "skin", sel = null, confirmId = null, msg = "";
export function initShop(hooks) {
  H = hooks || {};
  const root = document.getElementById("s-shop");
  if (!root) return;
  root.addEventListener("click", onClick);
  Wallet.onChange(() => { if (!root.classList.contains("hidden")) render(); });
}
export function openShop(t) {
  tab = t || tab; sel = null; confirmId = null; msg = "";
  const root = document.getElementById("s-shop");
  root.classList.remove("hidden");
  document.body.classList.add("shop-open");
  render();
}
export function closeShop() {
  const root = document.getElementById("s-shop");
  if (!root || root.classList.contains("hidden")) return;
  root.classList.add("hidden");
  document.body.classList.remove("shop-open");
  sel = null;
  if (H.preview) H.preview(null);
  if (H.onClose) H.onClose();
}
export function shopTab(t) { tab = t; sel = null; confirmId = null; msg = ""; render(); }
function card(it) {
  const own = Wallet.owns(it.id), on = Wallet.equipped(it.cat) === it.id, n = Wallet.count(it.id);
  const afford = Wallet.balance() >= it.price;
  let act;
  if (confirmId === it.id) {
    act = `<div class="shop-confirm"><span>לקנות ב-${it.price}?</span><button class="sbtn buy" data-yes="${it.id}">כן</button><button class="sbtn" data-no="1">לא</button></div>`;
  } else if (it.cat === "cons") {
    act = `<button class="sbtn buy${afford ? "" : " poor"}" data-buy="${it.id}">${coinSVG(20)} ${it.price}</button>`;
  } else if (own) {
    act = on ? `<button class="sbtn off" data-unequip="${it.cat}">הסרה</button>` : `<button class="sbtn eq" data-equip="${it.id}">ללבוש</button>`;
  } else {
    act = `<button class="sbtn buy${afford ? "" : " poor"}" data-buy="${it.id}">${coinSVG(20)} ${it.price}</button>`;
  }
  const badge = on ? `<span class="shop-badge on">בשימוש</span>` : own ? `<span class="shop-badge">שלך</span>` : it.cat === "cons" && n ? `<span class="shop-badge">יש לך ${n}</span>` : "";
  return `<div class="shop-card${sel === it.id ? " sel" : ""}${on ? " on" : ""}" data-sel="${it.id}" tabindex="0" role="button" aria-label="${esc(it.name)}">
    ${badge}<div class="shop-art-wrap" style="--c:${it.color || "#ffc83d"}">${itemSVG(it)}</div>
    <div class="shop-name">${esc(it.name)}</div><div class="shop-desc">${esc(it.desc)}</div>
    <div class="shop-act">${act}</div></div>`;
}
function coinsTab() {
  return `<div class="shop-coins">
    <p class="shop-soon-note"><b>בקרוב:</b> אפשר יהיה לקנות מטבעות, רק באישור הורים. בינתיים אוספים מטבעות במשחק: כל תשובה נכונה וכל מטבע במסלול.</p>
    <div class="shop-grid">${COIN_PACKS.map((p) => `<div class="shop-card pack soon">
      <span class="shop-badge soon">בקרוב</span>
      <div class="shop-art-wrap pack-art">${coinSVG(46)}${p.coins >= 1200 ? coinSVG(38) : ""}${p.coins >= 3000 ? coinSVG(32) : ""}</div>
      <div class="shop-name">${esc(p.label)}</div><div class="shop-desc">${p.coins.toLocaleString("he-IL")} מטבעות${p.bonus ? " · בונוס " + p.bonus : ""}</div>
      <div class="shop-act"><button class="sbtn soon" disabled aria-disabled="true">בקרוב</button></div></div>`).join("")}</div></div>`;
}
function render() {
  const root = document.getElementById("s-shop");
  if (!root) return;
  const items = CATALOG.filter((i) => i.cat === tab);
  const where = Wallet.mode === "cloud" ? "נשמר בחשבון אינגלישיה" : (Wallet.uid ? "נשמר במכשיר הזה (החשבון לא זמין כרגע)" : "נשמר במכשיר הזה · התחברו כדי לשמור בחשבון");
  root.innerHTML = `<div class="shop-panel" role="dialog" aria-label="חנות">
    <div class="shop-head">
      <h2>${shopIcon()} החנות</h2>
      <div class="shop-wallet" title="המטבעות שלך">${coinSVG(28)} <b id="shop-bal">${Wallet.balance().toLocaleString("he-IL")}</b></div>
      <button class="mq-x shop-x" data-close="1" aria-label="סגירה"></button>
    </div>
    <div class="shop-tabs" role="tablist">${CATS.map((c) => `<button role="tab" class="shop-tab${c.key === tab ? " on" : ""}" data-tab="${c.key}" aria-selected="${c.key === tab}">${esc(c.label)}</button>`).join("")}</div>
    <div class="shop-body">${tab === "coins" ? coinsTab() : `<div class="shop-grid">${items.map(card).join("")}</div>`}
      ${tab === "skin" ? `<p class="shop-note">בלי דמות מהחנות משחקים עם הגיבור שבחרתם במסך הפתיחה.</p>` : ""}
      ${tab === "cons" ? `<p class="shop-note">«סופר ריצה» מפעילים בתחילת שלב. «גלגל הצלה» מוצע כשהלבבות נגמרים. «רמז קסם» — כפתור בזמן הריצה.</p>` : ""}
    </div>
    <div class="shop-foot"><span class="shop-msg" role="status">${esc(msg)}</span><span class="shop-where">${esc(where)}</span></div>
  </div>`;
}
function shopIcon() {
  return `<svg class="mq-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16l-1.5 11h-13z" fill="#ffd43b" stroke="#5b3a00" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#5b3a00" stroke-width="1.8"/></svg>`;
}
function say(m) { msg = m; render(); }
async function onClick(e) {
  const t = e.target.closest("[data-close],[data-tab],[data-buy],[data-yes],[data-no],[data-equip],[data-unequip],[data-sel]");
  if (!t) { if (e.target.id === "s-shop") closeShop(); return; }
  const d = t.dataset;
  if (H.sfx) H.sfx();
  if (d.close) return closeShop();
  if (d.tab) return shopTab(d.tab);
  if (d.no) { confirmId = null; return render(); }
  if (d.buy) {
    const it = itemById(d.buy);
    sel = it.id; if (H.preview) H.preview(it);
    if (Wallet.balance() < it.price) return say(`חסרים ${it.price - Wallet.balance()} מטבעות. אספו עוד במשחק!`);
    confirmId = it.id; msg = ""; return render();
  }
  if (d.yes) {
    const it = itemById(d.yes);
    confirmId = null;
    try {
      say("קונים…");
      await buy(it.id, 1);
      if (it.cat !== "cons") { await equip(it.cat, it.id); if (H.onEquip) H.onEquip(); }
      if (H.bought) H.bought(it);
      say(it.cat === "cons" ? `קניתם ${it.name}! יש לכם ${Wallet.count(it.id)}.` : `${it.name} שלכם — וכבר בשימוש!`);
    } catch (x) { say((x && x.heb) || "הקנייה לא הצליחה. נסו שוב."); }
    return;
  }
  if (d.equip) {
    try { await equip(itemById(d.equip).cat, d.equip); if (H.onEquip) H.onEquip(); say("מעולה! עכשיו זה בשימוש."); } catch (x) { say((x && x.heb) || "לא הצליח."); }
    return;
  }
  if (d.unequip) {
    try { await equip(d.unequip, ""); if (H.onEquip) H.onEquip(); say("הוסר."); } catch (x) { say("לא הצליח."); }
    return;
  }
  if (d.sel) {
    const it = itemById(d.sel);
    sel = it.id; if (H.preview) H.preview(it);
    render();
  }
}
