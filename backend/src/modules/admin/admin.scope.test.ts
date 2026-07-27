import { StaffStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { Role } from '../../lib/roles.js';

const { prisma } = await import('../../lib/prisma.js');
const scope = await import('./admin.scope.js');

/*
 * The shape of every scope clause, asserted directly.
 *
 * These are the `where` fragments that decide whose records a staff member
 * reads, so what matters is that a scoped actor produces a clause that reaches
 * `Order.assigneeId` and an unscoped one produces `{}`. Asserting the object
 * rather than querying through it keeps the test independent of the order
 * tables — the relation paths are the thing that can silently drift, and a
 * wrong path is a leak whether or not any rows exist to prove it.
 *
 * `admin.guards.test.ts` covers the predicate itself (`canSeeAll`); this covers
 * what each module then puts in its query.
 */

const SCOPED = 'scope_test_scoped';
const WIDE = 'scope_test_wide';
const IDS = [SCOPED, WIDE];

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

async function makeStaff(id: string, permissions: string[]) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.test`, role: Role.STAFF },
    update: { role: Role.STAFF },
  });

  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      roleKey: 'reviewer',
      status: StaffStatus.ACTIVE,
      permissions,
    },
    update: { status: StaffStatus.ACTIVE, permissions },
  });
}

beforeAll(async () => {
  // Holds every area, none of the `.all` companions.
  await makeStaff(SCOPED, [
    'orders',
    'customers',
    'payments',
    'mailroom',
    'support',
    'reports',
  ]);

  // The same areas, every one of them widened.
  await makeStaff(WIDE, [
    'orders',
    'orders.all',
    'customers',
    'customers.all',
    'payments',
    'payments.all',
    'mailroom',
    'mailroom.all',
    'support',
    'support.all',
    'reports',
    'reports.all',
  ]);
});

afterAll(async () => {
  await prisma.staffProfile.deleteMany({ where: { userId: { in: IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
});

describe('a scoped staff member', () => {
  const me = () => actor(SCOPED, Role.STAFF);

  it('reads orders only where they are the assignee', async () => {
    expect(await scope.orderScope(me())).toEqual({ assigneeId: SCOPED });
  });

  it('reaches a quote through its order', async () => {
    expect(await scope.quoteScope(me())).toEqual({
      order: { is: { assigneeId: SCOPED } },
    });
  });

  it('reaches a payment through quote → order', async () => {
    expect(await scope.paymentScope(me())).toEqual({
      quote: { is: { order: { is: { assigneeId: SCOPED } } } },
    });
  });

  it('reaches a refund through payment → quote → order', async () => {
    expect(await scope.refundScope(me())).toEqual({
      payment: { is: { quote: { is: { order: { is: { assigneeId: SCOPED } } } } } },
    });
  });

  /*
   * `some`, not a single value — a customer with orders across several staff is
   * a customer all of them deal with. The inner `deletedAt` matters: without it
   * a soft-deleted order would keep granting its assignee that customer.
   */
  it('reads a customer only through an order they hold', async () => {
    expect(await scope.customerScope(me())).toEqual({
      orders: { some: { assigneeId: SCOPED, deletedAt: null } },
    });
  });

  it('reaches mail through the customer that owns the room', async () => {
    const owned = { orders: { some: { assigneeId: SCOPED, deletedAt: null } } };

    expect(await scope.mailItemScope(me())).toEqual({
      room: { is: { customer: { is: owned } } },
    });
    expect(await scope.mailRequestScope(me())).toEqual({
      customer: { is: owned },
    });
    // MailActionLog has no `customer` relation, so it goes via the mail item.
    expect(await scope.mailLogScope(me())).toEqual({
      mailItem: { is: { room: { is: { customer: { is: owned } } } } },
    });
  });

  // Reports ask their own area, not `payments` — a reviewer holds `reports` by
  // default, so whether their charts cover the org is a `reports` decision.
  it('narrows reports under the reports area', async () => {
    expect(await scope.reportOrderScope(me())).toEqual({ assigneeId: SCOPED });
    expect(await scope.reportPaymentScope(me())).toEqual({
      quote: { is: { order: { is: { assigneeId: SCOPED } } } },
    });
  });

  // The dashboard has no area of its own — every staff member lands on it — so
  // it borrows `orders` as the closest thing to "is this person an overseer".
  it('narrows the dashboard on the orders area', async () => {
    expect(await scope.dashboardOrderScope(me())).toEqual({ assigneeId: SCOPED });
    expect(await scope.dashboardPaymentScope(me())).toEqual({
      quote: { is: { order: { is: { assigneeId: SCOPED } } } },
    });
  });
});

describe('a member granted “All data”', () => {
  const me = () => actor(WIDE, Role.STAFF);

  it('reads every model unscoped', async () => {
    expect(await scope.orderScope(me())).toEqual({});
    expect(await scope.quoteScope(me())).toEqual({});
    expect(await scope.paymentScope(me())).toEqual({});
    expect(await scope.refundScope(me())).toEqual({});
    expect(await scope.customerScope(me())).toEqual({});
    expect(await scope.mailItemScope(me())).toEqual({});
    expect(await scope.mailRequestScope(me())).toEqual({});
    expect(await scope.mailLogScope(me())).toEqual({});
    expect(await scope.reportOrderScope(me())).toEqual({});
    expect(await scope.dashboardOrderScope(me())).toEqual({});
  });
});

describe('an admin', () => {
  // Passes on the role alone, with no profile and no grants at all.
  const me = () => actor('scope_test_admin_no_profile', Role.ADMIN);

  it('is unscoped everywhere without holding a single key', async () => {
    expect(await scope.orderScope(me())).toEqual({});
    expect(await scope.paymentScope(me())).toEqual({});
    expect(await scope.customerScope(me())).toEqual({});
    expect(await scope.mailLogScope(me())).toEqual({});
    expect(await scope.reportPaymentScope(me())).toEqual({});
  });
});

describe('scopeLabel', () => {
  it('names the two states the summaries publish', () => {
    expect(scope.scopeLabel(true)).toBe('all');
    expect(scope.scopeLabel(false)).toBe('assigned');
  });
});
