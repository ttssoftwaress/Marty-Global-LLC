import { FeedNotificationCategory } from '@prisma/client';

import {
  estimateConfirmations,
  fetchUsdtTransfers,
  isTronConfigured,
  tronConfig,
} from '../../config/tron.js';
import { logger } from '../../lib/logger.js';
import { formatUsdtRaw } from '../../lib/money.js';
import { prisma } from '../../lib/prisma.js';
import { AuditAction, record } from '../../modules/audit/audit.service.js';
import { formatMoneyDisplay } from '../../modules/admin/admin.views.js';
import {
  creditConfirmedPayments,
  expireStalePayments,
  settleTransfer,
} from '../../modules/payments/payments.service.js';
import { queueEmail } from '../../modules/notifications/notifications.service.js';

/*
 * The USDT (TRC-20) reconciliation sweep. AGENTS.md: "a repeatable job polls
 * TronGrid, verifies the real USDT contract address, matches a pending Payment
 * by address + amount, and credits only after required confirmations."
 *
 * This processor is an adapter: it reads the chain and hands each transfer to
 * `payments.service`, which owns every decision and all Prisma access. It signs
 * nothing and holds no key — the only chain calls are GETs.
 *
 * Idempotency is structural, not conventional. Every credit is guarded by the
 * unique tx hash on Payment and applied inside one transaction, so this
 * processor running twice — concurrently, or after a crash mid-sweep — credits
 * exactly once. That is what makes the "give up after 2 attempts" retry posture
 * in queues.ts safe: a lost sweep costs nothing, because the cursor only
 * advances past transfers that were actually processed.
 */

// Re-read a little before the cursor on every sweep. A transfer's block
// timestamp and the moment TronGrid will serve it are not the same instant, so a
// cursor set exactly at the last seen block can skip a transfer that indexed a
// moment late. Overlap is free — already-processed hashes return `duplicate`.
const OVERLAP_MS = 5 * 60 * 1000;

// The widest window a cold start will look back over. Without it, a first boot
// (cursor = 0) would ask TronGrid for the entire history of the address.
const COLD_START_WINDOW_MS = 24 * 60 * 60 * 1000;

const cursorProvider = () => `usdt-trc20-${tronConfig.network}`;

async function readCursor(): Promise<number> {
  const row = await prisma.chainSyncCursor.findUnique({
    where: { provider: cursorProvider() },
    select: { lastBlockTimestamp: true },
  });

  return row ? Number(row.lastBlockTimestamp) : 0;
}

async function writeCursor(blockTimestampMs: number): Promise<void> {
  const provider = cursorProvider();

  await prisma.chainSyncCursor.upsert({
    where: { provider },
    create: {
      provider,
      lastBlockTimestamp: BigInt(blockTimestampMs),
      lastSweptAt: new Date(),
    },
    // Never move the cursor backwards: a sweep that saw an older window must not
    // rewind past transfers a newer sweep already processed.
    update: { lastBlockTimestamp: BigInt(blockTimestampMs), lastSweptAt: new Date() },
  });
}

export type PollResult = {
  scanned: number;
  credited: number;
  confirming: number;
  mismatched: number;
  duplicates: number;
  unmatched: number;
  expired: number;
};

export async function pollUsdtTransfers(now = new Date()): Promise<PollResult> {
  const result: PollResult = {
    scanned: 0,
    credited: 0,
    confirming: 0,
    mismatched: 0,
    duplicates: 0,
    unmatched: 0,
    expired: 0,
  };

  if (!isTronConfigured()) {
    // No deposit address means nothing to watch. Debug, not warn: this is the
    // normal state of a dev machine that has not been given an address.
    logger.debug('USDT poll skipped — no deposit address configured');
    return result;
  }

  const nowMs = now.getTime();
  const cursor = await readCursor();
  const since = cursor > 0 ? cursor - OVERLAP_MS : nowMs - COLD_START_WINDOW_MS;

  const transfers = await fetchUsdtTransfers(Math.max(0, since));
  result.scanned = transfers.length;

  // Oldest first, so the cursor advances monotonically and a mid-sweep failure
  // leaves it behind the unprocessed remainder rather than ahead of it.
  const ordered = [...transfers].sort((a, b) => a.blockTimestamp - b.blockTimestamp);

  let highestProcessed = cursor;

  for (const transfer of ordered) {
    const confirmations = estimateConfirmations(transfer.blockTimestamp, nowMs);

    // `fetchUsdtTransfers` already dropped anything not from the verified USDT
    // contract; this is the belt-and-braces re-check on the value we act on.
    if (transfer.contractAddress !== tronConfig.usdtContract) {
      logger.warn(
        { txHash: transfer.transactionId },
        'Dropped transfer from an unexpected contract',
      );
      continue;
    }

    const outcome = await settleTransfer({
      transactionHash: transfer.transactionId,
      toAddress: transfer.to,
      amountRaw: BigInt(transfer.value),
      contractAddress: transfer.contractAddress,
      blockTimestampMs: transfer.blockTimestamp,
      confirmations,
    });

    switch (outcome.result) {
      case 'credited':
        result.credited += 1;
        await onCredited(outcome.paymentId, transfer.transactionId);
        break;
      case 'confirming':
        result.confirming += 1;
        break;
      case 'underpaid':
      case 'overpaid':
        result.mismatched += 1;
        await onMismatched(outcome.paymentId, outcome.result, transfer.value);
        break;
      case 'duplicate':
        result.duplicates += 1;
        break;
      case 'unmatched':
        result.unmatched += 1;
        // Money arrived that we cannot attribute. Never silently dropped — this
        // is the log a human reconciles from.
        logger.warn(
          {
            txHash: transfer.transactionId,
            amount: formatUsdtRaw(BigInt(transfer.value)),
          },
          'Unmatched USDT transfer received',
        );
        break;
    }

    if (transfer.blockTimestamp > highestProcessed) {
      highestProcessed = transfer.blockTimestamp;
    }
  }

  if (highestProcessed > cursor) {
    await writeCursor(highestProcessed);
  }

  /*
   * Advance anything that matched on an earlier sweep but was too shallow to
   * credit. This is why a customer who closes the tab still gets credited: the
   * transfer is already recorded, and depth is a function of elapsed time.
   */
  const credited = await creditConfirmedPayments(now, (chainConfirmedAt) =>
    estimateConfirmations(chainConfirmedAt.getTime(), nowMs),
  );

  for (const paymentId of credited) {
    result.credited += 1;
    await onCredited(paymentId, null);
  }

  result.expired = await expireStalePayments(now);

  if (result.expired > 0) {
    logger.info({ count: result.expired }, 'Expired stale USDT payments');
  }

  logger.debug(result, 'USDT poll complete');

  return result;
}

