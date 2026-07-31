import { PaymentProvider, PaymentStatus, Prisma, QuoteStatus } from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import type {
  ListPaymentsQuery,
  PaymentHistoryRange,
} from './billing.validation.js';

/*
 * Billing owns what is owed (AGENTS.md, Payments): the customer's quotes and
 * their settled payments. All Prisma access lives here.
 *
 * MONEY: every amount stays integer minor units + an ISO 4217 code, exactly as
 * stored — no float math, no division, no toFixed anywhere in this module. The
 * frontend formats at render (AGENTS.md, Money).
 *
 * Card payments are a later deployment, so there are no saved methods to list
 * and no card shape in anything this module returns.
 */

export type Money = { amount: number; currency: string };

const DEFAULT_CURRENCY = 'USD';

// How the money arrived, as the history row prints it. The map is what a further
// provider extends rather than a string literal at the callsite.
const METHOD_LABEL: Record<PaymentProvider, string> = {
  [PaymentProvider.USDT_TRC20]: 'USDT (TRC-20)',
  [PaymentProvider.WIRE_TRANSFER]: 'Bank transfer',
};

/*
 * Total a set of amounts the only way integer minor units may be totalled:
 * within one currency.
 *
 * Everything quoted and collected today is USD, so this is a guard rather than a
 * feature — but the shape it replaced added every row together and then labelled
 * the result with whichever code happened to come first, which prints a number
 * that is not an amount in any currency. AGENTS.md's money rules have no room
 * for that kind of silent pass.
 *
 * When more than one code is present the largest is reported and the rest are
 * left out, with a log line naming what was dropped (codes and the owner id, no
 * amounts attached to a person). A KPI that quietly under-reports is still
 * wrong, but it is wrong by omission and visible in the logs, where a fabricated
 * cross-currency sum is neither.
 */
function sumOneCurrency(
  rows: { amount: number; currency: string }[],
  context: { userId: string; kpi: string },
): Money {
  const totals = new Map<string, number>();

  for (const row of rows) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
  }

  const ranked = [...totals].sort(([, a], [, b]) => b - a);
  const top = ranked[0];

  if (!top) return { amount: 0, currency: DEFAULT_CURRENCY };

  if (ranked.length > 1) {
    logger.warn(
      { ...context, currencies: ranked.map(([code]) => code), reported: top[0] },
      'Mixed-currency billing total — only the dominant currency is reported',
    );
  }

  return { amount: top[1], currency: top[0] };
}

// --- Overview ------------------------------------------------------------
export type BillingQuoteView = {
  id: string;
  serviceName: string;
  amount: Money;
  issuedAt: string;
  validUntil: string;
  status: 'pending' | 'expired';
};

export type BillingKpis = {
  amountDue: Money;
  totalPaid: Money;
  pendingQuotes: number;
};

export type BillingOverview = {
  kpis: BillingKpis;
  quotes: BillingQuoteView[];
};

/*
 * The rows every billing reader works from — the billing screen and the
 * dashboard's billing card.
 *
 * There is one loader and one KPI computation below because "what this customer
 * owes and has paid" had been written twice, and two implementations of the same
 * money question drift the moment one of them is corrected and the other is
 * forgotten. EXPIRED quotes come back too: the overview lists them, and
 * `isPayable` excludes them from the totals either way, so the summary reading a
 * slightly wider set costs one status value and buys a single definition.
 */
type BillingQuoteRow = {
  id: string;
  serviceName: string;
  total: number;
  currency: string;
  issuedAt: Date;
  validUntil: Date;
  status: QuoteStatus;
};

type SettledPaymentRow = { amount: number; currency: string };

async function loadBillingRows(
  userId: string,
): Promise<[BillingQuoteRow[], SettledPaymentRow[]]> {
  // A customer sees only their own billing; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  return Promise.all([
    prisma.quote.findMany({
      where: {
        customerId: userId,
        deletedAt: null,
        status: { in: [QuoteStatus.PENDING, QuoteStatus.EXPIRED] },
      },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        serviceName: true,
        total: true,
        currency: true,
        issuedAt: true,
        validUntil: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        customerId: userId,
        deletedAt: null,
        status: PaymentStatus.SUCCEEDED,
      },
      select: { amount: true, currency: true },
    }),
  ]);
}

/*
 * A PENDING quote past its validity window reads as expired without waiting for
 * the job that flips the row — the customer sees the truth on this render, and it
 * is excluded from what they owe. The single definition of "payable", read by
 * both the KPIs and the quote list so a quote can never be owed on one and
 * expired on the other.
 */
function isPayable(quote: BillingQuoteRow, now: Date): boolean {
  return quote.status === QuoteStatus.PENDING && quote.validUntil > now;
}

/*
 * The one definition of what a customer owes and has paid.
 *
 * Integer addition only, and only within one currency — minor units summed as
 * integers, never divided, never added across codes.
 */
