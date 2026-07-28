import { OrderStatus, PaymentStatus, Prisma, QuoteStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { Role } from '../../lib/roles.js';

/*
 * USDT (TRC-20) collection, tested against a real database because every rule
 * that matters here is enforced by the service and the schema — not by anything
 * a screen could be trusted to repeat.
 *
 * These are exactly the paths AGENTS.md's Testing section names for payments:
 *
 *   - USDT matching, and under/overpayment as explicit statuses
 *   - "runs twice, credits once" idempotency, at both layers:
 *       · the Idempotency-Key on intent creation
 *       · the unique tx hash on settlement
 *   - confirmations gating a credit
 *   - money kept in integer minor units and raw bigints throughout
 *   - the ownership boundary on every read
 *
 * The chain itself is never contacted: `settleTransfer` takes a transfer as a
 * plain value, so a test can hand it the exact byte-for-byte cases (a one-unit
 * shortfall, a stale-rate arrival, a replayed hash) that are impractical to
 * provoke against a live testnet.
 */

// The deposit address the config resolves to. Fixed here so tests never depend
// on whatever is in the developer's .env.
const DEPOSIT_ADDRESS = 'TTestDepositAddress1111111111111111';
const MIN_CONFIRMATIONS = 19;

vi.mock('../../config/tron.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/tron.js')>();
  return {
    ...actual,
    tronConfig: {
      network: 'nile' as const,
      baseUrl: 'https://nile.trongrid.io',
      usdtContract: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
      depositAddress: DEPOSIT_ADDRESS,
      minConfirmations: MIN_CONFIRMATIONS,
      pollIntervalSeconds: 30,
      apiKey: undefined,
    },
    isTronConfigured: () => true,
  };
});

const queueEmail = vi.hoisted(() => vi.fn(async () => ({ id: 'notif_test' })));
vi.mock('../notifications/notifications.service.js', () => ({
  queueEmail,
  markFailed: vi.fn(),
}));

const { prisma } = await import('../../lib/prisma.js');
const {
  createIntent,
  creditConfirmedPayments,
  expireStalePayments,
  getPayment,
  getQuoteForCheckout,
  settleTransfer,
} = await import('./payments.service.js');

const CUSTOMER_ID = 'pay_test_customer';
const OTHER_ID = 'pay_test_other';
const USER_IDS = [CUSTOMER_ID, OTHER_ID];

function auth(userId: string, role: Role = Role.CUSTOMER): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

const reqAs = (context: AuthContext) => ({ auth: context }) as never;

async function ensureUser(id: string) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role: Role.CUSTOMER },
    update: {},
  });
}

let referenceCounter = 0;

// $559.50 — a value that drifts under float arithmetic, which is the point.
const QUOTE_TOTAL = 55_950;
const EXPECTED_RAW = 559_500_000n; // 559.500000 USDT at a 1:1 peg

// The order a quote was raised against. Only the tests that care about the
// order's own status attach one — a quote can stand alone (`Quote.orderId` is
// nullable), and the credit path has to cope with both.
async function createApprovedOrder(customerId = CUSTOMER_ID) {
  referenceCounter += 1;

  return prisma.order.create({
    data: {
      reference: `ORD-T${Date.now() % 100_000}${referenceCounter}`,
      customerId,
      status: OrderStatus.APPROVED,
      submittedAt: new Date(),
    },
  });
}

async function createQuote(
  overrides: Partial<{
    customerId: string;
    status: QuoteStatus;
    total: number;
    validUntil: Date;
    orderId: string;
  }> = {},
) {
  referenceCounter += 1;

  return prisma.quote.create({
    data: {
      reference: `QT-T${Date.now() % 100_000}${referenceCounter}`,
      customerId: overrides.customerId ?? CUSTOMER_ID,
      ...(overrides.orderId ? { orderId: overrides.orderId } : {}),
      status: overrides.status ?? QuoteStatus.PENDING,
      serviceName: 'LLC Formation — USA',
      subtotal: overrides.total ?? QUOTE_TOTAL,
      total: overrides.total ?? QUOTE_TOTAL,
      currency: 'USD',
      issuedAt: new Date(),
      validUntil:
        overrides.validUntil ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      lineItems: {
        create: [
          { label: 'State filing fee', amount: 49_900, sortOrder: 0 },
          { label: 'Registered agent (1 year)', amount: 6_050, sortOrder: 1 },
        ],
      },
    },
  });
}

