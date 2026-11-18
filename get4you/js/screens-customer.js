/* Customer screens: home, address picker, map, price, payment, tracking. */
import { db } from './data.js';
import { PRICING, CATEGORIES, PAYMENT_METHODS, VEHICLE_LABEL, SIM, DEMO_ADDRESSES } from './config.js';
import { quote, fmtMoney, weightTier } from './pricing.js';
import { searchAddress, haversineKm, offsetPoint } from './geo.js';
import { makeNearbyCouriers, drift, withEta } from './sim.js';
import { payments } from './payments.js';
import * as M from './map.js';
import { S, STEPS, STATUS_LABEL, newOrderId, applyEvent, courierPosition, legRemainingMin, canCancel, isActive, isTerminal } from './orders.js';
import { esc, num, ico, avatar, $, $$, clock, fmtKm, logoLockup, toast, openSheet, closeSheet, confirmSheet } from './ui.js';
import { ctx, go, getDraft, setDraft, setPlace, recomputeRoute, initPickup, fillDemoAddresses, ensurePosition } from './ctx.js';

const ellipsisAddr = (p) => (p ? p.label : '');

/* ---------------------------------------------------------------- HOME */
export function homeScreen(root) {
  const st = db.snapshot();
  const unread = st.notifications.some((n) => !n.read);
  root.innerHTML = `<section class="scr home">
    <header class="header">${logoLockup()}
      <div class="header-left">
        <button class="icon-btn" data-act="bell" aria-label="התראות">${ico('bell', 22)}${unread ? '<span class="badge"></span>' : ''}</button>
        <button class="avatar-sm" data-go="profile" aria-label="פרופיל">${avatar('noa', 40)}</button>
      </div></header>
    <div class="scroll">
      <div class="greet"><div class="h-greet">שלום, <span id="uname">${esc(st.profile.name)}</span></div><div class="h-title">לאן שולחים היום?</div></div>
      <button class="loc-pill" id="locpill" data-act="relocate"></button>
      <div class="card route" id="route"></div>
      <div><div class="h-section">קטגוריית הפריט</div><div class="cat-grid" id="cats"></div></div>
      <div><div class="h-section">משקל <span class="unit">(ק״ג)</span></div><div class="seg" id="seg"></div></div>
      <div><label class="h-section" for="desc">תיאור הפריט</label><input id="desc" class="input" type="text" maxlength="80" placeholder="למשל: מסמכים בתיק, חבילה קטנה" autocomplete="off"></div>
    </div>
    <div class="cta-wrap"><div class="est"><span class="est-k">מחיר מחושב</span><span class="est-v" id="est">—</span></div><button class="btn btn-primary" id="cta" disabled>הזמן שלי</button></div>
  </section>`;
  const desc = $('#desc', root);
  desc.value = getDraft().desc || '';
  desc.addEventListener('input', () => setDraft({ desc: desc.value }));

  function paint() {
    const d = getDraft();
    $('#cats', root).innerHTML = CATEGORIES.map((c) => `<button class="cat ${c.id === d.category ? 'on' : ''}" data-cat="${c.id}" aria-pressed="${c.id === d.category}"><span class="cat-ic">${ico(c.icon, 22)}</span><span>${c.label}</span></button>`).join('');
    $('#seg', root).innerHTML = PRICING.weightTiers.map((t) => `<button class="${t.id === d.weightId ? 'on' : ''}" data-w="${t.id}" aria-pressed="${t.id === d.weightId}">${num(t.label)}<small>ק״ג</small></button>`).join('');
    const row = (kind, label, p, ph) => `<button class="route-row" data-act="pick-${kind}" aria-label="${label}">
        <span class="route-ic">${kind === 'pickup' ? '<span class="dot-pick"></span>' : ico('pin-fill', 16, 'class="dot-drop"')}</span>
        <span class="route-txt"><span class="lab">${label}</span>${p ? `<span class="addr">${esc(p.label)}</span><span class="addr-sub">${esc(p.sub || '')}</span>` : `<span class="addr placeholder">${ph}</span><span class="addr-sub">הקש כדי לחפש כתובת</span>`}</span></button>`;
    $('#route', root).innerHTML = `<span class="route-line"></span>${row('pickup', 'איסוף', d.pickup, 'מאיפה לאסוף?')}${row('dropoff', 'יעד', d.dropoff, 'לאן שולחים?')}
      <button class="route-swap" data-act="swap" aria-label="החלף כיוון" ${d.pickup && d.dropoff ? '' : 'disabled'}>${ico('swap', 18)}</button>
      ${!d.dropoff ? '<button class="link-btn" data-act="demo-fill">מלא כתובות לדוגמה (חיפה)</button>' : ''}`;
    const pos = ctx.pos;
    const lp = $('#locpill', root);
    if (pos && pos.ok) { lp.className = 'loc-pill ok'; lp.innerHTML = `<span class="dotg"></span>המיקום שלך זוהה`; }
    else if (pos) { lp.className = 'loc-pill'; lp.innerHTML = 'נתוני דוגמה · חיפה — המיקום לא זמין (הקש לנסות שוב)'; }
    else { lp.className = 'loc-pill'; lp.innerHTML = 'מאתר מיקום…'; }

    const r = d.route, est = $('#est', root), cta = $('#cta', root);
    let ready = false;
    if (!d.pickup || !d.dropoff) est.innerHTML = '<span class="est-hint">הוסף כתובת יעד</span>';
    else if (!r || r.pending) est.innerHTML = '<span class="est-hint">מחשב מסלול…</span>';
    else {
      const q = quote({ distanceKm: r.km, weightId: d.weightId });
      if (q && q.error) est.innerHTML = '<span class="est-hint">המרחק רב מדי</span>';
      else { est.innerHTML = `<small class="est-km">${fmtKm(r.km)} ק״מ</small>${fmtMoney(q.total)}`; ready = true; }
    }
    cta.disabled = !ready;
  }
  paint();
  const unsub = db.subscribe(paint);
  initPickup().then(paint);
  ensurePosition().then(paint);

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-cat],[data-w],[data-act]'); if (!t) return;
    if (t.dataset.cat) setDraft({ category: t.dataset.cat });
    else if (t.dataset.w) setDraft({ weightId: t.dataset.w });
    else if (t.dataset.act === 'pick-pickup') openAddressPicker('pickup');
    else if (t.dataset.act === 'pick-dropoff') openAddressPicker('dropoff');
    else if (t.dataset.act === 'demo-fill') fillDemoAddresses();
    else if (t.dataset.act === 'swap') { const d = getDraft(); await setDraft({ pickup: d.dropoff, dropoff: d.pickup }); recomputeRoute(); }
    else if (t.dataset.act === 'relocate') { ctx.pos = null; paint(); await ensurePosition(true); const d = getDraft(); if (!d.pickup || d.pickup.my) { await setDraft({ pickup: null }); await initPickup(); } paint(); }
  });
  $('#cta', root).addEventListener('click', () => go('map'));
  return () => unsub();
}