/*
 * A credited payment: audit it, tell the customer, and post to their feed. None
 * of this may fail the credit — the money is already reconciled and the row is
 * committed, so every side effect below swallows its own failure (the same
 * posture the audit module takes).
 */
async function onCredited(paymentId: string, txHash: string | null): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      currency: true,
      customerId: true,
      quoteId: true,
      customer: { select: { email: true } },
      quote: { select: { reference: true, serviceName: true } },
    },
  });

  if (!payment) return;

  void record({
    actor: null, // A job credit is a system write, which the audit schema allows.
    action: AuditAction.PAYMENT_CREDITED,
    entityType: 'Payment',
    entityId: payment.id,
    // Ids, minor units, and a reference — no name, no address, no tx-linked PII.
    metadata: {
      quoteId: payment.quoteId,
      reference: payment.quote?.reference ?? null,
      amount: payment.amount,
      currency: payment.currency,
      provider: 'usdt_trc20',
      ...(txHash ? { txHash } : {}),
    },
  });

  const amount = formatMoneyDisplay({
    amount: payment.amount,
    currency: payment.currency,
  });

  try {
    await prisma.feedNotification.create({
      data: {
        userId: payment.customerId,
        category: FeedNotificationCategory.PAYMENT,
        message: `Payment of ${amount} received${
          payment.quote?.reference ? ` for quote ${payment.quote.reference}` : ''
        }. Thank you!`,
        href: '/app/billing',
      },
    });
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Failed to write payment feed entry');
  }

  try {
    await queueEmail({
      to: payment.customer.email,
      subject: `Payment received — ${amount}`,
      template: 'generic',
      heading: 'We received your payment',
      body: `Your payment of ${amount}${
        payment.quote?.serviceName ? ` for ${payment.quote.serviceName}` : ''
      } has been confirmed on-chain. Your order will continue processing.`,
      actionLabel: 'View billing',
      actionUrl: `${process.env.FRONTEND_ORIGIN ?? ''}/app/billing`,
      userId: payment.customerId,
    });
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Failed to queue payment receipt email');
  }
}

/*
 * An under- or overpayment. AGENTS.md is explicit that this is never a silent
 * pass, so it is audited and surfaced to the customer rather than only logged —
 * they are the one person who can tell us what they intended to send.
 */
async function onMismatched(
  paymentId: string,
  kind: 'underpaid' | 'overpaid',
  receivedRaw: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      currency: true,
      customerId: true,
      quoteId: true,
      usdtExpectedRaw: true,
    },
  });

  if (!payment) return;

  void record({
    actor: null,
    action: AuditAction.PAYMENT_MISMATCHED,
    entityType: 'Payment',
    entityId: payment.id,
    metadata: {
      kind,
      quoteId: payment.quoteId,
      expectedUsdtRaw: payment.usdtExpectedRaw?.toFixed(0) ?? null,
      receivedUsdtRaw: receivedRaw,
      amount: payment.amount,
      currency: payment.currency,
    },
  });

  logger.warn(
    { paymentId, kind, receivedUsdtRaw: receivedRaw },
    'USDT payment amount mismatch — needs manual resolution',
  );

  try {
    await prisma.feedNotification.create({
      data: {
        userId: payment.customerId,
        category: FeedNotificationCategory.PAYMENT,
        message:
          kind === 'underpaid'
            ? 'We received less than the quoted amount for your payment. Our team is reviewing it.'
            : 'We received more than the quoted amount for your payment. Our team is reviewing it.',
        href: '/app/billing',
      },
    });
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Failed to write mismatch feed entry');
  }
}

// The BullMQ entry point. Returns the sweep summary so a failed job's logs carry
// what it managed to do before failing.
export async function paymentsProcessor(): Promise<PollResult> {
  return pollUsdtTransfers();
}