let keyCounter = 0;
const nextKey = () => `idem-key-${Date.now()}-${(keyCounter += 1)}`;

const SENDER_ADDRESS = 'TTestSenderAddress222222222222222222';

// A transfer as the poller would hand it over, deep enough to credit.
function transfer(
  overrides: Partial<{
    transactionHash: string;
    fromAddress: string;
    toAddress: string;
    amountRaw: bigint;
    blockTimestampMs: number;
    confirmations: number;
  }> = {},
) {
  return {
    transactionHash: overrides.transactionHash ?? `0xtest${(keyCounter += 1)}`,
    fromAddress: overrides.fromAddress ?? SENDER_ADDRESS,
    toAddress: overrides.toAddress ?? DEPOSIT_ADDRESS,
    amountRaw: overrides.amountRaw ?? EXPECTED_RAW,
    contractAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    blockTimestampMs: overrides.blockTimestampMs ?? Date.now(),
    confirmations: overrides.confirmations ?? MIN_CONFIRMATIONS,
  };
}

// A live USDT intent against a quote — the payment a transfer is meant to match.
async function intentFor(quoteId: string) {
  return createIntent(
    reqAs(auth(CUSTOMER_ID)),
    { quoteId, method: 'usdt_trc20' },
    nextKey(),
  );
}

async function cleanup() {
  await prisma.unmatchedTransfer.deleteMany({
    where: { toAddress: { in: [DEPOSIT_ADDRESS, 'TSomeoneElsesAddress99999999999999'] } },
  });
  await prisma.payment.deleteMany({ where: { customerId: { in: USER_IDS } } });
  await prisma.quote.deleteMany({ where: { customerId: { in: USER_IDS } } });
  await prisma.feedNotification.deleteMany({ where: { userId: { in: USER_IDS } } });
  // After the quotes: a quote's FK to its order is SetNull, so deleting orders
  // first would orphan rows this cleanup is about to remove anyway.
  await prisma.orderActivity.deleteMany({
    where: { order: { customerId: { in: USER_IDS } } },
  });
  await prisma.order.deleteMany({ where: { customerId: { in: USER_IDS } } });
}

