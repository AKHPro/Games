import { db } from './data.js';
import { APP } from './config.js';
import { tickEngine } from './orders.js';
import { ico, $, $$, esc, openSheet, closeSheet, clock, toast } from './ui.js';
import { ctx, go } from './ctx.js';
import { homeScreen, mapScreen, priceScreen, payScreen, trackScreen } from './screens-customer.js';
import { courierScreen, ordersScreen, earningsScreen, walletScreen, profileScreen } from './screens-courier.js';

const routes = {
  home: { fn: homeScreen, role: 'customer', tab: 'home' },
  map: { fn: mapScreen, role: 'customer', tab: null },
  price: { fn: priceScreen, role: 'customer', tab: null },
  pay: { fn: payScreen, role: 'customer', tab: null },
  track: { fn: trackScreen, role: 'customer', tab: null },
  wallet: { fn: walletScreen, role: 'customer', tab: 'wallet' },
  courier: { fn: courierScreen, role: 'courier', tab: 'courier' },
  earnings: { fn: earningsScreen, role: 'courier', tab: 'earnings' },
  orders: { fn: ordersScreen, role: null, tab: 'orders' },
  profile: { fn: profileScreen, role: null, tab: 'profile' },
};
const TABS = {
  customer: [['home', 'בית', 'home'], ['orders', 'משלוחים', 'box'], ['wallet', 'ארנק', 'wallet'], ['profile', 'פרופיל', 'user']],
  courier: [['courier', 'ראשי', 'home'], ['orders', 'משלוחים', 'box'], ['earnings', 'הרווחים', 'earnings'], ['profile', 'חשבון', 'user']],
};

let cleanup = null;
const screenEl = document.getElementById('screen');
const tabbar = document.getElementById('tabbar');

function parseHash() {
  const m = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  return { name: m[0] || '', arg: m[1] ? decodeURIComponent(m[1]) : null };
}

function render() {
  const role = db.snapshot().profile.role;
  let { name, arg } = parseHash();
  if (!routes[name]) name = role === 'courier' ? 'courier' : 'home';
  const r = routes[name];
  if (r.role && r.role !== role) { name = role === 'courier' ? 'courier' : 'home'; history.replaceState(null, '', '#/' + name); }
  const route = routes[name];
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  closeSheet();
  const host = document.createElement('div');
  host.className = 'screen-host';
  screenEl.replaceChildren(host);
  document.getElementById('app').dataset.screen = name;
  const tabs = route.tab ? TABS[role] : null;
  tabbar.hidden = !tabs;
  document.getElementById('app').classList.toggle('with-tabs', !!tabs);
  if (tabs) {
    tabbar.innerHTML = tabs.map(([k, label, icon]) => `<button class="tab ${k === route.tab ? 'active' : ''}" data-go="${k}" aria-label="${label}" ${k === route.tab ? 'aria-current="page"' : ''}>${ico(icon, 22)}<span>${label}</span></button>`).join('');
  }
  cleanup = route.fn(host, arg) || null;
}

window.addEventListener('hashchange', render);
window.addEventListener('g4y-rerender', render);

document.getElementById('app').addEventListener('click', async (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  if (e.target.closest('[data-act="bell"]')) openNotifications();
});

function openNotifications() {
  const n = db.snapshot().notifications;
  openSheet(`<h3 class="sheet-title">התראות</h3><div class="notif">${n.length ? n.slice(0, 12).map((x) => `<div class="n-row ${x.read ? '' : 'unread'}"><span>${esc(x.text)}</span><span class="tiny">${clock(x.at)}</span></div>`).join('') : '<div class="empty">אין התראות חדשות</div>'}</div>`);
  db.markNotificationsRead();
  document.querySelectorAll('.icon-btn .badge').forEach((b) => b.remove());
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// footer version (shown on every screen's chrome, sits under the tab bar / in the app frame)
document.getElementById('ver').textContent = `Get4You v${APP.version} · מצב בדיקה`;

// simulation engine
setInterval(() => { tickEngine().catch((e) => console.error(e)); }, 500);

// PWA: service worker (only on https / localhost)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e)));
}

render();
