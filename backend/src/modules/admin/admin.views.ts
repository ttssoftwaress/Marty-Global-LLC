import { OrderStatus, type Region } from '@prisma/client';

import { toInitials } from '../../lib/initials.js';

/*
 * View shapes shared by the admin modules. Several screens print the same
 * concept — an order's status chip, a customer's region, a person's avatar — and
 * the frontend types declare each of them exactly once, so the mappers live here
 * rather than being re-derived per module and drifting apart.
 *
 * MONEY: an amount is always integer minor units plus its ISO 4217 code, passed
 * through untouched (AGENTS.md, Money). Nothing in this file divides, rounds, or
 * formats a currency value — the browser does that at render.
 */

export type Money = { amount: number; currency: string };

export const DEFAULT_CURRENCY = 'USD';

export const money = (amount: number, currency = DEFAULT_CURRENCY): Money => ({
  amount,
  currency,
});

// Sum minor units as integers. Explicit so no call site is tempted to reach for
// a float reduce.
export const sumMinor = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

// How many minor units make one major unit, per currency. Anything unlisted is
// the two-decimal default.
const MINOR_UNIT_EXPONENT: Record<string, number> = { JPY: 0, KRW: 0, USDT: 6 };

/*
 * Money as a display string, for the handful of admin fields the frontend
 * declares as pre-resolved (`PaymentsKpi.value`, `ReportKpi.value`,
 * `MailOpsKpi.value`) rather than as a `Money` object it formats itself.
 *
 * AGENTS.md forbids float arithmetic on money, so this does none: the major and
 * minor parts are split with integer division and remainder, grouped as
 * integers, and joined as text. `amount / 100` never happens — which also means
 * a value beyond 2^53 minor units would still print exactly.
 *
 * `compact` drops the fractional part, which is how the design prints revenue
 * headlines ("$127,450").
 */
export function formatMoneyDisplay(
  { amount, currency }: Money,
  { compact = false }: { compact?: boolean } = {},
): string {
  const exponent = MINOR_UNIT_EXPONENT[currency] ?? 2;
  const divisor = 10 ** exponent;

  const negative = amount < 0;
  const absolute = Math.abs(amount);

  const major = Math.trunc(absolute / divisor);
  const minor = absolute % divisor;

  const grouped = new Intl.NumberFormat('en-US').format(major);
  const fraction =
    compact || exponent === 0 ? '' : `.${String(minor).padStart(exponent, '0')}`;

  // USDT is not an ISO 4217 code, so it trails the number as a ticker instead of
  // leading it as a symbol.
  const body = `${grouped}${fraction}`;
  const signed = negative ? `-${body}` : body;

  if (currency === 'USDT') return `${signed} USDT`;
  if (currency === 'USD') return `${negative ? '-' : ''}$${grouped}${fraction}`;
  return `${signed} ${currency}`;
}

/*
 * The order status the wire uses. Prisma stores SCREAMING_SNAKE; every frontend
 * union is lowercase, so the two maps below are the single translation point.
 * `statusLabel` travels with the value so a wording change is a backend deploy
 * only — the frontend chip map owns the glyph and hue, never the words.
 */
export const ORDER_STATUS_VIEW: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'draft',
  [OrderStatus.SUBMITTED]: 'submitted',
  [OrderStatus.UNDER_REVIEW]: 'under_review',
  [OrderStatus.MISSING_INFO]: 'missing_info',
  [OrderStatus.APPROVED]: 'approved',
  [OrderStatus.PAID]: 'paid',
  [OrderStatus.PROCESSING]: 'processing',
  [OrderStatus.COMPLETED]: 'completed',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'Draft',
  [OrderStatus.SUBMITTED]: 'Submitted',
  [OrderStatus.UNDER_REVIEW]: 'Under review',
  [OrderStatus.MISSING_INFO]: 'Missing info',
  [OrderStatus.APPROVED]: 'Approved',
  [OrderStatus.PAID]: 'Paid',
  [OrderStatus.PROCESSING]: 'Processing',
  [OrderStatus.COMPLETED]: 'Completed',
};

// The order the status tabs and the dashboard breakdown are printed in — the
// pipeline's own order, not alphabetical.
export const ORDER_STATUS_SEQUENCE: readonly OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.SUBMITTED,
  OrderStatus.UNDER_REVIEW,
  OrderStatus.MISSING_INFO,
  OrderStatus.APPROVED,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.COMPLETED,
];

