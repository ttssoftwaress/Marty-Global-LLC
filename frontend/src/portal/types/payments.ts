/*
 * Payments — local mirror of the API shapes the checkout screen renders. The
 * backend is the source of truth (AGENTS.md, two-apps sync rule); these types
 * exist so the UI compiles against the same contract.
 *
 * MONEY: fiat stays integer minor units + ISO code, formatted only at render.
 * The USDT amount is a raw integer at `decimals` precision carried as a STRING,
 * never a number — a large amount would lose precision as a JS float, and the
 * screen only ever displays it (AGENTS.md, Money).
 *
 * Nothing here lets the client name an amount. The checkout posts a quote id and
 * the backend resolves every figure.
 */

import type { Money } from './dashboard';

/*
 * The methods a customer can pay with. Cards are a later deployment — the
 * checkout shows them as coming soon rather than offering a value the backend
 * would reject.
 *
 * Which of these is actually offered is NOT a frontend decision: whether we take
 * crypto, whether we take wires, and which bank accounts are live are admin
 * settings, so the checkout renders `GET /v1/payments/methods` (see
 * `PaymentMethodOption`) rather than a constant in this app.
 */
export type PaymentMethodKind = 'usdt_trc20' | 'wire_transfer';

/*
 * Where a payment is. `awaiting_payment` is pre-transfer, `confirming` means a
 * transfer matched but hasn't reached the required confirmation depth, and
 * `underpaid`/`overpaid` are the explicit mismatch states a human resolves —
 * never a silent pass (AGENTS.md, Money).
 */
export type PaymentStatusView =
  | 'awaiting_payment'
  | 'confirming'
  | 'succeeded'
  | 'failed'
  | 'expired'
  // The customer closed the window themselves before sending anything. Distinct
  // from `failed`: nothing went wrong and the quote is still open to pay.
  | 'cancelled'
  | 'underpaid'
  | 'overpaid';

// Everything the USDT screen needs to show a customer what to send and where.
export type UsdtPaymentInstructions = {
  network: 'mainnet' | 'nile';
  // The verified USDT contract, shown so a careful customer can confirm the
  // token before sending. A fake token reusing the name has a different address.
  contractAddress: string;
  depositAddress: string;
  /** Raw integer at `decimals` precision, as a string — never parsed to a float. */
  amountRaw: string;
  /** The same amount ready to display, e.g. "559.5". */
  amountDisplay: string;
  decimals: number;
  /** USDT-per-USD numerator over 1_000_000. */
  rateMinor: number;
  rateExpiresAt: string; // ISO-8601 UTC
  expiresAt: string; // ISO-8601 UTC — the payment stops watching after this
  minConfirmations: number;
  confirmations: number;
};

/*
 * One labelled line on a bank-transfer card, exactly as an admin entered it at
 * `/admin/settings`.
 *
 * The whole wire feature turns on this shape being open rather than a fixed set
 * of `iban` / `swift` / `sortCode` fields: banking details are not the same in
 * two countries, so the labels are data and this app renders whatever it is
 * given, in the order it is given.
 */
export type WireInstructionField = {
  label: string;
  value: string;
  /** Render with a copy button — on for anything a customer must reproduce. */
  copyable: boolean;
  /** Render larger and monospaced — the one or two lines that matter most. */
  emphasis: boolean;
};

/*
 * What a customer wiring money is shown. Every line is frozen onto the payment
 * when it is created, so an admin correcting a typo on the account later never
 * rewrites instructions somebody is already acting on.
 */
export type WirePaymentInstructions = {
  accountId: string | null;
  accountLabel: string;
  description: string | null;
  currency: string;
  fields: WireInstructionField[];
  /**
   * What to put in the transfer's reference field — the quote's own reference.
   * A wire carries free text, so unlike TRC-20 the amount need not be unique.
   */
  reference: string | null;
};

export type Payment = {
  id: string;
  quoteId: string | null;
  reference: string | null;
  serviceName: string;
  provider: PaymentMethodKind;
  status: PaymentStatusView;
  amount: Money;
  /** The Tron tx hash, or the bank's reference once one has been recorded. */
  transactionHash: string | null;
  usdt: UsdtPaymentInstructions | null;
  wire: WirePaymentInstructions | null;
  /**
   * When the customer said the transfer was on its way — a claim that reorders
   * the team's queue, never a settlement. Applies to any payment a person has to
   * settle, including USDT while automatic verification is switched off.
   */
  markedSentAt: string | null;
  /** What actually landed on-chain, when it didn't match what was asked for. */
  settledAmountDisplay: string | null;
  paidAt: string | null;
  createdAt: string;
};

/*
 * A bank account the customer may send to, as the method picker lists them.
 * Admin-registered — there is no such thing as a default account in this app.
 */
export type WireAccount = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  currency: string;
  fields: WireInstructionField[];
};

/*
 * What this deployment offers, resolved by the backend.
 *
 * `unavailableReason` is why a method can be present and disabled: an admin who
 * has switched crypto on but not finished configuring it should produce an
 * option that says so, rather than one that silently disappears and reads as
 * "they stopped taking crypto".
 */
export type PaymentMethodOption = {
  kind: PaymentMethodKind;
  available: boolean;
  unavailableReason: string | null;
  /**
   * Whether the method settles on its own. False for a wire always, and for
   * USDT while an admin has switched automatic verification off — the copy turns
   * on it, because promising "confirms in a minute" while a person is in the
   * loop is a support ticket per payment.
   */
  autoVerified: boolean;
  /** Wire only: the accounts the customer chooses between. */
  accounts: WireAccount[];
};

/*
 * The quote the checkout is collecting for. All five of the backend's
 * `QuoteStatus` values — checkout resolves a quote by id, so unlike the order
 * screen (four) and the billing list (two) it has no server-side filter in front
 * of it and must be able to name whatever it is handed, including a `draft` it
 * then refuses to take payment for.
 */
export type CheckoutQuoteStatus = 'pending' | 'expired' | 'paid' | 'cancelled' | 'draft';

export type CheckoutQuote = {
  id: string;
  reference: string;
  serviceName: string;
  total: Money;
  validUntil: string; // ISO-8601 UTC
  status: CheckoutQuoteStatus;
  lineItems: { id: string; label: string; amount: Money }[];
  /*
   * The payment window still open on this quote, if there is one. This is what
   * makes checkout survive a reload: the open window lives in the database, not
   * in the tab, so re-opening the page resumes it mid-countdown instead of
   * offering to start a second one.
   */
  activePayment: Payment | null;
};
