/* Leaflet wrapper + marker builders. Leaflet (window.L) is vendored locally. */
import { MAP } from './config.js';
import { esc, avatar } from './ui.js';

export function createMap(el, { center, zoom = 14, attribCorner = 'topleft' } = {}) {
  const L = window.L;
  const map = L.map(el, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, tap: true }).setView([center.lat, center.lng], zoom);
  L.tileLayer(MAP.tileUrl, { maxZoom: MAP.maxZoom, crossOrigin: true }).addTo(map);
  L.control.attribution({ position: attribCorner, prefix: false }).addAttribution(MAP.attribution).addTo(map);
  setTimeout(() => { if (map._mapPane) map.invalidateSize(); }, 50);
  return map;
}

const divIcon = (html, cls = '') => window.L.divIcon({ className: 'mk ' + cls, html, iconSize: [0, 0] });

export function pickupMarker(map, p, label) {
  return window.L.marker([p.lat, p.lng], { icon: divIcon(`<div class="mk-dot"></div><div class="place-label below">${label ? 'איסוף · ' + esc(label) : 'איסוף'}</div>`), interactive: false, zIndexOffset: 100 }).addTo(map);
}
export function dropoffMarker(map, p, label) {
  return window.L.marker([p.lat, p.lng], { icon: divIcon(`<div class="mk-pin"><svg width="26" height="32" viewBox="0 0 26 32"><path d="M13 31S2 19.5 2 12.5a11 11 0 0 1 22 0C24 19.5 13 31 13 31Z" fill="#FF4D28" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.2" fill="#fff"/></svg></div><div class="place-label above">${label ? 'יעד · ' + esc(label) : 'יעד'}</div>`), interactive: false, zIndexOffset: 100 }).addTo(map);
}
export function courierIconHtml(c, eta, me) {
  return `<div class="mk-courier"><div class="eta-bubble ${me ? 'me' : ''}">${eta != null ? esc(eta) : ''}</div><div class="courier-ava">${avatar(c.avatar || 'daniel', 40)}</div></div>`;
}
export function courierMarker(map, c, eta, { me = false, onClick } = {}) {
  const m = window.L.marker([c.pos.lat, c.pos.lng], { icon: divIcon(courierIconHtml(c, eta, me)), zIndexOffset: 500, keyboard: false }).addTo(map);
  if (onClick) m.on('click', onClick);
  return m;
}
export function setCourierMarker(m, c, pos, eta, me) {
  m.setLatLng([pos.lat, pos.lng]);
  m.setIcon(divIcon(courierIconHtml(c, eta, me)));
}
export function youMarker(map, p) {
  return window.L.marker([p.lat, p.lng], { icon: divIcon('<div class="mk-you"><span></span></div>'), interactive: false, zIndexOffset: 50 }).addTo(map);
}
export function routeLine(map, coords) {
  const L = window.L, ll = coords.map((c) => [c.lat, c.lng]);
  const casing = L.polyline(ll, { color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  const line = L.polyline(ll, { color: '#FF4D28', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  return { remove() { casing.remove(); line.remove(); }, setLatLngs(c) { const l = c.map((x) => [x.lat, x.lng]); casing.setLatLngs(l); line.setLatLngs(l); }, bounds: () => line.getBounds() };
}
export function fit(map, points, { top = 100, bottom = 380, side = 40, maxZoom = 16 } = {}) {
  const L = window.L;
  if (!map._mapPane) return; // map already removed
  const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
  map.invalidateSize();
  map.fitBounds(b, { paddingTopLeft: [side, top], paddingBottomRight: [side, bottom], maxZoom, animate: false });
}
