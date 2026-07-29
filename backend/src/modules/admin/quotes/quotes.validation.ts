import { z } from 'zod';

/*
 * Sending a quote on an order — the wire contract for the staff side of
 * "give the customer a price".
 *
 * MONEY (AGENTS.md): every amount is integer minor units plus an ISO 4217 code.
 * `1250` + `"USD"` is $12.50. The schema enforces the integer at the boundary so
 * a float can never reach the service — a client sending `12.50` is a 400, not a
 * value we round. There is no `total` field: the client never decides an amount,
 * so the backend sums the lines and stores the result (AGENTS.md, Money).
 */

// Signed: a discount or credit line is negative, which is why this is a plain
// int rather than a positive one. Bounded so a typo cannot store a nonsense
// amount — ±100,000,000 minor units is $1M, far above any real filing fee.
const minorUnits = z
  .number()
  .int('Amounts must be in integer minor units (cents), never a decimal')
  .min(-100_000_000)
  .max(100_000_000);

export const quoteLineItemSchema = z.object({
  label: z.string().trim().min(1).max(160),
  amount: minorUnits,
});
export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;

export const createQuoteSchema = z.object({
  /*
   * What the quote is for, as the billing row displays it. Snapshotted on the
   * quote rather than read through the order, so the row still reads correctly
   * after the catalog is renamed. Optional — the service falls back to the
   * order's own services when the sender doesn't override it.
   */
  serviceName: z.string().trim().min(1).max(160).optional(),
  lineItems: z.array(quoteLineItemSchema).min(1).max(30),
  // Both non-negative and stored as given; the total is derived from all three.
  tax: minorUnits.min(0).default(0),
  discount: minorUnits.min(0).default(0),
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be an ISO 4217 code')
    .default('USD'),
  /*
   * How long the customer has to accept, in days. A day count rather than a
   * date: the deadline is computed from the server clock so the window can never
   * be back-dated by a browser, and never built from a zoneless string
   * (AGENTS.md, Dates).
   */
  validForDays: z.number().int().min(1).max(90).default(14),
  // An optional note posted to the order's feed alongside the quote.
  message: z.string().trim().max(2_000).optional(),
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
