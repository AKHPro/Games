/* Get4You - central configuration.  Everything tunable lives here. */

export const APP = { name: 'Get4You', version: '0.1', stage: 'phase 1 - demo / test mode' };

/* ---------- PRICING: the single formula config object ----------
   total = base
         + round(distanceKm * perKm)           (distance surcharge)
         + weightTiers[selected].surcharge     (weight surcharge)
   then clamped to minTotal. Change numbers here only. */
export const PRICING = {
  currency: '₪',
  base: 12,            // fixed opening fee
  perKm: 2.5,          // per km of route distance
  maxKm: 60,           // quotes above this are refused
  minTotal: 12,
  courierShare: 0.8,   // share of the price paid to the courier (floored to whole currency units)
  weightTiers: [
    { id: 'w2',   label: 'עד 2',  range: [0, 2],   surcharge: 0 },
    { id: 'w5',   label: '2–5',        range: [2, 5],   surcharge: 8 },
    { id: 'w10',  label: '5–10',       range: [5, 10],  surcharge: 16 },
    { id: 'w10p', label: '+10',             range: [10, 99], surcharge: 28 },
  ],
  defaultWeightId: 'w5',
};

export const CATEGORIES = [
  { id: 'docs',  label: 'מסמכים', icon: 'doc' },
  { id: 'food',  label: 'מזון',             icon: 'food' },
  { id: 'box',   label: 'חבילה',       icon: 'box' },
  { id: 'shop',  label: 'קניות',       icon: 'bag' },
  { id: 'other', label: 'אחר',                   icon: 'dots' },
];
export const DEFAULT_CATEGORY = 'box';

/* ---------- Map / geo ---------- */
export const MAP = {
  tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  maxZoom: 19,
};

export const GEO = {
  // Fallback when geolocation is denied / unavailable. Clearly labelled as demo in the UI.
  fallback: { lat: 32.7996, lng: 34.9876, label: 'חיפה (מיקום לדוגמה)' },
  timeoutMs: 8000,
  maxAgeMs: 60000,
};

/* Demo addresses (Haifa) used for the "fill example addresses" shortcut and offline use. */
export const DEMO_ADDRESSES = {
  pickup:  { lat: 32.7996, lng: 34.9871, label: 'רח׳ מוריה 57', sub: 'מרכז הכרמל, חיפה' },
  dropoff: { lat: 32.8167, lng: 34.9972, label: 'רח׳ העצמאות 88', sub: 'העיר התחתית, חיפה' },
};

/* Nominatim usage policy: max 1 req/s, identifiable app, no heavy autocomplete, cache results.
   The browser sends Referer automatically; a custom User-Agent cannot be set from a web page. */
export const SEARCH = {
  endpoint: 'https://nominatim.openstreetmap.org',
  lang: 'he',
  countrycodes: 'il',      // '' = worldwide
  limit: 6,
  minChars: 4,
  autoSearch: true,        // search after the user stops typing (debounced); Enter/button always works
  debounceMs: 1200,
  minIntervalMs: 1100,     // global throttle between Nominatim requests
  timeoutMs: 8000,
};

export const ROUTING = {
  osrmBase: 'https://router.project-osrm.org',   // public demo server: low volume, no SLA
  timeoutMs: 6000,
  detourFactor: 1.3,       // haversine fallback: straight-line km * factor
  fallbackSpeedKmh: 28,
};

/* ---------- Simulation (demo data only) ---------- */
export const SIM = {
  couriersNearby: 3,
  minRadiusKm: 0.4,
  maxRadiusKm: 2.2,
  speedKmh: { motorbike: 32, car: 26, bike: 16 },
  driftMs: 4000,             // nearby couriers wander a little on the map
  // order simulation (time compressed so a demo finishes in ~1 minute)
  acceptDelayMs: 3500,
  startDelayMs: 1500,
  legMinMs: 8000,
  legMaxMs: 20000,
  timeScale: 30,             // 1 real minute of travel -> 2 seconds (clamped by legMin/legMax)
  demoRequestDelayMs: 5000,  // courier mode: a demo request arrives after this long when online
  demoRequestTtlSec: 15,
  myOrderTtlSec: 120,        // order that targets "me" as courier: time to accept
  tickMs: 500,
};

/* Generic demo couriers: first names only, NOT real people; always flagged as demo in the UI. */
export const DEMO_COURIERS = [
  { id: 'c1', name: 'דניאל', avatar: 'daniel', vehicle: 'motorbike', rating: 4.9 },
  { id: 'c2', name: 'מאיה', avatar: 'maya',   vehicle: 'car',       rating: 4.8 },
  { id: 'c3', name: 'יוסי', avatar: 'yossi',  vehicle: 'bike',      rating: 4.7 },
  { id: 'c4', name: 'שירן', avatar: 'noa',  vehicle: 'motorbike', rating: 4.6 },
  { id: 'c5', name: 'אלון', avatar: 'daniel', vehicle: 'car',       rating: 4.8 },
];
export const VEHICLE_LABEL = { motorbike: 'אופנוע', car: 'רכב', bike: 'אופניים' };

export const PAYMENT_METHODS = [
  { id: 'card',   name: 'כרטיס אשראי', sub: 'מסתיים ב־4242 · דוגמה', badge: 'card' },
  { id: 'paypal', name: 'PayPal',     sub: 'חשבון בדיקה', badge: 'paypal' },
  { id: 'apple',  name: 'Apple Pay',  sub: 'בדיקה · ללא חיוב', badge: 'apple' },
  { id: 'google', name: 'Google Pay', sub: 'בדיקה · ללא חיוב', badge: 'google' },
];
