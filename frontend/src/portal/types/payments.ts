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

// The methods a customer can actually pay with. Cards are a later deployment —
// the checkout shows them as coming soon rather than offering a value the
// backend would reject.
export type PaymentMethodKind = 'usdt_trc20';

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

export type Payment = {
  id: string;
  quoteId: string | null;
  reference: string | null;
  serviceName: string;
  provider: PaymentMethodKind;
  status: PaymentStatusView;
  amount: Money;
  /** The Tron tx hash, once a transfer has matched. */
  transactionHash: string | null;
  usdt: UsdtPaymentInstructions | null;
  /** What actually landed on-chain, when it didn't match what was asked for. */
  settledAmountDisplay: string | null;
  paidAt: string | null;
  createdAt: string;
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