/* ---------------------------------------------------------------- ADDRESS PICKER */
export function openAddressPicker(kind) {
  const title = kind === 'pickup' ? 'כתובת איסוף' : 'כתובת יעד';
  const s = openSheet(`<h3 class="sheet-title">${title}</h3>
    <form class="search-form" id="af" role="search"><input id="aq" class="input" type="search" placeholder="חפש כתובת (רחוב, מספר, עיר)" autocomplete="off" enterkeyhint="search"><button class="btn-sm" type="submit">חפש</button></form>
    <div id="ares" class="results" aria-live="polite"></div>
    <div class="results" id="aextra"></div>
    <p class="fine">החיפוש מופעל על ידי OpenStreetMap Nominatim.</p>`, { cls: 'tall' });
  const el = s.el, input = $('#aq', el), res = $('#ares', el);
  const items = [];
  const extra = [];
  if (kind === 'pickup') extra.push({ key: 'my', label: 'המיקום שלי', sub: 'השתמש במיקום הנוכחי', icon: 'nav' });
  extra.push({ key: 'demo', label: DEMO_ADDRESSES[kind].label, sub: DEMO_ADDRESSES[kind].sub + ' · כתובת לדוגמה', icon: 'pin' });
  $('#aextra', el).innerHTML = extra.map((x) => `<button class="res-row" data-extra="${x.key}"><span class="ico-soft">${ico(x.icon, 18)}</span><span><span class="addr">${esc(x.label)}</span><span class="addr-sub">${esc(x.sub)}</span></span></button>`).join('');
  let timer, ctrl, seq = 0;
  async function doSearch(q) {
    q = q.trim();
    clearTimeout(timer); ctrl && ctrl.abort();
    if (q.length < 4) { res.innerHTML = q ? '<div class="empty">הקלד לפחות 4 תווים</div>' : ''; return; }
    const my = ++seq; ctrl = new AbortController();
    res.innerHTML = '<div class="empty">מחפש…</div>';
    try {
      const near = (ctx.pos && ctx.pos.ok) ? ctx.pos : (getDraft().pickup || ctx.pos);
      const out = await searchAddress(q, { near, signal: ctrl.signal });
      if (my !== seq) return;
      items.length = 0; items.push(...out);
      res.innerHTML = out.length ? out.map((r, i) => `<button class="res-row" data-i="${i}"><span class="ico-soft">${ico('pin', 18)}</span><span><span class="addr">${esc(r.label)}</span><span class="addr-sub">${esc(r.sub)}</span></span></button>`).join('') : '<div class="empty">לא נמצאו תוצאות</div>';
    } catch (err) { if (my === seq && err.name !== 'AbortError') res.innerHTML = '<div class="empty">החיפוש לא זמין כרגע. אפשר לבחור כתובת לדוגמה.</div>'; }
  }
  $('#af', el).addEventListener('submit', (e) => { e.preventDefault(); doSearch(input.value); });
  input.addEventListener('input', () => { clearTimeout(timer); if (input.value.trim().length >= 4) timer = setTimeout(() => doSearch(input.value), 1200); });
  el.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-i]');
    const x = e.target.closest('[data-extra]');
    if (r) { const it = items[+r.dataset.i]; s.close(); await setPlace(kind, { lat: it.lat, lng: it.lng, label: it.label, sub: it.sub }); }
    else if (x && x.dataset.extra === 'demo') { s.close(); await setPlace(kind, { ...DEMO_ADDRESSES[kind], demo: true }); }
    else if (x && x.dataset.extra === 'my') { s.close(); ctx.pos = null; await setDraft({ pickup: null }); await initPickup(); }
  });
  setTimeout(() => input.focus(), 60);
}

