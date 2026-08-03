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
 * The two services these tests order, and the questions they ask — all of it
 * owned by this file.
 *
 * They used to be the seeded `company-formation` and `bank-account` rows, which
 * made these tests a second copy of whatever the catalog happened to say: the
 * fixtures read like production data right up until the real catalog changed its
 * form, and then five tests failed for a reason that had nothing to do with
 * orders. The catalog is admin-editable by design, so a test that asserts
 * against it is asserting against data someone is expected to edit.
 *
 * Test-owned ids and test-owned field keys instead. Nothing here touches the
 * seeded catalog — which also means running the suite no longer rewrites the
 * dev database's real services — and the behaviour under test (required
 * answers, option validation, region denormalisation, the shared-key merge) is
 * exercised on a form this file controls end to end.
 */
const COMPANY = 'orders-test-formation';
const BANK = 'orders-test-bank';

/*
 * The registry rows the forms below reference. Answers are keyed by
 * `FieldDefinition.key`, so a service can only ask what is registered — and the
 * `jurisdiction` in this key is load-bearing: the orders module denormalises
 * `Order.regionCode` from any answer whose FIELD NAME reads as a region,
 * country, or jurisdiction (orders.service.ts, REGION_FIELD_PATTERN).
 */
const COMPANY_NAME_KEY = 'orders_test_company_name';
const JURISDICTION_KEY = 'orders_test_jurisdiction';
const ENTITY_TYPE_KEY = 'orders_test_entity_type';
const BANK_REGION_KEY = 'orders_test_bank_jurisdiction';

const TEST_FIELDS = [
  {
    key: COMPANY_NAME_KEY,
    label: 'Company name',
    type: 'text',
    config: {},
  },
  {
    key: JURISDICTION_KEY,
    label: 'Jurisdiction',
    type: 'select',
    config: {
      options: [
        { value: 'us-de', label: 'United States — Delaware' },
        { value: 'uk', label: 'United Kingdom' },
      ],
    },
  },
  {
    key: ENTITY_TYPE_KEY,
    label: 'Entity type',
    type: 'select',
    config: {
      options: [
        { value: 'llc', label: 'LLC' },
        { value: 'ltd', label: 'LTD' },
      ],
    },
  },
  {
    key: BANK_REGION_KEY,
    label: 'Banking jurisdiction',
    type: 'select',
    config: { options: [{ value: 'us', label: 'United States' }] },
  },
];

// Which questions each service asks, as the references a real service stores.
const SERVICE_FORMS: Record<string, { fieldKey: string; required?: boolean }[]> = {
  [COMPANY]: [
    { fieldKey: COMPANY_NAME_KEY, required: true },
    { fieldKey: JURISDICTION_KEY, required: true },
    { fieldKey: ENTITY_TYPE_KEY, required: true },
  ],
  [BANK]: [
    { fieldKey: BANK_REGION_KEY, required: true },
    // Deliberately shared with the formation form: that is how the registry
    // marks two services as asking the same question.
    { fieldKey: COMPANY_NAME_KEY, required: true },
  ],
};

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

/*
 * The registry first — a service's form is a list of references into it, and an
 * unregistered key resolves to nothing, so a missing definition would quietly
 * turn a required question into no question at all.
 */
async function ensureFields() {
  for (const [index, field] of TEST_FIELDS.entries()) {
    const row = { ...field, sortOrder: 1_000 + index };
    await prisma.fieldDefinition.upsert({
      where: { key: field.key },
      create: row,
      update: row,
    });
  }
}

// Upsert rather than create, and the whole row on update: a previous run may
// have left these behind, and the form is part of what this file asserts on.
async function ensureService(id: string, name: string) {
  const row = {
    iconKey: 'default',
    name,
    description: 'Test service',
    footer: { label: 'Test' },
    detailFields: SERVICE_FORMS[id] ?? [],
    active: true,
    deletedAt: null,
  };

  await prisma.service.upsert({
    where: { id },
    create: { id, ...row },
    update: row,
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
    [COMPANY_NAME_KEY]: 'North Peak LLC',
    [JURISDICTION_KEY]: 'us-de',
    [ENTITY_TYPE_KEY]: 'llc',
  },
  [BANK]: {
    [BANK_REGION_KEY]: 'us',
    [COMPANY_NAME_KEY]: 'North Peak LLC',
  },
};

beforeEach(async () => {
  queueEmail.mockClear();
  await ensureUser(OWNER_ID);
  await ensureUser(OTHER_ID);
  await ensureFields();
  await ensureService(COMPANY, 'Company Formation');
  await ensureService(BANK, 'Bank Account');
  await ensureRegion('US', 'United States');
  await prisma.order.deleteMany({ where: { customerId: { in: [OWNER_ID, OTHER_ID] } } });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerId: { in: [OWNER_ID, OTHER_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [OWNER_ID, OTHER_ID] } } });
  // The fixtures are this file's own rows, so it clears them rather than leaving
  // two services and four questions behind in every developer's catalog.
  await prisma.service.deleteMany({ where: { id: { in: [COMPANY, BANK] } } });
  await prisma.fieldDefinition.deleteMany({
    where: { key: { in: TEST_FIELDS.map((field) => field.key) } },
  });
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
        answersByService: { [COMPANY]: { [COMPANY_NAME_KEY]: '' } },
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
            [COMPANY_NAME_KEY]: 'X',
            [JURISDICTION_KEY]: 'not-a-real-place',
            [ENTITY_TYPE_KEY]: 'llc',
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
