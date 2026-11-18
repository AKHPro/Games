/* Courier screens + shared list screens (orders, earnings) + wallet + profile. */
import { db } from './data.js';
import { PRICING, CATEGORIES, VEHICLE_LABEL, SIM, APP } from './config.js';
import { quote, fmtMoney, weightTier } from './pricing.js';
import { route as osrmRoute, offsetPoint, haversineKm } from './geo.js';
import { etaMinutes } from './sim.js';
import * as M from './map.js';
import { S, STATUS_LABEL, newOrderId, applyEvent, courierPosition, isActive, simplify } from './orders.js';
import { esc, num, ico, avatar, $, clock, dateShort, fmtKm, logoLockup, toast, confirmSheet, openSheet } from './ui.js';
import { ctx, go, ensurePosition, newDraft } from './ctx.js';

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const earningsToday = () => db.snapshot().courier.earnings.filter((e) => e.at >= startOfDay()).reduce((a, e) => a + e.amount, 0);
const myJobs = () => db.snapshot().orders.filter((o) => o.courier.type === 'me');

/* ---------------------------------------------------------------- COURIER HOME */
export function courierScreen(root) {
  root.innerHTML = `<section class="scr mapscr courier" style="--attr-top:78px">
    <div id="map" class="map"></div>
    <div class="float-top between"><div class="earn-chip"><div class="k">הרווחים היום</div><div class="v" id="earn"></div></div>
      <button class="online-toggle" id="tog" role="switch" aria-checked="false"><span class="toggle"></span><span id="togl"></span></button></div>
    <div class="dock" id="dock"></div></section>`;
  const startPos = ctx.pos || { lat: 32.7996, lng: 34.9876 };
  const map = M.createMap($('#map', root), { center: startPos, zoom: 15, attribCorner: 'topleft' });
  let dead = false, you = null, layers = [], demo = null, demoTimer = null, lastKey = '', fitKey = '', tickIv;
  let pos = db.snapshot().courier.pos || startPos;

  ensurePosition().then((p) => { if (dead) return; pos = { lat: p.lat, lng: p.lng }; db.saveCourier({ pos }); if (!you) draw(); else you.setLatLng([pos.lat, pos.lng]); if (!activeOrder() && !requestOrder() && !demo) map.setView([pos.lat, pos.lng], 15); });

  const activeOrder = () => myJobs().find((o) => [S.ACCEPTED, S.TO_PICKUP, S.PICKED_UP].includes(o.status));
  const requestOrder = () => myJobs().find((o) => o.status === S.PENDING);

  function scheduleDemo() {
    clearTimeout(demoTimer);
    const c = db.snapshot().courier;
    if (!c.online || demo || activeOrder() || requestOrder()) return;
    demoTimer = setTimeout(makeDemoRequest, SIM.demoRequestDelayMs);
  }
  async function makeDemoRequest() {
    if (dead) return;
    const c = db.snapshot().courier;
    if (!c.online || demo || activeOrder() || requestOrder()) return;
    const pickup0 = offsetPoint(pos, 0.5 + Math.random() * 0.7, Math.random() * 6.28);
    const drop0 = offsetPoint(pickup0, 1.5 + Math.random() * 2.5, Math.random() * 6.28);
    const pickup = { ...pickup0, label: 'איסוף לדוגמה', sub: 'נתוני דוגמה' };
    const dropoff = { ...drop0, label: 'יעד לדוגמה', sub: 'נתוני דוגמה' };
    const r = await osrmRoute(pickup, dropoff);
    const tier = PRICING.weightTiers[Math.floor(Math.random() * 3)];
    const cat = CATEGORIES[Math.floor(Math.random() * 4)];
    const q = quote({ distanceKm: r.km, weightId: tier.id });
    if (dead || !db.snapshot().courier.online || demo) return;
    demo = { id: 'demo', pickup, dropoff, category: cat.id, weightId: tier.id, route: { km: r.km, minutes: r.minutes, source: r.source, coords: simplify(r.coords) }, q, expiresAt: Date.now() + SIM.demoRequestTtlSec * 1000, ttl: SIM.demoRequestTtlSec };
    draw();
  }
  async function acceptDemo() {
    const now = Date.now(), d = demo; demo = null;
    const toPickKm = haversineKm(pos, d.pickup);
    const o = {
      id: newOrderId(), createdAt: now, status: S.PENDING, timeline: [{ status: S.PENDING, at: now }],
      customer: { type: 'demo' }, pickup: d.pickup, dropoff: d.dropoff, category: d.category, weightId: d.weightId, desc: '',
      quote: { total: d.q.total, lines: d.q.lines.map((l) => ({ key: l.key, amount: l.amount })), courierPay: d.q.courierPay },
      route: d.route, courier: { type: 'me', id: 'me', name: 'אתה', avatar: 'noa', vehicle: 'motorbike', rating: null, start: pos, etaMin: etaMinutes(toPickKm, 'motorbike') },
      payment: { method: 'demo', ref: 'DEMO', test: true, charged: 0 }, expiresAt: null, leg: null, messages: [], rating: null,
    };
    await db.createOrder(o);
    await applyEvent(o.id, 'ACCEPT');
  }

  function clearLayers() { layers.forEach((l) => l.remove()); layers = []; }
  function draw() {
    if (dead) return;
    const online = db.snapshot().courier.online;
    const act = activeOrder(), req = requestOrder();
    const job = act || req || demo;
    const key = [online, job && job.id, job && job.status, !!demo].join('|');
    if (key !== fitKey) {
      fitKey = key; clearLayers();
      if (job) {
        layers.push(M.routeLine(map, job.route.coords));
        layers.push(M.pickupMarker(map, job.pickup, ''), M.dropoffMarker(map, job.dropoff, ''));
        requestAnimationFrame(() => M.fit(map, [pos, job.pickup, job.dropoff], { top: 110, bottom: $('#dock', root).offsetHeight + 30 }));
      }
    }
    if (!you) you = M.youMarker(map, pos);
    if (act) { const p = courierPosition(act); you.setLatLng([p.lat, p.lng]); }
    paintDock(online, act, req);
    const tog = $('#tog', root);
    tog.className = 'online-toggle' + (online ? '' : ' off');
    tog.setAttribute('aria-checked', online);
    $('#togl', root).textContent = online ? 'מקוון' : 'לא מקוון';
    $('#earn', root).textContent = fmtMoney(earningsToday());
  }

  const timerRing = (secLeft, ttl) => {
    const C = 2 * Math.PI * 21, off = C * (1 - Math.max(0, secLeft) / ttl);
    return `<span class="req-timer"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" fill="none" stroke="#FFE6E0" stroke-width="5"/><circle cx="24" cy="24" r="21" fill="none" stroke="#FF4D28" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg><span class="t">0:${String(Math.max(0, Math.ceil(secLeft))).padStart(2, '0')}</span></span>`;
  };
  const routeCard = (j) => `<div class="card route static flat"><span class="route-line"></span>
      <div class="route-row"><span class="route-ic"><span class="dot-pick"></span></span><span class="route-txt"><span class="lab">איסוף</span><span class="addr">${esc(j.pickup.label)}</span><span class="addr-sub">${esc(j.pickup.sub || '')}</span></span></div>
      <div class="route-row"><span class="route-ic">${ico('pin-fill', 16, 'class="dot-drop"')}</span><span class="route-txt"><span class="lab">יעד</span><span class="addr">${esc(j.dropoff.label)}</span><span class="addr-sub">${esc(j.dropoff.sub || '')}</span></span></div></div>`;

  function paintDock(online, act, req) {
    const dock = $('#dock', root);
    let html;
    if (!online) html = `<div class="request idle"><h2 class="sheet-h">אתה לא מקוון</h2><p class="sheet-sub">עבור למצב מקוון כדי לקבל בקשות משלוח באזור שלך.</p><button class="btn btn-success" data-act="online">עבור למצב מקוון</button></div>`;
    else if (act) {
      const nextBtn = { accepted: ['START', 'התחל נסיעה לאיסוף'], to_pickup: ['PICKED_UP', 'אספתי את החבילה'], picked_up: ['DELIVER', 'נמסר ליעד'] }[act.status];
      const lbl = { accepted: 'המשלוח אושר', to_pickup: 'בדרך לאיסוף', picked_up: 'בדרך ליעד' }[act.status];
      const dest = act.status === S.PICKED_UP ? act.dropoff : act.pickup;
      html = `<div class="request"><div class="req-top"><div><div class="req-k">משלוח פעיל ${esc(act.id)}</div><div class="req-status">${lbl}</div></div><div class="req-pay-wrap"><div class="req-pay">${fmtMoney(act.quote.courierPay)}</div><div class="req-pay-k">הרווח שלך</div></div></div>
        ${routeCard(act)}
        <div class="tags"><span class="tag">${esc(CATEGORIES.find((c) => c.id === act.category).label)} · ${num(weightTier(act.weightId).label)} ק״ג</span>${act.customer.type === 'demo' ? '<span class="tag">נתוני דוגמה</span>' : '<span class="tag">הלקוח: אתה (בדיקה)</span>'}</div>
        <a class="link-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}">פתח ניווט במפות</a>
        <button class="btn btn-success" data-ev="${nextBtn[0]}" data-oid="${act.id}">${nextBtn[1]}</button></div>`;
    } else if (req || demo) {
      const j = req || demo, secLeft = Math.max(0, (j.expiresAt - Date.now()) / 1000), ttl = req ? SIM.myOrderTtlSec : demo.ttl;
      const toPickKm = haversineKm(pos, j.pickup), q = req ? req.quote : demo.q;
      const totalMin = etaMinutes(toPickKm, 'motorbike') + Math.round(j.route.minutes);
      html = `<div class="request"><div class="req-top">${timerRing(ttl, ttl)}<div class="req-pay-wrap end"><div class="req-new">בקשת משלוח חדשה</div><div class="req-pay">${fmtMoney(q.courierPay)}</div><div class="req-pay-k">הרווח שלך למשלוח זה</div></div></div>
        <div class="req-stats"><div class="stat"><div class="v">${fmtKm(toPickKm)} ק״מ</div><div class="k">ממך לאיסוף</div></div><div class="stat"><div class="v">${fmtKm(j.route.km)} ק״מ</div><div class="k">מסלול מלא</div></div><div class="stat"><div class="v">~${totalMin} דק׳</div><div class="k">זמן משוער</div></div></div>
        ${routeCard(j)}
        <div class="tags"><span class="tag">${esc(CATEGORIES.find((c) => c.id === j.category).label)} · ${num(weightTier(j.weightId).label)} ק״ג</span>${req ? '<span class="tag">הזמנה מצד הלקוח (אתה)</span>' : '<span class="tag">נתוני דוגמה</span>'}</div>
        <div class="req-actions"><button class="btn btn-success" data-act="accept">קבל משלוח</button><button class="btn btn-danger-ghost" data-act="decline">דחה</button></div></div>`;
    } else html = `<div class="request idle"><div class="pulse"><i></i><i></i></div><h2 class="sheet-h">מחפש משלוחים באזור שלך…</h2><p class="sheet-sub">בקשת דוגמה תגיע בעוד כמה שניות. אפשר גם <button class="inline-link" data-act="newdemo">ליצור בקשת דוגמה עכשיו</button>.</p></div>`;
    if (html !== lastKey) { dock.innerHTML = html; lastKey = html; }
    const j2 = req || demo;
    if (online && !act && j2) {
      const ttl2 = req ? SIM.myOrderTtlSec : demo.ttl, left = Math.max(0, (j2.expiresAt - Date.now()) / 1000);
      const C = 2 * Math.PI * 21, circ = dock.querySelectorAll('.req-timer circle')[1], t = dock.querySelector('.req-timer .t');
      if (circ) circ.setAttribute('stroke-dashoffset', C * (1 - left / ttl2));
      if (t) t.textContent = left >= 60 ? Math.floor(left / 60) + ':' + String(Math.ceil(left % 60)).padStart(2, '0') : '0:' + String(Math.ceil(left)).padStart(2, '0');
    }
  }

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act],[data-ev]'); if (!a) return;
    const online = db.snapshot().courier.online;
    if (a.dataset.act === 'online') { await db.saveCourier({ online: true }); scheduleDemo(); draw(); }
    else if (a.dataset.act === 'newdemo') makeDemoRequest();
    else if (a.dataset.act === 'accept') { const r = requestOrder(); if (r) await applyEvent(r.id, 'ACCEPT'); else if (demo) await acceptDemo(); draw(); }
    else if (a.dataset.act === 'decline') {
      const r = requestOrder(); if (r) await applyEvent(r.id, 'DECLINE'); else demo = null;
      lastKey = ''; scheduleDemo(); draw();
    } else if (a.dataset.ev) {
      await applyEvent(a.dataset.oid, a.dataset.ev);
      const o = db.snapshot().orders.find((x) => x.id === a.dataset.oid);
      if (o && o.status === S.DELIVERED) { toast(`המשלוח נמסר · הרווחת ${fmtMoney(o.quote.courierPay)}`); scheduleDemo(); }
      draw();
    }
  });
  $('#tog', root).addEventListener('click', async () => {
    const online = db.snapshot().courier.online;
    if (online && activeOrder()) return toast('סיים את המשלוח הפעיל לפני שתתנתק');
    demo = null; lastKey = ''; await db.saveCourier({ online: !online }); scheduleDemo(); draw();
  });
  // the generic handler above also sees the toggle (it has no data-act) -> ignored there.

  draw(); scheduleDemo();
  tickIv = setInterval(() => {
    if (demo && Date.now() >= demo.expiresAt) { demo = null; lastKey = ''; scheduleDemo(); }
    draw();
  }, 500);
  const unsub = db.subscribe(() => draw());
  return () => { dead = true; clearInterval(tickIv); clearTimeout(demoTimer); unsub(); map.remove(); };
}

