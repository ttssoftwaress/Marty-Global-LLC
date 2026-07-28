import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuoteStatus,
} from '@prisma/client';

import { env } from '../../config/env.js';
import { tronConfig, USDT_DECIMALS } from '../../config/tron.js';
import type { AuthContext } from '../../guards/auth-context.js';
import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import {
  compareSettlement,
  fiatMinorToUsdtRaw,
  formatUsdtRaw,
} from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { advanceOrderStatus } from '../orders/orders.service.js';
import type { CreateIntentInput } from './payments.validation.js';

/*
 * `payments` owns collecting what `billing` says is owed (AGENTS.md, Payments).
 * A Payment row is the source of truth for a collection attempt and carries the
 * provider reference — here, the Tron transaction hash.
 *
 * The three rules this file exists to enforce:
 *
 * 1. MONEY. Amounts are integer minor units (fiat) or raw bigint integers
 *    (USDT). Nothing here divides, rounds, or floats a value. The client never
 *    names an amount — every figure is resolved from the Quote row.
 *
 * 2. NEVER DOUBLE-CREDIT. The tx hash is unique in the schema, and matching and
 *    crediting happen inside ONE transaction. A poller that runs twice, or two
 *    pollers racing, credit exactly once.
 *
 * 3. NO KEYS. We watch transfers. There is no signing, no private key, and no
 *    outbound transfer anywhere in this module.
 *
 * Under- and overpayment are explicit terminal-ish statuses a human resolves,
 * never a silent pass.
 */

// --- Views ---------------------------------------------------------------

export type Money = { amount: number; currency: string };

export type UsdtPaymentInstructions = {
  network: 'mainnet' | 'nile';
  // The verified USDT contract, surfaced so a careful customer can check the
  // token they are sending is the real one before they send it.
  contractAddress: string;
  depositAddress: string;
  /** Raw integer at `decimals` precision, as a string — never a float. */
  amountRaw: string;
  /** The same amount as a display decimal, e.g. "559.500000". */
  amountDisplay: string;
  decimals: number;
  /** USDT-per-USD numerator over 1_000_000. */
  rateMinor: number;
  rateExpiresAt: string;
  expiresAt: string;
  minConfirmations: number;
  confirmations: number;
};

