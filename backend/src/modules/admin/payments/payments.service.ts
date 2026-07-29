import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { formatUsdtRaw } from '../../../lib/money.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { canSeeAll } from '../admin.guards.js';
import {
  paymentScope,
  quoteScope,
  scopeLabel,
  type DataScope,
} from '../admin.scope.js';
import {
  DEFAULT_CURRENCY,
  formatMoneyDisplay,
  iso,
  isoOrNull,
  money,
  type Money,
  sumMinor,
} from '../admin.views.js';
import type {
  ListLedgerQuery,
  ListUnmatchedQuery,
  PaymentStatusFilter,
  ResolveUnmatchedInput,
  RevenuePeriod,
  UnmatchedTransferFilter,
} from './payments.validation.js';

/*
 * Admin quotes & payments. `billing` owns what is owed and `payments` owns
 * collecting it (AGENTS.md); this module is the staff-side view over both.
 *
 * MONEY: every figure is integer minor units + ISO 4217. Sums are integer
 * addition; the only place a value becomes text is `formatMoneyDisplay`, which
 * splits with integer division rather than dividing into a float. No
 * `parseFloat`, no `toFixed`, anywhere in this file (AGENTS.md, Money).
 *
 * Card payments are a later deployment, so every settlement here is USDT and no
 * shape in this module carries card data of any kind.
 */

// --- Ledger status -------------------------------------------------------
/*
 * The ledger's status is a property of a quote *and* its payments, not of either
 * alone: an unpaid quote is `pending_payment`, a settled one is `paid`.
 * `deriveStatus` and `statusWhere` below are two expressions of one precedence
 * order — a settlement outranks a failure — and must stay in step, or the tab
 * counts would disagree with the rows under them.
 */
export type LedgerStatus = 'paid' | 'pending_payment' | 'failed';

// Every state in which money actually reached us. `includes` is checked against
// arbitrary PaymentStatus values, so the array is widened rather than inferred
// as a tuple of the single literal.
const SETTLED: readonly PaymentStatus[] = [PaymentStatus.SUCCEEDED];

function deriveStatus(
  payments: readonly { status: PaymentStatus }[],
): LedgerStatus {
  const has = (status: PaymentStatus) => payments.some((p) => p.status === status);

  if (has(PaymentStatus.SUCCEEDED)) return 'paid';
  if (has(PaymentStatus.FAILED)) return 'failed';
  return 'pending_payment';
}

function statusWhere(status: LedgerStatus): Prisma.QuoteWhereInput {
  switch (status) {
    case 'paid':
      return { payments: { some: { status: PaymentStatus.SUCCEEDED, deletedAt: null } } };
    case 'failed':
      return {
        payments: { some: { status: PaymentStatus.FAILED, deletedAt: null } },
        AND: [{ payments: { none: { status: { in: [...SETTLED] }, deletedAt: null } } }],
      };
    case 'pending_payment':
      return {
        payments: {
          none: { status: { in: [...SETTLED, PaymentStatus.FAILED] }, deletedAt: null },
        },
      };
  }
}

const STATUS_LABEL: Record<LedgerStatus, string> = {
  paid: 'Paid',
  pending_payment: 'Pending payment',
  failed: 'Failed',
};

// The action a row offers. The backend decides it so the UI never infers an
// action from a status.
const STATUS_ACTION: Record<LedgerStatus, { kind: string; label: string }> = {
  paid: { kind: 'view', label: 'View' },
  pending_payment: { kind: 'remind', label: 'Send reminder' },
  failed: { kind: 'view', label: 'View' },
};

const LEDGER_SCOPE: Prisma.QuoteWhereInput = {
  deletedAt: null,
  // A draft quote has not been issued, so it is not on the ledger yet.
  status: { not: QuoteStatus.DRAFT },
};

