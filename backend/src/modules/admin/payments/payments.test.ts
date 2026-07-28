import { PaymentProvider, PaymentStatus, QuoteStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';
import { formatMoneyDisplay } from '../admin.views.js';

const { prisma } = await import('../../../lib/prisma.js');
const { listLedger, getSummary } = await import('./payments.service.js');

/*
 * The money-critical paths this module owns: the ledger's derived status staying
 * in step with the tab counts, and the money helpers.
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
      provider: PaymentProvider.USDT_TRC20,
      status: PaymentStatus.SUCCEEDED,
      amount: AMOUNT,
      currency: 'USD',
      paidAt: now,
    },
  });
}

beforeEach(reset);

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { id: PAYMENT_ID } });
  await prisma.quote.deleteMany({ where: { id: QUOTE_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN_ID, CUSTOMER_ID] } } });
  await prisma.$disconnect();
});

describe('ledger status', () => {
  it('derives paid from a settled payment', async () => {
    const paid = await listLedger(admin(), { status: 'paid', limit: 50 });
    expect(paid.rows.find((row) => row.id === QUOTE_ID)?.status).toBe('paid');
  });

  /*
   * `deriveStatus` and `statusWhere` are two expressions of one precedence
   * order, so a quote whose only payment failed must leave the paid tab and
   * appear under `failed`. This is the assertion that keeps them in step.
   */
  it('moves a quote off the paid tab once its payment fails', async () => {
    await prisma.payment.update({
      where: { id: PAYMENT_ID },
      data: { status: PaymentStatus.FAILED },
    });

    const failed = await listLedger(admin(), { status: 'failed', limit: 50 });
    expect(failed.rows.find((row) => row.id === QUOTE_ID)?.status).toBe('failed');

    const stillPaid = await listLedger(admin(), { status: 'paid', limit: 50 });
    expect(stillPaid.rows.find((row) => row.id === QUOTE_ID)).toBeUndefined();
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
