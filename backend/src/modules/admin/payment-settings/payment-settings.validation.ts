import { z } from 'zod';

import { TRON_ADDRESS_PATTERN } from '../../../config/tron.js';

/*
 * Payment configuration — the wire contract for how we collect (AGENTS.md: Zod
 * schemas are the source of truth). Mirrors
 * `frontend/src/admin/types/payment-settings.ts`.
 *
 * Every bound here used to be a bound in `config/env.ts`, and each is kept for
 * the reason it was written there rather than relaxed on the way over:
 * confirmations below 1 credit unconfirmed money, a poll interval under 10
 * seconds is a rate-limit ban from TronGrid, and a rate of zero would price
 * every invoice at nothing.
 *
 * MONEY: the rate is an integer numerator over 1_000_000, never a decimal string
 * and never a float (AGENTS.md, Money). `z.coerce` is deliberately absent — a
 * form that sends "1.05" must fail, not round.
 */

/*
 * A public TRON receiving address, base58 ('T' + 33 chars). The same pattern the
 * poller validates against, imported rather than retyped: a form that accepted a
 * shape the chain client rejects would save an address nothing ever watches.
 *
 * Blank clears it, which is how USDT collection is stood down without switching
 * the whole method off.
 */
const depositAddress = z
  .string()
  .trim()
  .max(64)
  .refine((value) => value === '' || TRON_ADDRESS_PATTERN.test(value), {
    message: 'Must be a public TRON address — “T” followed by 33 characters',
  });

export const updatePaymentSettingsSchema = z
  .object({
    usdtEnabled: z.boolean().optional(),
    tronDepositAddress: depositAddress.optional(),
    /*
     * USDT-per-USD over a 1_000_000 scale. 1_000_000 is parity; 1_010_000 is a
     * 1% spread. The ceiling is 10× parity — not a real rate, but a typo of
     * 10000000 for 1000000 is, and it would ask every customer for ten times
     * what they owe.
     */
    usdtUsdRateMinor: z.number().int().min(1).max(10_000_000).optional(),
    usdtRateTtlMinutes: z.number().int().min(5).max(1440).optional(),
    tronMinConfirmations: z.number().int().min(1).max(100).optional(),
    tronPollIntervalSeconds: z.number().int().min(10).max(3600).optional(),
    usdtAutoVerifyEnabled: z.boolean().optional(),

    wireEnabled: z.boolean().optional(),
    // Shown above the bank details at checkout. Plain text, not markup — it is
    // rendered as text, and a length that would not fit on the card is a
    // paragraph nobody reads.
    wireInstructions: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsSchema>;

/*
 * --- Bank accounts -------------------------------------------------------
 *
 * The fields are the feature. Banking details are not the same shape in two
 * countries — a US account has a routing number and no IBAN, a UK one has a sort
 * code, a SEPA one has neither — so the admin owns both halves of every row,
 * labels included, and the checkout card renders exactly what they entered in
 * the order they set. A fixed `iban` / `swift` / `sortCode` schema would make
 * every new market a migration.
 */
const bankFieldSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    value: z.string().trim().min(1).max(200),
    // Renders with a copy button. On by default: most of these are numbers a
    // customer must reproduce exactly, and a mistyped one sends money to a
    // stranger.
    copyable: z.boolean().default(true),
    // Renders larger and monospaced — the one or two lines that matter most.
    emphasis: z.boolean().default(false),
  })
  .strict();
export type BankFieldInput = z.infer<typeof bankFieldSchema>;

/*
 * At least one field, because an account card with no details under its heading
 * is worse than no card. The ceiling is generous — a correspondent-bank
 * arrangement genuinely runs to a dozen lines — but finite, so a paste accident
 * cannot store a thousand rows the checkout would then try to render.
 */
const bankFields = z.array(bankFieldSchema).min(1).max(20);

/*
 * A short stable slug, used as the checkout option's value so relabelling an
 * account never changes what the client posts. Lower-case kebab, matching the
 * carrier code's shape rather than the location code's — the visible difference
 * is what stops one list's code being pasted into another's.
 */
export const bankAccountCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9-]{1,31}$/,
    'Use lower-case letters, digits and hyphens, e.g. usd-primary',
  );

const label = z.string().trim().min(1).max(80);
const description = z.string().trim().max(300);
// ISO 4217, advisory only — the quote decides what is owed, and this just says
// which account is the sensible one to send it to.
const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, e.g. USD');

export const createBankAccountSchema = z
  .object({
    code: bankAccountCodeSchema,
    label,
    description: description.optional(),
    currency: currency.default('USD'),
    active: z.boolean().optional(),
    fields: bankFields,
  })
  .strict();
export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

/*
 * No `code` — it is the value stored on every payment collected through this
 * account, so it is immutable once the row exists. Unrepresentable rather than
 * a runtime check, the same rule locations and carriers follow.
 *
 * `fields` is a whole-list replace when present. They are an ordered set that
 * only means anything together — an IBAN without its BIC is not half an
 * instruction, it is a wrong one — so a partial update has no sensible
 * semantics, and sending the list entire is also what makes reordering work.
 */
export const updateBankAccountSchema = z
  .object({
    label: label.optional(),
    description: description.optional(),
    currency: currency.optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    fields: bankFields.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;

/*
 * Reordering as one call carrying the complete list, exactly as locations and
 * carriers do: the order is a property of the list, not of any row in it, so two
 * admins reordering at once cannot interleave into a ranking neither chose.
 */
export const reorderBankAccountsSchema = z
  .object({ ids: z.array(z.string().min(1)).min(1).max(200) })
  .strict();
export type ReorderBankAccountsInput = z.infer<typeof reorderBankAccountsSchema>;

export const bankAccountIdParamSchema = z.object({
  accountId: z.string().min(1),
});
