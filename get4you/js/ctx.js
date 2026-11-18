/* Shared app context: navigation, location, order draft, route recompute. */
import { db } from './data.js';
import { PRICING, DEFAULT_CATEGORY, DEMO_ADDRESSES, GEO } from './config.js';
import { getPosition, reverseGeocode, route } from './geo.js';
import { simplify } from './orders.js';

export const ctx = { pos: null, posPromise: null };

export const go = (name, arg) => { location.hash = '#/' + name + (arg ? '/' + encodeURIComponent(arg) : ''); };

export function ensurePosition(force = false) {
  if (ctx.pos && !force) return Promise.resolve(ctx.pos);
  if (!ctx.posPromise || force) {
    ctx.posPromise = getPosition().then((p) => { ctx.pos = p; ctx.posPromise = null; return p; });
  }
  return ctx.posPromise;
}

export const newDraft = () => ({ pickup: null, dropoff: null, category: DEFAULT_CATEGORY, weightId: PRICING.defaultWeightId, desc: '', route: null, couriers: null, courierId: null });
export const getDraft = () => ({ ...newDraft(), ...(db.snapshot().draft || {}) });
export const setDraft = (p) => db.saveDraft(p);

let routeSeq = 0;
export async function recomputeRoute() {
  const d = getDraft();
  if (!d.pickup || !d.dropoff) { await setDraft({ route: null, couriers: null, courierId: null }); return; }
  const seq = ++routeSeq;
  await setDraft({ route: { pending: true }, couriers: null, courierId: null });
  const r = await route(d.pickup, d.dropoff);
  if (seq !== routeSeq) return; // a newer request superseded this one
  await setDraft({ route: { km: r.km, minutes: r.minutes, source: r.source, coords: simplify(r.coords) } });
}

export async function setPlace(kind, place) {
  await setDraft({ [kind]: place });
  await recomputeRoute();
}

/** Default pickup = my location (labelled honestly when it is only the demo fallback). */
export async function initPickup() {
  const d = getDraft();
  if (d.pickup) return;
  const p = await ensurePosition();
  if (getDraft().pickup) return;
  const place = p.ok
    ? { lat: p.lat, lng: p.lng, label: 'המיקום שלי', sub: 'זוהה במכשיר', my: true }
    : { lat: p.lat, lng: p.lng, label: GEO.fallback.label, sub: 'מיקום לדוגמה – המיקום לא זמין', my: true, fallback: true };
  await setPlace('pickup', place);
  if (p.ok) {
    const rev = await reverseGeocode(p);
    if (rev && getDraft().pickup && getDraft().pickup.my) await db.saveDraft({ pickup: { ...getDraft().pickup, label: rev.label || 'המיקום שלי', sub: rev.sub || 'זוהה במכשיר' } });
  }
}

export async function fillDemoAddresses() {
  await setDraft({ pickup: { ...DEMO_ADDRESSES.pickup, demo: true }, dropoff: { ...DEMO_ADDRESSES.dropoff, demo: true } });
  await recomputeRoute();
}