beforeEach(async () => {
  queueEmail.mockClear();
  await ensureUser(CUSTOMER_ID);
  await ensureUser(OTHER_ID);
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

// --- Creating an intent --------------------------------------------------

describe('createIntent', () => {
  it('resolves the amount from the quote in integer minor units', async () => {
    const quote = await createQuote();

    const payment = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    expect(payment.amount).toEqual({ amount: QUOTE_TOTAL, currency: 'USD' });
    expect(Number.isInteger(payment.amount.amount)).toBe(true);
    expect(payment.status).toBe('awaiting_payment');
    expect(payment.provider).toBe('usdt_trc20');

    // The USDT figure is the raw integer, exact, as a string — never a float.
    expect(payment.usdt?.amountRaw).toBe(EXPECTED_RAW.toString());
    expect(payment.usdt?.amountDisplay).toBe('559.5');
    expect(payment.usdt?.decimals).toBe(6);
    expect(payment.usdt?.depositAddress).toBe(DEPOSIT_ADDRESS);
    // The verified contract is surfaced so a customer can check the token.
    expect(payment.usdt?.contractAddress).toBe(
      'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    );
    expect(payment.usdt?.minConfirmations).toBe(MIN_CONFIRMATIONS);
  });

  it('locks the rate with an expiry', async () => {
    const quote = await createQuote();

    const payment = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    expect(payment.usdt?.rateMinor).toBe(1_000_000);
    expect(new Date(payment.usdt!.rateExpiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(payment.usdt?.expiresAt).toBe(payment.usdt?.rateExpiresAt);
  });

  it('returns the SAME payment when the Idempotency-Key is replayed', async () => {
    const quote = await createQuote();
    const key = nextKey();

    const first = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      key,
    );
    const second = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      key,
    );

    expect(second.id).toBe(first.id);

    // The real assertion: one row, so the customer is never asked to send twice.
    const count = await prisma.payment.count({ where: { quoteId: quote.id } });
    expect(count).toBe(1);
  });

  it('resumes the live payment when the checkout is reloaded with a fresh key', async () => {
    const quote = await createQuote();

    const first = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );
    const second = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    expect(second.id).toBe(first.id);
    expect(await prisma.payment.count({ where: { quoteId: quote.id } })).toBe(1);
  });

  it('refuses to reuse another customer\'s Idempotency-Key', async () => {
    const quote = await createQuote();
    const key = nextKey();

    await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      key,
    );

    // A guessed key must not leak the amount or reference of someone else's
    // payment.
    await expect(
      createIntent(
        reqAs(auth(OTHER_ID)),
        { quoteId: quote.id, method: 'usdt_trc20' },
        key,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('gives concurrent payments distinct amounts so a transfer is attributable', async () => {
    // Two customers owing the identical total. With one shared address and no
    // memo field, identical expected amounts would make a transfer ambiguous.
    const mine = await createQuote();
    const theirs = await createQuote({ customerId: OTHER_ID });

    const a = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: mine.id, method: 'usdt_trc20' },
      nextKey(),
    );
    const b = await createIntent(
      reqAs(auth(OTHER_ID)),
      { quoteId: theirs.id, method: 'usdt_trc20' },
      nextKey(),
    );

    expect(a.usdt?.amountRaw).not.toBe(b.usdt?.amountRaw);

    // The nudge is one atomic unit — 0.000001 USDT, far less than a cent.
    const difference =
      BigInt(b.usdt!.amountRaw) - BigInt(a.usdt!.amountRaw);
    expect(difference).toBe(1n);
  });

  it('refuses a quote the caller does not own, as a 404', async () => {
    const quote = await createQuote();

    // 404 not 403: whether another customer's quote exists is not this caller's
    // business, and a 403 would confirm the id is real.
    await expect(
      createIntent(
        reqAs(auth(OTHER_ID)),
        { quoteId: quote.id, method: 'usdt_trc20' },
        nextKey(),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an expired, paid, or cancelled quote', async () => {
    const expired = await createQuote({
      validUntil: new Date(Date.now() - 1_000),
    });
    await expect(
      createIntent(
        reqAs(auth(CUSTOMER_ID)),
        { quoteId: expired.id, method: 'usdt_trc20' },
        nextKey(),
      ),
    ).rejects.toMatchObject({ status: 422 });

    const paid = await createQuote({ status: QuoteStatus.PAID });
    await expect(
      createIntent(
        reqAs(auth(CUSTOMER_ID)),
        { quoteId: paid.id, method: 'usdt_trc20' },
        nextKey(),
      ),
    ).rejects.toMatchObject({ status: 422 });

    const cancelled = await createQuote({ status: QuoteStatus.CANCELLED });
    await expect(
      createIntent(
        reqAs(auth(CUSTOMER_ID)),
        { quoteId: cancelled.id, method: 'usdt_trc20' },
        nextKey(),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});

// --- Settlement ----------------------------------------------------------

describe('settleTransfer', () => {
  it('credits an exact, confirmed transfer and marks the quote paid', async () => {
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const outcome = await settleTransfer(
      transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) }),
    );

    expect(outcome.result).toBe('credited');

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: intent.id },
    });
    expect(row.status).toBe(PaymentStatus.SUCCEEDED);
    expect(row.paidAt).not.toBeNull();

    const settledQuote = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id },
    });
    expect(settledQuote.status).toBe(QuoteStatus.PAID);
    expect(settledQuote.paidAt).not.toBeNull();
  });

  /*
   * The order follows the money. An order still reading "Approved" against a
   * quote we have been paid for sends the customer back to a checkout for a debt
   * that no longer exists — so the two move together, in one transaction.
   */
  it('carries the quote’s order to Paid when the transfer credits', async () => {
    const order = await createApprovedOrder();
    const quote = await createQuote({ orderId: order.id });
    const intent = await intentFor(quote.id);

    await settleTransfer(transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) }));

    const paid = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe(OrderStatus.PAID);

    // And the customer is told why, on their own order feed.
    const entry = await prisma.orderActivity.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(entry.internal).toBe(false);
    expect(entry.message).toContain('Payment received');
  });

  // A shallow transfer is matched but not credited, so the order must not move
  // either — "confirming" is not "paid".
  it('leaves the order alone while a transfer is still confirming', async () => {
    const order = await createApprovedOrder();
    const quote = await createQuote({ orderId: order.id });
    const intent = await intentFor(quote.id);

    const outcome = await settleTransfer(
      transfer({ amountRaw: BigInt(intent.usdt!.amountRaw), confirmations: 1 }),
    );

    expect(outcome.result).toBe('confirming');

    const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.status).toBe(OrderStatus.APPROVED);
  });

  it('runs twice and credits once', async () => {
    // The rule AGENTS.md names by name. The tx hash is unique, so a replayed
    // sweep can never produce a second credit.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const event = transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) });

    const first = await settleTransfer(event);
    const second = await settleTransfer(event);
    const third = await settleTransfer(event);

    expect(first.result).toBe('credited');
    expect(second.result).toBe('duplicate');
    expect(third.result).toBe('duplicate');

    const credited = await prisma.payment.count({
      where: { quoteId: quote.id, status: PaymentStatus.SUCCEEDED },
    });
    expect(credited).toBe(1);
  });

  it('credits once under concurrent settlement of the same hash', async () => {
    // Two workers racing on one transfer. The unique constraint is the guard,
    // not the pre-check, so exactly one wins.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);
    const event = transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) });

    const outcomes = await Promise.all([
      settleTransfer(event),
      settleTransfer(event),
      settleTransfer(event),
    ]);

    expect(outcomes.filter((o) => o.result === 'credited')).toHaveLength(1);
    expect(outcomes.filter((o) => o.result === 'duplicate')).toHaveLength(2);

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: intent.id },
    });
    expect(row.status).toBe(PaymentStatus.SUCCEEDED);
  });

  it('holds a transfer that is not deep enough, then credits it on a later sweep', async () => {
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const shallow = await settleTransfer(
      transfer({
        amountRaw: BigInt(intent.usdt!.amountRaw),
        confirmations: MIN_CONFIRMATIONS - 1,
      }),
    );

    expect(shallow.result).toBe('confirming');

    // The quote is NOT paid yet — that is the whole point of the gate.
    let row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe(PaymentStatus.PROCESSING);
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe(QuoteStatus.PENDING);

    // A later sweep, now deep enough.
    const credited = await creditConfirmedPayments(
      new Date(),
      () => MIN_CONFIRMATIONS,
    );
    expect(credited).toContain(intent.id);

    row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe(PaymentStatus.SUCCEEDED);
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe(QuoteStatus.PAID);
  });

  it('credits a confirming payment only once across repeated sweeps', async () => {
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    await settleTransfer(
      transfer({
        amountRaw: BigInt(intent.usdt!.amountRaw),
        confirmations: 1,
      }),
    );

    const first = await creditConfirmedPayments(new Date(), () => MIN_CONFIRMATIONS);
    const second = await creditConfirmedPayments(new Date(), () => MIN_CONFIRMATIONS);

    expect(first).toEqual([intent.id]);
    // Already SUCCEEDED, so the second sweep finds nothing to do.
    expect(second).toEqual([]);
  });

  it('flags a one-unit shortfall as UNDERPAID and leaves the quote unpaid', async () => {
    // AGENTS.md: under/overpayment is an explicit status, never a silent pass.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const outcome = await settleTransfer(
      transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) - 1n }),
    );

    expect(outcome.result).toBe('underpaid');

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe(PaymentStatus.UNDERPAID);
    expect(row.failureReason).toBeTruthy();

    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe(QuoteStatus.PENDING);
  });

  it('flags an overpayment as OVERPAID and leaves the quote unpaid', async () => {
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const outcome = await settleTransfer(
      transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) + 5_000_000n }),
    );

    expect(outcome.result).toBe('overpaid');

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe(PaymentStatus.OVERPAID);
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe(QuoteStatus.PENDING);
  });

  it('records what actually arrived, not what was expected', async () => {
    const quote = await createQuote();
    const intent = await intentFor(quote.id);
    const received = BigInt(intent.usdt!.amountRaw) - 1n;

    await settleTransfer(transfer({ amountRaw: received }));

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.usdtAmountRaw?.toFixed(0)).toBe(received.toString());
    expect(row.usdtExpectedRaw?.toFixed(0)).toBe(intent.usdt!.amountRaw);
  });

  it('does not credit a transfer that arrived after the locked rate expired', async () => {
    // AGENTS.md: the rate is re-checked before crediting. A late transfer is
    // held for a human rather than settled at a stale price.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    const afterExpiry = row.rateExpiresAt!.getTime() + 60_000;

    const outcome = await settleTransfer(
      transfer({
        amountRaw: BigInt(intent.usdt!.amountRaw),
        blockTimestampMs: afterExpiry,
      }),
    );

    expect(outcome.result).toBe('underpaid');
    expect(
      (await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status,
    ).toBe(QuoteStatus.PENDING);
  });

  it('leaves a transfer to an unknown address unmatched', async () => {
    const quote = await createQuote();
    await intentFor(quote.id);

    const outcome = await settleTransfer(
      transfer({ toAddress: 'TSomeoneElsesAddress99999999999999' }),
    );

    expect(outcome.result).toBe('unmatched');
  });

  it('leaves a wildly wrong amount unmatched rather than guessing', async () => {
    // Attribution is by amount alone, so a value far from any expectation must
    // not be attached to someone's invoice on a guess.
    const quote = await createQuote();
    await intentFor(quote.id);

    const outcome = await settleTransfer(transfer({ amountRaw: 1_000n }));

    expect(outcome.result).toBe('unmatched');
  });

  it('attributes a transfer to the payment whose amount it matches exactly', async () => {
    // Two live payments, one atomic unit apart. The exact match must win.
    const mine = await createQuote();
    const theirs = await createQuote({ customerId: OTHER_ID });

    const a = await intentFor(mine.id);
    const b = await createIntent(
      reqAs(auth(OTHER_ID)),
      { quoteId: theirs.id, method: 'usdt_trc20' },
      nextKey(),
    );

    await settleTransfer(transfer({ amountRaw: BigInt(b.usdt!.amountRaw) }));

    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: b.id } })).status,
    ).toBe(PaymentStatus.SUCCEEDED);
    // The other payment is untouched.
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: a.id } })).status,
    ).toBe(PaymentStatus.PENDING);
  });
});

