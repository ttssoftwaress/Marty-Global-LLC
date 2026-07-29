/*
 * Billing & payments — local mirror of the API shapes the billing screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the endpoints land.
 *
 * Money stays integer minor units + ISO code (AGENTS.md, Money rules) — never a
 * float, formatted only at render.
 *
 * Card payments are a later deployment, so nothing here models a card: a payment
 * carries the method's label and that is all the screen prints.
 */

import type { Money } from './dashboard';

// The three headline figures across the top of the page.
export type BillingKpis = {
  amountDue: Money;
  totalPaid: Money;
  pendingQuotes: number;
};

/*
 * A quote awaiting payment. `status` drives the chip: the design shows
 * `pending`, and `expired` covers a quote whose validity window has lapsed.
 *
 * Two of the backend enum's five, and narrower than the order screen's four:
 * this list is "what you still owe", so `billing.service.ts` queries only
 * PENDING and EXPIRED and then re-reads a lapsed PENDING as `expired` on the
 * render. A paid, cancelled, or draft quote never reaches this list — the
 * server-side filter is what makes the narrowing safe, not this type.
 *
 * Deliberately not shared with `orders.ts`'s `QuoteStatus` (four values) or
 * `payments.ts`'s `CheckoutQuoteStatus` (all five): each mirrors what its own
 * endpoint returns, and merging them would widen every chip to statuses its
 * screen can never be handed.
 */
export type QuoteStatus = 'pending' | 'expired';

export type BillingQuote = {
  id: string;
  serviceName: string;
  amount: Money;
  issuedAt: string; // ISO-8601 UTC — "Date issued" (desktop-only column)
  validUntil: string; // ISO-8601 UTC — "Valid until"
  status: QuoteStatus;
};

// The design shows `paid`; `failed` is the other terminal state a real payment
// row can carry, so the chip covers it too.
export type PaymentStatus = 'paid' | 'failed';

export type PaymentRecord = {
  id: string;
  paidAt: string; // ISO-8601 UTC — "Date"
  serviceName: string;
  amount: Money;
  // How it was collected, already phrased by the backend: "USDT (TRC-20)".
  method: string;
  status: PaymentStatus;
  // The invoice PDF is a short-TTL presigned URL the backend hands out after an
  // ownership check (AGENTS.md, Security & PII); absent until it is ready.
  invoiceHref?: string;
};

/*
 * Cursor pagination, mirroring the API envelope (AGENTS.md, API Conventions).
 * Desktop and tablet render the page counter + Previous/Next; mobile renders
 * "Load more payments" over the same cursor.
 *
 * There is no `page` here because a cursor stream has no offset to report — the
 * screen owns which window it is showing, and the backend supplies only the
 * "of Y" half of the counter.
 */
export type PaymentHistoryPage = {
  payments: PaymentRecord[];
  totalPages: number;
  totalCount: number;
  // Cursor for the next page; null when the history is exhausted.
  nextCursor: string | null;
};

// The single overview payload: KPIs and quotes. Payment history is paginated on
// its own endpoint.
export type BillingOverview = {
  kpis: BillingKpis;
  quotes: BillingQuote[];
};

// Time window for the payment-history query; the backend resolves the range.
export type PaymentHistoryRange = '30d' | '6m' | '12m' | 'all';