export type PaymentView = {
  id: string;
  quoteId: string | null;
  reference: string | null;
  serviceName: string;
  provider: 'usdt_trc20';
  status: PaymentStatusView;
  amount: Money;
  /** The Tron tx hash once a transfer has matched. */
  transactionHash: string | null;
  usdt: UsdtPaymentInstructions | null;
  /** Set only when the chain settled an amount that didn't match. */
  settledAmountDisplay: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PaymentStatusView =
  | 'awaiting_payment'
  | 'confirming'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'underpaid'
  | 'overpaid';

const STATUS_VIEW: Record<PaymentStatus, PaymentStatusView> = {
  [PaymentStatus.PENDING]: 'awaiting_payment',
  [PaymentStatus.REQUIRES_ACTION]: 'awaiting_payment',
  [PaymentStatus.PROCESSING]: 'confirming',
  [PaymentStatus.SUCCEEDED]: 'succeeded',
  [PaymentStatus.FAILED]: 'failed',
  [PaymentStatus.UNDERPAID]: 'underpaid',
  [PaymentStatus.OVERPAID]: 'overpaid',
};

type PaymentRecord = Prisma.PaymentGetPayload<{
  include: { quote: { select: { serviceName: true; reference: true } } };
}>;

const iso = (date: Date) => date.toISOString();

/*
 * A PENDING payment past its window reads as expired on this render rather than
 * waiting for the sweeper to flip the row — the customer sees the truth now, and
 * the screen stops showing an address that is no longer being watched at that
 * amount. The same rule billing applies to a lapsed quote.
 */
function effectiveStatus(payment: PaymentRecord, now: Date): PaymentStatus {
  const stillOpen =
    payment.status === PaymentStatus.PENDING ||
    payment.status === PaymentStatus.REQUIRES_ACTION;

  if (stillOpen && payment.expiresAt && payment.expiresAt <= now) {
    return PaymentStatus.FAILED;
  }
  return payment.status;
}

export function toPaymentView(payment: PaymentRecord, now = new Date()): PaymentView {
  const status = effectiveStatus(payment, now);
  const isExpired =
    status === PaymentStatus.FAILED && payment.status === PaymentStatus.PENDING;

  const expected = payment.usdtExpectedRaw;

  return {
    id: payment.id,
    quoteId: payment.quoteId,
    reference: payment.quote?.reference ?? null,
    serviceName: payment.quote?.serviceName ?? 'Payment',
    provider: 'usdt_trc20',
    status: isExpired ? 'expired' : STATUS_VIEW[status],
    amount: { amount: payment.amount, currency: payment.currency },
    transactionHash: payment.providerRef,
    usdt:
      payment.provider === PaymentProvider.USDT_TRC20 &&
      expected !== null &&
      payment.depositAddress
        ? {
            network: tronConfig.network,
            contractAddress: tronConfig.usdtContract,
            depositAddress: payment.depositAddress,
            // Prisma hands a Decimal back; `.toFixed(0)` on a Decimal is exact
            // string formatting of an integer, not float arithmetic.
            amountRaw: expected.toFixed(0),
            amountDisplay: formatUsdtRaw(BigInt(expected.toFixed(0)), USDT_DECIMALS),
            decimals: payment.usdtDecimals ?? USDT_DECIMALS,
            rateMinor: payment.lockedRateMinor ?? env.USDT_USD_RATE_MINOR,
            rateExpiresAt: payment.rateExpiresAt
              ? iso(payment.rateExpiresAt)
              : iso(now),
            expiresAt: payment.expiresAt ? iso(payment.expiresAt) : iso(now),
            minConfirmations: tronConfig.minConfirmations,
            confirmations: payment.confirmations,
          }
        : null,
    // Only meaningful once something actually landed on-chain.
    settledAmountDisplay: payment.usdtAmountRaw
      ? formatUsdtRaw(BigInt(payment.usdtAmountRaw.toFixed(0)), USDT_DECIMALS)
      : null,
    paidAt: payment.paidAt ? iso(payment.paidAt) : null,
    createdAt: iso(payment.createdAt),
  };
}

const PAYMENT_INCLUDE = {
  quote: { select: { serviceName: true, reference: true } },
} as const;

// Statuses that mean "this payment is still watching the chain".
const LIVE_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.REQUIRES_ACTION,
  PaymentStatus.PROCESSING,
];

// --- Creating an intent --------------------------------------------------

/*
 * The amount is what makes a transfer identifiable, because TRC-20 has no memo
 * field. Two customers owing the same invoice total would otherwise produce two
 * payments watching the same (address, amount) pair and an arriving transfer
 * could not be attributed to either.
 *
 * So a collision nudges the expected amount up by one atomic unit (0.000001
 * USDT — worth a ten-thousandth of a cent) until it is unique among live
 * payments. The customer pays that exact figure, and the database's partial
 * unique index is the real guarantee: if a concurrent request wins the race, the
 * insert fails and we try the next value rather than creating an ambiguous pair.
 */
const MAX_AMOUNT_NUDGES = 50;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

