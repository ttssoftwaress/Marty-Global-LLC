import { OrderStatus, PaymentStatus, Prisma, QuoteStatus } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { canSeeAll } from '../admin.guards.js';
import {
  reportCustomerScope,
  reportOrderScope,
  reportPaymentScope,
  scopeLabel,
  type DataScope,
} from '../admin.scope.js';
import {
  DEFAULT_CURRENCY,
  formatMoneyDisplay,
  money,
  sumMinor,
} from '../admin.views.js';
import type { BreakdownDimension, ReportRange } from './reports.validation.js';

/*
 * Admin reports & analytics. Every card on the screen is scoped by the header's
 * one period, so each function here takes the same resolved range.
 *
 * The backend owns every derived figure — trends, percentages, bucket labels,
 * axis ceilings, bar ratios — because the frontend types say so and because it
 * is the only way two cards can be guaranteed to agree. The UI divides nothing.
 *
 * Every read is also scoped to what the actor is entitled to see (admin.scope).
 * The `reviewer` role holds `reports` by default and `reports.all` off, so
 * without this a reviewer's charts would be org-wide revenue — the one number
 * the permission grid is most explicitly trying to withhold.
 *
 * MONEY: integer minor units throughout; the only text conversion is
 * `formatMoneyDisplay`, which uses integer division (AGENTS.md, Money).
 */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const monthLabel = (date: Date): string => MONTHS[date.getUTCMonth()] ?? '';

const CUSTOMER_SCOPE: Prisma.UserWhereInput = {
  deletedAt: null,
  OR: [{ role: Role.CUSTOMER }, { role: null }],
};

const COLLECTED: readonly PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIALLY_REFUNDED,
];

/*
 * Quotes under the reports area. admin.scope has no `reportQuoteScope` because
 * a quote has no assignee of its own — it is derived here by nesting the order
 * scope through `Quote.orderId`, which keeps the one ownership column
 * (`Order.assigneeId`) as the single source rather than inventing a second.
 *
 * `orderId` is nullable, so a quote raised outside an order belongs to nobody
 * and is counted only for the unscoped — the same rule as the rest of the file.
 */
async function reportQuoteScope(
  actor: AuthContext,
): Promise<Prisma.QuoteWhereInput> {
  const scope = await reportOrderScope(actor);
  return Object.keys(scope).length === 0 ? {} : { order: { is: scope } };
}

/*
 * Resolve a period into real bounds, plus the equally long window before it —
 * every KPI's trend is this window against that one.
 *
 * Boundaries are UTC days. A custom range's `to` is inclusive of that whole day,
 * so the exclusive end is the following midnight; without that, picking
 * "1st–7th" would silently drop the 7th.
 */
export type ResolvedRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  /** Whether the series buckets by day or by month. */
  granularity: 'day' | 'month';
};

function utcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function resolveRange(range: ReportRange, now: Date): ResolvedRange {
  const today = utcDay(now);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);

  let start: Date;
  let granularity: ResolvedRange['granularity'] = 'day';

  if (range.period === 'custom' && range.from && range.to) {
    start = new Date(`${range.from}T00:00:00.000Z`);
    const inclusiveEnd = new Date(`${range.to}T00:00:00.000Z`);
    inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);

    const span = inclusiveEnd.getTime() - start.getTime();
    return {
      start,
      end: inclusiveEnd,
      previousStart: new Date(start.getTime() - span),
      previousEnd: start,
      // A window longer than roughly three months is unreadable as daily bars.
      granularity: span > 92 * 24 * 60 * 60 * 1000 ? 'month' : 'day',
    };
  }

  if (range.period === 'ytd') {
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    granularity = 'month';
  } else {
    start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (range.period === '90d' ? 89 : 29));
    granularity = range.period === '90d' ? 'month' : 'day';
  }

  const span = end.getTime() - start.getTime();

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - span),
    previousEnd: start,
    granularity,
  };
}

type Bucket = { start: Date; end: Date; label: string };