// --- Unattributable money ------------------------------------------------

/*
 * The counterpart to "runs twice, credits once": runs a hundred times, warns
 * once.
 *
 * The poller re-reads a five-minute overlap window on every sweep, so a stray
 * transfer is handed to `settleTransfer` again and again for as long as it sits
 * unresolved. A matched transfer goes quiet on the second pass because its hash
 * is claimed on the payment row; these tests are the same guarantee for a
 * transfer that matched nothing.
 */
describe('unmatched transfers', () => {
  it('records an unattributable transfer instead of only logging it', async () => {
    const event = transfer({ amountRaw: 1_000n });

    const outcome = await settleTransfer(event);

    expect(outcome.result).toBe('unmatched');

    const row = await prisma.unmatchedTransfer.findUniqueOrThrow({
      where: { transactionHash: event.transactionHash },
    });

    // The raw integer, exact — never rounded through a float.
    expect(row.amountRaw.toFixed(0)).toBe('1000');
    expect(row.decimals).toBe(6);
    expect(row.fromAddress).toBe(SENDER_ADDRESS);
    expect(row.toAddress).toBe(DEPOSIT_ADDRESS);
    expect(row.sightings).toBe(1);
    expect(row.resolvedAt).toBeNull();
  });

  it('reports only the FIRST sighting, so a re-read sweep stays quiet', async () => {
    // The bug this table exists to fix: the same transfer warned on every poll
    // interval, forever, because nothing recorded that we had already seen it.
    const event = transfer({ amountRaw: 1_000n });

    const first = await settleTransfer(event);
    const second = await settleTransfer(event);
    const third = await settleTransfer(event);

    expect(first).toMatchObject({ result: 'unmatched', firstSighting: true });
    expect(second).toMatchObject({ result: 'unmatched', firstSighting: false });
    expect(third).toMatchObject({ result: 'unmatched', firstSighting: false });

    // All three resolve to the one row — the tx hash is unique.
    expect(second).toMatchObject({ transferId: (first as { transferId: string }).transferId });

    const row = await prisma.unmatchedTransfer.findUniqueOrThrow({
      where: { transactionHash: event.transactionHash },
    });
    expect(row.sightings).toBe(3);
  });

  it('advances lastSeenAt while leaving the original sighting alone', async () => {
    const event = transfer({ amountRaw: 1_000n });

    const firstSweep = new Date('2026-07-27T18:00:00.000Z');
    const laterSweep = new Date('2026-07-28T18:00:00.000Z');

    await settleTransfer(event, firstSweep);
    await settleTransfer(event, laterSweep);

    const row = await prisma.unmatchedTransfer.findUniqueOrThrow({
      where: { transactionHash: event.transactionHash },
    });

    // "First seen yesterday, still here now" is exactly what a reconciler needs.
    expect(row.firstSeenAt.toISOString()).toBe(firstSweep.toISOString());
    expect(row.lastSeenAt.toISOString()).toBe(laterSweep.toISOString());
  });

  it('records once under concurrent sweeps of the same transfer', async () => {
    // Two workers on the same overlap window. The unique hash is the guard, so
    // exactly one of them reports a first sighting.
    const event = transfer({ amountRaw: 1_000n });

    const outcomes = await Promise.all([
      settleTransfer(event),
      settleTransfer(event),
      settleTransfer(event),
    ]);

    const firsts = outcomes.filter(
      (outcome) => outcome.result === 'unmatched' && outcome.firstSighting,
    );
    expect(firsts).toHaveLength(1);

    expect(
      await prisma.unmatchedTransfer.count({
        where: { transactionHash: event.transactionHash },
      }),
    ).toBe(1);
  });

  it('never records a transfer that matched a payment', async () => {
    // The recording is for money we cannot attribute. A credited transfer is
    // attributed, so it must not also appear in the reconciliation queue.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const event = transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) });
    await settleTransfer(event);
    await settleTransfer(event);

    expect(
      await prisma.unmatchedTransfer.count({
        where: { transactionHash: event.transactionHash },
      }),
    ).toBe(0);
  });

  it('does not record an under- or overpayment either', async () => {
    // An amount mismatch IS attributed — to a payment, with its own explicit
    // status. It belongs on that payment, not in the stray-money queue.
    const quote = await createQuote();
    const intent = await intentFor(quote.id);

    const event = transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) - 1n });
    const outcome = await settleTransfer(event);

    expect(outcome.result).toBe('underpaid');
    expect(
      await prisma.unmatchedTransfer.count({
        where: { transactionHash: event.transactionHash },
      }),
    ).toBe(0);
  });
});

