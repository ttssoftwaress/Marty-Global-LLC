import type {
  BankAccount,
  BankAccountCreatePayload,
  BankAccountDraft,
  BankAccountFormErrors,
  BankAccountUpdatePayload,
  BankFieldDraft,
  PaymentSettingsErrors,
} from '../types/payment-settings';

/*
 * Draft ↔ payload plumbing for the payment-configuration forms.
 *
 * The validation here mirrors the backend's Zod schemas. It exists to say what
 * is wrong beside the input rather than after a round trip — the server refuses
 * the same things, and it is the one that decides (AGENTS.md: business logic
 * lives in services).
 *
 * MONEY: the USD→USDT rate is an integer numerator over 1_000_000 on the wire.
 * The form edits it as a decimal ("1.01" for a 1% spread) because nobody wants
 * to type 1010000, and the two conversions below are the only place the two
 * representations meet. Both are integer string arithmetic — no `parseFloat`, no
 * `toFixed`, no multiplying by 1e6 (AGENTS.md, Money).
 */

// USDT's own scale, and the scale the rate numerator is expressed over.
export const RATE_SCALE_DIGITS = 6;

/*
 * A public TRON receiving address: base58, 'T' + 33 characters. The same pattern
 * the backend validates against and the poller reads — a form that accepted a
 * shape the chain client rejects would save an address nothing ever watches.
 */
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/*
 * Rate numerator → the decimal an admin reads and types.
 *
 * Built by slicing digits, so the value never passes through a float: 1_010_000
 * becomes "1.01", and trailing zeros are trimmed so parity reads as "1" rather
 * than "1.000000".
 */