function buckets(range: ResolvedRange): Bucket[] {
  if (range.granularity === 'month') {
    const out: Bucket[] = [];
    let cursor = new Date(
      Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1),
    );

    while (cursor < range.end) {
      const next = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
      out.push({ start: cursor, end: next, label: monthLabel(cursor) });
      cursor = next;
    }

    return out;
  }

  const out: Bucket[] = [];
  const cursor = new Date(range.start);

  while (cursor < range.end) {
    const next = new Date(cursor);
    next.setUTCDate(next.getUTCDate() + 1);
    out.push({
      start: new Date(cursor),
      end: next,
      label: `${monthLabel(cursor)} ${String(cursor.getUTCDate()).padStart(2, '0')}`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

// --- Summary -------------------------------------------------------------
export type ReportsSummary = {
  kpis: {
    id: string;
    label: string;
    value: string;
    trend: {
      direction: 'up' | 'down' | 'flat';
      label: string;
      caption: string;
      tone: 'positive' | 'negative' | 'neutral';
    };
    sparkline: number[];
  }[];
  /*
   * Whether these charts cover the org or only this actor's own filings. It
   * travels with the summary because "$40k collected" and "$40k collected on
   * your orders" are the same number with very different meanings, and the
   * browser must not infer which from a role it does not hold.
   */
  scope: DataScope;
};

/*
 * A movement as the design prints it. `direction` is which way the number went;
 * `tone` is whether that is good news — the two are separate because a falling
 * refund rate is `down` and healthy, while a falling conversion rate is `down`
 * and not. `higherIsBetter` is what tells them apart.
 */
function movement(
  current: number,
  previous: number,
  caption: string,
  higherIsBetter = true,
) {
  if (previous === 0) {
    return {
      direction: current > 0 ? ('up' as const) : ('flat' as const),
      label: current > 0 ? 'New' : 'No change',
      caption,
      tone: current > 0 ? (higherIsBetter ? 'positive' : 'negative') : ('neutral' as const),
    } as ReportsSummary['kpis'][number]['trend'];
  }

  // Percentage of a ratio, not of money: rounding here changes a caption, never
  // an amount (AGENTS.md's float rule is about money, which stays integer).
  const percent = ((current - previous) / previous) * 100;
  const rounded = Math.round(percent * 10) / 10;

  const direction = rounded === 0 ? 'flat' : rounded > 0 ? 'up' : 'down';
  const good = rounded === 0 ? 'neutral' : rounded > 0 === higherIsBetter ? 'positive' : 'negative';

  return {
    direction,
    label: `${rounded > 0 ? '+' : ''}${rounded}%`,
    caption,
    tone: good,
  } as ReportsSummary['kpis'][number]['trend'];
}

export async function getSummary(
  actor: AuthContext,
  range: ReportRange,
): Promise<ReportsSummary> {
  const resolved = resolveRange(range, new Date());
  const window = buckets(resolved);

  // Resolved once and spread into all eight reads: the conversion KPI divides
  // paid quotes by orders, so a scope applied to one and not the other would
  // produce a ratio over two different populations.
  const [seesAll, orderScope, paymentScope, customerScope, quoteScope] = await Promise.all([
    canSeeAll(actor, 'reports'),
    reportOrderScope(actor),
    reportPaymentScope(actor),
    reportCustomerScope(actor),
    reportQuoteScope(actor),
  ]);

  const [payments, previousPayments, orders, previousOrders, customers, previousCustomers, paidQuotes, previousPaidQuotes] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          ...paymentScope,
          deletedAt: null,
          status: { in: [...COLLECTED] },
          paidAt: { gte: resolved.start, lt: resolved.end },
        },
        select: { amount: true, currency: true, paidAt: true },
      }),
      prisma.payment.aggregate({
        where: {
          ...paymentScope,
          deletedAt: null,
          status: { in: [...COLLECTED] },
          paidAt: { gte: resolved.previousStart, lt: resolved.previousEnd },
        },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: {
          ...orderScope,
          deletedAt: null,
          createdAt: { gte: resolved.start, lt: resolved.end },
        },
        select: { createdAt: true },
      }),
      prisma.order.count({
        where: {
          ...orderScope,
          deletedAt: null,
          createdAt: { gte: resolved.previousStart, lt: resolved.previousEnd },
        },
      }),
      prisma.user.findMany({
        where: {
          ...customerScope,
          ...CUSTOMER_SCOPE,
          createdAt: { gte: resolved.start, lt: resolved.end },
        },
        select: { createdAt: true },
      }),
      prisma.user.count({
        where: {
          ...customerScope,
          ...CUSTOMER_SCOPE,
          createdAt: { gte: resolved.previousStart, lt: resolved.previousEnd },
        },
      }),
      prisma.quote.count({
        where: {
          ...quoteScope,
          deletedAt: null,
          status: QuoteStatus.PAID,
          paidAt: { gte: resolved.start, lt: resolved.end },
        },
      }),
      prisma.quote.count({
        where: {
          ...quoteScope,
          deletedAt: null,
          status: QuoteStatus.PAID,
          paidAt: { gte: resolved.previousStart, lt: resolved.previousEnd },
        },
      }),
    ]);

  const currency = payments[0]?.currency ?? DEFAULT_CURRENCY;
  const revenue = sumMinor(payments.map((payment) => payment.amount));
  const previousRevenue = previousPayments._sum.amount ?? 0;

  // Conversion: of the orders raised in the window, how many were paid for.
  const conversion = orders.length === 0 ? 0 : (paidQuotes / orders.length) * 100;
  const previousConversion =
    previousOrders === 0 ? 0 : (previousPaidQuotes / previousOrders) * 100;

  const caption = 'vs. previous period';

  // Sparklines show shape only and never print a value, so they are plain
  // per-bucket numbers in the KPI's own unit.
  const revenueSpark = window.map((bucket) =>
    sumMinor(
      payments
        .filter((p) => p.paidAt && p.paidAt >= bucket.start && p.paidAt < bucket.end)
        .map((p) => p.amount),
    ),
  );

  const orderSpark = window.map(
    (bucket) =>
      orders.filter((o) => o.createdAt >= bucket.start && o.createdAt < bucket.end).length,
  );

  const customerSpark = window.map(
    (bucket) =>
      customers.filter((c) => c.createdAt >= bucket.start && c.createdAt < bucket.end)
        .length,
  );

  return {
    kpis: [
      {
        id: 'revenue',
        label: 'Total revenue',
        value: formatMoneyDisplay(money(revenue, currency), { compact: true }),
        trend: movement(revenue, previousRevenue, caption),
        sparkline: revenueSpark,
      },
      {
        id: 'orders',
        label: 'Orders placed',
        value: new Intl.NumberFormat('en-US').format(orders.length),
        trend: movement(orders.length, previousOrders, caption),
        sparkline: orderSpark,
      },
      {
        id: 'customers',
        label: 'New customers',
        value: new Intl.NumberFormat('en-US').format(customers.length),
        trend: movement(customers.length, previousCustomers, caption),
        sparkline: customerSpark,
      },
      {
        id: 'conversion',
        label: 'Order conversion',
        value: `${Math.round(conversion * 10) / 10}%`,
        trend: movement(conversion, previousConversion, caption),
        sparkline: orderSpark,
      },
    ],
    scope: scopeLabel(seesAll),
  };
}