// --- Summary -------------------------------------------------------------
export type PaymentsSummary = {
  kpis: {
    id: string;
    label: string;
    value: string;
    caption: string;
    captionTone: 'neutral' | 'warning' | 'success';
    badge?: { label: string; tone: 'neutral' | 'warning' | 'success' };
  }[];
  tabs: { value: PaymentStatusFilter; label: string; count: number }[];
  /*
   * Whether these figures cover the org's money or only the filings this actor
   * holds. The KPI captions below read from it, so a scoped member is told the
   * total is theirs rather than being left to assume it is everyone's.
   */
  scope: DataScope;
};

const LEDGER_STATUSES: readonly LedgerStatus[] = [
  'paid',
  'pending_payment',
  'failed',
];

function startOfUtcMonth(date: Date, monthsAgo = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsAgo, 1, 0, 0, 0, 0),
  );
}

export async function getSummary(actor: AuthContext): Promise<PaymentsSummary> {
  const now = new Date();
  const thisMonth = startOfUtcMonth(now);
  const lastMonth = startOfUtcMonth(now, 1);

  /*
   * The KPIs, the tab counts, and the ledger rows under them all read the same
   * scope — resolved once here and spread into every query below. A tab that
   * counted org-wide while the list showed only this member's rows would be a
   * disclosure in itself: the difference between the two numbers is exactly the
   * volume of work they were not meant to see.
   */
  const seesAll = await canSeeAll(actor, 'payments');
  const quoteWhere = await quoteScope(actor);
  const paymentWhere = await paymentScope(actor);

  const ledgerScope: Prisma.QuoteWhereInput = { ...LEDGER_SCOPE, ...quoteWhere };

  const [
    collected,
    outstanding,
    thisMonthCollected,
    lastMonthCollected,
    totalQuotes,
    counts,
  ] = await Promise.all([
    // Everything that settled.
    prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        deletedAt: null,
        status: PaymentStatus.SUCCEEDED,
      },
      _sum: { amount: true },
    }),
    // What is still owed: issued quotes inside their validity window with
    // nothing settled against them.
    (async () => {
      const where: Prisma.QuoteWhereInput = {
        ...ledgerScope,
        status: QuoteStatus.PENDING,
        validUntil: { gt: now },
        payments: { none: { status: { in: [...SETTLED] }, deletedAt: null } },
      };

      const [count, total] = await Promise.all([
        prisma.quote.count({ where }),
        prisma.quote.aggregate({ where, _sum: { total: true } }),
      ]);

      return { count, total: total._sum.total ?? 0 };
    })(),
    prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        deletedAt: null,
        status: PaymentStatus.SUCCEEDED,
        paidAt: { gte: thisMonth },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        deletedAt: null,
        status: PaymentStatus.SUCCEEDED,
        paidAt: { gte: lastMonth, lt: thisMonth },
      },
      _sum: { amount: true },
    }),
    prisma.quote.count({ where: ledgerScope }),
    Promise.all(
      LEDGER_STATUSES.map((status) =>
        prisma.quote.count({ where: { ...ledgerScope, AND: [statusWhere(status)] } }),
      ),
    ),
  ]);

  const totalCollected = collected._sum.amount ?? 0;
  const thisMonthTotal = thisMonthCollected._sum.amount ?? 0;
  const lastMonthTotal = lastMonthCollected._sum.amount ?? 0;

  // Integer subtraction on minor units, never a float.
  const monthDelta = thisMonthTotal - lastMonthTotal;

  // Every caption says whose money it is counting when the figures are narrowed,
  // so a scoped total is never read as the org's.
  const suffix = seesAll ? '' : ' · assigned to you';

  return {
    scope: scopeLabel(seesAll),
    kpis: [
      {
        id: 'revenue-collected',
        label: 'Revenue collected',
        value: formatMoneyDisplay(money(totalCollected), { compact: true }),
        caption: `All time${suffix}`,
        captionTone: 'neutral',
      },
      {
        id: 'this-month',
        label: 'This month',
        value: formatMoneyDisplay(money(thisMonthTotal), { compact: true }),
        caption: 'vs. last month',
        captionTone: monthDelta >= 0 ? 'success' : 'warning',
        badge: {
          label: `${monthDelta >= 0 ? '+' : '-'}${formatMoneyDisplay(money(Math.abs(monthDelta)), { compact: true })}`,
          tone: monthDelta >= 0 ? 'success' : 'warning',
        },
      },
      {
        id: 'outstanding',
        label: 'Outstanding',
        // "14 / $8,920" — the count of unpaid invoices and what they add to.
        value: `${outstanding.count} / ${formatMoneyDisplay(money(outstanding.total), { compact: true })}`,
        caption: `Invoices issued, awaiting payment${suffix}`,
        captionTone: outstanding.count > 0 ? 'warning' : 'neutral',
      },
    ],
    tabs: [
      { value: 'all', label: 'All', count: totalQuotes },
      ...LEDGER_STATUSES.map((status, index) => ({
        value: status as PaymentStatusFilter,
        label: STATUS_LABEL[status],
        count: counts[index] ?? 0,
      })),
    ],
  };
}