export async function createIntent(
  req: Parameters<typeof getAuth>[0],
  input: CreateIntentInput,
  idempotencyKey: string,
): Promise<PaymentView> {
  const auth = getAuth(req);

  if (!tronConfig.depositAddress) {
    // A misconfiguration, not the customer's fault — but we must not hand out a
    // screen with no address on it.
    logger.error('USDT payment requested but TRON_DEPOSIT_ADDRESS is not set');
    throw AppError.businessRule(
      'Crypto payment is temporarily unavailable. Please try again later.',
    );
  }

  /*
   * Idempotency first (AGENTS.md, API Conventions: mutating payment endpoints
   * are retry-safe). A retried request — a flaky network, a double-tapped
   * button — must resolve to the SAME payment, never a second one asking for a
   * second transfer.
   */
  const existingByKey = await prisma.payment.findUnique({
    where: { idempotencyKey },
    include: PAYMENT_INCLUDE,
  });

  if (existingByKey) {
    // The key is the caller's, so it must not be usable to read someone else's
    // payment: a guessed key would otherwise leak an amount and a reference.
    if (existingByKey.customerId !== auth.userId) {
      throw AppError.conflict('This Idempotency-Key has already been used');
    }
    return toPaymentView(existingByKey);
  }

  const now = new Date();

  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, deletedAt: null },
    select: {
      id: true,
      customerId: true,
      status: true,
      total: true,
      currency: true,
      validUntil: true,
      serviceName: true,
      reference: true,
    },
  });

  if (!quote) throw AppError.notFound('Quote not found');

  /*
   * Ownership, checked in the service after the record loads (AGENTS.md). A 404
   * rather than a 403: whether some other customer's quote exists is not this
   * caller's business, and a 403 would confirm the id is real.
   */
  if (quote.customerId !== auth.userId) {
    throw AppError.notFound('Quote not found');
  }

  if (quote.status === QuoteStatus.PAID) {
    throw AppError.businessRule('This quote has already been paid.');
  }

  if (
    quote.status === QuoteStatus.CANCELLED ||
    quote.status === QuoteStatus.DRAFT
  ) {
    throw AppError.businessRule('This quote is not available for payment.');
  }

  if (quote.status === QuoteStatus.EXPIRED || quote.validUntil <= now) {
    throw AppError.businessRule(
      'This quote has expired. Ask your account manager for an updated quote.',
    );
  }

  if (quote.total <= 0) {
    throw AppError.businessRule('This quote has nothing to pay.');
  }

  /*
   * One live payment per quote. Without this a customer who reloads the checkout
   * gets a second address-and-amount to send to, and we would be watching two
   * amounts for one debt. Returning the existing one instead makes the checkout
   * page naturally resumable.
   */
  const live = await prisma.payment.findFirst({
    where: {
      quoteId: quote.id,
      customerId: auth.userId,
      deletedAt: null,
      status: { in: LIVE_STATUSES },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: PAYMENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });

  if (live) return toPaymentView(live, now);

  // The rate is locked at intent time and re-checked before crediting
  // (AGENTS.md, Money). Integer numerator over a fixed scale — never a float.
  const rateMinor = env.USDT_USD_RATE_MINOR;
  const baseRaw = fiatMinorToUsdtRaw(quote.total, quote.currency, rateMinor);

  const rateExpiresAt = new Date(
    now.getTime() + env.USDT_RATE_TTL_MINUTES * 60 * 1000,
  );

  const created = await createWithUniqueAmount(
    baseRaw,
    (expectedRaw) =>
      prisma.payment.create({
        data: {
          customerId: auth.userId,
          quoteId: quote.id,
          provider: PaymentProvider.USDT_TRC20,
          status: PaymentStatus.PENDING,
          amount: quote.total,
          currency: quote.currency,
          depositAddress: tronConfig.depositAddress,
          usdtExpectedRaw: new Prisma.Decimal(expectedRaw.toString()),
          usdtDecimals: USDT_DECIMALS,
          lockedRateMinor: rateMinor,
          rateExpiresAt,
          // The payment stops watching when the rate does: a transfer arriving
          // later must not be credited against a stale price.
          expiresAt: rateExpiresAt,
          idempotencyKey,
        },
        include: PAYMENT_INCLUDE,
      }),
  );

  logger.info(
    { paymentId: created.id, quoteId: quote.id, provider: 'usdt_trc20' },
    'USDT payment intent created',
  );

  return toPaymentView(created, now);
}

/*
 * Insert the payment at the first expected amount no other live payment is
 * already watching. The retry is driven by the database's partial unique index
 * rather than a pre-flight SELECT, so two concurrent requests cannot both read
 * "free" and then both insert.
 */
async function createWithUniqueAmount<T>(
  baseRaw: bigint,
  create: (expectedRaw: bigint) => Promise<T>,
): Promise<T> {
  for (let nudge = 0; nudge < MAX_AMOUNT_NUDGES; nudge += 1) {
    try {
      return await create(baseRaw + BigInt(nudge));
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  // Fifty simultaneous payments for the identical amount is not a real load
  // pattern; refusing beats handing out an ambiguous amount.
  throw AppError.conflict(
    'Could not allocate a unique payment amount. Please try again in a moment.',
  );
}

// --- Reads ---------------------------------------------------------------

export async function getPayment(
  req: Parameters<typeof getAuth>[0],
  paymentId: string,
): Promise<PaymentView> {
  const auth = getAuth(req);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, deletedAt: null },
    include: PAYMENT_INCLUDE,
  });

  if (!payment) throw AppError.notFound('Payment not found');

  // Ownership boundary — same 404-not-403 reasoning as above.
  if (payment.customerId !== auth.userId) {
    throw AppError.notFound('Payment not found');
  }

  return toPaymentView(payment);
}