/* ---------------------------------------------------------------- MAP (couriers nearby) */
export function mapScreen(root) {
  const d0 = getDraft();
  if (!d0.pickup || !d0.dropoff || !d0.route || d0.route.pending) { go('home'); return; }
  let d = d0;
  const courierOnline = db.snapshot().courier.online;
  let list = d.couriers && d.couriers.length ? d.couriers.filter((c) => c.type !== 'me') : makeNearbyCouriers(d.pickup);
  const meEntry = () => courierOnline ? [{ id: 'me', type: 'me', name: 'אתה (מצב שליח)', avatar: 'noa', vehicle: 'motorbike', rating: null, pos: db.snapshot().courier.pos || offsetPoint(d.pickup, 0.8, 1) }] : [];
  const all = () => withEta([...list, ...meEntry()], d.pickup);
  let selected = d.courierId && all().some((c) => c.id === d.courierId) ? d.courierId : all()[0].id;
  setDraft({ couriers: list, courierId: selected });

  root.innerHTML = `<section class="scr mapscr" style="--attr-top:64px">
    <div id="map" class="map"></div>
    <div class="float-top"><button class="search-pill" data-act="edit-drop" aria-label="שנה יעד">${ico('search', 18)}<span class="sp-txt">${esc(ellipsisAddr(d.dropoff))}</span></button><button class="icon-btn" data-go="home" aria-label="חזרה">${ico('back', 22)}</button></div>
    <div class="sheet" id="sheet"></div></section>`;
  const map = M.createMap($('#map', root), { center: d.pickup, zoom: 14 });
  M.routeLine(map, d.route.coords);
  M.pickupMarker(map, d.pickup, d.pickup.label);
  M.dropoffMarker(map, d.dropoff, d.dropoff.label);
  const markers = new Map();

  function paintSheet() {
    const cs = all();
    $('#sheet', root).innerHTML = `<div class="sheet-handle"></div>
      <div class="sheet-head"><h2 class="sheet-h">${cs.length} שליחים בקרבת מקום</h2><span class="example-pill">דוגמה</span></div>
      <div class="c-list">${cs.map((c) => `<button class="c-row ${c.id === selected ? 'sel' : ''}" data-c="${c.id}" aria-pressed="${c.id === selected}">
          <span class="c-ava">${avatar(c.avatar, 48)}</span>
          <span class="c-info"><span class="c-name">${esc(c.name)}</span><span class="c-meta">${c.rating ? `<span class="star">${c.rating.toFixed(1)}${ico('star', 13)}</span><i>·</i>` : ''}<span class="veh">${ico(c.vehicle === 'car' ? 'car' : c.vehicle === 'bike' ? 'bike' : 'motorbike', 16)}${VEHICLE_LABEL[c.vehicle]}</span></span></span>
          <span class="pill-eta">${c.etaMin} דק׳</span></button>`).join('')}</div>
      <button class="btn btn-primary" id="go">${selected === cs[0].id ? 'המשך עם השליח הקרוב' : 'המשך עם ' + esc(cs.find((c) => c.id === selected).name)}</button>`;
  }
  function paintMarkers() {
    const cs = all();
    cs.forEach((c) => {
      const eta = c.etaMin + " דק׳";
      if (markers.has(c.id)) M.setCourierMarker(markers.get(c.id), c, c.pos, eta, c.type === 'me');
      else markers.set(c.id, M.courierMarker(map, c, eta, { me: c.type === 'me', onClick: () => { selected = c.id; setDraft({ courierId: selected }); paintSheet(); } }));
    });
  }
  paintSheet(); paintMarkers();
  requestAnimationFrame(() => {
    const h = $('#sheet', root).offsetHeight;
    M.fit(map, [d.pickup, d.dropoff, ...all().map((c) => c.pos)], { top: 110, bottom: h + 30 });
  });
  const iv = setInterval(() => { list = drift(list, d.pickup); paintMarkers(); paintSheet(); }, SIM.driftMs);

  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]');
    if (c) { selected = c.dataset.c; setDraft({ courierId: selected, couriers: list }); paintSheet(); return; }
    if (e.target.closest('#go')) { setDraft({ couriers: list, courierId: selected }); go('price'); }
    else if (e.target.closest('[data-act="edit-drop"]')) openAddressPicker('dropoff');
  });
  const unsub = db.subscribe(() => {
    const nd = getDraft();
    if (nd.route && !nd.route.pending && nd.route !== d.route) window.dispatchEvent(new Event('g4y-rerender'));
  });
  return () => { clearInterval(iv); unsub(); map.remove(); };
}

