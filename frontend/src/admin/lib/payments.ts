import type { PaymentMethodSummary } from '../types/payments';

/*
 * Render-time helpers for the quotes & payments screen.
 *
 * The method line prints the backend's own phrasing — the UI never derives a
 * method from a status or assembles one from parts. Card payments are a later
 * deployment, so no card data reaches this file to print.
 */

export const EM_DASH = '—';

// The method's label ("USDT (TRC-20)"), and an em dash when a row has not been
// paid yet.
export function formatPaymentMethod(method: PaymentMethodSummary | null) {
  return method?.label ?? EM_DASH;
}
