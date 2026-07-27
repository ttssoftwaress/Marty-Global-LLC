import {
  MailRequestStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { canSeeAll } from '../admin.guards.js';
import {
  dashboardCustomerScope,
  dashboardMailItemScope,
  dashboardMailRequestScope,
  dashboardOrderScope,
  dashboardPaymentScope,
  dashboardQuoteScope,
  scopeLabel,
  type DataScope,
} from '../admin.scope.js';
import {
  iso,
  money,
  type Money,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_SEQUENCE,
  ORDER_STATUS_VIEW,
  OPEN_ORDER_STATUSES,
} from '../admin.views.js';
import type { DashboardPeriod } from './dashboard.validation.js';

/*
 * The admin home screen. One query composes it from the orders, billing,
 * customers, support, and mail-room tables, so every figure agrees with the page
 * it links to — that is the whole reason this is a single endpoint rather than
 * five the screen stitches together.
 *
 * This route carries no `requirePermission` and deliberately never will: every
 * staff member lands here, whatever they hold. Scoping is therefore the only
 * access control on the screen, not a refinement of one — without it a mail
 * operator with no orders, payments, or reports grant reads org revenue, the
 * full order pipeline, and customer names off the home page. The scope keys off
 * `orders` (admin.scope explains why that is the closest thing to "overseer").
 *
 * MONEY: integer minor units + ISO 4217, summed as integers (AGENTS.md, Money).
 */

export type DashboardSummary = {
  period: DashboardPeriod;
  /*
   * Whether the screen covers the org or only this actor's own filings. It
   * travels with the summary because "8 new applications" and "8 new
   * applications assigned to you" are the same number with very different
   * meanings, and the browser must not infer which from a role it does not hold.
   */
  scope: DataScope;
  metrics: {
    id: string;
    label: string;
    value: { kind: 'count'; count: number } | { kind: 'money'; money: Money };
    caption: string;
    trend: { direction: 'up' | 'down' | 'flat'; label: string };
  }[];
  ordersByStatus: { status: string; label: string; count: number }[];
  recentActivity: {
    id: string;
    kind: 'application' | 'payment' | 'document' | 'approval' | 'quote' | 'mail';
    message: string;
    occurredAt: string;
    to?: string;
  }[];
  attention: {
    total: number;
    items: {
      id: string;
      title: string;
      detail: string;
      actionLabel: string;
      to: string;
      emphasis: 'default' | 'urgent' | 'critical';
    }[];
  };
};

/*
 * The window a period means, plus the equally long window before it — the trend
 * on each KPI is this period against that one, which is what makes "+3 this
 * week" a real comparison rather than a decoration.
 *
 * Boundaries are UTC. A jurisdiction-local boundary would be the right call for
 * a filing deadline (AGENTS.md, Dates); a dashboard counting the team's own work
 * has no jurisdiction to be local to.
 */
function windows(period: DashboardPeriod, now: Date) {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (period === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (period === 'month') start.setUTCDate(start.getUTCDate() - 29);

  const spanMs = now.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - spanMs);

  return { start, previousStart, previousEnd: start };
}

const PERIOD_CAPTION: Record<DashboardPeriod, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
};

// The arrow and hue come from the backend, so the UI never has to know which way
// is good for a given metric.
function trend(current: number, previous: number, caption: string) {
  const delta = current - previous;
  if (delta === 0) return { direction: 'flat' as const, label: `No change ${caption}` };

  return {
    direction: delta > 0 ? ('up' as const) : ('down' as const),
    label: `${delta > 0 ? '+' : ''}${delta} ${caption}`,
  };
}

