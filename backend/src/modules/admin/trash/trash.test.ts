import { describe, expect, it, afterAll, beforeEach } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';

const { prisma } = await import('../../../lib/prisma.js');
const trash = await import('./trash.service.js');

/*
 * The one promise this feature makes that nothing else can check for it:
 * **restoring puts back exactly what the delete took, and nothing else.**
 *
 * Everything around it is ordinary CRUD. This is not — it is a cascade captured
 * at one moment and replayed at another, and the failure mode is silent. A
 * restore that over-reaches quietly resurrects a record somebody deleted last
 * month; one that under-reaches leaves a customer visible with their orders
 * still hidden. Neither throws, and neither is visible from the screen.
 *
 * So the cases below are the two directions of that, plus the guard that must
 * refuse rather than half-complete a bulk delete.
 */

const ADMIN = 'trash_test_admin';
const CUSTOMER = 'trash_test_customer';

function actor(): AuthContext {
  return {
    userId: ADMIN,
    role: Role.ADMIN,
    sessionId: `sess_${ADMIN}`,
    email: `${ADMIN}@example.test`,
    emailVerified: true,
  };
}

// Two orders, so one can be deleted first and the other only by the cascade —
// which is the whole distinction under test.
const ORDER_A = 'trash_test_order_a';
const ORDER_B = 'trash_test_order_b';

async function cleanup() {
  await prisma.trashEntry.deleteMany({
    where: { entityId: { in: [CUSTOMER, ORDER_A, ORDER_B] } },
  });
  await prisma.order.deleteMany({ where: { id: { in: [ORDER_A, ORDER_B] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN, CUSTOMER] } } });
}

async function seed() {
  await prisma.user.createMany({
    data: [
      {
        id: ADMIN,
        name: 'Trash Test Admin',
        email: `${ADMIN}@example.test`,
        role: Role.ADMIN,
      },
      {
        id: CUSTOMER,
        name: 'Trash Test Customer',
        email: `${CUSTOMER}@example.test`,
        role: Role.CUSTOMER,
      },
    ],
  });

  await prisma.order.createMany({
    data: [
      { id: ORDER_A, reference: 'TRASH-A', customerId: CUSTOMER },
      { id: ORDER_B, reference: 'TRASH-B', customerId: CUSTOMER },
    ],
  });
}

async function entryFor(entityType: string, entityId: string) {
  return prisma.trashEntry.findUniqueOrThrow({
    where: { entityType_entityId: { entityType, entityId } },
  });
}

beforeEach(async () => {
  await cleanup();
  await seed();
});

afterAll(cleanup);

describe('trashing a record', () => {
  it('takes the rows that would otherwise be left pointing at it', async () => {
    const result = await trash.trashRows(actor(), 'customer', [CUSTOMER]);

    expect(result.deleted).toBe(1);
    // Both orders went with the customer. Left behind, they would keep appearing
    // in the orders queue attached to somebody who is gone.
    expect(result.cascaded).toBeGreaterThanOrEqual(2);

    const orders = await prisma.order.findMany({
      where: { id: { in: [ORDER_A, ORDER_B] } },
      select: { id: true, deletedAt: true },
    });

    expect(orders.every((order) => order.deletedAt !== null)).toBe(true);
  });

  it('refuses the whole selection when one row is refused', async () => {
    // A staff account cannot be deleted from the customer list — and the refusal
    // has to take the whole call with it, or an admin is told "2 of 3 deleted"
    // with no way to tell which.
    await expect(
      trash.trashRows(actor(), 'customer', [CUSTOMER, ADMIN]),
    ).rejects.toMatchObject({ status: 422 });

    const customer = await prisma.user.findUnique({ where: { id: CUSTOMER } });
    expect(customer?.deletedAt).toBeNull();
  });
});