export function rateMinorToDecimal(rateMinor: number): string {
  const digits = String(Math.max(0, Math.trunc(rateMinor))).padStart(
    RATE_SCALE_DIGITS + 1,
    '0',
  );

  const whole = digits.slice(0, digits.length - RATE_SCALE_DIGITS);
  const fraction = digits.slice(digits.length - RATE_SCALE_DIGITS).replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

/*
 * The inverse: the typed decimal back to its integer numerator.
 *
 * Returns null for anything that is not a plain non-negative decimal within the
 * scale, so a value that would silently truncate is refused rather than rounded.
 * The digits are padded and concatenated — again, never multiplied.
 */
export function rateDecimalToMinor(input: string): number | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(input.trim());
  if (!match) return null;

  const [, whole = '0', fraction = ''] = match;
  if (fraction.length > RATE_SCALE_DIGITS) return null;

  const minor = Number(`${whole}${fraction.padEnd(RATE_SCALE_DIGITS, '0')}`);

  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/*
 * The USDT half of the settings form, as the inputs hold it: strings, because
 * that is what an `<input>` gives back, converted on submit.
 */
export type UsdtSettingsDraft = {
  enabled: boolean;
  depositAddress: string;
  /** The rate as a decimal, e.g. "1" or "1.01". */
  rate: string;
  rateTtlMinutes: string;
  minConfirmations: string;
  pollIntervalSeconds: string;
  autoVerifyEnabled: boolean;
};

export type WireSettingsDraft = {
  enabled: boolean;
  instructions: string;
};

// Bounds mirrored from the backend's Zod schema. Each is kept for the reason it
// was written there: confirmations below 1 credit unconfirmed money, a poll
// interval under 10 seconds is a rate-limit ban from TronGrid, and a rate of
// zero prices every invoice at nothing.
const BOUNDS = {
  rateTtlMinutes: { min: 5, max: 1440 },
  minConfirmations: { min: 1, max: 100 },
  pollIntervalSeconds: { min: 10, max: 3600 },
} as const;

function wholeNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateUsdtDraft(draft: UsdtSettingsDraft): PaymentSettingsErrors {
  const errors: PaymentSettingsErrors = {};

  const address = draft.depositAddress.trim();
  if (address && !TRON_ADDRESS.test(address)) {
    errors.tronDepositAddress =
      'Must be a public TRON address — “T” followed by 33 characters';
  }

  if (rateDecimalToMinor(draft.rate) === null) {
    errors.usdtUsdRateMinor = `A positive number with at most ${RATE_SCALE_DIGITS} decimal places, e.g. 1 or 1.01`;
  }

  const checks = [
    ['rateTtlMinutes', 'usdtRateTtlMinutes', draft.rateTtlMinutes],
    ['minConfirmations', 'tronMinConfirmations', draft.minConfirmations],
    ['pollIntervalSeconds', 'tronPollIntervalSeconds', draft.pollIntervalSeconds],
  ] as const;

  for (const [boundKey, errorKey, raw] of checks) {
    const { min, max } = BOUNDS[boundKey];
    const value = wholeNumber(raw);

    if (value === null || value < min || value > max) {
      errors[errorKey] = `A whole number between ${min} and ${max}`;
    }
  }

  return errors;
}

/*
 * The settings payload, sent as a whole so a single save applies both halves.
 * `depositAddress` is sent even when blank — that is how USDT collection is
 * stood down without switching the method off, and omitting an empty string
 * would make clearing it impossible.
 */
export function paymentSettingsPayload(
  usdt: UsdtSettingsDraft,
  wire: WireSettingsDraft,
) {
  return {
    usdtEnabled: usdt.enabled,
    tronDepositAddress: usdt.depositAddress.trim(),
    usdtUsdRateMinor: rateDecimalToMinor(usdt.rate) ?? 1_000_000,
    usdtRateTtlMinutes: wholeNumber(usdt.rateTtlMinutes) ?? 30,
    tronMinConfirmations: wholeNumber(usdt.minConfirmations) ?? 19,
    tronPollIntervalSeconds: wholeNumber(usdt.pollIntervalSeconds) ?? 30,
    usdtAutoVerifyEnabled: usdt.autoVerifyEnabled,
    wireEnabled: wire.enabled,
    wireInstructions: wire.instructions.trim(),
  };
}

// --- Bank accounts -------------------------------------------------------

let fieldKeySeed = 0;

// A key that survives reordering and removal, so React never reuses a row's
// state for a different field.
export function newFieldKey(): string {
  fieldKeySeed += 1;
  return `field-${fieldKeySeed}`;
}

export function newBankField(): BankFieldDraft {
  return { key: newFieldKey(), label: '', value: '', copyable: true, emphasis: false };
}

/*
 * A fresh account, pre-seeded with the two lines nearly every bank card starts
 * with. A blank list is a worse starting point than a wrong guess: the admin
 * relabels a row in a second, and the pair says what this form is for.
 */
export function newBankAccountDraft(): BankAccountDraft {
  return {
    code: '',
    label: '',
    description: '',
    currency: 'USD',
    active: true,
    fields: [
      { ...newBankField(), label: 'Account name' },
      { ...newBankField(), label: 'Account number', emphasis: true },
    ],
  };
}

export function draftFromBankAccount(account: BankAccount): BankAccountDraft {
  return {
    code: account.code,
    label: account.label,
    description: account.description ?? '',
    currency: account.currency,
    active: account.active,
    fields: account.fields.map((field) => ({ ...field, key: newFieldKey() })),
  };
}

/*
 * A code guessed from the label: lower-case kebab, trimmed to the backend's
 * 32-character ceiling. A guess, not an answer — the box stays editable and only
 * fills in while it is untouched.
 */
export function deriveBankAccountCode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

const BANK_CODE = /^[a-z][a-z0-9-]{1,31}$/;
const CURRENCY = /^[A-Z]{3}$/;

export function validateBankAccountDraft(
  draft: BankAccountDraft,
  { isEdit }: { isEdit: boolean },
): BankAccountFormErrors {
  const errors: BankAccountFormErrors = {};

  if (!draft.label.trim()) errors.label = 'Give this account a name';

  // The code is immutable once the row exists, so it is only validated while it
  // can still be set.
  if (!isEdit && !BANK_CODE.test(draft.code.trim())) {
    errors.code = 'Use lower-case letters, digits and hyphens, e.g. usd-primary';
  }

  if (!CURRENCY.test(draft.currency.trim().toUpperCase())) {
    errors.currency = 'Use a three-letter currency code, e.g. USD';
  }

  const filled = usableFields(draft.fields);

  if (filled.length === 0) {
    // An account card with no details under its heading is worse than no card
    // at all — the backend refuses it too.
    errors.fields = 'Add at least one detail — a label and its value';
  } else if (
    draft.fields.some(
      (field) => Boolean(field.label.trim()) !== Boolean(field.value.trim()),
    )
  ) {
    errors.fields = 'Every detail needs both a label and a value';
  }

  return errors;
}

/*
 * The rows that will actually be sent: both halves filled. A wholly empty row is
 * dropped rather than rejected, because the form always keeps one spare at the
 * bottom for the next entry.
 */
export function usableFields(fields: BankFieldDraft[]): BankFieldDraft[] {
  return fields.filter((field) => field.label.trim() && field.value.trim());
}

function payloadFields(draft: BankAccountDraft) {
  return usableFields(draft.fields).map((field) => ({
    label: field.label.trim(),
    value: field.value.trim(),
    copyable: field.copyable,
    emphasis: field.emphasis,
  }));
}

export function bankAccountCreatePayload(
  draft: BankAccountDraft,
): BankAccountCreatePayload {
  return {
    code: draft.code.trim().toLowerCase(),
    label: draft.label.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    currency: draft.currency.trim().toUpperCase(),
    active: draft.active,
    fields: payloadFields(draft),
  };
}

/*
 * The update always carries the whole field list. They are an ordered set that
 * only means anything together — an IBAN without its BIC is not half an
 * instruction, it is a wrong one — so a partial update has no sensible
 * semantics, and sending the list entire is also what makes reordering work.
 */
export function bankAccountUpdatePayload(
  draft: BankAccountDraft,
): BankAccountUpdatePayload {
  return {
    label: draft.label.trim(),
    description: draft.description.trim(),
    currency: draft.currency.trim().toUpperCase(),
    active: draft.active,
    fields: payloadFields(draft),
  };
}

// How the list column summarises an account: its first couple of labels, so a
// row is recognisable without opening it.
export function formatAccountFields(account: BankAccount): string {
  if (account.fields.length === 0) return 'No details yet';

  const labels = account.fields.slice(0, 2).map((field) => field.label);
  const rest = account.fields.length - labels.length;

  return rest > 0 ? `${labels.join(', ')} +${rest} more` : labels.join(', ');
}
