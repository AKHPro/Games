/* Payment provider abstraction.  Phase 1 = TEST MODE ONLY: no network, no card data, no charge.
   A real provider (Stripe / PayPal / Apple Pay / Google Pay via a PSP) would implement the same
   `pay()` signature and be swapped in below - always charged from a backend, never from the client. */

export const TestPaymentProvider = {
  id: 'test',
  testMode: true,
  async pay({ amount, method }) {
    await new Promise((r) => setTimeout(r, 1100)); // fake processing time
    return { ok: true, test: true, charged: 0, amount, method, ref: 'TEST-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
  },
};
export const payments = TestPaymentProvider;