// --- Revenue over time ---------------------------------------------------
export type ReportSeries = {
  points: { label: string; value: number }[];
  maxValue: number;
  valueKind: 'money' | 'count';
  currency?: string;
};

export async function getRevenue(
  actor: AuthContext,
  range: ReportRange,
): Promise<ReportSeries> {
  const resolved = resolveRange(range, new Date());
  const window = buckets(resolved);

  const payments = await prisma.payment.findMany({
    where: {
      ...(await reportPaymentScope(actor)),
      deletedAt: null,
      status: { in: [...COLLECTED] },
      paidAt: { gte: resolved.start, lt: resolved.end },
    },
    select: { amount: true, currency: true, paidAt: true },
  });

  const points = window.map((bucket) => ({
    label: bucket.label,
    value: sumMinor(
      payments
        .filter((p) => p.paidAt && p.paidAt >= bucket.start && p.paidAt < bucket.end)
        .map((p) => p.amount),
    ),
  }));

  return {
    points,
    // The axis ceiling travels with the series so ticks hold still across a
    // period switch instead of re-scaling to the tallest point on screen.
    maxValue: Math.max(0, ...points.map((point) => point.value)),
    valueKind: 'money',
    currency: payments[0]?.currency ?? DEFAULT_CURRENCY,
  };
}

