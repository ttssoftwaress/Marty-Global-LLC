import { z } from 'zod';

/*
 * The admin quotes & payments wire contract. Mirrors
 * `frontend/src/admin/types/payments.ts`.
 *
 * Nothing here accepts an amount to collect: the client never decides what is
 * owed (AGENTS.md, Money). The one write that carries a figure is a refund, and
 * it is bounded server-side by what was actually collected.
 */

// The ledger's filter tabs. `all` is the unfiltered view.
export const paymentStatusFilter = z.enum([
  'all',
  'paid',
  'pending_payment',
  'refunded',
  'failed',
  'partially_refunded',
]);
export type PaymentStatusFilter = z.infer<typeof paymentStatusFilter>;

export const listLedgerQuerySchema = z.object({
  status: paymentStatusFilter.default('all'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListLedgerQuery = z.infer<typeof listLedgerQuerySchema>;

export const listRefundsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;

export const revenuePeriod = z.enum(['7d', '30d', '12m']);
export type RevenuePeriod = z.infer<typeof revenuePeriod>;

export const revenueQuerySchema = z.object({
  period: revenuePeriod.default('30d'),
});
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

/*
 * A refund. The amount is integer minor units — the browser captured major units
 * and converted once, exactly as the catalog form does, so no float reaches the
 * wire. The service still checks it against what the payment actually collected;
 * a client-sent figure is a request, never the authority.
 */
export const refundSchema = z.object({
  amount: z.number().int().min(1).max(100_000_000),
  reason: z.string().trim().min(1).max(280),
});
export type RefundInput = z.infer<typeof refundSchema>;