// --- Ledger --------------------------------------------------------------
export type BillingLedgerRow = {
  id: string;
  reference: string;
  customer: { id: string; name: string };
  service: string;
  amount: Money;
  issuedAt: string;
  status: LedgerStatus;
  statusLabel: string;
  method: { label: string } | null;
  action: { kind: string; label: string };
  to: string;
};

export type BillingLedgerPage = {
  rows: BillingLedgerRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

const ledgerInclude = {
  customer: { select: { id: true, name: true } },
  order: { select: { id: true, reference: true } },
  payments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      provider: true,
    },
  },
} satisfies Prisma.QuoteInclude;

type LedgerQuote = Prisma.QuoteGetPayload<{ include: typeof ledgerInclude }>;

// How the money arrived, as the row prints it. One provider today; a row that
// has not been paid yet has no method at all, which the ledger prints as an em
// dash.
const METHOD_LABEL: Record<PaymentProvider, string> = {
  [PaymentProvider.USDT_TRC20]: 'USDT (TRC-20)',
};

function methodOf(quote: LedgerQuote): BillingLedgerRow['method'] {
  const settled = quote.payments.find((payment) => SETTLED.includes(payment.status));
  if (!settled) return null;

  return { label: METHOD_LABEL[settled.provider] };
}

export async function listLedger(
  actor: AuthContext,
  query: ListLedgerQuery,
): Promise<BillingLedgerPage> {
  const where: Prisma.QuoteWhereInput = {
    ...LEDGER_SCOPE,
    // Scoped to the quotes raised against this actor's own orders unless they
    // hold "All data" for payments. Applied to the count as well as the rows —
    // see admin.scope.ts.
    ...(await quoteScope(actor)),
    ...(query.status === 'all' ? {} : { AND: [statusWhere(query.status)] }),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.findMany({
      where,
      include: ledgerInclude,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map((quote) => {
      const status = deriveStatus(quote.payments);

      return {
        id: quote.id,
        // The design prints the order reference the customer recognises; a quote
        // raised without an order falls back to its own.
        reference: quote.order?.reference ?? quote.reference,
        customer: { id: quote.customer.id, name: quote.customer.name },
        service: quote.serviceName,
        amount: money(quote.total, quote.currency),
        issuedAt: iso(quote.issuedAt),
        status,
        statusLabel: STATUS_LABEL[status],
        method: methodOf(quote),
        action: STATUS_ACTION[status],
        // The reference and the view action point at the same record.
        to: quote.order ? `/admin/orders/${quote.order.id}` : '/admin/payments',
      };
    }),
    nextCursor: page.nextCursor,
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- Revenue series ------------------------------------------------------
export type RevenueSeries = {
  period: RevenuePeriod;
  points: { label: string; collected: Money }[];
  maxValue: Money;
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/*
 * Bucket boundaries fall in UTC, and the label is resolved here so the chart
 * never has to know how a period is bucketed or in which zone the boundary sits
 * (AGENTS.md, Dates). Daily buckets read "Jul 06", monthly ones "Mar".
 */
function monthLabel(date: Date): string {
  return MONTHS[date.getUTCMonth()] ?? '';
}

function buckets(period: RevenuePeriod, now: Date) {
  if (period === '12m') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = startOfUtcMonth(now, 11 - index);
      const end = startOfUtcMonth(now, 10 - index);
      return { start, end, label: monthLabel(start) };
    });
  }

  const days = period === '7d' ? 7 : 30;
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  return Array.from({ length: days }, (_, index) => {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (days - 1 - index));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      start,
      end,
      label: `${monthLabel(start)} ${String(start.getUTCDate()).padStart(2, '0')}`,
    };
  });
}

