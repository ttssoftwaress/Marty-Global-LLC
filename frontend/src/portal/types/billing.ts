/*
 * Billing & payments — local mirror of the API shapes the billing screen
 * renders. The backend is the source of truth (AGENTS.md, two-apps sync rule);
 * these types exist so the UI compiles and composes before the endpoints land.
 *
 * Money stays integer minor units + ISO code (AGENTS.md, Money rules) — never a
 * float, formatted only at render. We store brand + last four for a card, never
 * a PAN or CVC: Stripe holds the card, we hold the token (AGENTS.md, PCI).
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

// The four card networks we surface a branded badge for, plus a fallback.
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

// A card reference — brand + last four only. Never a full number or CVC.
export type CardSummary = {
  brand: CardBrand;
  last4: string;
};

// The design shows `paid`; `refunded` and `failed` are the other terminal
// states a real payment row can carry, so the chip covers them too.
export type PaymentStatus = 'paid' | 'refunded' | 'failed';

export type PaymentRecord = {
  id: string;
  paidAt: string; // ISO-8601 UTC — "Date"
  serviceName: string;
  amount: Money;
  card: CardSummary; // renders as "Visa •••• 4242"
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

export type SavedPaymentMethod = {
  id: string;
  card: CardSummary;
  expMonth: number; // 1–12
  expYear: number; // four-digit year
  isDefault: boolean;
};

// The single overview payload: KPIs, quotes, and saved methods. Payment history
// is paginated on its own endpoint.
export type BillingOverview = {
  kpis: BillingKpis;
  quotes: BillingQuote[];
  savedMethods: SavedPaymentMethod[];
};

// Time window for the payment-history query; the backend resolves the range.
export type PaymentHistoryRange = '30d' | '6m' | '12m' | 'all';
