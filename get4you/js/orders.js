/* Order state machine + local simulation engine. */
import { SIM } from './config.js';
import { db } from './data.js';
import { pointAlong, lerpPt } from './geo.js';

export const S = {
  PENDING: 'pending', ACCEPTED: 'accepted', TO_PICKUP: 'to_pickup', PICKED_UP: 'picked_up',
  DELIVERED: 'delivered', DECLINED: 'declined', EXPIRED: 'expired', CANCELLED: 'cancelled',
};
/* state -> { event: nextState } */
export const TRANSITIONS = {
  pending:   { ACCEPT: 'accepted', DECLINE: 'declined', EXPIRE: 'expired', CANCEL: 'cancelled' },
  accepted:  { START: 'to_pickup', CANCEL: 'cancelled' },
  to_pickup: { PICKED_UP: 'picked_up', CANCEL: 'cancelled' },
  picked_up: { DELIVER: 'delivered' },
};
export const STEPS = [S.ACCEPTED, S.TO_PICKUP, S.PICKED_UP, S.DELIVERED];
export const isTerminal = (s) => !TRANSITIONS[s];
export const isActive = (o) => !isTerminal(o.status);
export const canCancel = (o) => !!(TRANSITIONS[o.status] && TRANSITIONS[o.status].CANCEL);

export const STATUS_LABEL = {
  pending: 'ממתין לאישור', accepted: 'אושרה', to_pickup: 'בדרך לאיסוף', picked_up: 'בדרך ליעד',
  delivered: 'נמסרה', declined: 'נדחתה', expired: 'לא נענתה', cancelled: 'בוטלה',
};

export function nextState(status, event) {
  const n = TRANSITIONS[status] && TRANSITIONS[status][event];
  return n || null;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const legDurationMs = (minutes) => clamp((minutes * 60000) / SIM.timeScale, SIM.legMinMs, SIM.legMaxMs);

export const newOrderId = () => 'GF-' + String(Math.floor(10000 + Math.random() * 89999));

/** Apply an event to an order (persisted through the data layer). Returns the new order or null if illegal. */
export async function applyEvent(orderId, event, extra = {}) {
  const cur = await db.getOrder(orderId);
  if (!cur) return null;
  const to = nextState(cur.status, event);
  if (!to) return null;
  const now = Date.now();
  const patch = (o) => {
    const n = { ...o, status: to, timeline: [...o.timeline, { status: to, at: now }], ...extra };
    if (to === S.TO_PICKUP) {
      n.leg = { kind: 'pickup', startedAt: now, durationMs: legDurationMs(o.courier.etaMin || 3), minutes: o.courier.etaMin || 3 };
    } else if (to === S.PICKED_UP) {
      n.leg = { kind: 'route', startedAt: now, durationMs: legDurationMs(o.route.minutes), minutes: o.route.minutes };
    } else if (to === S.DELIVERED || isTerminal(to)) {
      n.leg = null;
    }
    return n;
  };
  const updated = await db.updateOrder(orderId, patch);
  await notifyStatus(updated);
  if (to === S.DELIVERED && updated.courier.type === 'me') {
    const c = db.snapshot().courier;
    await db.saveCourier({ earnings: [...c.earnings, { orderId, amount: updated.quote.courierPay, at: now }] });
  }
  return updated;
}

async function notifyStatus(o) {
  const msg = {
    accepted: `ההזמנה ${o.id} אושרה על ידי ${o.courier.name}`,
    to_pickup: `${o.courier.name} בדרך לאיסוף (${o.id})`,
    picked_up: `החבילה נאספה, בדרך ליעד (${o.id})`,
    delivered: `ההזמנה ${o.id} נמסרה`,
    declined: `${o.courier.name} דחה את ההזמנה ${o.id}`,
    expired: `ההזמנה ${o.id} לא נענתה בזמן`,
    cancelled: `ההזמנה ${o.id} בוטלה`,
  }[o.status];
  if (msg && o.customer.type === 'me') await db.addNotification({ text: msg, orderId: o.id });
}

/** Position of the courier for map rendering, derived from timestamps (survives reloads). */
export function courierPosition(o, now = Date.now()) {
  const c = o.courier;
  switch (o.status) {
    case S.PENDING: case S.ACCEPTED: case S.DECLINED: case S.EXPIRED: case S.CANCELLED:
      return c.start || o.pickup;
    case S.TO_PICKUP: {
      const t = o.leg ? clamp((now - o.leg.startedAt) / o.leg.durationMs, 0, 1) : 0;
      return lerpPt(c.start || o.pickup, o.pickup, t);
    }
    case S.PICKED_UP: {
      const t = o.leg ? clamp((now - o.leg.startedAt) / o.leg.durationMs, 0, 1) : 0;
      return pointAlong(o.route.coords, t);
    }
    case S.DELIVERED: return o.dropoff;
    default: return o.pickup;
  }
}
/** Minutes remaining on the current leg (in "real" minutes, scaled from the compressed simulation). */
export function legRemainingMin(o, now = Date.now()) {
  if (!o.leg) return 0;
  const t = clamp((now - o.leg.startedAt) / o.leg.durationMs, 0, 1);
  return o.leg.minutes * (1 - t);
}
export const legDone = (o, now = Date.now()) => !!o.leg && now - o.leg.startedAt >= o.leg.durationMs;

/** Called on a timer. Drives simulated couriers and request expiry. */
export async function tickEngine(now = Date.now()) {
  const orders = db.snapshot().orders;
  for (const o of orders) {
    if (isTerminal(o.status)) continue;
    const last = o.timeline[o.timeline.length - 1].at;
    if (o.status === S.PENDING && o.expiresAt && now >= o.expiresAt) { await applyEvent(o.id, 'EXPIRE'); continue; }
    if (o.courier.type !== 'sim') continue; // 'me' orders advance by the courier's buttons
    if (o.status === S.PENDING && now - last >= SIM.acceptDelayMs) await applyEvent(o.id, 'ACCEPT');
    else if (o.status === S.ACCEPTED && now - last >= SIM.startDelayMs) await applyEvent(o.id, 'START');
    else if (o.status === S.TO_PICKUP && legDone(o, now)) await applyEvent(o.id, 'PICKED_UP');
    else if (o.status === S.PICKED_UP && legDone(o, now)) await applyEvent(o.id, 'DELIVER');
  }
}

export function simplify(coords, max = 140) {
  if (!coords || coords.length <= max) return coords;
  const step = (coords.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.round(i * step)]);
  return out;
}