export async function getRevenue(
  actor: AuthContext,
  period: RevenuePeriod,
): Promise<RevenueSeries> {
  const now = new Date();
  const window = buckets(period, now);
  // Every period produces at least seven buckets, so this is defensive only.
  const from = window[0]?.start ?? now;

  // One read of the window, bucketed in memory. A group-by per bucket would be
  // N queries for a chart that never spans more than 30 of them.
  const payments = await prisma.payment.findMany({
    where: {
      ...(await paymentScope(actor)),
      deletedAt: null,
      status: PaymentStatus.SUCCEEDED,
      paidAt: { gte: from },
    },
    select: { amount: true, currency: true, paidAt: true },
  });

  const currency = payments[0]?.currency ?? DEFAULT_CURRENCY;

  const points = window.map((bucket) => ({
    label: bucket.label,
    collected: money(
      sumMinor(
        payments
          .filter(
            (payment) =>
              payment.paidAt && payment.paidAt >= bucket.start && payment.paidAt < bucket.end,
          )
          .map((payment) => payment.amount),
      ),
      currency,
    ),
  }));

  return {
    period,
    points,
    // The axis ceiling travels with the series so the ticks hold still across a
    // period switch instead of re-scaling to the tallest bar on screen.
    maxValue: money(
      Math.max(0, ...points.map((point) => point.collected.amount)),
      currency,
    ),
  };
}

// --- Unattributed transfers ----------------------------------------------

/*
 * The reconciliation queue for USDT that arrived matching no payment.
 *
 * AGENTS.md requires that money we cannot attribute is never silently dropped.
 * The poller records each one as an `UnmatchedTransfer`; this is where a human
 * sees it. Deliberately unscoped by customer, because the defining property of
 * one of these rows is that it belongs to nobody we can name — there is no
 * customer to scope it to, and hiding it from a reviewer would recreate exactly
 * the blind spot the table exists to close.
 *
 * MONEY: the raw integer travels as a string and the display value is built by
 * `formatUsdtRaw`, which never lets the amount pass through a float (AGENTS.md).
 */
export type UnmatchedTransferRow = {
  id: string;
  transactionHash: string;
  /** Raw on-chain integer, as a decimal string. */
  amountRaw: string;
  /** The same amount as a display decimal, e.g. "1.5". */
  amountDisplay: string;
  decimals: number;
  fromAddress: string;
  toAddress: string;
  contractAddress: string;
  blockAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sightings: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
};

export type UnmatchedTransferPage = {
  rows: UnmatchedTransferRow[];
  nextCursor: string | null;
  /** Open items across the whole queue, not just this page — the header count. */
  openCount: number;
};

const UNMATCHED_STATUS_WHERE: Record<
  UnmatchedTransferFilter,
  Prisma.UnmatchedTransferWhereInput
> = {
  open: { resolvedAt: null },
  resolved: { resolvedAt: { not: null } },
  all: {},
};

