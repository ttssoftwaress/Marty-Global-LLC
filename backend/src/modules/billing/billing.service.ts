import { PaymentProvider, PaymentStatus, Prisma, QuoteStatus } from '@prisma/client';

import { getAuth } from '../../guards/index.js';
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

// How the money arrived, as the history row prints it. One provider today; the
// map is what a second one extends rather than a string literal at the callsite.
const METHOD_LABEL: Record<PaymentProvider, string> = {
  [PaymentProvider.USDT_TRC20]: 'USDT (TRC-20)',
};

// --- Overview ------------------------------------------------------------
export type BillingQuoteView = {
  id: string;
  serviceName: string;
  amount: Money;
  issuedAt: string;
  validUntil: string;
  status: 'pending' | 'expired';
};

export type BillingOverview = {
  kpis: { amountDue: Money; totalPaid: Money; pendingQuotes: number };
  quotes: BillingQuoteView[];
};

export async function getOverview(
  req: Parameters<typeof getAuth>[0],
): Promise<BillingOverview> {
  const auth = getAuth(req);
  const now = new Date();

  // A customer sees only their own billing; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  const [quotes, succeeded] = await Promise.all([
    prisma.quote.findMany({
      where: {
        customerId: auth.userId,
        deletedAt: null,
        status: { in: [QuoteStatus.PENDING, QuoteStatus.EXPIRED] },
      },
      orderBy: { issuedAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: {
        customerId: auth.userId,
        deletedAt: null,
        status: PaymentStatus.SUCCEEDED,
      },
      select: { amount: true, currency: true },
    }),
  ]);

  // A PENDING quote past its validity window reads as expired without waiting for
  // the job that flips the row — the customer sees the truth on this render, and
  // it is excluded from what they owe.
  const views: BillingQuoteView[] = quotes.map((quote) => ({
    id: quote.id,
    serviceName: quote.serviceName,
    amount: { amount: quote.total, currency: quote.currency },
    issuedAt: quote.issuedAt.toISOString(),
    validUntil: quote.validUntil.toISOString(),
    status:
      quote.status === QuoteStatus.PENDING && quote.validUntil > now
        ? 'pending'
        : 'expired',
  }));

  const payable = views.filter((quote) => quote.status === 'pending');

  // Integer addition only — minor units summed as integers, never divided.
  const amountDue = payable.reduce((sum, quote) => sum + quote.amount.amount, 0);
  const totalPaid = succeeded.reduce((sum, payment) => sum + payment.amount, 0);

  // Currency comes from the records themselves; mixing currencies in one total
  // would be wrong, so the first payable quote's code wins and USD is the
  // fallback when there is nothing to sum.
  const dueCurrency = payable[0]?.amount.currency ?? DEFAULT_CURRENCY;
  const paidCurrency = succeeded[0]?.currency ?? DEFAULT_CURRENCY;

  return {
    kpis: {
      amountDue: { amount: amountDue, currency: dueCurrency },
      totalPaid: { amount: totalPaid, currency: paidCurrency },
      pendingQuotes: payable.length,
    },
    quotes: views,
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

export type PaymentHistoryPage = {
  payments: PaymentRecordView[];
  page: number;
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
    // The design's "Page X of Y" is a convenience over the cursor stream; without
    // an offset we report page 1 for the first fetch and let the cursor advance.
    page: query.cursor ? 0 : 1,
    totalPages: Math.max(1, Math.ceil(totalCount / query.limit)),
    totalCount,
    nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null,
  };
}

// --- Cross-module summaries ----------------------------------------------
// The dashboard's billing card reads the same figures as the billing KPIs, so
// it calls this rather than re-deriving them (one definition, no drift).
export async function getBillingSummary(userId: string): Promise<{
  amountDue: Money;
  totalPaid: Money;
  pendingQuotes: number;
}> {
  const now = new Date();

  const [payable, succeeded] = await Promise.all([
    prisma.quote.findMany({
      where: {
        customerId: userId,
        deletedAt: null,
        status: QuoteStatus.PENDING,
        validUntil: { gt: now },
      },
      select: { total: true, currency: true },
    }),
    prisma.payment.findMany({
      where: { customerId: userId, deletedAt: null, status: PaymentStatus.SUCCEEDED },
      select: { amount: true, currency: true },
    }),
  ]);

  return {
    amountDue: {
      amount: payable.reduce((sum, quote) => sum + quote.total, 0),
      currency: payable[0]?.currency ?? DEFAULT_CURRENCY,
    },
    totalPaid: {
      amount: succeeded.reduce((sum, payment) => sum + payment.amount, 0),
      currency: succeeded[0]?.currency ?? DEFAULT_CURRENCY,
    },
    pendingQuotes: payable.length,
  };
}