/* ---------------------------------------------------------------- ORDERS LIST (customer & courier) */
export function ordersScreen(root) {
  const role = db.snapshot().profile.role;
  const render = () => {
    const st = db.snapshot();
    const list = role === 'courier' ? st.orders.filter((o) => o.courier.type === 'me') : st.orders.filter((o) => o.customer.type === 'me');
    root.innerHTML = `<section class="scr list"><header class="header center"><h1 class="page-title">משלוחים</h1></header><div class="scroll">
      ${list.length ? list.map((o) => {
        const amount = role === 'courier' ? o.quote.courierPay : o.quote.total;
        return `<button class="card order-card" data-oid="${o.id}"><span class="oc-top"><span class="oid">${esc(o.id)}</span><span class="status s-${o.status}">${STATUS_LABEL[o.status]}</span></span>
          <span class="oc-route"><span>${esc(o.pickup.label)}</span>${ico('back', 14, 'class="flip"')}<span>${esc(o.dropoff.label)}</span></span>
          <span class="oc-bot"><span class="tiny">${dateShort(o.createdAt)}</span><b>${role === 'courier' ? 'הרווח ' : ''}${fmtMoney(amount)}</b></span></button>`;
      }).join('') : `<div class="empty-state">${ico('box', 44)}<h2>אין משלוחים עדיין</h2><p>${role === 'courier' ? 'עבור למסך הראשי, התחבר כמקוון וקבל בקשה.' : 'הזמנות שתבצע יופיעו כאן.'}</p></div>`}
    </div></section>`;
  };
  render();
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-oid]'); if (!c) return;
    if (role === 'courier') go('courier'); else go('track', c.dataset.oid);
  });
  const unsub = db.subscribe(render);
  return () => unsub();
}

