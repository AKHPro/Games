/* Simulated nearby couriers (DEMO DATA - not real people). */
import { SIM, DEMO_COURIERS } from './config.js';
import { offsetPoint, haversineKm } from './geo.js';

// small deterministic PRNG so the same pickup point gives the same demo couriers
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const etaMinutes = (km, vehicle) => Math.max(2, Math.round(((km * 1.3) / SIM.speedKmh[vehicle]) * 60));

export function makeNearbyCouriers(center, n = SIM.couriersNearby) {
  const rnd = mulberry(Math.round(center.lat * 1e4) ^ Math.round(center.lng * 1e4));
  const out = [];
  const bearing0 = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const d = DEMO_COURIERS[i % DEMO_COURIERS.length];
    const km = SIM.minRadiusKm + rnd() * (SIM.maxRadiusKm - SIM.minRadiusKm);
    const pos = offsetPoint(center, km, bearing0 + (i * 2 * Math.PI) / n + rnd() * 0.8);
    out.push({ ...d, type: 'sim', pos });
  }
  return withEta(out, center);
}
export function withEta(list, center) {
  return list
    .map((c) => { const km = haversineKm(c.pos, center); return { ...c, distKm: km, etaMin: etaMinutes(km, c.vehicle) }; })
    .sort((a, b) => a.etaMin - b.etaMin || a.distKm - b.distKm);
}
/** gentle random walk so the map feels alive */
export function drift(list, center) {
  return withEta(list.map((c) => c.type === 'me' ? c : ({ ...c, pos: offsetPoint(c.pos, 0.03, Math.random() * Math.PI * 2) })), center);
}
