/* ==========================================================================
   Data layer.  The UI talks ONLY to this module's `db` object.
   Phase 1: LocalAdapter (localStorage, works offline, syncs across tabs).
   Later: write a FirebaseAdapter with the same methods (Firestore collections
   `profiles`, `couriers`, `orders`, `payments`) and swap it in `createDb()`.
   Contract:
     snapshot()                  -> current state (sync, cached)
     subscribe(fn)               -> fn(state) on every change; returns unsubscribe
     saveProfile(patch)          saveCourier(patch)         saveDraft(patch|null)
     createOrder(order)          updateOrder(id, patchOrFn) getOrder(id)
     addPayment(p)               addNotification(n)         markNotificationsRead()
     resetAll()
   All writes return Promises so a remote adapter can be dropped in.
   ========================================================================== */

const KEY = 'get4you.v1';

const initial = () => ({
  v: 1,
  profile: { role: 'customer', name: 'אורח', phone: '' },
  courier: { online: false, pos: null, earnings: [] }, // earnings: [{orderId, amount, at}]
  draft: null,
  orders: [],
  payments: [],
  notifications: [],
});

class LocalAdapter {
  constructor() {
    this.listeners = new Set();
    this.state = this._load();
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) { this.state = this._load(); this._emit(); }
    });
  }
  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...initial(), ...JSON.parse(raw) };
    } catch { /* corrupted -> reset */ }
    return initial();
  }
  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* quota */ }
    this._emit();
  }
  _emit() { this.listeners.forEach((fn) => { try { fn(this.state); } catch (e) { console.error(e); } }); }

  snapshot() { return this.state; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  async saveProfile(p) { this.state.profile = { ...this.state.profile, ...p }; this._save(); }
  async saveCourier(p) { this.state.courier = { ...this.state.courier, ...p }; this._save(); }
  async saveDraft(p) { this.state.draft = p === null ? null : { ...(this.state.draft || {}), ...p }; this._save(); }

  async createOrder(o) { this.state.orders = [o, ...this.state.orders]; this._save(); return o; }
  async updateOrder(id, patch) {
    const i = this.state.orders.findIndex((o) => o.id === id);
    if (i < 0) return null;
    const cur = this.state.orders[i];
    const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch };
    this.state.orders = this.state.orders.map((o, k) => (k === i ? next : o));
    this._save();
    return next;
  }
  async getOrder(id) { return this.state.orders.find((o) => o.id === id) || null; }

  async addPayment(p) { this.state.payments = [p, ...this.state.payments]; this._save(); }
  async addNotification(n) {
    this.state.notifications = [{ ...n, at: Date.now(), read: false }, ...this.state.notifications].slice(0, 30);
    this._save();
  }
  async markNotificationsRead() {
    this.state.notifications = this.state.notifications.map((n) => ({ ...n, read: true }));
    this._save();
  }
  async resetAll() { this.state = initial(); this._save(); }
}

export function createDb() { return new LocalAdapter(); }
export const db = createDb();