// The checkout screen polls this while a transfer confirms.
export async function getQuoteForCheckout(
  req: Parameters<typeof getAuth>[0],
  quoteId: string,
): Promise<{
  id: string;
  reference: string;
  serviceName: string;
  total: Money;
  validUntil: string;
  status: 'pending' | 'expired' | 'paid' | 'cancelled' | 'draft';
  lineItems: { id: string; label: string; amount: Money }[];
}> {
  const auth = getAuth(req);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, deletedAt: null },
    include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!quote || quote.customerId !== auth.userId) {
    throw AppError.notFound('Quote not found');
  }

  const now = new Date();
  const expired =
    quote.status === QuoteStatus.PENDING && quote.validUntil <= now;

  const statusView = expired
    ? ('expired' as const)
    : (
        {
          [QuoteStatus.PENDING]: 'pending',
          [QuoteStatus.PAID]: 'paid',
          [QuoteStatus.EXPIRED]: 'expired',
          [QuoteStatus.CANCELLED]: 'cancelled',
          [QuoteStatus.DRAFT]: 'draft',
        } as const
      )[quote.status];

  return {
    id: quote.id,
    reference: quote.reference,
    serviceName: quote.serviceName,
    total: { amount: quote.total, currency: quote.currency },
    validUntil: iso(quote.validUntil),
    status: statusView,
    lineItems: quote.lineItems.map((line) => ({
      id: line.id,
      label: line.label,
      amount: { amount: line.amount, currency: quote.currency },
    })),
  };
}

// --- Settlement (called by the poller, never by a request handler) --------

export type SettlementInput = {
  transactionHash: string;
  /** Sender. Recorded on an unmatched transfer — the only lead on stray money. */
  fromAddress: string;
  toAddress: string;
  /** Raw integer the transfer carried. */
  amountRaw: bigint;
  /** Contract the transfer came from — verified by the caller against USDT. */
  contractAddress: string;
  blockTimestampMs: number;
  confirmations: number;
};

export type SettlementOutcome =
  | { result: 'credited'; paymentId: string }
  | { result: 'confirming'; paymentId: string; confirmations: number }
  | { result: 'underpaid'; paymentId: string }
  | { result: 'overpaid'; paymentId: string }
  | { result: 'duplicate'; paymentId: string }
  /*
   * Unattributable money, now recorded rather than only logged. `firstSighting`
   * is what lets the poller warn once instead of every sweep: the overlap window
   * re-reads the same transfer indefinitely, and a matched transfer goes quiet
   * because its hash is claimed on the payment row — this is the equivalent
   * claim for a transfer that matched nothing.
   */
  | { result: 'unmatched'; transferId: string; firstSighting: boolean };

/*
 * Apply one on-chain transfer.
 *
 * This is THE function AGENTS.md's "runs twice, credits once" rule is about, so
 * the ordering matters:
 *
 *   1. The tx hash is claimed FIRST, inside the transaction, by writing it to
 *      `providerRef` (unique). A second run — a retry, a redelivered sweep, a
 *      racing worker — fails that write and returns `duplicate` without touching
 *      the quote.
 *   2. Matching and crediting happen in the SAME transaction as that claim, so
 *      there is no window where the hash is claimed but the quote is unpaid.
 *   3. The locked rate is re-checked before crediting: a transfer that arrives
 *      after the window is held, not credited at a stale price.
 *
 * Confirmations gate the credit but not the match: a shallow transfer is matched
 * and moved to PROCESSING so the customer sees "confirming", and a later sweep
 * credits it once it is deep enough.
 *
 * Split in two: `applyTransfer` below is the money path exactly as described,
 * and the exported `settleTransfer` wraps it to record anything it could not
 * attribute. The recording is deliberately OUTSIDE the settlement transaction —
 * it touches no payment and no quote, and it must never be able to roll back a
 * credit or hold a lock while it writes.
 */
/*
 * Mark a quote paid and carry its order to PAID with it.
 *
 * Both credit paths below call this rather than updating the quote themselves,
 * because the two facts have to land together: an order still reading "Approved"
 * against a paid quote sends the customer back to a checkout for money we have
 * already taken. Inside the caller's transaction for the same reason — this is
 * the "never double-credit" path, and a status write that could commit
 * independently of the credit would be a second source of truth for whether the
 * debt is settled.
 *
 * `advanceOrderStatus` only moves forward, so a payment confirming after a
 * reviewer already pushed the filing to Processing leaves it alone.
 */
