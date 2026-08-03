import type { Request } from 'express';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../lib/app-error.js';
import { Role } from '../../lib/roles.js';
import type { AuthContext } from '../../guards/auth-context.js';

// The confirmation email goes through the notifications service, which needs
// Redis/SES — mock it so these tests exercise only the orders logic + DB.
const queueEmail = vi.hoisted(() => vi.fn(async () => ({ id: 'notif_test' })));
vi.mock('../notifications/notifications.service.js', () => ({ queueEmail }));

const { prisma } = await import('../../lib/prisma.js');
const { createOrder, listOrders, getOrderDetail } = await import(
  './orders.service.js'
);

/*
 * The two services these tests order. The ids match prisma/seed.ts so the
 * fixtures read like production data, but ensureService below creates them
 * rather than assuming the seed has been run: OrderItem.serviceId is a foreign
 * key, so on a database that has never been seeded every order here fails to
 * insert. A test that needs `db:seed` first is a test that passes on one
 * machine.
 */
const COMPANY = 'company-formation';
const BANK = 'bank-account';

const OWNER_ID = 'orders_test_owner';
const OTHER_ID = 'orders_test_other';

function auth(userId: string, role: Role = Role.CUSTOMER): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

// The service reads the current user via getAuth(req) — a request carrying an
// AuthContext is all it needs (same shape the guard sets).
function reqAs(context: AuthContext): Request {
  return { auth: context } as unknown as Request;
}

async function ensureUser(id: string) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role: 'customer' },
    update: {},
  });
}

// Upsert rather than create: these ids are shared with the seed, so the row may
// already exist. `deletedAt: null` on update revives one a previous test soft
// deleted.
async function ensureService(id: string, name: string) {
  await prisma.service.upsert({
    where: { id },
    create: {
      id,
      iconKey: 'default',
      name,
      description: 'Test service',
      footer: { label: 'Test' },
    },
    update: { deletedAt: null },
  });
}

/*
 * Regions are reference data an admin maintains at /admin/settings — deliberately
 * never seeded, so no fresh database has any. `Order.regionCode` is resolved by
 * looking the candidate up against the active regions (orders.service.ts), which
 * means the "us-de" answer only denormalises to "US" when this row exists.
 */
async function ensureRegion(code: string, label: string) {
  await prisma.region.upsert({
    where: { code },
    create: { code, label, flag: '🏳️', active: true },
    update: { active: true },
  });
}

/*
 * Answer keys are `FieldDefinition.key` values from the seeded field registry —
 * a service's form is a list of references into it, so these are the only keys
 * the catalog can ask for.
 *
 * `company_name` is deliberately the same key on both services: that is how the
 * registry marks two services as asking the same question, and the customer's
 * master form asks it once and records the answer against both items.
 */
const validAnswers = {
  [COMPANY]: {
    company_name: 'North Peak LLC',
    jurisdiction: 'us-de',
    entity_type: 'llc',
  },
  [BANK]: {
    banking_region: 'us',
    company_name: 'North Peak LLC',
    identity_document: 'passport.pdf',
    proof_of_address: 'utility-bill.pdf',
  },
};

beforeEach(async () => {
  queueEmail.mockClear();
  await ensureUser(OWNER_ID);
  await ensureUser(OTHER_ID);
  await ensureService(COMPANY, 'Company Formation');
  await ensureService(BANK, 'Bank Account');
  await ensureRegion('US', 'United States');
  await prisma.order.deleteMany({ where: { customerId: { in: [OWNER_ID, OTHER_ID] } } });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerId: { in: [OWNER_ID, OTHER_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, OTHER_ID] } } });
  await prisma.$disconnect();
});

