import {
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { canSeeAll } from '../admin.guards.js';
import {
  paymentScope,
  quoteScope,
  refundScope,
  scopeLabel,
  type DataScope,
} from '../admin.scope.js';
import {
  DEFAULT_CURRENCY,
  formatMoneyDisplay,
  iso,
  money,
  type Money,
  sumMinor,
} from '../admin.views.js';
import type {
  ListLedgerQuery,
  ListRefundsQuery,
  PaymentStatusFilter,
  RefundInput,
  RevenuePeriod,
} from './payments.validation.js';

/*
 * Admin quotes & payments. `billing` owns what is owed and `payments` owns
 * collecting it (AGENTS.md); this module is the staff-side view over both, plus
 * the one write that reverses a collection.
 *
 * MONEY: every figure is integer minor units + ISO 4217. Sums are integer
 * addition; the only place a value becomes text is `formatMoneyDisplay`, which
 * splits with integer division rather than dividing into a float. No
 * `parseFloat`, no `toFixed`, anywhere in this file (AGENTS.md, Money).
 *
 * PCI: a card is brand + last four and nothing else. There is no shape in this
 * module that could carry a PAN or CVC.
 */

// --- Ledger status -------------------------------------------------------
/*
 * The ledger's status is a property of a quote *and* its payments, not of either
 * alone: an unpaid quote is `pending_payment`, a settled one is `paid` until a
 * reversal moves it on. `deriveStatus` and `statusWhere` below are two
 * expressions of one precedence order — a reversal outranks a settlement, which
 * outranks a failure — and must stay in step, or the tab counts would disagree
 * with the rows under them.
 */
export type LedgerStatus =
  | 'paid'
  | 'pending_payment'
  | 'refunded'
  | 'failed'
  | 'partially_refunded';

// Every state in which money actually reached us. `includes` is checked against
// arbitrary PaymentStatus values, so the array is widened rather than inferred
// as a tuple of the three literals.
const SETTLED: readonly PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

function deriveStatus(
  payments: readonly { status: PaymentStatus }[],
): LedgerStatus {
  const has = (status: PaymentStatus) => payments.some((p) => p.status === status);

  if (has(PaymentStatus.REFUNDED)) return 'refunded';
  if (has(PaymentStatus.PARTIALLY_REFUNDED)) return 'partially_refunded';
  if (has(PaymentStatus.SUCCEEDED)) return 'paid';
  if (has(PaymentStatus.FAILED)) return 'failed';
  return 'pending_payment';
}

function statusWhere(status: LedgerStatus): Prisma.QuoteWhereInput {
  switch (status) {
    case 'refunded':
      return { payments: { some: { status: PaymentStatus.REFUNDED, deletedAt: null } } };
    case 'partially_refunded':
      return {
        payments: { some: { status: PaymentStatus.PARTIALLY_REFUNDED, deletedAt: null } },
        AND: [{ payments: { none: { status: PaymentStatus.REFUNDED, deletedAt: null } } }],
      };
    case 'paid':
      return {
        payments: { some: { status: PaymentStatus.SUCCEEDED, deletedAt: null } },
        AND: [
          {
            payments: {
              none: {
                status: { in: [PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
                deletedAt: null,
              },
            },
          },
        ],
      };
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
  refunded: 'Refunded',
  failed: 'Failed',
  partially_refunded: 'Partially refunded',
};

// The action a row offers. The backend decides it so the UI never infers an
// action from a status.
const STATUS_ACTION: Record<LedgerStatus, { kind: string; label: string }> = {
  paid: { kind: 'refund', label: 'Issue refund' },
  partially_refunded: { kind: 'refund', label: 'Issue refund' },
  pending_payment: { kind: 'remind', label: 'Send reminder' },
  refunded: { kind: 'view', label: 'View' },
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
  'partially_refunded',
  'refunded',
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
  const refundWhere = await refundScope(actor);

  const ledgerScope: Prisma.QuoteWhereInput = { ...LEDGER_SCOPE, ...quoteWhere };

  const [
    collected,
    refunded,
    outstanding,
    thisMonthCollected,
    lastMonthCollected,
    totalQuotes,
    counts,
  ] = await Promise.all([
    // Gross collected: everything that settled, before reversals.
    prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        deletedAt: null,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
      },
      _sum: { amount: true },
    }),
    prisma.refund.aggregate({
      where: { ...refundWhere, deletedAt: null },
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
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
        paidAt: { gte: thisMonth },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        deletedAt: null,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
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

  const grossCollected = collected._sum.amount ?? 0;
  const totalRefunded = refunded._sum.amount ?? 0;
  const thisMonthTotal = thisMonthCollected._sum.amount ?? 0;
  const lastMonthTotal = lastMonthCollected._sum.amount ?? 0;

  // Integer subtraction on minor units — net of reversals, never a float.
  const netCollected = grossCollected - totalRefunded;
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
        value: formatMoneyDisplay(money(netCollected), { compact: true }),
        caption: `Net of refunds, all time${suffix}`,
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
      {
        id: 'refunded',
        label: 'Refunded',
        value: formatMoneyDisplay(money(totalRefunded), { compact: true }),
        caption: `Refunds & adjustments, all time${suffix}`,
        captionTone: 'neutral',
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
  method: { label: string; brand?: string; last4?: string } | null;
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
      cardBrand: true,
      cardLast4: true,
    },
  },
} satisfies Prisma.QuoteInclude;

type LedgerQuote = Prisma.QuoteGetPayload<{ include: typeof ledgerInclude }>;

/*
 * How the money arrived, as the row prints it. A card shows its brand and last
 * four — the only card details we hold (AGENTS.md, PCI). A USDT settlement has
 * no card fields and renders from its label alone, and an unpaid row has no
 * method at all, which the ledger prints as an em dash.
 */
function methodOf(quote: LedgerQuote): BillingLedgerRow['method'] {
  const settled = quote.payments.find((payment) => SETTLED.includes(payment.status));
  if (!settled) return null;

  if (settled.provider === PaymentProvider.USDT_TRC20) {
    return { label: 'USDT (TRC-20)' };
  }

  if (!settled.cardBrand) return { label: 'Card' };

  const brand = settled.cardBrand.toLowerCase();
  return {
    label: brand.charAt(0).toUpperCase() + brand.slice(1),
    brand,
    ...(settled.cardLast4 ? { last4: settled.cardLast4 } : {}),
  };
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

// --- Refund log ----------------------------------------------------------
export type RefundLogPage = {
  rows: {
    id: string;
    reference: string;
    customer: { id: string; name: string };
    amount: Money;
    reason: string;
    processedAt: string;
    processedBy: string;
    to: string;
  }[];
  nextCursor: string | null;
};

export async function listRefunds(
  actor: AuthContext,
  query: ListRefundsQuery,
): Promise<RefundLogPage> {
  const rows = await prisma.refund.findMany({
    where: { ...(await refundScope(actor)), deletedAt: null },
    include: {
      payment: {
        include: {
          customer: { select: { id: true, name: true } },
          quote: { select: { reference: true, order: { select: { id: true, reference: true } } } },
        },
      },
    },
    orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(query.cursor, query.limit),
  });

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map((refund) => {
      const order = refund.payment.quote?.order;

      return {
        id: refund.id,
        reference: order?.reference ?? refund.payment.quote?.reference ?? refund.id,
        customer: {
          id: refund.payment.customer.id,
          name: refund.payment.customer.name,
        },
        amount: money(refund.amount, refund.currency),
        reason: refund.reason,
        processedAt: iso(refund.processedAt),
        processedBy: refund.processedByName,
        to: order ? `/admin/orders/${order.id}` : '/admin/payments',
      };
    }),
    nextCursor: page.nextCursor,
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
      status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
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

// --- Write ---------------------------------------------------------------
/*
 * Record a refund against a settled payment.
 *
 * This is a ledger entry, not a call to Stripe: moving the money is a job's work
 * (AGENTS.md — charging, webhooks, and reconciliation run in processors, never
 * in request handlers). What happens here is the part that must be transactional
 * — bounding the amount against what was collected, writing the reversal, and
 * moving the payment's status in one step.
 */
export async function refundPayment(
  actor: AuthContext,
  paymentId: string,
  idempotencyKey: string,
  input: RefundInput,
): Promise<{ id: string; amount: Money; status: string }> {
  /*
   * Retry-safety, before anything else. A client that resends the same key —
   * a flaky network, a double-click on "Issue refund" — must get the original
   * reversal back, not a second one. The unique constraint on the column is the
   * real guarantee; this lookup is what turns a would-be 409 into the same 201
   * the first call returned.
   */
  const replay = await prisma.refund.findUnique({
    where: { idempotencyKey },
    include: { payment: { select: { status: true } } },
  });

  if (replay) {
    return {
      id: replay.id,
      amount: money(replay.amount, replay.currency),
      status:
        replay.payment.status === PaymentStatus.REFUNDED
          ? 'refunded'
          : 'partially_refunded',
    };
  }

  /*
   * The scope is part of the lookup, not a check after it. A payment outside
   * this actor's reach must be indistinguishable from one that does not exist —
   * a 403 here would confirm the record is real, which is the id-probing hole
   * the whole scope model exists to close.
   *
   * This route is `requireAdmin`-gated today, so in practice the clause is
   * redundant. It is written anyway for the same reason the guards are: a write
   * that reverses money must be correct on its own, not because of what happens
   * to be mounted in front of it.
   */
  const payment = await prisma.payment.findFirst({
    where: { ...(await paymentScope(actor)), id: paymentId, deletedAt: null },
    include: { refunds: { where: { deletedAt: null }, select: { amount: true } } },
  });

  if (!payment) throw AppError.notFound('Payment not found');

  if (!SETTLED.includes(payment.status)) {
    throw AppError.businessRule('Only a settled payment can be refunded');
  }

  const alreadyRefunded = sumMinor(payment.refunds.map((refund) => refund.amount));
  const remaining = payment.amount - alreadyRefunded;

  // Integer comparison on minor units. Over-refunding is a business-rule error,
  // never a silent clamp — the operator should see the real remaining figure.
  if (input.amount > remaining) {
    throw AppError.businessRule('Refund exceeds the amount still collected', {
      remaining: { amount: remaining, currency: payment.currency },
    });
  }

  const actorName = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true },
  });

  const nextStatus =
    input.amount === remaining ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;

  const refund = await prisma.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        paymentId,
        amount: input.amount,
        currency: payment.currency,
        reason: input.reason,
        idempotencyKey,
        processedById: actor.userId,
        processedByName: actorName?.name ?? 'Marty Global team',
      },
    });

    await tx.payment.update({ where: { id: paymentId }, data: { status: nextStatus } });

    return created;
  });

  void record({
    actor,
    action: AuditAction.PAYMENT_REFUNDED,
    entityType: 'Payment',
    entityId: paymentId,
    // Amounts in minor units; no card data, no customer PII.
    metadata: {
      refundId: refund.id,
      amount: input.amount,
      currency: payment.currency,
      statusTo: nextStatus,
    },
  });

  return {
    id: refund.id,
    amount: money(refund.amount, refund.currency),
    status: nextStatus === PaymentStatus.REFUNDED ? 'refunded' : 'partially_refunded',
  };
}
