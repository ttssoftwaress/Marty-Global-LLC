/*
 * Admin quotes & payments — local mirror of the API shapes the screen renders.
 * The backend is the source of truth (AGENTS.md, two-apps sync rule); these
 * types exist so the UI compiles and composes before the endpoints land.
 *
 * Nothing on the screen is hardcoded business data: the KPI figures, the chart
 * series, and the ledger rows all arrive from the API. Money is an integer
 * minor-unit amount plus its ISO 4217 code everywhere (AGENTS.md, Money rules)
 * — the UI never does arithmetic on it, only formats at render.
 */

import type { Money } from './dashboard';

export type { Money };

/*
 * A payment's lifecycle state, which is what the ledger's status chip and its
 * filter tabs both key off. These mirror the backend's payment status enum.
 */
export type PaymentStatus = 'paid' | 'pending_payment' | 'failed';

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
 * How a payment was collected, phrased by the backend. Card payments are a later
 * deployment, so there is no card shape here — only the label the ledger prints.
 *
 * A row that has not been paid yet has no method at all — the ledger prints an
 * em dash for it — so the whole object is nullable on a row.
 */
export type PaymentMethodSummary = {
  label: string; // the backend's phrasing: "USDT (TRC-20)"
};

/*
 * What a ledger row's action control does. The backend decides which action a
 * row offers, so the UI never infers an action from a status:
 *   - `remind`   — an unpaid invoice that can be chased
 *   - `view`     — a settled or terminal row that only opens
 *   - `none`     — no action available (renders as a muted em dash)
 *
 * `label` is the backend's word for it ("Send reminder", "View"), so a wording
 * change never needs a frontend deploy.
 */
export type LedgerActionKind = 'remind' | 'view' | 'none';

export type LedgerAction = {
  kind: LedgerActionKind;
  label: string;
  /*
   * Set on a `remind` the endpoint would refuse right now — the customer was
   * already chased inside the cooldown. The control renders disabled with this
   * sentence rather than looking live and failing on click, and the wording is
   * the backend's for the same reason `label` is.
   */
  disabledReason?: string;
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
 * A USDT (TRC-20) transfer that landed on our deposit address and matched no
 * payment — money nobody can be billed for and nobody can be credited with.
 *
 * TRC-20 carries no memo field, so a transfer is attributed by its amount alone;
 * anything that misses every live payment ends up here for a human to sort out.
 * AGENTS.md requires that such money is never silently dropped, and this queue is
 * where it surfaces.
 *
 * MONEY: the amount arrives as the raw on-chain integer (a string, because it can
 * exceed a safe JS integer) plus a display decimal the backend already formatted.
 * The UI prints `amountDisplay` and never does arithmetic on either — this is not
 * a `Money` object precisely because USDT is not a minor-unit fiat currency.
 */
export type UnmatchedTransferRow = {
  id: string;
  transactionHash: string;
  amountRaw: string;
  amountDisplay: string; // "1.5" — already formatted, never re-derived here
  decimals: number;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  blockAt: string; // ISO-8601 UTC — when the money actually landed
  firstSeenAt: string; // when a sweep first noticed it
  lastSeenAt: string; // the most recent sweep that still saw it unresolved
  /*
   * How many sweeps have re-read this transfer. The poller re-reads an overlap
   * window every interval, so a rising count is the queue's way of saying "still
   * sitting here" — it is not a count of separate transfers.
   */
  sightings: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
};

// `open` is what a reconciler works from; `resolved` is the record of what past
// strays turned out to be.
export type UnmatchedTransferFilter = 'open' | 'resolved' | 'all';

export type UnmatchedTransferPage = {
  rows: UnmatchedTransferRow[];
  nextCursor: string | null;
  // Open items across the whole queue, not just this page, so the section header
  // never has to count rows it happens to have loaded.
  openCount: number;
};

/*
 * --- Manual settlement ---------------------------------------------------
 *
 * Payments only a person can close: every bank transfer — nothing in this system
 * reads a bank feed — plus USDT while an admin has automatic verification
 * switched off in payment settings.
 *
 * Which providers are in the queue is the backend's answer, not a filter this
 * app applies: with the chain sweep running, settling a crypto payment by hand
 * would route around the confirmation depth and the rate lock the customer was
 * quoted, so the API refuses it and the row is simply not listed.
 */
export type SettlementProvider = 'usdt_trc20' | 'wire_transfer';

// `awaiting` is what a settler works from; `closed` covers a payment cancelled
// by the customer or closed out without settling.
export type SettlementStatus = 'awaiting' | 'settled' | 'closed';

export type SettlementRow = {
  id: string;
  provider: SettlementProvider;
  status: SettlementStatus;
  amount: Money;
  /** Pre-resolved by the backend, e.g. "$1,250.00". */
  amountDisplay: string;
  quoteId: string | null;
  reference: string | null;
  serviceName: string | null;
  customerName: string;
  customerEmail: string;
  /** Which bank account the customer was told to send to, for a wire. */
  accountLabel: string | null;
  /**
   * The bank details as the customer saw them, so a settler can check the
   * statement against the account the money was meant to land in without
   * opening the settings screen.
   */
  instructions: { label: string; value: string }[];
  /** When the customer said they had sent it. Null means they have not. */
  markedSentAt: string | null;
  /** The bank's reference or the tx hash, once one has been recorded. */
  providerRef: string | null;
  settledAt: string | null;
  settledBy: string | null;
  settlementNote: string | null;
  createdAt: string;
};

export type SettlementFilter = 'open' | 'settled' | 'all';

export type SettlementPage = {
  rows: SettlementRow[];
  nextCursor: string | null;
  // Open items across the whole queue, not just this page, so the section header
  // never has to count rows it happens to have loaded.
  openCount: number;
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