/*
 * Work still on the team's plate. "Awaiting review" on the queue header and the
 * dashboard's open-work figures both mean this set, so it is defined once.
 *
 * PROCESSING belongs here and PAID does not: a paid order is waiting on us to
 * pick it up, but nobody is working it yet, whereas a processing filing is
 * actively being worked and is the reviewer's open item until it completes.
 * APPROVED is likewise excluded — the ball is with the customer to pay.
 */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.SUBMITTED,
  OrderStatus.UNDER_REVIEW,
  OrderStatus.MISSING_INFO,
  OrderStatus.PROCESSING,
];

const VIEW_TO_ORDER_STATUS = new Map(
  ORDER_STATUS_SEQUENCE.map((status) => [ORDER_STATUS_VIEW[status], status]),
);

export function toOrderStatus(view: string): OrderStatus | undefined {
  return VIEW_TO_ORDER_STATUS.get(view);
}

/*
 * The order pipeline, as transitions rather than as a list. Staff move an order
 * forward one step at a time; the backend owns which steps exist so the detail
 * screen's status control can render the real choices instead of guessing from
 * the sequence above.
 *
 * MISSING_INFO is the one branch: review can send an order back to the customer,
 * and resolving it returns to review. That return is part of the pipeline, not a
 * backwards move — an order parked on a missing document has to get back into
 * review somehow, and reopening it is the whole point of the status.
 *
 * The tail of the pipeline is APPROVED (priced and offered) → PAID → PROCESSING
 * → COMPLETED. Two of those steps have automation behind them — sending a quote
 * approves the order, and a settled payment marks it paid — but both stay
 * settable by hand here, because money is taken outside the app often enough
 * (a wire, a card read over the phone) that a reviewer must be able to say so
 * without waiting for a webhook. PROCESSING and COMPLETED are manual only:
 * nothing in the system can observe a filing being worked or finished.
 *
 * COMPLETED is terminal. An admin can still set any status (see
 * `allowedNextStatuses`), which is the escape hatch for a mis-click; a staff
 * member cannot, and gets a 422.
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.SUBMITTED],
  [OrderStatus.SUBMITTED]: [OrderStatus.UNDER_REVIEW],
  [OrderStatus.UNDER_REVIEW]: [OrderStatus.MISSING_INFO, OrderStatus.APPROVED],
  [OrderStatus.MISSING_INFO]: [OrderStatus.UNDER_REVIEW],
  [OrderStatus.APPROVED]: [OrderStatus.PAID],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING],
  [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
};

// What this actor may move this order to. An admin overrides the pipeline, so
// they see every status except the one it already holds.
export function allowedNextStatuses(
  current: OrderStatus,
  isAdmin: boolean,
): readonly OrderStatus[] {
  if (isAdmin) {
    return ORDER_STATUS_SEQUENCE.filter((status) => status !== current);
  }
  return ORDER_STATUS_TRANSITIONS[current];
}

/*
 * A person on a row — the customer a queue entry is about, or the staff member
 * it is assigned to. `initials` is resolved server-side (lib/initials.ts) for
 * the reason every admin type documents: a client-side split mangles names it
 * does not expect.
 */
export type Party = { name: string; initials: string };

export const party = (name: string | null | undefined): Party => ({
  name: name ?? 'Unknown',
  initials: toInitials(name),
});

/*
 * A region as a row prints it. `flag` is an emoji — text carried with the row,
 * never an exported asset (Design.md forbids pulling glyph assets), and omitted
 * rather than faked when a region has none.
 */
export type RegionView = { name: string; flag?: string };

export function regionView(
  region: Pick<Region, 'label' | 'flag'> | null | undefined,
  fallback = 'Not specified',
): RegionView {
  if (!region) return { name: fallback };
  return { name: region.label, ...(region.flag ? { flag: region.flag } : {}) };
}

// ISO-8601 UTC on the wire; the browser converts to the viewer's zone at render
// (AGENTS.md, Dates). Nullable dates stay null rather than becoming a sentinel
// string — every consuming type declares `string | null` and prints an em dash.
export const iso = (date: Date): string => date.toISOString();
export const isoOrNull = (date: Date | null | undefined): string | null =>
  date ? date.toISOString() : null;