// --- Expiry --------------------------------------------------------------

describe('expireStalePayments', () => {
  it('closes a payment whose window passed with no transfer', async () => {
    const quote = await createQuote();
    const intent = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    const count = await expireStalePayments(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );

    expect(count).toBeGreaterThanOrEqual(1);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } })).status,
    ).toBe(PaymentStatus.FAILED);
  });

  it('never expires a payment that already matched a transfer', async () => {
    // A mid-confirmation payment must not be expired out from under real money.
    const quote = await createQuote();
    const intent = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    await settleTransfer(
      transfer({ amountRaw: BigInt(intent.usdt!.amountRaw), confirmations: 1 }),
    );

    await expireStalePayments(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const row = await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } });
    expect(row.status).toBe(PaymentStatus.PROCESSING);
  });
});

// --- Reads and the ownership boundary ------------------------------------

describe('reads', () => {
  it('returns the customer their own payment', async () => {
    const quote = await createQuote();
    const intent = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    const read = await getPayment(reqAs(auth(CUSTOMER_ID)), intent.id);
    expect(read.id).toBe(intent.id);
  });

  it('refuses another customer\'s payment', async () => {
    const quote = await createQuote();
    const intent = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    await expect(
      getPayment(reqAs(auth(OTHER_ID)), intent.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns the quote with its line items for checkout', async () => {
    const quote = await createQuote();

    const view = await getQuoteForCheckout(reqAs(auth(CUSTOMER_ID)), quote.id);

    expect(view.total).toEqual({ amount: QUOTE_TOTAL, currency: 'USD' });
    expect(view.status).toBe('pending');
    expect(view.lineItems).toHaveLength(2);
    // Lines sum to the total in integer minor units.
    expect(view.lineItems.reduce((sum, l) => sum + l.amount.amount, 0)).toBe(
      QUOTE_TOTAL,
    );
  });

  it('refuses another customer\'s quote at checkout', async () => {
    const quote = await createQuote();

    await expect(
      getQuoteForCheckout(reqAs(auth(OTHER_ID)), quote.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('reads a lapsed quote as expired without waiting for a job', async () => {
    const quote = await createQuote({ validUntil: new Date(Date.now() - 1_000) });

    const view = await getQuoteForCheckout(reqAs(auth(CUSTOMER_ID)), quote.id);
    expect(view.status).toBe('expired');
  });
});

// --- The database-level matching guarantee -------------------------------

describe('the partial unique index', () => {
  it('forbids two live payments watching the same address and amount', async () => {
    // This is the constraint that makes attribution unambiguous. Enforced by the
    // database, so a race cannot slip past it.
    const quote = await createQuote();
    await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    const duplicate = prisma.payment.create({
      data: {
        customerId: CUSTOMER_ID,
        provider: 'USDT_TRC20',
        status: PaymentStatus.PENDING,
        amount: QUOTE_TOTAL,
        currency: 'USD',
        depositAddress: DEPOSIT_ADDRESS,
        usdtExpectedRaw: new Prisma.Decimal(EXPECTED_RAW.toString()),
        usdtDecimals: 6,
      },
    });

    await expect(duplicate).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same amount again once the earlier payment settles', async () => {
    // Two customers paying the same invoice total months apart is normal; the
    // index is partial precisely so history does not block new payments.
    const quote = await createQuote();
    const intent = await createIntent(
      reqAs(auth(CUSTOMER_ID)),
      { quoteId: quote.id, method: 'usdt_trc20' },
      nextKey(),
    );

    await settleTransfer(transfer({ amountRaw: BigInt(intent.usdt!.amountRaw) }));

    const reused = await prisma.payment.create({
      data: {
        customerId: OTHER_ID,
        provider: 'USDT_TRC20',
        status: PaymentStatus.PENDING,
        amount: QUOTE_TOTAL,
        currency: 'USD',
        depositAddress: DEPOSIT_ADDRESS,
        usdtExpectedRaw: new Prisma.Decimal(EXPECTED_RAW.toString()),
        usdtDecimals: 6,
      },
    });

    expect(reused.id).toBeTruthy();
  });
});