// --- Breakdowns ----------------------------------------------------------
export type ReportBreakdown = {
  slices: { id: string; label: string; count: number; percentage: number }[];
  total: number;
  totalLabel: string;
};

/*
 * The donut cards. The share is resolved here as well as the count, so the UI
 * never divides — and so a rounded set of percentages still reads as intended.
 */
export async function getBreakdown(
  actor: AuthContext,
  dimension: BreakdownDimension,
  range: ReportRange,
): Promise<ReportBreakdown> {
  const resolved = resolveRange(range, new Date());
  const inWindow = { gte: resolved.start, lt: resolved.end };
  const orderScope = await reportOrderScope(actor);

  if (dimension === 'service') {
    const grouped = await prisma.orderItem.groupBy({
      by: ['serviceId', 'serviceName'],
      // An order item has no assignee; it inherits the scope of its order, so
      // the clause merges into the existing relation filter rather than
      // becoming a second one that would replace its window bounds.
      where: {
        order: { is: { ...orderScope, deletedAt: null, createdAt: inWindow } },
      },
      _count: { _all: true },
      orderBy: { _count: { serviceId: 'desc' } },
    });

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

    return {
      slices: grouped.map((row) => ({
        id: row.serviceId,
        label: row.serviceName,
        count: row._count._all,
        percentage: share(row._count._all, total),
      })),
      total,
      totalLabel: 'Services ordered',
    };
  }

  const grouped = await prisma.order.groupBy({
    by: ['regionCode'],
    where: { ...orderScope, deletedAt: null, createdAt: inWindow },
    _count: { _all: true },
    orderBy: { _count: { regionCode: 'desc' } },
  });

  const codes = grouped
    .map((row) => row.regionCode)
    .filter((code): code is string => Boolean(code));

  const regions = await prisma.region.findMany({ where: { code: { in: codes } } });
  const labels = new Map(regions.map((region) => [region.code, region.label]));

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);

  return {
    slices: grouped.map((row) => ({
      id: row.regionCode ?? 'unspecified',
      // An order whose jurisdiction was never captured still gets a slice rather
      // than vanishing from a total the KPI cards also print.
      label: row.regionCode ? (labels.get(row.regionCode) ?? row.regionCode) : 'Not specified',
      count: row._count._all,
      percentage: share(row._count._all, total),
    })),
    total,
    totalLabel: 'Orders',
  };
}

