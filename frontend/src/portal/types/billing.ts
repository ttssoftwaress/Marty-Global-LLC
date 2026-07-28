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
 */
export type PaymentHistoryPage = {
  payments: PaymentRecord[];
  page: number;
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
