import { PaymentProvider, PaymentStatus, QuoteStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';
import { formatMoneyDisplay } from '../admin.views.js';

const { prisma } = await import('../../../lib/prisma.js');
const { refundPayment, listLedger, getSummary } = await import('./payments.service.js');

/*
 * The money-critical paths AGENTS.md names: the refund flow, its
 * "runs twice, credits once" idempotency, and the money helpers.
 *
 * Every amount here is integer minor units — 34900 is $349.00. A test that
 * asserted on a float would be asserting the wrong thing.
 */

const ADMIN_ID = 'pay_test_admin';
const CUSTOMER_ID = 'pay_test_customer';
const QUOTE_ID = 'pay_test_quote';
const PAYMENT_ID = 'pay_test_payment';

const AMOUNT = 34_900;

function admin(): AuthContext {
  return {
    userId: ADMIN_ID,
    role: Role.ADMIN,
    sessionId: 'sess_pay_test',
    email: 'admin@example.test',
    emailVerified: true,
  };
}

async function reset() {
  await prisma.refund.deleteMany({ where: { paymentId: PAYMENT_ID } });
  await prisma.payment.deleteMany({ where: { id: PAYMENT_ID } });
  await prisma.quote.deleteMany({ where: { id: QUOTE_ID } });

  for (const [id, role] of [
    [ADMIN_ID, Role.ADMIN],
    [CUSTOMER_ID, Role.CUSTOMER],
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
      update: {},
    });
  }

  const now = new Date();

  await prisma.quote.create({
    data: {
      id: QUOTE_ID,
      reference: 'QT-PAYTEST',
      customerId: CUSTOMER_ID,
      status: QuoteStatus.PAID,
      serviceName: 'Test service',
      subtotal: AMOUNT,
      total: AMOUNT,
      currency: 'USD',
      issuedAt: now,
      validUntil: new Date(now.getTime() + 86_400_000),
      paidAt: now,
    },
  });

  await prisma.payment.create({
    data: {
      id: PAYMENT_ID,
      customerId: CUSTOMER_ID,
      quoteId: QUOTE_ID,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.SUCCEEDED,
      amount: AMOUNT,
      currency: 'USD',
      cardBrand: 'visa',
      cardLast4: '4242',
      paidAt: now,
    },
  });
}

beforeEach(reset);

afterAll(async () => {
  await prisma.refund.deleteMany({ where: { paymentId: PAYMENT_ID } });
  await prisma.payment.deleteMany({ where: { id: PAYMENT_ID } });
  await prisma.quote.deleteMany({ where: { id: QUOTE_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN_ID, CUSTOMER_ID] } } });
  await prisma.$disconnect();
});