// One decimal place, which is what the donut legend prints.
function share(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

// --- Conversion funnel ---------------------------------------------------
export type FunnelStage = {
  id: string;
  label: string;
  value: string;
  percentage: string;
  barRatio: number;
};

/*
 * The funnel we can actually evidence.
 *
 * The design's top stage implies site visitors, which lives in PostHog rather
 * than this database — inventing a figure for it would be exactly the fabricated
 * statistic AGENTS.md forbids. So the funnel starts at the first step we own.
 *
 * Every stage counts the SAME cohort: the orders raised in the window, then how
 * many of *those* were quoted, then how many of those were paid. Counting each
 * stage over its own window instead would compare different populations, and a
 * later stage could exceed an earlier one — a funnel that widens, with a bar
 * ratio above 1 and a conversion above 100%. Nesting the counts is what makes
 * the shape true by construction rather than by luck of the data.
 *
 * `percentage` is stage-to-stage conversion (each stage's share of the one
 * above); `barRatio` is width against the first stage. They answer different
 * questions, which is why both come down rather than one being derived.
 */
export async function getFunnel(
  actor: AuthContext,
  range: ReportRange,
): Promise<FunnelStage[]> {
  const resolved = resolveRange(range, new Date());
  const inWindow = { gte: resolved.start, lt: resolved.end };

  // The cohort every stage below is measured against. Scoping it once is what
  // keeps the funnel true for a scoped actor: all three stages narrow together,
  // so the shape stays a subset chain rather than widening.
  const cohort: Prisma.OrderWhereInput = {
    ...(await reportOrderScope(actor)),
    deletedAt: null,
    createdAt: inWindow,
  };

  /*
   * Account creation is deliberately not a stage: an existing customer can order
   * again, so orders are not a subset of new accounts and putting the two in one
   * funnel is what produced a widening shape. New customers are already a KPI on
   * the same screen, which is where that figure belongs.
   */
  const [orders, quoted, paid] = await Promise.all([
    prisma.order.count({ where: cohort }),
    // Counted on the order, not the quote, so an order quoted twice is still one
    // order through the stage.
    prisma.order.count({
      where: {
        ...cohort,
        quotes: { some: { deletedAt: null, status: { not: QuoteStatus.DRAFT } } },
      },
    }),
    prisma.order.count({
      where: { ...cohort, quotes: { some: { deletedAt: null, status: QuoteStatus.PAID } } },
    }),
  ]);

  const stages = [
    { id: 'orders', label: 'Applications started', count: orders },
    { id: 'quoted', label: 'Quotes issued', count: quoted },
    { id: 'paid', label: 'Payments completed', count: paid },
  ];

  const top = stages[0]?.count ?? 0;

  return stages.map((stage, index) => {
    const previous = index === 0 ? stage.count : (stages[index - 1]?.count ?? 0);
    const conversion = previous === 0 ? 0 : (stage.count / previous) * 100;

    return {
      id: stage.id,
      label: stage.label,
      value: new Intl.NumberFormat('en-US').format(stage.count),
      percentage: `${index === 0 ? 100 : Math.round(conversion * 10) / 10}%`,
      barRatio: top === 0 ? 0 : stage.count / top,
    };
  });
}

// --- Customer growth -----------------------------------------------------
export type GrowthSeries = {
  points: { label: string; newCustomers: number; cumulative: number }[];
  maxNewCustomers: number;
  maxCumulative: number;
};

export async function getGrowth(
  actor: AuthContext,
  range: ReportRange,
): Promise<GrowthSeries> {
  const resolved = resolveRange(range, new Date());
  const window = buckets(resolved);
  const customerScope = await reportCustomerScope(actor);

  const [created, before] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...customerScope,
        ...CUSTOMER_SCOPE,
        createdAt: { gte: resolved.start, lt: resolved.end },
      },
      select: { createdAt: true },
    }),
    // The running total starts from everyone who already existed, or the line
    // would restart at zero every time the period changes. It carries the same
    // scope as the bars, or the line would start above a total the bars can
    // never reach.
    prisma.user.count({
      where: {
        ...customerScope,
        ...CUSTOMER_SCOPE,
        createdAt: { lt: resolved.start },
      },
    }),
  ]);

  let running = before;

  const points = window.map((bucket) => {
    const newCustomers = created.filter(
      (user) => user.createdAt >= bucket.start && user.createdAt < bucket.end,
    ).length;

    running += newCustomers;
    return { label: bucket.label, newCustomers, cumulative: running };
  });

  return {
    points,
    // A ceiling per series: the cumulative line's totals dwarf the bars, and one
    // shared ceiling would flatten the bars to nothing.
    maxNewCustomers: Math.max(0, ...points.map((point) => point.newCustomers)),
    maxCumulative: Math.max(0, ...points.map((point) => point.cumulative)),
  };
}

export { OrderStatus };
