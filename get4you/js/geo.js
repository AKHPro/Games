/* Geo helpers: geolocation, Nominatim search/reverse, OSRM routing (haversine fallback). */
import { GEO, SEARCH, ROUTING } from './config.js';

const R = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function offsetPoint(p, km, bearingRad) {
  const dLat = (km * Math.cos(bearingRad)) / 110.574;
  const dLng = (km * Math.sin(bearingRad)) / (111.32 * Math.cos(rad(p.lat)));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}
export const lerpPt = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

/* ---------- geolocation ---------- */
export function getPosition() {
  return new Promise((resolve) => {
    const fb = () => resolve({ ok: false, lat: GEO.fallback.lat, lng: GEO.fallback.lng, label: GEO.fallback.label });
    if (!('geolocation' in navigator)) return fb();
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; fb(); } }, GEO.timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { if (done) return; done = true; clearTimeout(timer); resolve({ ok: true, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { if (done) return; done = true; clearTimeout(timer); fb(); },
      { enableHighAccuracy: false, timeout: GEO.timeoutMs, maximumAge: GEO.maxAgeMs }
    );
  });
}

/* ---------- fetch with timeout ---------- */
async function fetchJson(url, timeoutMs, signal) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---------- Nominatim (throttled to 1 req / minIntervalMs, cached) ---------- */
let lastCall = 0, chain = Promise.resolve();
const cache = new Map();
function throttled(fn) {
  const run = chain.then(async () => {
    const wait = lastCall + SEARCH.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}
function splitDisplay(item) {
  const a = item.address || {};
  const road = a.road || a.pedestrian || a.footway || '';
  const label = road ? (road + (a.house_number ? ' ' + a.house_number : '')) : (item.name || (item.display_name || '').split(',')[0]);
  const sub = [a.neighbourhood || a.suburb, a.city || a.town || a.village || a.municipality].filter(Boolean).join(', ');
  return { label: label || item.display_name, sub: sub || (item.display_name || '').split(',').slice(1, 3).join(',').trim() };
}
export async function searchAddress(q, { near, signal } = {}) {
  q = (q || '').trim();
  if (q.length < SEARCH.minChars) return [];
  const key = 's:' + q.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({ format: 'jsonv2', q, addressdetails: '1', limit: String(SEARCH.limit), 'accept-language': SEARCH.lang });
  if (SEARCH.countrycodes) params.set('countrycodes', SEARCH.countrycodes);
  if (near) { // soft bias (not bounded) towards the user's area
    const d = 0.35; params.set('viewbox', [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(','));
  }
  const data = await throttled(() => fetchJson(`${SEARCH.endpoint}/search?${params}`, SEARCH.timeoutMs, signal));
  const out = data.map((it) => ({ lat: +it.lat, lng: +it.lon, ...splitDisplay(it) }));
  cache.set(key, out);
  return out;
}
export async function reverseGeocode(p) {
  const key = 'r:' + p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
  if (cache.has(key)) return cache.get(key);
  try {
    const params = new URLSearchParams({ format: 'jsonv2', lat: p.lat, lon: p.lng, zoom: '18', addressdetails: '1', 'accept-language': SEARCH.lang });
    const it = await throttled(() => fetchJson(`${SEARCH.endpoint}/reverse?${params}`, SEARCH.timeoutMs));
    const out = splitDisplay(it);
    cache.set(key, out);
    return out;
  } catch { return null; }
}

/* ---------- routing ---------- */
export async function route(a, b) {
  const straight = haversineKm(a, b);
  try {
    const url = `${ROUTING.osrmBase}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const j = await fetchJson(url, ROUTING.timeoutMs);
    const r = j.routes && j.routes[0];
    if (!r) throw new Error('no route');
    const coords = r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    return { km: r.distance / 1000, minutes: r.duration / 60, coords, source: 'osrm' };
  } catch {
    const km = straight * ROUTING.detourFactor;
    return { km, minutes: (km / ROUTING.fallbackSpeedKmh) * 60, coords: [a, b], source: 'haversine' };
  }
}

/* ---------- polyline helpers ---------- */
export function cumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineKm(coords[i - 1], coords[i]));
  return cum;
}
export function pointAlong(coords, t) {
  if (!coords || coords.length < 2) return coords && coords[0];
  t = Math.max(0, Math.min(1, t));
  const cum = cumulative(coords), total = cum[cum.length - 1] || 1;
  const target = t * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  return lerpPt(coords[i - 1], coords[i], (target - cum[i - 1]) / seg);
}