describe('createOrder', () => {
  it('creates a submitted order with items and returns the confirmation', async () => {
    const confirmation = await createOrder(reqAs(auth(OWNER_ID)), {
      serviceIds: [COMPANY, BANK],
      answersByService: validAnswers,
      notes: 'Prioritize the formation.',
    });

    expect(confirmation.reference).toMatch(
      /^ORD-\d{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/,
    );
    expect(confirmation.serviceNames).toHaveLength(2);
    expect(confirmation.confirmationEmail).toBe(`${OWNER_ID}@example.com`);

    const stored = await prisma.order.findFirstOrThrow({
      where: { customerId: OWNER_ID },
      include: { items: true },
    });
    expect(stored.status).toBe('SUBMITTED');
    expect(stored.submittedAt).not.toBeNull();
    expect(stored.items).toHaveLength(2);
    // The jurisdiction answer ("us-de") is denormalised to the region the admin
    // queue filters on; without it that filter can never match the order.
    expect(stored.regionCode).toBe('US');

    // The confirmation email is queued (through the mocked notifications service).
    expect(queueEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing required field with a validation error', async () => {
    await expect(
      createOrder(reqAs(auth(OWNER_ID)), {
        serviceIds: [COMPANY],
        answersByService: { [COMPANY]: { company_name: '' } },
      }),
    ).rejects.toMatchObject({ status: 400 });

    // Nothing was created.
    const count = await prisma.order.count({ where: { customerId: OWNER_ID } });
    expect(count).toBe(0);
  });

  it('rejects a select value outside its options', async () => {
    await expect(
      createOrder(reqAs(auth(OWNER_ID)), {
        serviceIds: [COMPANY],
        answersByService: {
          [COMPANY]: {
            company_name: 'X',
            jurisdiction: 'not-a-real-place',
            entity_type: 'llc',
          },
        },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an unavailable service id', async () => {
    await expect(
      createOrder(reqAs(auth(OWNER_ID)), {
        serviceIds: ['does-not-exist'],
        answersByService: {},
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('listOrders', () => {
  it("returns only the caller's own orders, newest first", async () => {
    await createOrder(reqAs(auth(OWNER_ID)), {
      serviceIds: [COMPANY],
      answersByService: validAnswers,
    });
    await createOrder(reqAs(auth(OTHER_ID)), {
      serviceIds: [BANK],
      answersByService: validAnswers,
    });

    const page = await listOrders(reqAs(auth(OWNER_ID)), {
      filter: 'all',
      limit: 10,
    });

    expect(page.orders).toHaveLength(1);
    expect(page.counts.all).toBe(1);
    expect(page.counts.active).toBe(1);
    expect(page.counts.completed).toBe(0);
  });

  it('filters by status set', async () => {
    await createOrder(reqAs(auth(OWNER_ID)), {
      serviceIds: [COMPANY],
      answersByService: validAnswers,
    });

    const active = await listOrders(reqAs(auth(OWNER_ID)), {
      filter: 'active',
      limit: 10,
    });
    const completed = await listOrders(reqAs(auth(OWNER_ID)), {
      filter: 'completed',
      limit: 10,
    });

    expect(active.orders).toHaveLength(1);
    expect(completed.orders).toHaveLength(0);
  });
});

describe('getOrderDetail', () => {
  it('returns the order with a derived timeline and labelled application fields', async () => {
    await createOrder(reqAs(auth(OWNER_ID)), {
      serviceIds: [COMPANY],
      answersByService: validAnswers,
    });
    const created = await prisma.order.findFirstOrThrow({
      where: { customerId: OWNER_ID },
    });

    const detail = await getOrderDetail(reqAs(auth(OWNER_ID)), created.id);

    expect(detail.reference).toBe(created.reference);
    expect(detail.status).toBe('submitted');
    expect(detail.timeline.steps.length).toBeGreaterThan(0);
    expect(detail.timeline.currentIndex).toBe(0);
    // Select values are resolved to their option labels.
    expect(detail.applicationDetails).toContainEqual({
      label: 'Jurisdiction',
      value: 'United States — Delaware',
    });
  });

  it("hides another customer's order behind a 404", async () => {
    await createOrder(reqAs(auth(OWNER_ID)), {
      serviceIds: [COMPANY],
      answersByService: validAnswers,
    });
    const ownerOrder = await prisma.order.findFirstOrThrow({
      where: { customerId: OWNER_ID },
    });

    await expect(
      getOrderDetail(reqAs(auth(OTHER_ID)), ownerOrder.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});