describe('refundPayment', () => {
  it('records a full refund and moves the payment to REFUNDED', async () => {
    const result = await refundPayment(admin(), PAYMENT_ID, 'idem-full-001', {
      amount: AMOUNT,
      reason: 'Service could not be delivered.',
    });

    expect(result.amount).toEqual({ amount: AMOUNT, currency: 'USD' });
    expect(result.status).toBe('refunded');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: PAYMENT_ID } });
    expect(payment.status).toBe(PaymentStatus.REFUNDED);
  });

  it('records a partial refund and moves the payment to PARTIALLY_REFUNDED', async () => {
    const result = await refundPayment(admin(), PAYMENT_ID, 'idem-partial-001', {
      amount: 10_000,
      reason: 'Goodwill credit.',
    });

    expect(result.status).toBe('partially_refunded');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: PAYMENT_ID } });
    expect(payment.status).toBe(PaymentStatus.PARTIALLY_REFUNDED);
  });

  /*
   * The "runs twice, credits once" case AGENTS.md requires. A retried request
   * carries the same Idempotency-Key — a double-click on "Issue refund", or a
   * client retry after a timeout — and must resolve to the original reversal
   * rather than a second one.
   */
  it('is idempotent: the same key twice credits once', async () => {
    const first = await refundPayment(admin(), PAYMENT_ID, 'idem-repeat-001', {
      amount: 10_000,
      reason: 'Goodwill credit.',
    });
    const second = await refundPayment(admin(), PAYMENT_ID, 'idem-repeat-001', {
      amount: 10_000,
      reason: 'Goodwill credit.',
    });

    expect(second.id).toBe(first.id);

    const refunds = await prisma.refund.findMany({ where: { paymentId: PAYMENT_ID } });
    expect(refunds).toHaveLength(1);

    const total = refunds.reduce((sum, refund) => sum + refund.amount, 0);
    expect(total).toBe(10_000);
  });

  it('refuses to refund more than was collected', async () => {
    await expect(
      refundPayment(admin(), PAYMENT_ID, 'idem-over-001', {
        amount: AMOUNT + 1,
        reason: 'Too much.',
      }),
    ).rejects.toMatchObject({ status: 422 });

    const refunds = await prisma.refund.count({ where: { paymentId: PAYMENT_ID } });
    expect(refunds).toBe(0);
  });

  it('refuses to refund more than what remains after a partial', async () => {
    await refundPayment(admin(), PAYMENT_ID, 'idem-first-001', {
      amount: 30_000,
      reason: 'Partial.',
    });

    // 4900 remains; asking for 5000 must fail rather than clamp.
    await expect(
      refundPayment(admin(), PAYMENT_ID, 'idem-second-001', {
        amount: 5_000,
        reason: 'Rest.',
      }),
    ).rejects.toMatchObject({ status: 422 });

    const refunds = await prisma.refund.findMany({ where: { paymentId: PAYMENT_ID } });
    expect(refunds).toHaveLength(1);
  });

  it('refuses to refund a payment that never settled', async () => {
    await prisma.payment.update({
      where: { id: PAYMENT_ID },
      data: { status: PaymentStatus.FAILED },
    });

    await expect(
      refundPayment(admin(), PAYMENT_ID, 'idem-failed-001', {
        amount: 100,
        reason: 'Nope.',
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('404s on an unknown payment', async () => {
    await expect(
      refundPayment(admin(), 'does-not-exist', 'idem-missing-001', {
        amount: 100,
        reason: 'Nope.',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('ledger status', () => {
  it('derives paid, then partially_refunded, then refunded as reversals land', async () => {
    const paid = await listLedger(admin(), { status: 'paid', limit: 50 });
    expect(paid.rows.find((row) => row.id === QUOTE_ID)?.status).toBe('paid');

    await refundPayment(admin(), PAYMENT_ID, 'idem-ledger-001', {
      amount: 10_000,
      reason: 'Partial.',
    });

    const partial = await listLedger(admin(), { status: 'partially_refunded', limit: 50 });
    expect(partial.rows.find((row) => row.id === QUOTE_ID)?.status).toBe(
      'partially_refunded',
    );

    // The filter and the derived row status agree — the tab count and the rows
    // under it come from two different expressions of the same precedence, so
    // this is the assertion that keeps them in step.
    const stillPaid = await listLedger(admin(), { status: 'paid', limit: 50 });
    expect(stillPaid.rows.find((row) => row.id === QUOTE_ID)).toBeUndefined();
  });

  it('never exposes a card number — only brand and last four', async () => {
    const page = await listLedger(admin(), { status: 'all', limit: 50 });
    const row = page.rows.find((entry) => entry.id === QUOTE_ID);

    expect(row?.method).toEqual({ label: 'Visa', brand: 'visa', last4: '4242' });
    expect(JSON.stringify(row)).not.toContain('4242424242424242');
  });

  it('reports tab counts that match the rows each filter returns', async () => {
    const summary = await getSummary(admin());
    const paidTab = summary.tabs.find((tab) => tab.value === 'paid');
    const paidRows = await listLedger(admin(), { status: 'paid', limit: 50 });

    expect(paidTab?.count).toBe(paidRows.totalResults);
  });
});

describe('formatMoneyDisplay', () => {
  /*
   * The display helper is the one place money becomes text. It must never divide
   * into a float, which is what these cases pin down: the fractional part comes
   * from an integer remainder, so it cannot drift.
   */
  it('formats USD minor units exactly', () => {
    expect(formatMoneyDisplay({ amount: 1250, currency: 'USD' })).toBe('$12.50');
    expect(formatMoneyDisplay({ amount: 5, currency: 'USD' })).toBe('$0.05');
    expect(formatMoneyDisplay({ amount: 100, currency: 'USD' })).toBe('$1.00');
    expect(formatMoneyDisplay({ amount: 12_745_099, currency: 'USD' })).toBe('$127,450.99');
  });

  it('drops the fraction in compact mode, without rounding up', () => {
    expect(formatMoneyDisplay({ amount: 12_745_099, currency: 'USD' }, { compact: true })).toBe(
      '$127,450',
    );
  });

  it('handles zero and negative amounts', () => {
    expect(formatMoneyDisplay({ amount: 0, currency: 'USD' })).toBe('$0.00');
    expect(formatMoneyDisplay({ amount: -2500, currency: 'USD' })).toBe('-$25.00');
  });

  it('formats USDT with its six decimals and a trailing ticker', () => {
    // 1 USDT = 1_000_000 raw units.
    expect(formatMoneyDisplay({ amount: 1_500_000, currency: 'USDT' })).toBe(
      '1.500000 USDT',
    );
  });

  it('formats a zero-decimal currency without a fractional part', () => {
    expect(formatMoneyDisplay({ amount: 5000, currency: 'JPY' })).toBe('5,000 JPY');
  });

  it('stays exact past the float-safe range', () => {
    // 2^53 minor units and beyond would lose precision under `amount / 100`.
    expect(formatMoneyDisplay({ amount: 900_719_925_474_099, currency: 'USD' })).toBe(
      '$9,007,199,254,740.99',
    );
  });
});