async function creditQuote(
  tx: Prisma.TransactionClient,
  quoteId: string,
  paidAt: Date,
): Promise<void> {
  const quote = await tx.quote.update({
    where: { id: quoteId },
    data: { status: QuoteStatus.PAID, paidAt },
    select: { orderId: true, reference: true },
  });

  if (!quote.orderId) return;

  await advanceOrderStatus(tx, quote.orderId, OrderStatus.PAID, {
    authorName: 'Marty Global',
    message: `Payment received — quote ${quote.reference} settled in full.`,
  });
}

/*
 * What the money path alone can say. It knows a transfer matched nothing; it
 * does not know whether we have seen that transfer before, which is the
 * recording step's answer.
 */
type ApplyOutcome =
  | Exclude<SettlementOutcome, { result: 'unmatched' }>
  | { result: 'unmatched' };

async function applyTransfer(input: SettlementInput): Promise<ApplyOutcome> {
  // Cheap pre-check outside the transaction — an already-processed hash is by
  // far the common case on every sweep after the first.
  const already = await prisma.payment.findUnique({
    where: { providerRef: input.transactionHash },
    select: { id: true },
  });

  if (already) {
    return { result: 'duplicate', paymentId: already.id };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      /*
       * Match on (address, expected amount) among live payments only. The
       * partial unique index guarantees this is at most one row, so there is no
       * "which one did they mean" ambiguity to resolve here.
       */
      const candidates = await tx.payment.findMany({
        where: {
          deletedAt: null,
          provider: PaymentProvider.USDT_TRC20,
          depositAddress: input.toAddress,
          status: { in: LIVE_STATUSES },
        },
        orderBy: { createdAt: 'asc' },
      });

      const expectedMatch = candidates.find(
        (payment) =>
          payment.usdtExpectedRaw !== null &&
          BigInt(payment.usdtExpectedRaw.toFixed(0)) === input.amountRaw,
      );

      /*
       * No exact match. Rather than dropping the transfer, look for a live
       * payment whose expected amount is close enough that this is plainly an
       * attempt to pay it — an under- or overpayment, which AGENTS.md requires
       * be an explicit status a human resolves, never a silent pass.
       *
       * "Closest expected amount" is the only attribution available without a
       * memo field, so it is deliberately conservative: a transfer that matches
       * nothing within a 10% band is left unmatched for manual reconciliation
       * rather than guessed at.
       */
      const payment = expectedMatch ?? nearestCandidate(candidates, input.amountRaw);

      if (!payment) {
        /*
         * No live candidate. Usually that genuinely means an unattributable
         * transfer — but it is also what a loser of a concurrent race sees, once
         * the winner has moved the payment out of the live statuses. Re-check
         * the hash before reporting: calling a credited transfer "unmatched"
         * would send a human hunting for money that is already reconciled.
         */
        const claimed = await tx.payment.findUnique({
          where: { providerRef: input.transactionHash },
          select: { id: true },
        });

        return claimed
          ? ({ result: 'duplicate' as const, paymentId: claimed.id })
          : ({ result: 'unmatched' as const });
      }

      const expectedRaw = BigInt(payment.usdtExpectedRaw?.toFixed(0) ?? '0');
      const comparison = compareSettlement(input.amountRaw, expectedRaw);

      const blockAt = new Date(input.blockTimestampMs);

      /*
       * The rate lock, re-checked before crediting (AGENTS.md, Money). A
       * transfer whose block landed after the window closed is recorded against
       * the payment but never auto-credited — the price it was quoted at is no
       * longer the price.
       */
      const rateStale = Boolean(
        payment.rateExpiresAt && blockAt > payment.rateExpiresAt,
      );

      const common = {
        // Claiming the hash: unique, so this is the double-credit guard.
        providerRef: input.transactionHash,
        usdtAmountRaw: new Prisma.Decimal(input.amountRaw.toString()),
        usdtDecimals: USDT_DECIMALS,
        confirmations: input.confirmations,
        chainConfirmedAt: blockAt,
      };

      if (comparison === 'underpaid' || comparison === 'overpaid') {
        const status =
          comparison === 'underpaid'
            ? PaymentStatus.UNDERPAID
            : PaymentStatus.OVERPAID;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            ...common,
            status,
            failureReason: `Chain settled ${formatUsdtRaw(input.amountRaw)} USDT against an expected ${formatUsdtRaw(expectedRaw)} USDT`,
          },
        });

        // The quote stays unpaid: a mismatched amount has not settled the debt.
        return { result: comparison, paymentId: payment.id };
      }

      if (rateStale) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            ...common,
            status: PaymentStatus.UNDERPAID,
            failureReason:
              'Transfer arrived after the locked rate expired; needs manual review',
          },
        });
        return { result: 'underpaid', paymentId: payment.id };
      }

      if (input.confirmations < tronConfig.minConfirmations) {
        // Matched but not yet final. The hash is still claimed here, so the next
        // sweep updates this row instead of matching the transfer again.
        await tx.payment.update({
          where: { id: payment.id },
          data: { ...common, status: PaymentStatus.PROCESSING },
        });

        return {
          result: 'confirming',
          paymentId: payment.id,
          confirmations: input.confirmations,
        };
      }

      // Deep enough, exact amount, rate still valid: credit.
      await tx.payment.update({
        where: { id: payment.id },
        data: { ...common, status: PaymentStatus.SUCCEEDED, paidAt: blockAt },
      });

      if (payment.quoteId) {
        await creditQuote(tx, payment.quoteId, blockAt);
      }

      return { result: 'credited', paymentId: payment.id };
    });
  } catch (error) {
    /*
     * A unique violation here means a concurrent worker claimed the same hash
     * between the pre-check and the write. That is the guard doing its job, not
     * an error: the transfer is credited exactly once, by the other worker.
     */
    if (isUniqueViolation(error)) {
      const winner = await prisma.payment.findUnique({
        where: { providerRef: input.transactionHash },
        select: { id: true },
      });
      return winner
        ? { result: 'duplicate', paymentId: winner.id }
        : { result: 'unmatched' };
    }
    throw error;
  }
}