/* ---------------------------------------------------------------- PRICE */
const selectedCourier = (d) => (d.couriers || []).find((c) => c.id === d.courierId) || (d.courierId === 'me' ? { id: 'me', type: 'me', name: 'אתה (מצב שליח)', avatar: 'noa', vehicle: 'motorbike', rating: null, pos: db.snapshot().courier.pos || offsetPoint(d.pickup, 0.8, 1) } : null);
function currentCourier(d) {
  if (d.courierId === 'me') { const base = selectedCourier(d); return withEta([base], d.pickup)[0]; }
  const c = (d.couriers || []).find((x) => x.id === d.courierId);
  return c ? withEta([c], d.pickup)[0] : null;
}

export function priceScreen(root) {
  const d = getDraft();
  if (!d.pickup || !d.dropoff || !d.route || d.route.pending) { go('home'); return; }
  const c = currentCourier(d);
  if (!c) { go('map'); return; }
  const q = quote({ distanceKm: d.route.km, weightId: d.weightId });
  const cat = CATEGORIES.find((x) => x.id === d.category);
  const L = Object.fromEntries(q.lines.map((l) => [l.key, l]));
  root.innerHTML = `<section class="scr price">
    <header class="header center"><h1 class="page-title">הצעת מחיר</h1><button class="icon-btn pos-end" data-go="map" aria-label="חזרה">${ico('back', 22)}</button></header>
    <div class="scroll">
      <div class="pill-row"><span class="example-pill">מחיר להמחשה · מצב בדיקה</span></div>
      <div class="total-hero"><div class="k">סה״כ לתשלום</div><div class="v">${fmtMoney(q.total, { decimals: 2 })}</div></div>
      <div class="card route static"><span class="route-line"></span>
        <div class="route-row"><span class="route-ic"><span class="dot-pick"></span></span><span class="route-txt"><span class="lab">איסוף</span><span class="addr">${esc(d.pickup.label)}${d.pickup.sub ? ', ' + esc(d.pickup.sub) : ''}</span></span></div>
        <div class="route-row"><span class="route-ic">${ico('pin-fill', 16, 'class="dot-drop"')}</span><span class="route-txt"><span class="lab">יעד</span><span class="addr">${esc(d.dropoff.label)}${d.dropoff.sub ? ', ' + esc(d.dropoff.sub) : ''}</span></span></div></div>
      <div class="card breakdown">
        <div class="bd-row"><span class="k"><span class="ico-soft">${ico('wallet', 16)}</span>דמי בסיס</span><span class="v">${fmtMoney(L.base.amount, { decimals: 2 })}</span></div>
        <div class="bd-row"><span class="k"><span class="ico-soft">${ico('route', 16)}</span>מרחק נסיעה · ${fmtKm(L.distance.km)} ק״מ</span><span class="v">${fmtMoney(L.distance.amount, { decimals: 2 })}</span></div>
        <div class="bd-row"><span class="k"><span class="ico-soft">${ico('weight', 16)}</span>תוספת משקל · ${num(L.weight.tier.label)} ק״ג</span><span class="v">${fmtMoney(L.weight.amount, { decimals: 2 })}</span></div>
        <div class="bd-row total"><span class="k">סה״כ</span><span class="v">${fmtMoney(q.total, { decimals: 2 })}</span></div></div>
      <div class="card courier-card"><span class="c-ava">${avatar(c.avatar, 44)}</span><span class="c-info"><span class="c-name">${esc(c.name)} · ${c.type === 'me' ? 'שליח במכשיר זה' : 'השליח הקרוב'}</span><span class="c-meta">${c.rating ? `<span class="star">${c.rating.toFixed(1)}${ico('star', 13)}</span><i>·</i>` : ''}<span>${VEHICLE_LABEL[c.vehicle]}</span><i>·</i><span>הגעה בעוד ${c.etaMin} דק׳</span></span></span></div>
      <p class="fine">המחיר סופי וכולל מע״מ · ללא תוספות בדרך (נתוני בדיקה)</p>
    </div>
    <div class="cta-wrap"><button class="btn btn-primary" id="topay">המשך לתשלום</button></div></section>`;
  $('#topay', root).addEventListener('click', () => go('pay'));
}