describe('restoring a record', () => {
  it('puts back exactly what that delete took', async () => {
    await trash.trashRows(actor(), 'customer', [CUSTOMER]);
    const entry = await entryFor('customer', CUSTOMER);

    await trash.restoreEntries(actor(), [entry.id]);

    const [customer, orders, gone] = await Promise.all([
      prisma.user.findUnique({ where: { id: CUSTOMER } }),
      prisma.order.findMany({
        where: { id: { in: [ORDER_A, ORDER_B] } },
        select: { deletedAt: true },
      }),
      prisma.trashEntry.findUnique({
        where: {
          entityType_entityId: { entityType: 'customer', entityId: CUSTOMER },
        },
      }),
    ]);

    expect(customer?.deletedAt).toBeNull();
    expect(orders.every((order) => order.deletedAt === null)).toBe(true);
    // The table holds live trash only — which is what makes a double-clicked
    // restore a no-op rather than a second one.
    expect(gone).toBeNull();
  });

  /*
   * The case a re-derived cascade gets wrong, and the reason the ids are
   * captured at delete time instead.
   *
   * Order A is deleted on its own first. Deleting the customer afterwards must
   * not claim it — so restoring the customer must leave A where its own delete
   * put it, while bringing B back.
   */
  it('leaves a row that was already in the Trash before the delete', async () => {
    await trash.trashRows(actor(), 'order', [ORDER_A]);
    await trash.trashRows(actor(), 'customer', [CUSTOMER]);

    const entry = await entryFor('customer', CUSTOMER);
    await trash.restoreEntries(actor(), [entry.id]);

    const [a, b] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: ORDER_A } }),
      prisma.order.findUniqueOrThrow({ where: { id: ORDER_B } }),
    ]);

    expect(a.deletedAt).not.toBeNull();
    expect(b.deletedAt).toBeNull();

    // And A's own entry is still there to restore it with, deliberately: the
    // customer's restore never owned it.
    const own = await prisma.trashEntry.findUnique({
      where: { entityType_entityId: { entityType: 'order', entityId: ORDER_A } },
    });
    expect(own).not.toBeNull();
  });

  /*
   * Deleting several rows at once files one entry each, and each must own only
   * its own closure. A shared cascade attached to every entry would restore both
   * customers' orders when one customer is put back.
   */
  it('scopes the cascade to each row when several are deleted together', async () => {
    const result = await trash.trashRows(actor(), 'order', [ORDER_A, ORDER_B]);
    expect(result.deleted).toBe(2);

    const entry = await entryFor('order', ORDER_A);
    await trash.restoreEntries(actor(), [entry.id]);

    const [a, b] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: ORDER_A } }),
      prisma.order.findUniqueOrThrow({ where: { id: ORDER_B } }),
    ]);

    expect(a.deletedAt).toBeNull();
    expect(b.deletedAt).not.toBeNull();
  });
});

describe('the retention window', () => {
  it('stamps a deadline rather than computing one later', async () => {
    const { retentionDays } = await trash.getSettings();
    const before = Date.now();

    await trash.trashRows(actor(), 'order', [ORDER_A]);
    const entry = await entryFor('order', ORDER_A);

    const expected = before + retentionDays * 86_400_000;

    // Within a minute of the window from the moment of deletion. Stored, not
    // derived: shortening the setting later must not retroactively destroy
    // something an admin was told they had this long to recover.
    expect(Math.abs(entry.purgeAt.getTime() - expected)).toBeLessThan(60_000);
  });

  it('destroys nothing before the deadline', async () => {
    await trash.trashRows(actor(), 'order', [ORDER_A]);

    const result = await trash.purgeExpired();
    expect(result.purged).toBe(0);

    expect(
      await prisma.order.findUnique({ where: { id: ORDER_A } }),
    ).not.toBeNull();
  });

  it('hard-deletes once the deadline has passed', async () => {
    await trash.trashRows(actor(), 'order', [ORDER_A]);

    const entry = await entryFor('order', ORDER_A);
    await prisma.trashEntry.update({
      where: { id: entry.id },
      data: { purgeAt: new Date(Date.now() - 1000) },
    });

    await trash.purgeExpired();

    // The row is gone for good, and so is the entry that pointed at it — the
    // audit trail is what is left saying it ever existed.
    expect(await prisma.order.findUnique({ where: { id: ORDER_A } })).toBeNull();
    expect(await prisma.trashEntry.findUnique({ where: { id: entry.id } })).toBeNull();
  });
});
