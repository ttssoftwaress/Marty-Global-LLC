/*
 * Admin quotes & payments — local mirror of the API shapes the screen renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the KPI figures, the chart
 * series, the ledger rows, and the refund log all arrive from the API. Money is
 * an integer minor-unit amount plus its ISO 4217 code everywhere (AGENTS.md,
 * Money rules) — the UI never does arithmetic on it, only formats at render.
 */

import type { Money } from './dashboard';

export type { Money };

/*
 * A payment's lifecycle state, which is what the ledger's status chip and its
 * filter tabs both key off. These mirror the backend's payment status enum.
 */
export type PaymentStatus =
  | 'paid'
  | 'pending_payment'
  | 'refunded'
  | 'failed'
  | 'partially_refunded';

/*
 * The ledger's filter tab set. `all` is the unfiltered view the section opens
 * on; every other value narrows to one payment status.
 */
export type PaymentStatusFilter = PaymentStatus | 'all';

/*
 * A filter tab. The backend supplies the label and the count so the strip stays
 * in step with the statuses the pipeline actually uses — the UI never derives a
 * count from the current page of rows.
 */
export type PaymentStatusTab = {
  value: PaymentStatusFilter;
  label: string;
  count: number;
};

/*
 * How a payment was collected. `brand` and `last4` are the only card details we
 * ever hold (AGENTS.md — Stripe holds the card, we hold the token); a bank or
 * crypto settlement carries no card fields and renders from `label` alone.
 *
 * A row that has not been paid yet has no method at all — the ledger prints an
 * em dash for it — so the whole object is nullable on a row.
 */
export type PaymentMethodSummary = {
  label: string; // the backend's phrasing: "Visa", "ACH transfer", "USDT (TRC-20)"
  brand?: string;
  last4?: string;
};

/*
 * What a ledger row's action control does. The backend decides which action a
 * row offers, so the UI never infers an action from a status:
 *   - `refund`   — a completed payment that can still be reversed
 *   - `remind`   — an unpaid invoice that can be chased
 *   - `view`     — a terminal row that only opens
 *   - `none`     — no action available (renders as a muted em dash)
 *
 * `label` is the backend's word for it ("Issue refund", "Send reminder"), so a
 * wording change never needs a frontend deploy.
 */
export type LedgerActionKind = 'refund' | 'remind' | 'view' | 'none';

export type LedgerAction = {
  kind: LedgerActionKind;
  label: string;
};

/*
 * One row of the billing ledger. `reference` is the printed "#ORD-9021";
 * `to` is the order's detail route so the reference and the view action link
 * to the same record.
 */
export type BillingLedgerRow = {
  id: string;
  reference: string;
  customer: { id: string; name: string };
  service: string;
  amount: Money;
  issuedAt: string; // ISO-8601 UTC
  status: PaymentStatus;
  statusLabel: string;
  method: PaymentMethodSummary | null; // null renders as an em dash
  action: LedgerAction;
  to: string;
};

/*
 * One page of the ledger. Cursor pagination is the API convention (AGENTS.md),
 * so `nextCursor` drives mobile's "Load more"; `page`/`totalPages` drive the
 * numbered pager the wider links show over the same stream.
 */
export type BillingLedgerPage = {
  rows: BillingLedgerRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

/*
 * A refunds & adjustments log entry. The amount is the money returned, printed
 * in the error color on every link; `processedBy` is the staff member who
 * approved it, which the audit module records alongside the payment.
 */
export type RefundLogRow = {
  id: string;
  reference: string;
  customer: { id: string; name: string };
  amount: Money;
  reason: string;
  processedAt: string; // ISO-8601 UTC
  processedBy: string;
  to: string;
};

export type RefundLogPage = {
  rows: RefundLogRow[];
  nextCursor: string | null;
};

/*
 * The revenue chart's period switch. The backend resolves each into a bucketed
 * series, so the UI never re-buckets or re-aggregates what it is given.
 */
export type RevenuePeriod = '7d' | '30d' | '12m';

export const REVENUE_PERIODS: { value: RevenuePeriod; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
];

/*
 * One bucket of the revenue series. `label` is the backend's pre-formatted axis
 * caption for the bucket ("Jul 06", "Mar"), so the chart never has to know how a
 * period is bucketed or in which timezone the boundary falls (AGENTS.md, Dates).
 */
export type RevenuePoint = {
  label: string;
  collected: Money;
};

/*
 * The chart's whole payload: the series plus the axis ceiling the backend chose.
 * Sending `maxValue` down means the y-axis ticks are stable across a period
 * switch and across a refetch, rather than jumping to whatever the current
 * page's tallest bar happens to be.
 */
export type RevenueSeries = {
  period: RevenuePeriod;
  points: RevenuePoint[];
  maxValue: Money;
};

/*
 * A headline KPI. `tone` is the backend's read on how the caption should be
 * colored — the "Invoices issued · due in 15 days" line is amber on the design
 * because it is a warning, not because of its position in the row.
 */
export type PaymentsKpiTone = 'neutral' | 'warning' | 'success';

export type PaymentsKpi = {
  id: string;
  label: string;
  value: string; // pre-resolved by the backend: "$127,450", "14 / $8,920"
  caption: string;
  captionTone: PaymentsKpiTone;
  badge?: { label: string; tone: PaymentsKpiTone };
};

/*
 * Everything the screen's chrome needs in one call, so the KPI figures, the
 * ledger tab counts, and the chart agree with each other and with the list.
 */
export type PaymentsSummary = {
  kpis: PaymentsKpi[];
  tabs: PaymentStatusTab[];
};