export async function listUnmatchedTransfers(
  _actor: AuthContext,
  query: ListUnmatchedQuery,
): Promise<UnmatchedTransferPage> {
  const [rows, openCount] = await Promise.all([
    prisma.unmatchedTransfer.findMany({
      where: UNMATCHED_STATUS_WHERE[query.status],
      // Newest transfer first. `blockAt` rather than `firstSeenAt`: a cold start
      // can notice an old transfer today, and the queue should read in the order
      // the money actually arrived.
      orderBy: [{ blockAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    prisma.unmatchedTransfer.count({ where: { resolvedAt: null } }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map((transfer) => {
      const raw = BigInt(transfer.amountRaw.toFixed(0));

      return {
        id: transfer.id,
        transactionHash: transfer.transactionHash,
        amountRaw: raw.toString(),
        amountDisplay: formatUsdtRaw(raw, transfer.decimals),
        decimals: transfer.decimals,
        fromAddress: transfer.fromAddress,
        toAddress: transfer.toAddress,
        contractAddress: transfer.contractAddress,
        blockAt: iso(transfer.blockAt),
        firstSeenAt: iso(transfer.firstSeenAt),
        lastSeenAt: iso(transfer.lastSeenAt),
        sightings: transfer.sightings,
        resolvedAt: isoOrNull(transfer.resolvedAt),
        resolvedBy: transfer.resolvedByName,
        resolutionNote: transfer.resolutionNote,
      };
    }),
    nextCursor: page.nextCursor,
    openCount,
  };
}

/*
 * Close out a stray transfer with a note on what it turned out to be.
 *
 * This moves no money — it is an annotation, which is why it takes no amount
 * and no payment id. Real money owed is collected the one way it always is: the
 * customer pays the quote and the poller credits the transfer it matches.
 *
 * Retry-safe by construction rather than by an Idempotency-Key: the update is
 * conditional on the row still being open, so a double-click or a resent request
 * updates zero rows the second time and the original resolution stands. That is
 * the property AGENTS.md's idempotency rule is after, and a replay has no second
 * side effect it could duplicate.
 */
export async function resolveUnmatchedTransfer(
  actor: AuthContext,
  transferId: string,
  input: ResolveUnmatchedInput,
  now = new Date(),
): Promise<UnmatchedTransferRow> {
  const existing = await prisma.unmatchedTransfer.findUnique({
    where: { id: transferId },
    select: { id: true, resolvedAt: true },
  });

  if (!existing) throw AppError.notFound('Transfer not found');

  if (existing.resolvedAt) {
    throw AppError.conflict('This transfer has already been reconciled');
  }

  const actorName = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  const { count } = await prisma.unmatchedTransfer.updateMany({
    where: { id: transferId, resolvedAt: null },
    data: {
      resolvedAt: now,
      resolvedById: actor.userId,
      resolvedByName: actorName?.name ?? 'Marty Global team',
      resolutionNote: input.note,
    },
  });

  // Zero rows means another reviewer resolved it between the read and the write.
  // Their resolution stands; this caller is told, rather than silently shown a
  // note that is not the one on the record.
  if (count === 0) {
    throw AppError.conflict('This transfer has already been reconciled');
  }

  const resolved = await prisma.unmatchedTransfer.findUniqueOrThrow({
    where: { id: transferId },
  });

  void record({
    actor,
    action: AuditAction.UNMATCHED_TRANSFER_RESOLVED,
    entityType: 'UnmatchedTransfer',
    entityId: resolved.id,
    // Ids and the raw amount as a string. The sender address stays out of the
    // trail the same way it stays out of the logs (AGENTS.md, Security & PII).
    metadata: {
      txHash: resolved.transactionHash,
      amountRaw: resolved.amountRaw.toFixed(0),
      decimals: resolved.decimals,
      sightings: resolved.sightings,
    },
  });

  const raw = BigInt(resolved.amountRaw.toFixed(0));

  return {
    id: resolved.id,
    transactionHash: resolved.transactionHash,
    amountRaw: raw.toString(),
    amountDisplay: formatUsdtRaw(raw, resolved.decimals),
    decimals: resolved.decimals,
    fromAddress: resolved.fromAddress,
    toAddress: resolved.toAddress,
    contractAddress: resolved.contractAddress,
    blockAt: iso(resolved.blockAt),
    firstSeenAt: iso(resolved.firstSeenAt),
    lastSeenAt: iso(resolved.lastSeenAt),
    sightings: resolved.sightings,
    resolvedAt: isoOrNull(resolved.resolvedAt),
    resolvedBy: resolved.resolvedByName,
    resolutionNote: resolved.resolutionNote,
  };
}