/* ---------------------------------------------------------------- PAYMENT (TEST MODE) */
const BADGE = {
  card: '<span class="pay-badge b-card">' + ico('card', 20) + '</span>',
  paypal: '<span class="pay-badge b-paypal">PayPal</span>',
  apple: '<span class="pay-badge b-apple">Apple Pay</span>',
  google: '<span class="pay-badge b-google">G Pay</span>',
};
export function payScreen(root) {
  const d = getDraft();
  if (!d.pickup || !d.dropoff || !d.route || d.route.pending) { go('home'); return; }
  const c = currentCourier(d);
  if (!c) { go('map'); return; }
  const q = quote({ distanceKm: d.route.km, weightId: d.weightId });
  let method = 'card', busy = false;
  root.innerHTML = `<section class="scr pay">
    <header class="header center"><h1 class="page-title">תשלום</h1><button class="icon-btn pos-end" data-go="price" aria-label="חזרה">${ico('back', 22)}</button></header>
    <div class="scroll">
      <div class="test-banner" role="status">${ico('lock', 18)}<span><b>מצב בדיקה – ללא חיוב</b><small>לא נאספים פרטי כרטיס ואין פנייה לשירות תשלום</small></span></div>
      <div class="total-hero small"><div class="k">לתשלום</div><div class="v">${fmtMoney(q.total, { decimals: 2 })}</div></div>
      <div class="fake-card" aria-label="כרטיס לדוגמה"><div class="row top"><span class="ck big">כרטיס אשראי · דוגמה</span><span class="chip"></span></div>
        <div class="pan">•••• •••• •••• 4242</div>
        <div class="row"><div><div class="ck">בעל הכרטיס</div><div class="cv">משתמש בדיקה</div></div><div class="ta-end"><div class="ck">תוקף</div><div class="cv">05/28</div></div></div></div>
      <div class="h-section">אמצעי תשלום</div>
      <div id="methods"></div>
      <p class="fine lockline">${ico('lock', 13)} מצב בדיקה · כל אמצעי התשלום מדומים</p>
    </div>
    <div class="cta-wrap"><button class="btn btn-primary" id="paybtn"></button></div></section>`;
  const paint = () => {
    $('#methods', root).innerHTML = PAYMENT_METHODS.map((m) => `<button class="pay-row ${m.id === method ? 'on' : ''}" data-m="${m.id}" role="radio" aria-checked="${m.id === method}">${BADGE[m.badge]}<span class="pay-txt"><span class="pay-name">${esc(m.name)}</span><span class="pay-sub">${esc(m.sub)}</span></span><span class="radio"></span></button>`).join('');
    const b = $('#paybtn', root);
    b.disabled = busy;
    b.innerHTML = busy ? '<span class="spinner"></span> מעבד (בדיקה)…' : `שלם ${fmtMoney(q.total)} (בדיקה)`;
  };
  paint();
  root.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-m]');
    if (m && !busy) { method = m.dataset.m; paint(); return; }
    if (!e.target.closest('#paybtn') || busy) return;
    busy = true; paint();
    const res = await payments.pay({ amount: q.total, method });
    const now = Date.now();
    const cc = currentCourier(getDraft());
    const order = {
      id: newOrderId(), createdAt: now, status: S.PENDING, timeline: [{ status: S.PENDING, at: now }],
      customer: { type: 'me' },
      pickup: d.pickup, dropoff: d.dropoff, category: d.category, weightId: d.weightId, desc: d.desc || '',
      quote: { total: q.total, lines: q.lines.map((l) => ({ key: l.key, amount: l.amount })), courierPay: q.courierPay },
      route: d.route,
      courier: { type: cc.type, id: cc.id, name: cc.name, avatar: cc.avatar, vehicle: cc.vehicle, rating: cc.rating, start: cc.pos, etaMin: cc.etaMin },
      payment: { method, ref: res.ref, test: true, charged: 0 },
      expiresAt: cc.type === 'me' ? now + SIM.myOrderTtlSec * 1000 : null,
      leg: null, messages: [], rating: null,
    };
    await db.createOrder(order);
    await db.addPayment({ orderId: order.id, amount: q.total, method, ref: res.ref, at: now, test: true });
    await setDraft(null);
    go('track', order.id);
  });
}

