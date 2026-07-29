import { z } from 'zod';

/*
 * The payments wire contract (AGENTS.md: Zod schemas are the source of truth).
 *
 * The single most important thing about this file is what it does NOT accept:
 * there is no amount, no currency, and no rate anywhere in it. The client never
 * decides what is owed — the backend resolves every figure from the quote when
 * it creates the intent (AGENTS.md, Money). A request body that tried to name a
 * price would be rejected as an unknown key, not honoured.
 */

// The providers a customer can start a payment with. Cards are deliberately
// absent — that vertical is a later deployment, and accepting a card value here
// would mean advertising a method that cannot complete.
export const paymentMethodKind = z.enum(['usdt_trc20']);
export type PaymentMethodKind = z.infer<typeof paymentMethodKind>;

// POST /v1/payments/intents — start (or resume) collecting on a quote.
// `.strict()` so a body carrying an `amount` fails loudly rather than being
// silently ignored.
export const createIntentSchema = z
  .object({
    quoteId: z.string().min(1),
    method: paymentMethodKind.default('usdt_trc20'),
  })
  .strict();
export type CreateIntentInput = z.infer<typeof createIntentSchema>;

// The route params. Express 5 types a param as `string | string[]` (a repeated
// `?a=1&a=2`-style match), so these coerce through Zod rather than being
// asserted — an array id must fail validation, not be read as a string.
export const paymentIdParamSchema = z.object({
  paymentId: z.string().min(1),
});
export type PaymentIdParam = z.infer<typeof paymentIdParamSchema>;

export const quoteIdParamSchema = z.object({
  quoteId: z.string().min(1),
});
export type QuoteIdParam = z.infer<typeof quoteIdParamSchema>;