export async function getSummary(
  actor: AuthContext,
  period: DashboardPeriod,
): Promise<DashboardSummary> {
  const now = new Date();
  const { start, previousStart, previousEnd } = windows(period, now);
  const caption = PERIOD_CAPTION[period];

  const inWindow = { gte: start };
  const inPrevious = { gte: previousStart, lt: previousEnd };

  // Both windows of a trend take the same scope, or the comparison would be
  // this actor's period against the org's previous one.
  const [seesAll, orderScope, customerScope, paymentScope] = await Promise.all([
    canSeeAll(actor, 'orders'),
    dashboardOrderScope(actor),
    dashboardCustomerScope(actor),
    dashboardPaymentScope(actor),
  ]);

  const [
    newOrders,
    newOrdersBefore,
    awaitingReview,
    newCustomers,
    newCustomersBefore,
    collected,
    collectedBefore,
    byStatus,
    activity,
    attention,
  ] = await Promise.all([
    prisma.order.count({
      where: { ...orderScope, deletedAt: null, createdAt: inWindow },
    }),
    prisma.order.count({
      where: { ...orderScope, deletedAt: null, createdAt: inPrevious },
    }),
    prisma.order.count({
      where: {
        ...orderScope,
        deletedAt: null,
        status: { in: [...OPEN_ORDER_STATUSES] },
      },
    }),
    prisma.user.count({
      where: {
        ...customerScope,
        deletedAt: null,
        OR: [{ role: Role.CUSTOMER }, { role: null }],
        createdAt: inWindow,
      },
    }),
    prisma.user.count({
      where: {
        ...customerScope,
        deletedAt: null,
        OR: [{ role: Role.CUSTOMER }, { role: null }],
        createdAt: inPrevious,
      },
    }),
    prisma.payment.aggregate({
      where: {
        ...paymentScope,
        deletedAt: null,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
        paidAt: inWindow,
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        ...paymentScope,
        deletedAt: null,
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED] },
        paidAt: inPrevious,
      },
      _sum: { amount: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { ...orderScope, deletedAt: null },
      _count: { _all: true },
    }),
    recentActivity(actor),
    needsAttention(actor, now),
  ]);

  const statusCounts = new Map(byStatus.map((row) => [row.status, row._count._all]));
  const collectedNow = collected._sum.amount ?? 0;
  const collectedBeforeTotal = collectedBefore._sum.amount ?? 0;

  return {
    period,
    scope: scopeLabel(seesAll),
    metrics: [
      {
        id: 'new-applications',
        label: 'New applications',
        value: { kind: 'count', count: newOrders },
        caption: 'Submitted in this period',
        trend: trend(newOrders, newOrdersBefore, caption),
      },
      {
        id: 'awaiting-review',
        label: 'Awaiting review',
        value: { kind: 'count', count: awaitingReview },
        caption: 'Open across all periods',
        // A backlog figure has no period to trend against — it is a level, not a
        // flow — so it reads flat with the queue's own wording.
        trend: { direction: 'flat', label: 'Open work queue' },
      },
      {
        id: 'revenue',
        label: 'Revenue collected',
        value: { kind: 'money', money: money(collectedNow) },
        caption: 'Settled payments in this period',
        trend: {
          direction:
            collectedNow === collectedBeforeTotal
              ? 'flat'
              : collectedNow > collectedBeforeTotal
                ? 'up'
                : 'down',
          label: `vs. previous ${caption.replace('this ', '')}`,
        },
      },
      {
        id: 'new-customers',
        label: 'New customers',
        value: { kind: 'count', count: newCustomers },
        caption: 'Accounts created in this period',
        trend: trend(newCustomers, newCustomersBefore, caption),
      },
    ],
    ordersByStatus: ORDER_STATUS_SEQUENCE.map((status) => ({
      status: ORDER_STATUS_VIEW[status],
      label: ORDER_STATUS_LABEL[status],
      count: statusCounts.get(status) ?? 0,
    })),
    recentActivity: activity,
    attention,
  };
}

/*
 * The activity feed. Four sources, merged and cut to the newest few — the design
 * shows one stream, and reading each source's own newest rows is far cheaper
 * than a union view over five tables.
 */
async function recentActivity(
  actor: AuthContext,
): Promise<DashboardSummary['recentActivity']> {
  const take = 6;

  // Every entry names a customer, so an unscoped feed is a customer list a
  // scoped actor is not entitled to — the scope has to reach all four sources,
  // not just the ones that carry money.
  const [orderScope, paymentScope, quoteScope, mailScope] = await Promise.all([
    dashboardOrderScope(actor),
    dashboardPaymentScope(actor),
    dashboardQuoteScope(actor),
    dashboardMailItemScope(actor),
  ]);

  const [orders, payments, quotes, mail] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderScope, deletedAt: null },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.payment.findMany({
      where: { ...paymentScope, deletedAt: null, status: PaymentStatus.SUCCEEDED },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.quote.findMany({
      where: { ...quoteScope, deletedAt: null, status: { not: QuoteStatus.DRAFT } },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.mailItem.findMany({
      where: { ...mailScope, deletedAt: null },
      include: { room: { include: { customer: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take,
    }),
  ]);

  const entries: (DashboardSummary['recentActivity'][number] & { at: Date })[] = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      kind: 'application' as const,
      message: `${order.customer.name} submitted ${order.reference}.`,
      occurredAt: iso(order.submittedAt ?? order.createdAt),
      to: `/admin/orders/${order.id}`,
      at: order.submittedAt ?? order.createdAt,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      kind: 'payment' as const,
      message: `${payment.customer.name} completed a payment.`,
      occurredAt: iso(payment.paidAt ?? payment.createdAt),
      to: '/admin/payments',
      at: payment.paidAt ?? payment.createdAt,
    })),
    ...quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      kind: 'quote' as const,
      message: `Quote ${quote.reference} issued to ${quote.customer.name}.`,
      occurredAt: iso(quote.issuedAt),
      to: '/admin/payments',
      at: quote.issuedAt,
    })),
    ...mail.map((item) => ({
      id: `mail-${item.id}`,
      kind: 'mail' as const,
      message: `Mail filed for ${item.room.customer.name}.`,
      occurredAt: iso(item.createdAt),
      to: '/admin/mailroom',
      at: item.createdAt,
    })),
  ];

  return entries
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8)
    .map(({ at: _at, ...entry }) => entry);
}