/* ---------------------------------------------------------------- TRACKING */
const STEP_LABEL = { accepted: 'אושרה', to_pickup: 'בדרך לאיסוף', picked_up: 'נאסף', delivered: 'נמסר' };
export function trackScreen(root, id) {
  const o0 = db.snapshot().orders.find((o) => o.id === id);
  if (!o0) { go('orders'); return; }
  root.innerHTML = `<section class="scr mapscr" style="--attr-top:64px">
    <div id="map" class="map"></div>
    <div class="float-top"><div class="search-pill static"><span class="sp-txt">מעקב משלוח</span><span class="oid">${esc(o0.id)}</span></div><button class="icon-btn" data-go="orders" aria-label="חזרה">${ico('back', 22)}</button></div>
    <div class="sheet" id="sheet"></div></section>`;
  const map = M.createMap($('#map', root), { center: o0.pickup, zoom: 14 });
  M.routeLine(map, o0.route.coords);
  M.pickupMarker(map, o0.pickup, o0.pickup.label);
  M.dropoffMarker(map, o0.dropoff, o0.dropoff.label);
  const cm = M.courierMarker(map, { ...o0.courier, pos: courierPosition(o0) }, null, { me: o0.courier.type === 'me' });
  let fitted = false, lastHtml = '';

  const eta = (o, now) => {
    const rem = legRemainingMin(o, now);
    if (o.status === S.TO_PICKUP) return { pick: now + rem * 60000, drop: now + (rem + o.route.minutes) * 60000, bubble: Math.max(1, Math.ceil(rem)) };
    if (o.status === S.PICKED_UP) return { drop: now + rem * 60000, bubble: Math.max(1, Math.ceil(rem)) };
    const toPick = o.courier.etaMin || 3;
    return { pick: now + toPick * 60000, drop: now + (toPick + o.route.minutes) * 60000, bubble: toPick };
  };
  function render() {
    const o = db.snapshot().orders.find((x) => x.id === id);
    if (!o) return;
    const now = Date.now(), e = eta(o, now), me = o.courier.type === 'me';
    const pos = courierPosition(o, now);
    M.setCourierMarker(cm, o.courier, pos, ['to_pickup', 'picked_up'].includes(o.status) ? e.bubble + ' דק׳' : null, me);
    if (!fitted) { fitted = true; requestAnimationFrame(() => M.fit(map, [o.pickup, o.dropoff, pos], { top: 110, bottom: $('#sheet', root).offsetHeight + 30 })); }
    const T = {
      pending: ['ממתין לאישור השליח', me ? 'עבור למצב שליח (פרופיל) ואשר את ההזמנה' : `${o.courier.name} מקבל את הבקשה…`],
      accepted: ['ההזמנה אושרה', `${o.courier.name} מתכונן לצאת לדרך`],
      to_pickup: ['השליח בדרך לאיסוף', `הגעה משוערת לאיסוף ${clock(e.pick)} · מסירה ${clock(e.drop)}`],
      picked_up: ['החבילה בדרך ליעד', `מסירה משוערת ${clock(e.drop)}`],
      delivered: ['ההזמנה נמסרה', `נמסרה ב־${clock(o.timeline[o.timeline.length - 1].at)}`],
      declined: ['השליח לא זמין', 'השליח דחה את ההזמנה. בחר שליח אחר'],
      expired: ['השליח לא ענה', 'לא התקבל אישור בזמן. בחר שליח אחר'],
      cancelled: ['ההזמנה בוטלה', 'לא בוצע חיוב (מצב בדיקה)'],
    }[o.status];
    const idx = STEPS.indexOf(o.status);
    const stepsHtml = STEPS.map((s, i) => `<div class="step ${idx > i || o.status === S.DELIVERED ? 'done' : idx === i ? 'now' : ''}"><span class="step-d">${idx > i || o.status === S.DELIVERED ? ico('check', 12, 'style="color:#fff"') : idx === i ? '<span class="now-dot"></span>' : ''}</span><span class="step-l">${STEP_LABEL[s]}</span></div>`).join('');
    const prog = idx < 0 ? 0 : Math.max(0, Math.min(1, (o.status === S.DELIVERED ? 3 : idx) / 3));
    const failed = [S.DECLINED, S.EXPIRED].includes(o.status);
    const cat = CATEGORIES.find((c) => c.id === o.category);
    const html = `<div class="sheet-handle"></div>
      <h2 class="sheet-h big">${T[0]}</h2><p class="sheet-sub">${T[1]}</p>
      ${o.status === S.CANCELLED || failed ? '' : `<div class="steps" style="--prog:${prog}"><div class="steps-bar"><i></i></div>${stepsHtml}</div>`}
      <div class="card courier-card"><span class="c-ava">${avatar(o.courier.avatar, 48)}</span><span class="c-info"><span class="c-name">${esc(o.courier.name)}${me ? '' : ' <span class="example-pill sm">דוגמה</span>'}</span><span class="c-meta">${o.courier.rating ? `<span class="star">${o.courier.rating.toFixed(1)}${ico('star', 13)}</span><i>·</i>` : ''}<span>${VEHICLE_LABEL[o.courier.vehicle]}</span><i>·</i><span>${esc(cat.label)} ${num(weightTier(o.weightId).label)} ק״ג</span></span></span></div>
      ${o.status === S.DELIVERED ? `<div class="rate"><span>דרג את המשלוח</span><span class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${(o.rating || 0) >= n ? 'on' : ''}" aria-label="${n} כוכבים">${ico('star', 30)}</button>`).join('')}</span></div>
         <button class="btn btn-primary" data-go="home">חזרה לדף הבית</button>`
      : failed ? `<button class="btn btn-primary" data-act="rechoose">בחר שליח אחר</button>`
      : o.status === S.CANCELLED ? `<button class="btn btn-primary" data-go="home">חזרה לדף הבית</button>`
      : `<div class="action-btns"><button class="btn btn-ghost" data-act="call">${ico('phone', 18)} התקשר</button><button class="btn btn-ghost" data-act="chat">${ico('chat', 18)} צ׳אט</button></div>
         ${canCancel(o) ? '<button class="link-btn danger" data-act="cancel">ביטול הזמנה</button>' : ''}`}
      <p class="fine">מצב בדיקה · ${me ? 'השליח הוא אתה (מצב שליח)' : 'השליח מדומה'} · תשלום: ${esc(o.payment.ref)} (ללא חיוב)</p>`;
    if (html !== lastHtml) { $('#sheet', root).innerHTML = html; lastHtml = html; }
  }
  render();
  const iv = setInterval(render, 500);
  const unsub = db.subscribe(render);

  root.addEventListener('click', async (ev) => {
    const o = db.snapshot().orders.find((x) => x.id === id); if (!o) return;
    const star = ev.target.closest('[data-star]');
    if (star) { await db.updateOrder(id, { rating: +star.dataset.star }); return; }
    const a = ev.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'call') toast('מצב בדיקה – אין שיחה אמיתית עם השליח');
    else if (a.dataset.act === 'chat') openChat(id);
    else if (a.dataset.act === 'cancel') { if (await confirmSheet({ title: 'לבטל את ההזמנה?', text: 'לא יבוצע חיוב (מצב בדיקה).', okLabel: 'בטל הזמנה', danger: true })) await applyEvent(id, 'CANCEL'); }
    else if (a.dataset.act === 'rechoose') {
      await setDraft({ pickup: o.pickup, dropoff: o.dropoff, category: o.category, weightId: o.weightId, desc: o.desc, route: o.route, couriers: null, courierId: null });
      go('map');
    }
  });
  return () => { clearInterval(iv); unsub(); map.remove(); closeSheet(); };
}

