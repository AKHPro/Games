import { PRICING } from './config.js';

export const fmtMoney = (n, { decimals } = {}) => {
  const d = decimals ?? (Number.isInteger(n) ? 0 : 2);
  return PRICING.currency + Number(n).toFixed(d);
};
export const weightTier = (id) => PRICING.weightTiers.find((t) => t.id === id) || PRICING.weightTiers[0];

/** Pure function. distanceKm may be null (no destination yet) -> returns null. */
export function quote({ distanceKm, weightId }) {
  if (distanceKm == null || !isFinite(distanceKm)) return null;
  if (distanceKm > PRICING.maxKm) return { error: 'too_far', maxKm: PRICING.maxKm };
  const tier = weightTier(weightId);
  const km = Math.round(distanceKm * 10) / 10;
  const lines = [
    { key: 'base', amount: PRICING.base },
    { key: 'distance', amount: Math.round(km * PRICING.perKm), km },
    { key: 'weight', amount: tier.surcharge, tier },
  ];
  const sum = lines.reduce((a, l) => a + l.amount, 0);
  const total = Math.max(PRICING.minTotal, sum);
  return { lines, total, km, tier, courierPay: Math.floor(total * PRICING.courierShare) };
}
