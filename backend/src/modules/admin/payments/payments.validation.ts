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

/*
 * --- Manual settlement ---------------------------------------------------
 *
 * The queue of payments a person has to confirm: every wire, plus USDT while
 * automatic verification is switched off. `open` is the working view; `settled`
 * is the record of who confirmed what.
 */
export const settlementFilter = z.enum(['open', 'settled', 'all']);
export type SettlementFilter = z.infer<typeof settlementFilter>;

export const listSettlementsQuerySchema = z.object({
  status: settlementFilter.default('open'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListSettlementsQuery = z.infer<typeof listSettlementsQuerySchema>;

/*
 * Confirming that money we cannot see arrived.
 *
 * Note the shape: no amount and no currency. The figure is the quote's, resolved
 * server-side — a client-supplied amount is exactly what AGENTS.md forbids, and
 * a settlement is "this invoice was paid in full", not "credit this much".
 * A part payment is not representable here on purpose; it is a conversation with
 * the customer, not a form field.
 *
 * `reference` is what the provider calls the movement — the bank's reference for
 * a wire, the tx hash for a hand-verified USDT payment. Optional, because a
 * settler may genuinely not have one, and unique in the schema, so the same
 * reference cannot be pasted onto two invoices.
 */
export const settlePaymentSchema = z
  .object({
    reference: z.string().trim().min(1).max(120).optional(),
    note: z.string().trim().max(280).optional(),
    /*
     * When the money landed, per the bank statement — not when the form was
     * submitted. A wire confirmed on Monday for a Friday credit should date to
     * Friday, because that is what the quote was paid on. Defaults to now.
     */
    paidAt: z.iso.datetime().optional(),
  })
  .strict();
export type SettlePaymentInput = z.infer<typeof settlePaymentSchema>;

// Closing one out without settling: the money never arrived, or arrived as
// something else. The reason is required — this reopens the quote for payment,
// and "why" is the only thing the customer will ask.
export const rejectPaymentSchema = z
  .object({ reason: z.string().trim().min(1).max(280) })
  .strict();
export type RejectPaymentInput = z.infer<typeof rejectPaymentSchema>;

export const paymentIdParamSchema = z.object({
  paymentId: z.string().min(1),
});

export const revenuePeriod = z.enum(['7d', '30d', '12m']);
export type RevenuePeriod = z.infer<typeof revenuePeriod>;

export const revenueQuerySchema = z.object({
  period: revenuePeriod.default('30d'),
});
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
