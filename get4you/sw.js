/* Get4You service worker: offline app shell + cached map tiles. Never touches payment/search/routing APIs. */
const VERSION = 'g4y-v0.1.0';
const SHELL = `${VERSION}-shell`, TILES = `${VERSION}-tiles`;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/config.js', 'js/pricing.js', 'js/geo.js', 'js/icons.js', 'js/avatars.js', 'js/data.js', 'js/payments.js',
  'js/orders.js', 'js/sim.js', 'js/ui.js', 'js/map.js', 'js/ctx.js', 'js/screens-customer.js', 'js/screens-courier.js',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/marker-icon.png', 'vendor/images/layers.png',
  'fonts/Heebo.ttf', 'fonts/Outfit.ttf',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png', 'icons/favicon-32.png', 'icons/icon.svg',
];
const MAX_TILES = 250;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'tile.openstreetmap.org') { // tiles: cache-first, bounded
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) { c.put(req, res.clone()); trim(c); } return res; }
      catch { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return; // Nominatim, OSRM, etc: network only, never cached
  e.respondWith(
    fetch(req).then((res) => { if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone())); return res; })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
