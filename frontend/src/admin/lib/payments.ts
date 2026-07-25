import type { PaymentMethodSummary } from '../types/payments';

/*
 * Render-time helpers for the quotes & payments screen.
 *
 * The method line is the one piece of card data we ever print, and it is only
 * ever the brand and last four — never a PAN (AGENTS.md, Payments). The backend
 * sends those two fields already separated; this only joins them for display.
 */

export const EM_DASH = '—';

/*
 * "Visa •••• 4242" for a card, the plain label for anything else ("ACH
 * transfer", "USDT (TRC-20)"), and an em dash when a row has not been paid yet.
 */
export function formatPaymentMethod(method: PaymentMethodSummary | null) {
  if (!method) return EM_DASH;
  if (method.brand && method.last4) return `${method.brand} •••• ${method.last4}`;
  return method.label;
}
