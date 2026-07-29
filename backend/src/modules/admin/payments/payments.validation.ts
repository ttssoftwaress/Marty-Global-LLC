import { z } from 'zod';

/*
 * The admin quotes & payments wire contract. Mirrors
 * `frontend/src/admin/types/payments.ts`.
 *
 * Nothing here accepts an amount: the client never decides what is owed
 * (AGENTS.md, Money). Every figure the screen prints is resolved server-side
 * from the quote and the payments raised against it.
 */

// The ledger's filter tabs. `all` is the unfiltered view.
export const paymentStatusFilter = z.enum([
  'all',
  'paid',
  'pending_payment',
  'failed',
]);
export type PaymentStatusFilter = z.infer<typeof paymentStatusFilter>;

export const listLedgerQuerySchema = z.object({
  status: paymentStatusFilter.default('all'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListLedgerQuery = z.infer<typeof listLedgerQuerySchema>;

/*
 * The unattributed-transfer queue. `open` is what a reconciler works from;
 * `resolved` is the record of what past ones turned out to be.
 */
export const unmatchedTransferFilter = z.enum(['open', 'resolved', 'all']);
export type UnmatchedTransferFilter = z.infer<typeof unmatchedTransferFilter>;

export const listUnmatchedQuerySchema = z.object({
  status: unmatchedTransferFilter.default('open'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListUnmatchedQuery = z.infer<typeof listUnmatchedQuerySchema>;

/*
 * Closing out a stray transfer. The note is the whole payload — there is no
 * amount and no payment id, because resolving is an annotation, not a transfer
 * of money. Attaching stray funds to an invoice would be crediting a payment
 * from a client-supplied figure, which AGENTS.md forbids outright; if the money
 * is genuinely owed, the customer pays the quote and the poller credits it.
 */
export const resolveUnmatchedSchema = z.object({
  note: z.string().trim().min(1).max(280),
});
export type ResolveUnmatchedInput = z.infer<typeof resolveUnmatchedSchema>;

export const revenuePeriod = z.enum(['7d', '30d', '12m']);
export type RevenuePeriod = z.infer<typeof revenuePeriod>;

export const revenueQuerySchema = z.object({
  period: revenuePeriod.default('30d'),
});
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