/*
 * Record a transfer we could not attribute, and say whether this is the first
 * time we have seen it.
 *
 * An upsert on the unique tx hash, which is the whole mechanism: the first sweep
 * inserts, every later sweep that re-reads the overlap window bumps `lastSeenAt`
 * and the sighting count instead of producing another warning. That mirrors what
 * a matched transfer already gets for free from the unique `providerRef`.
 *
 * `sightings` is incremented in the database rather than read-then-written, so
 * two workers sweeping the same window cannot lose a count to a race.
 *
 * Resolving a row does NOT stop the counter — a resolved transfer the poller
 * still sees is a fact worth keeping, and re-opening it would undo a human's
 * decision on every sweep.
 */
async function recordUnmatchedTransfer(
  input: SettlementInput,
  now: Date,
): Promise<{ transferId: string; firstSighting: boolean }> {
  const existing = await prisma.unmatchedTransfer.findUnique({
    where: { transactionHash: input.transactionHash },
    select: { id: true },
  });

  if (existing) {
    await prisma.unmatchedTransfer.update({
      where: { id: existing.id },
      data: { lastSeenAt: now, sightings: { increment: 1 } },
    });
    return { transferId: existing.id, firstSighting: false };
  }

  try {
    const created = await prisma.unmatchedTransfer.create({
      data: {
        transactionHash: input.transactionHash,
        contractAddress: input.contractAddress,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        amountRaw: new Prisma.Decimal(input.amountRaw.toString()),
        decimals: USDT_DECIMALS,
        blockAt: new Date(input.blockTimestampMs),
        firstSeenAt: now,
        lastSeenAt: now,
      },
      select: { id: true },
    });

    return { transferId: created.id, firstSighting: true };
  } catch (error) {
    // A concurrent sweep inserted it between the read and the write. Same guard
    // as the settlement path: the constraint decides, and the loser reports the
    // sighting as a repeat rather than warning a second time.
    if (isUniqueViolation(error)) {
      const winner = await prisma.unmatchedTransfer.update({
        where: { transactionHash: input.transactionHash },
        data: { lastSeenAt: now, sightings: { increment: 1 } },
        select: { id: true },
      });
      return { transferId: winner.id, firstSighting: false };
    }
    throw error;
  }
}