function billingKpis(
  quotes: BillingQuoteRow[],
  succeeded: SettledPaymentRow[],
  now: Date,
  userId: string,
): BillingKpis {
  const payable = quotes.filter((quote) => isPayable(quote, now));

  return {
    amountDue: sumOneCurrency(
      payable.map((quote) => ({ amount: quote.total, currency: quote.currency })),
      { userId, kpi: 'amountDue' },
    ),
    totalPaid: sumOneCurrency(succeeded, { userId, kpi: 'totalPaid' }),
    pendingQuotes: payable.length,
  };
}

export async function getOverview(
  req: Parameters<typeof getAuth>[0],
): Promise<BillingOverview> {
  const auth = getAuth(req);
  const now = new Date();

  const [quotes, succeeded] = await loadBillingRows(auth.userId);

  return {
    kpis: billingKpis(quotes, succeeded, now, auth.userId),
    quotes: quotes.map((quote) => ({
      id: quote.id,
      serviceName: quote.serviceName,
      amount: { amount: quote.total, currency: quote.currency },
      issuedAt: quote.issuedAt.toISOString(),
      validUntil: quote.validUntil.toISOString(),
      status: isPayable(quote, now) ? 'pending' : 'expired',
    })),
  };
}

// --- Payment history -----------------------------------------------------
export type PaymentRecordView = {
  id: string;
  paidAt: string;
  serviceName: string;
  amount: Money;
  /** How it was collected, as the row prints it: "USDT (TRC-20)". */
  method: string;
  status: 'paid' | 'failed';
  invoiceHref?: string;
};

/*
 * `totalPages` is the "Page X of Y" denominator; there is deliberately no `page`
 * on the wire. This is a cursor stream (AGENTS.md), so the server has no offset
 * to report — it used to answer 1 for the first fetch and 0 for every one after
 * it, which reads as a page number and is not one. The client owns the window it
 * is showing, which is what the billing screen already does.
 */
export type PaymentHistoryPage = {
  payments: PaymentRecordView[];
  totalPages: number;
  totalCount: number;
  nextCursor: string | null;
};

// The history lists terminal states only — a pending or in-flight collection
// isn't history yet, so it stays off this list until it settles.
const HISTORY_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.FAILED,
];

const STATUS_TO_VIEW: Partial<Record<PaymentStatus, PaymentRecordView['status']>> =
  {
    [PaymentStatus.SUCCEEDED]: 'paid',
    [PaymentStatus.FAILED]: 'failed',
  };

// Each range resolves to a cutoff on the server clock, so the window is the
// server's notion of "now" rather than the browser's.
function rangeCutoff(range: PaymentHistoryRange, now: Date): Date | undefined {
  if (range === 'all') return undefined;

  const cutoff = new Date(now);
  if (range === '30d') cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  if (range === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6);
  if (range === '12m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  return cutoff;
}

export async function listPayments(
  req: Parameters<typeof getAuth>[0],
  query: ListPaymentsQuery,
): Promise<PaymentHistoryPage> {
  const auth = getAuth(req);
  const cutoff = rangeCutoff(query.range, new Date());

  const where: Prisma.PaymentWhereInput = {
    customerId: auth.userId,
    deletedAt: null,
    status: { in: HISTORY_STATUSES },
    ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    // The row displays the quote's service name, so search matches that (and the
    // quote reference the customer would have on an invoice).
    ...(query.search
      ? {
          quote: {
            is: {
              OR: [
                { serviceName: { contains: query.search, mode: 'insensitive' } },
                { reference: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  };

  const totalCount = await prisma.payment.count({ where });

  // Cursor pagination (AGENTS.md): fetch limit+1 to know whether more remain.
  const rows = await prisma.payment.findMany({
    where,
    include: { quote: { select: { serviceName: true } } },
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  // Presigned in parallel rather than one after another: this is a list, so a
  // serial await here would add one signature round of latency per row.
  const payments = await Promise.all(
    pageRows.map(async (payment) => ({
      id: payment.id,
      // A failed attempt never got a paidAt; the row still needs a date, so it
      // falls back to when the attempt was made.
      paidAt: (payment.paidAt ?? payment.createdAt).toISOString(),
      serviceName: payment.quote?.serviceName ?? 'Payment',
      amount: { amount: payment.amount, currency: payment.currency },
      method: METHOD_LABEL[payment.provider],
      status: STATUS_TO_VIEW[payment.status] ?? 'failed',
      // Short-TTL presigned URL, minted after the ownership check above
      // (AGENTS.md, Security & PII); absent until the invoice exists.
      invoiceHref: await presignObject(payment.invoiceObjectKey),
    })),
  );

  return {
    payments,
    totalPages: Math.max(1, Math.ceil(totalCount / query.limit)),
    totalCount,
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

// --- Cross-module summaries ----------------------------------------------
/*
 * The dashboard's billing card. It reads the billing KPIs through the same
 * loader and the same computation the billing screen uses, so the two surfaces
 * cannot disagree about what a customer owes — which is the whole reason this
 * is a call and not a second implementation.
 */
export async function getBillingSummary(userId: string): Promise<BillingKpis> {
  const now = new Date();
  const [quotes, succeeded] = await loadBillingRows(userId);

  return billingKpis(quotes, succeeded, now, userId);
}
