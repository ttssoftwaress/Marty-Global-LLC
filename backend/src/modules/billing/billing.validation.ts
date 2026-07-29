import { z } from 'zod';

// The billing wire contract (AGENTS.md: Zod schemas are the source of truth).
// Nothing here accepts an amount — the client never decides what is owed; the
// backend resolves every figure from the quote and payment records.

// The payment-history time window. The backend resolves each range to a cutoff.
export const paymentHistoryRange = z.enum(['30d', '6m', '12m', 'all']);
export type PaymentHistoryRange = z.infer<typeof paymentHistoryRange>;

export const listPaymentsQuerySchema = z.object({
  range: paymentHistoryRange.default('all'),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().min(1).optional(),
  // The history renders 10 per page in the design; cap so a client can't ask for
  // an unbounded page.
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