function openChat(id) {
  const REPLIES = ['קיבלתי, אני בדרך.', 'אין בעיה, אעדכן כשאגיע.', 'מצוין, תודה!'];
  const s = openSheet(`<h3 class="sheet-title">צ׳אט עם השליח</h3><div class="chat" id="chat" aria-live="polite"></div>
    <form class="search-form" id="cf"><input id="cq" class="input" type="text" maxlength="200" placeholder="כתוב הודעה…" autocomplete="off"><button class="btn-sm" type="submit">שלח</button></form>
    <p class="fine">מצב בדיקה · הודעות נשמרות במכשיר בלבד</p>`, { cls: 'tall' });
  const box = $('#chat', s.el);
  const paint = () => {
    const o = db.snapshot().orders.find((x) => x.id === id); if (!o) return;
    box.innerHTML = o.messages.length ? o.messages.map((m) => `<div class="msg ${m.from}">${esc(m.text)}</div>`).join('') : '<div class="empty">אין הודעות עדיין</div>';
    box.scrollTop = box.scrollHeight;
  };
  paint();
  const unsub = db.subscribe(paint);
  $('#cf', s.el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const inp = $('#cq', s.el), text = inp.value.trim(); if (!text) return;
    inp.value = '';
    await db.updateOrder(id, (o) => ({ ...o, messages: [...o.messages, { from: 'me', text, at: Date.now() }] }));
    const o = db.snapshot().orders.find((x) => x.id === id);
    if (o && o.courier.type === 'sim') setTimeout(() => db.updateOrder(id, (x) => ({ ...x, messages: [...x.messages, { from: 'them', text: REPLIES[x.messages.length % REPLIES.length], at: Date.now() }] })), 1500);
  });
  const host = document.getElementById('sheet-host'); const prev = host._close;
  host._close = () => { unsub(); prev && prev(); };
}
