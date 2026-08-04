import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';

const { prisma } = await import('../../../lib/prisma.js');
const service = await import('./customers.service.js');

/*
 * Suspending a customer account.
 *
 * The interesting part is not that the flag flips — it is that the flag alone
 * does not end anything. A session cookie stays valid until it expires, so a ban
 * that leaves the sessions behind is a ban the customer keeps working through in
 * an open tab. Both halves are asserted here.
 *
 * The second rule is the one AGENTS.md asks of every conditional write: run it
 * twice, take effect once. Two staff pressing Suspend on the same account must
 * land one write and one refusal, not two audit entries claiming an already
 * closed account was closed again.
 */

const CUSTOMER = 'cust_test_ban_target';
const ADMIN = 'cust_test_ban_admin';

const IDS = [CUSTOMER, ADMIN];

function actor(): AuthContext {
  return {
    userId: ADMIN,
    role: Role.ADMIN,
    sessionId: `sess_${ADMIN}`,
    email: `${ADMIN}@example.test`,
    emailVerified: true,
  };
}

async function cleanup() {
  await prisma.session.deleteMany({ where: { userId: { in: IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
}

// Two devices, so "every session" means more than "the current one".
async function signedInOn(count: number) {
  await prisma.session.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      id: `sess_ban_test_${index}`,
      token: `token_ban_test_${index}`,
      userId: CUSTOMER,
      expiresAt: new Date(Date.now() + 86_400_000),
    })),
  });
}

beforeEach(async () => {
  await cleanup();

  await prisma.user.createMany({
    data: [
      {
        id: CUSTOMER,
        name: 'Ban Test Customer',
        email: `${CUSTOMER}@example.test`,
        role: Role.CUSTOMER,
      },
      {
        id: ADMIN,
        name: 'Ban Test Admin',
        email: `${ADMIN}@example.test`,
        role: Role.ADMIN,
      },
    ],
  });
});

afterAll(cleanup);

describe('banCustomer', () => {
  it('suspends the account and ends every session it holds', async () => {
    await signedInOn(2);

    const detail = await service.banCustomer(actor(), CUSTOMER, {
      reason: 'Chargeback fraud',
    });

    expect(detail.isBanned).toBe(true);
    expect(detail.status).toBe('suspended');
    expect(detail.banReason).toBe('Chargeback fraud');

    const [user, sessions] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: CUSTOMER } }),
      prisma.session.count({ where: { userId: CUSTOMER } }),
    ]);

    expect(user.banned).toBe(true);
    // Permanent until somebody lifts it — an expiring ban would let the account
    // back in with nothing on screen saying it was coming.
    expect(user.banExpires).toBeNull();
    expect(sessions).toBe(0);
  });

  it('runs twice, suspends once', async () => {
    await service.banCustomer(actor(), CUSTOMER, { reason: 'First' });

    await expect(
      service.banCustomer(actor(), CUSTOMER, { reason: 'Second' }),
    ).rejects.toMatchObject({ status: 409 });

    // The first decision stands, note included.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: CUSTOMER } });
    expect(user.banReason).toBe('First');
  });

  it('suspends without a reason', async () => {
    const detail = await service.banCustomer(actor(), CUSTOMER, {});

    expect(detail.isBanned).toBe(true);
    expect(detail.banReason).toBeNull();
  });

  it('404s on an account that is not a customer', async () => {
    await expect(
      service.banCustomer(actor(), ADMIN, {}),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('unbanCustomer', () => {
  it('restores access and clears the note', async () => {
    await service.banCustomer(actor(), CUSTOMER, { reason: 'Chargeback fraud' });

    const detail = await service.unbanCustomer(actor(), CUSTOMER);

    expect(detail.isBanned).toBe(false);
    expect(detail.banReason).toBeNull();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: CUSTOMER } });
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
  });

  it('refuses an account that is not suspended', async () => {
    await expect(
      service.unbanCustomer(actor(), CUSTOMER),
    ).rejects.toMatchObject({ status: 409 });
  });

  /*
   * A ban with a past expiry is not a ban — `guards/require-auth.ts` lets that
   * account in — so the record must not print it as suspended, and the screen
   * must still be able to clear the stale flag.
   */
  it('reads a lapsed ban as active, and still clears it', async () => {
    await prisma.user.update({
      where: { id: CUSTOMER },
      data: {
        banned: true,
        banReason: 'Expired hold',
        banExpires: new Date(Date.now() - 86_400_000),
      },
    });

    const before = await service.getCustomer(actor(), CUSTOMER);
    expect(before.isBanned).toBe(false);
    expect(before.banReason).toBeNull();

    const after = await service.unbanCustomer(actor(), CUSTOMER);
    expect(after.isBanned).toBe(false);
  });
});