/*
 * Apply one on-chain transfer, and record it if it matched nothing.
 *
 * The poller's only entry point. Everything about crediting lives in
 * `applyTransfer`; this adds the one thing that path cannot answer — whether an
 * unattributable transfer is new — so the sweep can warn once about stray money
 * instead of once every poll interval, forever.
 */
export async function settleTransfer(
  input: SettlementInput,
  now = new Date(),
): Promise<SettlementOutcome> {
  const outcome = await applyTransfer(input);

  if (outcome.result !== 'unmatched') return outcome;

  return { ...outcome, ...(await recordUnmatchedTransfer(input, now)) };
}

/*
 * The closest live payment to an unmatched amount, within 10%. Used only to
 * classify an under/overpayment against the payment it was most plausibly meant
 * for. Anything further away is left unmatched — a wrong guess would attach
 * someone's money to someone else's invoice.
 */
function nearestCandidate<
  T extends { usdtExpectedRaw: Prisma.Decimal | null },
>(candidates: T[], amountRaw: bigint): T | undefined {
  let best: T | undefined;
  let bestDistance = 0n;

  for (const candidate of candidates) {
    if (!candidate.usdtExpectedRaw) continue;

    const expected = BigInt(candidate.usdtExpectedRaw.toFixed(0));
    if (expected === 0n) continue;

    const difference = amountRaw > expected ? amountRaw - expected : expected - amountRaw;

    // Integer percentage band — no float ratio.
    if (difference * 10n > expected) continue;

    if (!best || difference < bestDistance) {
      best = candidate;
      bestDistance = difference;
    }
  }

  return best;
}

/*
 * Re-check payments that matched a transfer but were not yet deep enough to
 * credit. Confirmation depth is a function of elapsed time, so this needs no
 * chain read for the amount — only the current depth, which the caller supplies.
 *
 * Separate from `settleTransfer` because the transfer is already recorded: this
 * only advances an already-matched row, and re-running it credits once because
 * the status guard excludes anything already SUCCEEDED.
 */
export async function creditConfirmedPayments(
  now: Date,
  confirmationsFor: (chainConfirmedAt: Date) => number,
): Promise<string[]> {
  const confirming = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      provider: PaymentProvider.USDT_TRC20,
      status: PaymentStatus.PROCESSING,
      chainConfirmedAt: { not: null },
      providerRef: { not: null },
    },
    select: {
      id: true,
      quoteId: true,
      chainConfirmedAt: true,
      rateExpiresAt: true,
    },
  });

  const credited: string[] = [];

  for (const payment of confirming) {
    if (!payment.chainConfirmedAt) continue;

    const confirmations = confirmationsFor(payment.chainConfirmedAt);

    if (confirmations < tronConfig.minConfirmations) {
      // Keep the customer's progress bar honest between sweeps.
      await prisma.payment.update({
        where: { id: payment.id },
        data: { confirmations },
      });
      continue;
    }

    /*
     * Conditional update: the WHERE still requires PROCESSING, so if another
     * worker credited this row since the read, this updates zero rows and the
     * quote is not touched a second time.
     */
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PROCESSING },
        data: {
          status: PaymentStatus.SUCCEEDED,
          confirmations,
          paidAt: payment.chainConfirmedAt,
        },
      });

      if (updated.count === 0) return false;

      if (payment.quoteId && payment.chainConfirmedAt) {
        await creditQuote(tx, payment.quoteId, payment.chainConfirmedAt);
      }

      return true;
    });

    if (result) credited.push(payment.id);
  }

  return credited;
}

/*
 * Close out payments whose window has passed without a transfer. Only rows that
 * never matched anything are touched — `providerRef: null` — so a payment that
 * is mid-confirmation can never be expired out from under a real transfer.
 */
export async function expireStalePayments(now: Date): Promise<number> {
  const { count } = await prisma.payment.updateMany({
    where: {
      deletedAt: null,
      provider: PaymentProvider.USDT_TRC20,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_ACTION] },
      providerRef: null,
      expiresAt: { lte: now },
    },
    data: {
      status: PaymentStatus.FAILED,
      failureReason: 'Payment window expired with no transfer received',
    },
  });

  return count;
}

// The audit actor for a job-driven credit: there is no human actor, which the
// audit schema allows (a null actor is a system write).
export const SYSTEM_ACTOR: AuthContext | null = null;