/*
 * The "Needs attention" queue. `emphasis` is what the design reads by: outline
 * for routine work, solid navy once it is overdue, solid accent when a customer
 * is blocked waiting on us.
 */
async function needsAttention(
  actor: AuthContext,
  now: Date,
): Promise<DashboardSummary['attention']> {
  const staleCutoff = new Date(now);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 3);

  const expiringSoon = new Date(now);
  expiringSoon.setUTCDate(expiringSoon.getUTCDate() + 7);

  const [seesAll, orderScope, quoteScope, mailScope] = await Promise.all([
    canSeeAll(actor, 'orders'),
    dashboardOrderScope(actor),
    dashboardQuoteScope(actor),
    dashboardMailRequestScope(actor),
  ]);

  const [missingInfo, unassigned, stale, expiring, mailQueue] = await Promise.all([
    prisma.order.count({
      where: { ...orderScope, deletedAt: null, status: OrderStatus.MISSING_INFO },
    }),
    /*
     * The unassigned pool is rota information, not work: it is a queue for
     * whoever distributes it, and `canSeeAll('orders')` is exactly the actor who
     * does (admin.guards folds `orders.assign` into it). Scoping the count by
     * assignee would be self-defeating anyway — "assigned to me AND assigned to
     * nobody" is always zero — so rather than print a permanent 0 tile, a scoped
     * actor is not told how large a pool they cannot see or act on.
     */
    seesAll
      ? prisma.order.count({
          where: {
            deletedAt: null,
            assigneeId: null,
            status: { in: [...OPEN_ORDER_STATUSES] },
          },
        })
      : 0,
    prisma.order.count({
      where: {
        ...orderScope,
        deletedAt: null,
        status: { in: [...OPEN_ORDER_STATUSES] },
        createdAt: { lt: staleCutoff },
      },
    }),
    prisma.quote.count({
      where: {
        ...quoteScope,
        deletedAt: null,
        status: QuoteStatus.PENDING,
        validUntil: { gt: now, lt: expiringSoon },
      },
    }),
    prisma.mailRequest.count({
      where: { ...mailScope, deletedAt: null, status: MailRequestStatus.PENDING },
    }),
  ]);

  const items: DashboardSummary['attention']['items'] = [];

  // A customer who cannot proceed until we act comes first, and reads critical.
  if (missingInfo > 0) {
    items.push({
      id: 'missing-info',
      title: `${missingInfo} application${missingInfo === 1 ? '' : 's'} missing information`,
      detail: 'The customer is blocked until the team responds.',
      actionLabel: 'Review',
      to: '/admin/orders?status=missing_info',
      emphasis: 'critical',
    });
  }

  if (stale > 0) {
    items.push({
      id: 'stale-orders',
      title: `${stale} order${stale === 1 ? '' : 's'} open for over 3 days`,
      detail: 'Older than the review target.',
      actionLabel: 'Review',
      to: '/admin/orders',
      emphasis: 'urgent',
    });
  }

  if (expiring > 0) {
    items.push({
      id: 'expiring-quotes',
      title: `${expiring} quote${expiring === 1 ? '' : 's'} expiring within 7 days`,
      detail: 'Unpaid and approaching their validity date.',
      actionLabel: 'View',
      to: '/admin/payments',
      emphasis: 'urgent',
    });
  }

  if (unassigned > 0) {
    items.push({
      id: 'unassigned',
      title: `${unassigned} order${unassigned === 1 ? '' : 's'} unassigned`,
      detail: 'Waiting to be picked up by a reviewer.',
      actionLabel: 'Assign',
      to: '/admin/orders',
      emphasis: 'default',
    });
  }

  if (mailQueue > 0) {
    items.push({
      id: 'mail-requests',
      title: `${mailQueue} mail request${mailQueue === 1 ? '' : 's'} pending`,
      detail: 'Forwarding and shredding waiting on an operator.',
      actionLabel: 'Open',
      to: '/admin/mailroom',
      emphasis: 'default',
    });
  }

  return {
    total: missingInfo + stale + expiring + unassigned + mailQueue,
    items,
  };
}

export type { Prisma };