/* ---------------------------------------------------------------- EARNINGS (courier) */
export function earningsScreen(root) {
  const render = () => {
    const e = db.snapshot().courier.earnings, total = e.reduce((a, x) => a + x.amount, 0);
    root.innerHTML = `<section class="scr list"><header class="header center"><h1 class="page-title">הרווחים</h1></header><div class="scroll">
      <div class="card big-stat"><div class="k">הרווחים היום</div><div class="v">${fmtMoney(earningsToday())}</div><div class="k">סה״כ מצטבר · ${fmtMoney(total)} · ${e.length} משלוחים</div></div>
      <p class="fine">מצב בדיקה · הרווחים להמחשה בלבד, ללא תשלום אמיתי. ${Math.round(PRICING.courierShare * 100)}% ממחיר ההזמנה.</p>
      ${e.slice().reverse().map((x) => `<div class="card line-card"><span><b>${esc(x.orderId)}</b><span class="tiny">${dateShort(x.at)}</span></span><b class="pos">+${fmtMoney(x.amount)}</b></div>`).join('')}
    </div></section>`;
  };
  render();
  const unsub = db.subscribe(render);
  return () => unsub();
}

/* ---------------------------------------------------------------- WALLET (customer, test) */
export function walletScreen(root) {
  const render = () => {
    const p = db.snapshot().payments;
    root.innerHTML = `<section class="scr list"><header class="header center"><h1 class="page-title">ארנק</h1></header><div class="scroll">
      <div class="test-banner">${ico('lock', 18)}<span><b>מצב בדיקה – ללא חיוב</b><small>אמצעי התשלום מדומים. בשלב הבא יחוברו Stripe / PayPal / Apple Pay / Google Pay דרך שרת.</small></span></div>
      <div class="h-section">היסטוריית תשלומי בדיקה</div>
      ${p.length ? p.map((x) => `<div class="card line-card"><span><b>${esc(x.orderId)}</b><span class="tiny">${dateShort(x.at)} · ${esc(x.method)} · ${esc(x.ref)}</span></span><span class="amt"><b>${fmtMoney(x.amount)}</b><span class="tiny">לא חויב</span></span></div>`).join('') : '<div class="empty-state"><h2>אין תשלומים עדיין</h2></div>'}
    </div></section>`;
  };
  render();
  const unsub = db.subscribe(render);
  return () => unsub();
}

