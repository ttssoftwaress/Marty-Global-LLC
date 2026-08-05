import {
  FeedNotificationCategory,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import { publicAppUrl } from '../../../config/env.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { logger } from '../../../lib/logger.js';
import { formatUsdtRaw } from '../../../lib/money.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { createFeedNotification } from '../../notifications/notifications.feed.js';
import { channelsFor } from '../../notifications/notifications.preferences.js';
import { queueEmail } from '../../notifications/notifications.service.js';
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
import { readWireInstructions } from '../../payments/payment-settings.service.js';
/*
 * The settlement writes live in the payments module, not here. This module is
 * the staff-side VIEW over money; the money path — crediting a quote, carrying
 * its order to PAID, the conditional write that makes two settlers credit once —
 * belongs beside the poller that shares it, so a manually-settled invoice and a
 * chain-credited one cannot diverge (AGENTS.md: business logic lives in
 * services, once).
 */
import {
  manualProviders,
  rejectPayment as rejectPaymentInService,
  settlePaymentManually,
} from '../../payments/payments.service.js';
import type {
  ListLedgerQuery,
  ListSettlementsQuery,
  ListUnmatchedQuery,
  PaymentStatusFilter,
  RejectPaymentInput,
  ResolveUnmatchedInput,
  RevenuePeriod,
  SettlementFilter,
  SettlePaymentInput,
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

/*
 * How long a customer is left alone after a reminder. A chase is a real email to
 * a real person, so the ledger's own control is what stops us sending three of
 * them in a morning — the cooldown is enforced as a conditional update on
 * `lastRemindedAt` (see `remindQuote`), and the row carries the reason so the
 * button reads as spent rather than 422-ing on click.
 */
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const VIEW_ACTION = { kind: 'view', label: 'View' } as const;

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
  /*
   * What the row offers, decided here so the UI never infers an action from a
   * status. `disabledReason` is set on a `remind` the endpoint would refuse right
   * now — the control is drawn disabled with that sentence beside it instead of
   * looking live and failing on click (Design.md, the states Figma doesn't draw).
   */
  action: { kind: string; label: string; disabledReason?: string };
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

// How the money arrived, as the row prints it. A row that has not been paid yet
// has no method at all, which the ledger prints as an em dash.
const METHOD_LABEL: Record<PaymentProvider, string> = {
  [PaymentProvider.USDT_TRC20]: 'USDT (TRC-20)',
  [PaymentProvider.WIRE_TRANSFER]: 'Bank transfer',
};

function methodOf(quote: LedgerQuote): BillingLedgerRow['method'] {
  const settled = quote.payments.find((payment) => SETTLED.includes(payment.status));
  if (!settled) return null;

  return { label: METHOD_LABEL[settled.provider] };
}

/*
 * Whether this quote can still be chased, and why not when it can't. One
 * function so the row's control and `remindQuote`'s guard can never disagree
 * about it — a button that offers something the endpoint refuses is the failure
 * this replaces.
 *
 * An expired or withdrawn offer is deliberately not remindable: chasing payment
 * for a price that no longer stands is not a reminder, it is a new quote.
 */
function remindBlockedReason(
  quote: Pick<LedgerQuote, 'status' | 'validUntil' | 'lastRemindedAt'>,
  now: Date,
): string | null {
  if (quote.status !== QuoteStatus.PENDING || quote.validUntil <= now) {
    return 'This quote is no longer live, so it can’t be chased. Send a new one instead.';
  }

  if (
    quote.lastRemindedAt &&
    now.getTime() - quote.lastRemindedAt.getTime() < REMINDER_COOLDOWN_MS
  ) {
    return 'A reminder for this invoice was already sent in the last 24 hours.';
  }

  return null;
}

function actionFor(
  quote: LedgerQuote,
  status: LedgerStatus,
  now: Date,
): BillingLedgerRow['action'] {
  if (status !== 'pending_payment') return { ...VIEW_ACTION };

  const blocked = remindBlockedReason(quote, now);

  // An offer that has lapsed cannot be chased at all, so the row falls back to
  // the action that always applies rather than showing a permanently dead one.
  if (blocked && quote.status !== QuoteStatus.PENDING) return { ...VIEW_ACTION };
  if (blocked && quote.validUntil <= now) return { ...VIEW_ACTION };

  return {
    kind: 'remind',
    label: 'Send reminder',
    ...(blocked ? { disabledReason: blocked } : {}),
  };
}

function toLedgerRow(quote: LedgerQuote, now: Date): BillingLedgerRow {
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
    action: actionFor(quote, status, now),
    // The reference and the view action point at the same record.
    to: quote.order ? `/admin/orders/${quote.order.id}` : '/admin/payments',
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
  const now = new Date();

  return {
    rows: page.rows.map((quote) => toLedgerRow(quote, now)),
    nextCursor: page.nextCursor,
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- One ledger row, in full ---------------------------------------------

/*
 * What the ledger's expanded row reads.
 *
 * None of this is on the list, and deliberately: the itemised breakdown and the
 * attempt history are two extra joins per quote, and a page of the ledger would
 * pay for both on every row to render detail nobody has opened. The list stays
 * one query over quotes; this is the second query, for the one row somebody is
 * looking at.
 *
 * MONEY: every figure stays integer minor units through `money()`; the only
 * arithmetic is the integer sum the quote already stores separately.
 */
export type LedgerAttempt = {
  id: string;
  provider: 'usdt_trc20' | 'wire_transfer';
  providerLabel: string;
  status: PaymentStatus;
  amount: Money;
  providerRef: string | null;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
};

export type LedgerRowDetail = {
  id: string;
  reference: string;
  quoteReference: string;
  customer: { id: string; name: string; email: string };
  service: string;
  status: LedgerStatus;
  statusLabel: string;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  issuedAt: string;
  validUntil: string;
  paidAt: string | null;
  lastRemindedAt: string | null;
  reminderCount: number;
  items: { id: string; label: string; amount: Money }[];
  attempts: LedgerAttempt[];
  order: { id: string; reference: string; to: string } | null;
};

const PROVIDER_KEY = {
  [PaymentProvider.USDT_TRC20]: 'usdt_trc20',
  [PaymentProvider.WIRE_TRANSFER]: 'wire_transfer',
} as const;

export async function getLedgerRow(
  actor: AuthContext,
  quoteId: string,
): Promise<LedgerRowDetail> {
  const quote = await prisma.quote.findFirst({
    // The same scope the list applied. A row a member cannot see in the ledger
    // must not become readable by asking for its detail directly.
    where: { ...LEDGER_SCOPE, ...(await quoteScope(actor)), id: quoteId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, reference: true } },
      lineItems: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      payments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!quote) throw AppError.notFound('Quote not found');

  const status = deriveStatus(quote.payments);

  return {
    id: quote.id,
    reference: quote.order?.reference ?? quote.reference,
    quoteReference: quote.reference,
    customer: quote.customer,
    service: quote.serviceName,
    status,
    statusLabel: STATUS_LABEL[status],
    subtotal: money(quote.subtotal, quote.currency),
    discount: money(quote.discount, quote.currency),
    tax: money(quote.tax, quote.currency),
    total: money(quote.total, quote.currency),
    issuedAt: iso(quote.issuedAt),
    validUntil: iso(quote.validUntil),
    paidAt: isoOrNull(quote.paidAt),
    lastRemindedAt: isoOrNull(quote.lastRemindedAt),
    reminderCount: quote.reminderCount,
    items: quote.lineItems.map((item) => ({
      id: item.id,
      label: item.label,
      amount: money(item.amount, quote.currency),
    })),
    /*
     * Every attempt, not just the settled one. A reconciler opening this row is
     * usually asking why an invoice is still open, and "one failed USDT intent
     * that expired" is the answer the ledger row itself cannot give.
     */
    attempts: quote.payments.map((payment) => ({
      id: payment.id,
      provider: PROVIDER_KEY[payment.provider],
      providerLabel: METHOD_LABEL[payment.provider],
      status: payment.status,
      amount: money(payment.amount, payment.currency),
      providerRef: payment.providerRef,
      createdAt: iso(payment.createdAt),
      paidAt: isoOrNull(payment.paidAt),
      failureReason: payment.failureReason,
    })),
    order: quote.order
      ? {
          id: quote.order.id,
          reference: quote.order.reference,
          to: `/admin/orders/${quote.order.id}`,
        }
      : null,
  };
}

// --- Payment reminder ----------------------------------------------------
/*
 * Chase an unpaid invoice — the write behind the ledger's "Send reminder".
 *
 * It moves no money and changes no amount: the customer is told again about a
 * price that was already quoted, through the same queued channels every other
 * customer-facing message uses (AGENTS.md — email always leaves from a job,
 * never inline in a request handler).
 *
 * Retry-safe without an Idempotency-Key, the same way the transfer resolve is:
 * the cooldown is claimed with a conditional update, so a double-click, a
 * resent request, or two reviewers working the same row send exactly one email.
 * The claim is taken before anything is queued, so the losing caller is told
 * rather than quietly sending a second chase.
 *
 * The actor's own quote scope gates it. A member without "All data" for payments
 * can chase the invoices on their own filings and nothing else — the same
 * boundary the list they clicked from applies.
 */
export async function remindQuote(
  actor: AuthContext,
  quoteId: string,
  now = new Date(),
): Promise<BillingLedgerRow> {
  const quote = await prisma.quote.findFirst({
    where: { ...LEDGER_SCOPE, ...(await quoteScope(actor)), id: quoteId },
    include: ledgerInclude,
  });

  if (!quote) throw AppError.notFound('Quote not found');

  if (deriveStatus(quote.payments) !== 'pending_payment') {
    throw AppError.businessRule(
      'This invoice is not awaiting payment, so there is nothing to chase.',
    );
  }

  const blocked = remindBlockedReason(quote, now);
  if (blocked) throw AppError.businessRule(blocked);

  /*
   * What the customer chose to hear about a quote. A reminder is the same
   * category as the quote it chases (`quoteAlerts`), so a customer who muted
   * those is not reached by re-sending one under another name. Checked before
   * the claim below so a refused send does not burn the cooldown.
   */
  const alerts = await channelsFor(quote.customerId, 'quoteAlerts');

  if (!alerts.email && !alerts.inApp) {
    throw AppError.businessRule(
      'This customer has turned off quote alerts, so a reminder cannot be sent to them.',
    );
  }

  const cooldownFrom = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  const claim = await prisma.quote.updateMany({
    where: {
      id: quote.id,
      status: QuoteStatus.PENDING,
      validUntil: { gt: now },
      OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lte: cooldownFrom } }],
    },
    data: { lastRemindedAt: now, reminderCount: { increment: 1 } },
  });

  // Someone else chased this invoice between the read above and the write.
  if (claim.count === 0) {
    throw AppError.businessRule(
      'A reminder for this invoice was already sent in the last 24 hours.',
    );
  }

  const amount = formatMoneyDisplay(money(quote.total, quote.currency));
  const reference = quote.order?.reference ?? quote.reference;
  const href = quote.order ? `/app/orders/${quote.order.id}` : '/app/billing';

  // `createFeedNotification` writes the row and pushes the new unread count
  // itself, so nothing else is emitted here.
  if (alerts.inApp) {
    await createFeedNotification({
      userId: quote.customerId,
      category: FeedNotificationCategory.BILLING,
      message: `Quote ${quote.reference} for ${amount} on ${reference} is still awaiting payment.`,
      href: `/app/billing/quotes/${quote.id}`,
    }).catch((error: unknown) => {
      logger.error({ err: error, quoteId: quote.id }, 'Failed to write a reminder feed row');
    });
  }

  if (alerts.email) {
    const customer = await prisma.user.findUnique({
      where: { id: quote.customerId },
      select: { email: true },
    });

    if (customer?.email) {
      // The cooldown is already claimed, so a failure to queue must not fail the
      // request — the same posture as every other notification in the codebase.
      await queueEmail({
        to: customer.email,
        subject: `Reminder: quote ${quote.reference} is awaiting payment`,
        template: 'generic',
        heading: 'A payment is still outstanding',
        body: `Quote ${quote.reference} for ${amount} on ${reference} hasn't been paid yet. It's valid until ${quote.validUntil.toISOString().slice(0, 10)}.`,
        actionLabel: 'View quote',
        actionUrl: `${publicAppUrl}${href}`,
        userId: quote.customerId,
      }).catch((error: unknown) => {
        logger.error({ err: error, quoteId: quote.id }, 'Failed to queue a reminder email');
      });
    }
  }

  void record({
    actor,
    action: AuditAction.PAYMENT_REMINDER_SENT,
    entityType: 'Quote',
    entityId: quote.id,
    // A reference, minor units, and which channels went out. No customer name
    // and no email address (AGENTS.md, Security & PII).
    metadata: {
      reference: quote.reference,
      orderReference: quote.order?.reference ?? null,
      total: quote.total,
      currency: quote.currency,
      channels: { email: alerts.email, inApp: alerts.inApp },
      reminderCount: quote.reminderCount + 1,
    },
  });

  logger.info({ quoteId: quote.id }, 'Payment reminder sent');

  // The row as it now reads: the cooldown this send just started is what makes
  // the control come back disabled rather than inviting a second chase.
  return toLedgerRow({ ...quote, lastRemindedAt: now }, now);
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
  /** The amount as a display decimal, e.g. "1.5". */
  amountDisplay: string;
  fromAddress: string;
  blockAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

/*
 * The expanded row: the chain facts a reconciler needs only once they are
 * actually chasing this transfer — which address it landed in, which contract
 * it came through, the raw integer, how many sweeps have seen it, and the note
 * whoever closed it left.
 *
 * Split out rather than shipped with the list because the queue is scanned by
 * hash, amount, and age; the addresses are 34 characters each and were being
 * sent for every row to be read on almost none of them.
 */
export type UnmatchedTransferDetail = UnmatchedTransferRow & {
  /** Raw on-chain integer, as a decimal string. */
  amountRaw: string;
  decimals: number;
  toAddress: string;
  contractAddress: string;
  sightings: number;
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

type UnmatchedRecord = Prisma.UnmatchedTransferGetPayload<object>;

function toUnmatchedRow(transfer: UnmatchedRecord): UnmatchedTransferRow {
  // The raw integer never becomes a float: it is read as a BigInt and formatted
  // by integer division (AGENTS.md, Money).
  const raw = BigInt(transfer.amountRaw.toFixed(0));

  return {
    id: transfer.id,
    transactionHash: transfer.transactionHash,
    amountDisplay: formatUsdtRaw(raw, transfer.decimals),
    fromAddress: transfer.fromAddress,
    blockAt: iso(transfer.blockAt),
    firstSeenAt: iso(transfer.firstSeenAt),
    lastSeenAt: iso(transfer.lastSeenAt),
    resolvedAt: isoOrNull(transfer.resolvedAt),
    resolvedBy: transfer.resolvedByName,
  };
}

function toUnmatchedDetail(transfer: UnmatchedRecord): UnmatchedTransferDetail {
  return {
    ...toUnmatchedRow(transfer),
    amountRaw: BigInt(transfer.amountRaw.toFixed(0)).toString(),
    decimals: transfer.decimals,
    toAddress: transfer.toAddress,
    contractAddress: transfer.contractAddress,
    sightings: transfer.sightings,
    resolutionNote: transfer.resolutionNote,
  };
}

/*
 * One transfer in full — the queue's expanded row.
 *
 * No scope check, matching the list: a transfer that matched no payment belongs
 * to nobody we can name, so there is no customer to scope it to and hiding it
 * from a reviewer would recreate the blind spot the queue exists to close.
 */
export async function getUnmatchedTransfer(
  transferId: string,
): Promise<UnmatchedTransferDetail> {
  const transfer = await prisma.unmatchedTransfer.findFirst({
    where: { id: transferId, deletedAt: null },
  });

  if (!transfer) throw AppError.notFound('Transfer not found');

  return toUnmatchedDetail(transfer);
}

export async function listUnmatchedTransfers(
  _actor: AuthContext,
  query: ListUnmatchedQuery,
): Promise<UnmatchedTransferPage> {
  const [rows, openCount] = await Promise.all([
    prisma.unmatchedTransfer.findMany({
      where: { ...UNMATCHED_STATUS_WHERE[query.status], deletedAt: null },
      // Newest transfer first. `blockAt` rather than `firstSeenAt`: a cold start
      // can notice an old transfer today, and the queue should read in the order
      // the money actually arrived.
      orderBy: [{ blockAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    prisma.unmatchedTransfer.count({ where: { resolvedAt: null, deletedAt: null } }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map(toUnmatchedRow),
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
): Promise<UnmatchedTransferDetail> {
  const existing = await prisma.unmatchedTransfer.findFirst({
    where: { id: transferId, deletedAt: null },
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

  // The write answers with the full record rather than the row shape: the caller
  // has the expanded panel open, and it is the panel's note it just wrote.
  return toUnmatchedDetail(resolved);
}

/*
 * --- Manual settlement queue ---------------------------------------------
 *
 * Payments only a person can close. Every wire is one — nothing in this codebase
 * reads a bank feed — and so is every USDT payment while automatic verification
 * is switched off in payment settings.
 *
 * Which providers qualify is asked of the payments module rather than decided
 * here, so the queue and the write it feeds cannot disagree about what a settler
 * is allowed to touch (`manualProviders` / `assertManuallySettleable`).
 *
 * Scoped like the ledger: a reviewer without `payments.all` sees the payments
 * against filings they are assigned, and an operations manager sees the org's.
 */
export type SettlementRow = {
  id: string;
  provider: 'usdt_trc20' | 'wire_transfer';
  status: 'awaiting' | 'settled' | 'closed';
  amount: Money;
  amountDisplay: string;
  quoteId: string | null;
  reference: string | null;
  serviceName: string | null;
  customerName: string;
  customerEmail: string;
  /** Which bank account the customer was told to send to, for a wire. */
  accountLabel: string | null;
  /** When the customer said they had sent it. Null means they have not. */
  markedSentAt: string | null;
  settledAt: string | null;
  settledBy: string | null;
  createdAt: string;
};

/*
 * The expanded row.
 *
 * `instructions` is the reason this split exists: the frozen instruction card
 * is a whole rendered bank-details block per wire, and the queue was shipping
 * one for every row to show it on the one row a settler opens. It is exactly
 * what the expanded panel is for — the settler checks the statement against the
 * account the money was meant to land in, without opening the settings screen.
 */
export type SettlementDetail = SettlementRow & {
  instructions: { label: string; value: string }[];
  /** The bank's reference or the tx hash, once one has been recorded. */
  providerRef: string | null;
  settlementNote: string | null;
  customerId: string;
  quoteTotal: Money | null;
  quoteValidUntil: string | null;
  order: { id: string; reference: string; to: string } | null;
};

export type SettlementPage = {
  rows: SettlementRow[];
  nextCursor: string | null;
  /** Open items across the whole queue, not just this page — the header count. */
  openCount: number;
};

const SETTLEMENT_STATUS_WHERE: Record<SettlementFilter, Prisma.PaymentWhereInput> = {
  open: { status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_ACTION] } },
  settled: { status: PaymentStatus.SUCCEEDED },
  all: {},
};

function settlementStatus(status: PaymentStatus): SettlementRow['status'] {
  if (status === PaymentStatus.SUCCEEDED) return 'settled';
  if (status === PaymentStatus.PENDING || status === PaymentStatus.REQUIRES_ACTION) {
    return 'awaiting';
  }
  return 'closed';
}

const SETTLEMENT_INCLUDE = {
  quote: { select: { serviceName: true, reference: true } },
  customer: { select: { name: true, email: true } },
} as const;

type SettlementRecord = Prisma.PaymentGetPayload<{
  include: typeof SETTLEMENT_INCLUDE;
}>;

function toSettlementRow(payment: SettlementRecord): SettlementRow {
  const snapshot = readWireInstructions(payment.wireInstructions);

  return {
    id: payment.id,
    provider:
      payment.provider === PaymentProvider.WIRE_TRANSFER
        ? 'wire_transfer'
        : 'usdt_trc20',
    status: settlementStatus(payment.status),
    amount: money(payment.amount, payment.currency),
    amountDisplay: formatMoneyDisplay({
      amount: payment.amount,
      currency: payment.currency,
    }),
    quoteId: payment.quoteId,
    reference: payment.quote?.reference ?? null,
    serviceName: payment.quote?.serviceName ?? null,
    customerName: payment.customer.name,
    customerEmail: payment.customer.email,
    accountLabel: snapshot?.accountLabel || payment.bankAccountLabel || null,
    markedSentAt: isoOrNull(payment.customerMarkedSentAt),
    settledAt: isoOrNull(payment.paidAt),
    settledBy: payment.settledByName,
    createdAt: iso(payment.createdAt),
  };
}

const SETTLEMENT_DETAIL_INCLUDE = {
  quote: {
    select: {
      serviceName: true,
      reference: true,
      total: true,
      currency: true,
      validUntil: true,
      order: { select: { id: true, reference: true } },
    },
  },
  customer: { select: { id: true, name: true, email: true } },
} as const;

/*
 * One payment in the settlement queue, in full — what the expanded row reads.
 *
 * Scoped exactly like the list. A settler who cannot see a payment in the queue
 * must not be able to read its bank instructions by asking for them directly,
 * and `assertInScope` is the same guard the two writes below use.
 */
export async function getSettlement(
  actor: AuthContext,
  paymentId: string,
): Promise<SettlementDetail> {
  await assertInScope(actor, paymentId);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: SETTLEMENT_DETAIL_INCLUDE,
  });

  if (!payment) throw AppError.notFound('Payment not found');

  const snapshot = readWireInstructions(payment.wireInstructions);
  const order = payment.quote?.order ?? null;

  return {
    ...toSettlementRow(payment),
    // Label and value only — the copy flags are a checkout concern, and this is
    // a reconciler reading a bank statement.
    instructions: (snapshot?.fields ?? []).map((field) => ({
      label: field.label,
      value: field.value,
    })),
    providerRef: payment.providerRef,
    settlementNote: payment.settlementNote,
    customerId: payment.customer.id,
    quoteTotal: payment.quote
      ? money(payment.quote.total, payment.quote.currency)
      : null,
    quoteValidUntil: payment.quote ? iso(payment.quote.validUntil) : null,
    order: order
      ? {
          id: order.id,
          reference: order.reference,
          to: `/admin/orders/${order.id}`,
        }
      : null,
  };
}

export async function listSettlements(
  actor: AuthContext,
  query: ListSettlementsQuery,
): Promise<SettlementPage> {
  const providers = await manualProviders();
  const scope = await paymentScope(actor);

  const base: Prisma.PaymentWhereInput = {
    deletedAt: null,
    provider: { in: providers },
    ...scope,
  };

  const [rows, openCount] = await Promise.all([
    prisma.payment.findMany({
      where: { ...base, ...SETTLEMENT_STATUS_WHERE[query.status] },
      /*
       * The ones the customer says they have sent, first — that is the whole
       * point of the claim, and it is the difference between "somewhere in a
       * list" and "check the statement for this one today". Nulls sort last, then
       * oldest first within each group, because an open payment that has been
       * waiting longest is the one most overdue a decision.
       */
      orderBy: [
        { customerMarkedSentAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      include: SETTLEMENT_INCLUDE,
      ...cursorArgs(query.cursor, query.limit),
    }),
    prisma.payment.count({ where: { ...base, ...SETTLEMENT_STATUS_WHERE.open } }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map(toSettlementRow),
    nextCursor: page.nextCursor,
    openCount,
  };
}

/*
 * Confirm the money arrived.
 *
 * Everything that matters happens in `settlePaymentManually` — the provider
 * check, the conditional write that makes two settlers credit once, and the
 * single credit path shared with the poller. What this adds is the two things
 * the money path deliberately does not do: scope the payment to what this staff
 * member may see, and tell the customer.
 *
 * The scope check is why it is here and not in the payments module: `paymentScope`
 * is an admin concept, and a reviewer holding `payments.settle` without
 * `payments.all` must not be able to settle an invoice on someone else's filing
 * by guessing an id.
 */
export async function settlePayment(
  actor: AuthContext,
  paymentId: string,
  input: SettlePaymentInput,
): Promise<SettlementRow> {
  await assertInScope(actor, paymentId);

  const { notice } = await settlePaymentManually(actor, {
    paymentId,
    reference: input.reference,
    note: input.note,
    paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
  });

  /*
   * The receipt. Deliberately the same two channels a chain credit sends —
   * an in-app feed entry gated on the customer's `statusUpdates` preference, and
   * an email through the queue (never inline, AGENTS.md) — because a settled
   * invoice is a settled invoice however the money reached us, and a customer
   * who wired should not hear less than one who sent USDT.
   *
   * Every one of these swallows its own failure: the credit is committed and
   * audited already, and a bounced email must not undo it.
   */
  await announceManualSettlement(notice);

  return readSettlementRow(paymentId);
}

/*
 * The same decision the other way: close the payment out without settling it.
 * The quote goes back to unpaid, which is the point — the customer is usually
 * about to try again.
 */
export async function rejectSettlement(
  actor: AuthContext,
  paymentId: string,
  input: RejectPaymentInput,
): Promise<SettlementRow> {
  await assertInScope(actor, paymentId);
  await rejectPaymentInService(actor, paymentId, input.reason);

  return readSettlementRow(paymentId);
}

/*
 * A 404 rather than a 403 for a payment outside this member's scope — whether
 * some other reviewer's invoice exists is not this caller's business, and a 403
 * would confirm the id is real. The same rule the customer-facing reads use.
 */
async function assertInScope(actor: AuthContext, paymentId: string): Promise<void> {
  const scope = await paymentScope(actor);

  const found = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null, ...scope },
    select: { id: true },
  });

  if (!found) throw AppError.notFound('Payment not found');
}

// Re-read through the list's own mapper so the response and the queue agree on
// every field, rather than assembling a second shape by hand.
async function readSettlementRow(paymentId: string): Promise<SettlementRow> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: SETTLEMENT_INCLUDE,
  });

  if (!payment) throw AppError.notFound('Payment not found');

  return toSettlementRow(payment);
}

/*
 * Tell the customer their payment landed — the manual mirror of the poller's
 * `onCredited`.
 *
 * Split out rather than inlined because it is the half that must never be able
 * to fail the settlement: the credit is committed and audited by the time this
 * runs, so each channel swallows its own error and the money stays reconciled
 * either way.
 */
async function announceManualSettlement(notice: {
  id: string;
  customerId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  quoteReference: string | null;
  quoteServiceName: string | null;
}): Promise<void> {
  const amount = formatMoneyDisplay({
    amount: notice.amount,
    currency: notice.currency,
  });

  try {
    // Gated on `statusUpdates`, the category the settings screen files a payment
    // event under — the same promise the chain credit honours.
    const channels = await channelsFor(notice.customerId, 'statusUpdates');

    await createFeedNotification({
      userId: notice.customerId,
      category: FeedNotificationCategory.PAYMENT,
      message: `Payment of ${amount} received${
        notice.quoteReference ? ` for quote ${notice.quoteReference}` : ''
      }. Thank you!`,
      href: '/app/billing',
    });

    if (!channels.email) return;

    await queueEmail({
      to: notice.customerEmail,
      subject: `Payment received — ${amount}`,
      template: 'generic',
      heading: 'We received your payment',
      body: `Your payment of ${amount}${
        notice.quoteServiceName ? ` for ${notice.quoteServiceName}` : ''
      } has been confirmed by our team. Your order will continue processing.`,
      actionLabel: 'View billing',
      actionUrl: `${publicAppUrl}/app/billing`,
      userId: notice.customerId,
    });
  } catch (error) {
    logger.error(
      { err: error, paymentId: notice.id },
      'Failed to announce a manually settled payment',
    );
  }
}