/* ---------------------------------------------------------------- PROFILE / ROLE SWITCH */
export function profileScreen(root) {
  const st = db.snapshot();
  const role = st.profile.role;
  root.innerHTML = `<section class="scr list"><header class="header center"><h1 class="page-title">${role === 'courier' ? 'חשבון' : 'פרופיל'}</h1></header><div class="scroll">
    <div class="card prof"><span class="avatar-lg">${avatar('noa', 64)}</span><div class="prof-f"><label class="h-section" for="pname">שם</label><input class="input" id="pname" maxlength="30" value="${esc(st.profile.name)}"></div></div>
    <div><div class="h-section">מצב שימוש</div>
      <div class="seg two" id="roleseg" role="radiogroup"><button data-role="customer" class="${role === 'customer' ? 'on' : ''}" role="radio" aria-checked="${role === 'customer'}">לקוח · שולח חבילות</button><button data-role="courier" class="${role === 'courier' ? 'on' : ''}" role="radio" aria-checked="${role === 'courier'}">שליח · מקבל משלוחים</button></div>
      <p class="fine">בשלב הבדיקה אפשר לעבור בין התפקידים באותו מכשיר ולראות את שני צדדי ההזמנה.</p></div>
    <div class="card line-card"><span><b>מיקום</b><span class="tiny" id="locst">${ctx.pos ? (ctx.pos.ok ? 'זוהה במכשיר' : 'לא זמין · משתמש במיקום לדוגמה (חיפה)') : 'טרם נבדק'}</span></span><button class="btn-sm" id="reloc">בדוק מיקום</button></div>
    <button class="btn btn-ghost" id="reset">איפוס נתוני בדיקה</button>
    <div class="about"><div class="about-logo">${logoLockup()}</div><p>גרסה ${APP.version} · מצב בדיקה</p><p class="fine">מפה: &copy; תורמי OpenStreetMap · חיפוש כתובות: Nominatim · מסלולים: OSRM. שליחים, מחירים ותשלומים בשלב זה הם הדגמה.</p></div>
  </div></section>`;
  const name = $('#pname', root);
  name.addEventListener('change', () => db.saveProfile({ name: name.value.trim() || 'אורח' }));
  root.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-role]');
    if (r && r.dataset.role !== role) { await db.saveProfile({ name: name.value.trim() || 'אורח', role: r.dataset.role }); go(r.dataset.role === 'courier' ? 'courier' : 'home'); toast(r.dataset.role === 'courier' ? 'עברת למצב שליח' : 'עברת למצב לקוח'); }
    else if (e.target.closest('#reloc')) { $('#locst', root).textContent = 'בודק…'; const p = await ensurePosition(true); $('#locst', root).textContent = p.ok ? 'זוהה במכשיר' : 'לא זמין · משתמש במיקום לדוגמה (חיפה)'; }
    else if (e.target.closest('#reset')) { if (await confirmSheet({ title: 'לאפס את נתוני הבדיקה?', text: 'כל ההזמנות והנתונים השמורים במכשיר יימחקו.', okLabel: 'אפס', danger: true })) { await db.resetAll(); ctx.pos = null; go('home'); toast('הנתונים אופסו'); } }
  });
}

export { newDraft, openSheet };
