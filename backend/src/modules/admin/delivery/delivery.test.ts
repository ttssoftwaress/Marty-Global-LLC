import { beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../../lib/roles.js';
import type { AuthContext } from '../../../guards/auth-context.js';

const { prisma } = await import('../../../lib/prisma.js');
const { getItemResult, saveResult, updateOrderItemStatus } = await import(
  './delivery.service.js'
);

/*
 * The delivery gate — the one rule that makes a result page trustworthy: a
 * customer is never told a service is complete while the record behind it is
 * blank.
 *
 * Everything here is the AGENTS.md "critical path" reading of this feature. The
 * registry CRUD and the queue's filters are ordinary list/write code; what is
 * worth a test is the invariant that a required field cannot be skipped, and
 * that the two ways of completing a service agree with each other.
 */

const ADMIN_ID = 'delivery_test_admin';
const CUSTOMER_ID = 'delivery_test_customer';
const SERVICE_ID = 'delivery_test_service';
const PLAIN_SERVICE_ID = 'delivery_test_plain_service';

function auth(userId: string, role: Role = Role.ADMIN): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

async function ensureUser(id: string, role: string) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role },
    update: {},
  });
}

/*
 * A service returning two facts: a required company name (which is also the
 * record's title) and an optional filing date. The gate should refuse a delivery
 * missing the first and allow one missing the second.
 */
async function seedRegistry() {
  await prisma.resultFieldDefinition.upsert({
    where: { key: 'delivery_test_company_name' },
    create: {
      key: 'delivery_test_company_name',
      label: 'Company name',
      type: 'text',
      isPrimary: true,
      showInList: true,
    },
    update: {},
  });

  await prisma.resultFieldDefinition.upsert({
    where: { key: 'delivery_test_filed_on' },
    create: { key: 'delivery_test_filed_on', label: 'Filed on', type: 'date' },
    update: {},
  });
}

async function seedServices() {
  await prisma.service.upsert({
    where: { id: SERVICE_ID },
    create: {
      id: SERVICE_ID,
      iconKey: 'company-formation',
      name: 'Delivery Test Formation',
      description: 'Fixture service that returns a record.',
      features: [],
      footer: { label: '' },
      resultFields: [
        { fieldKey: 'delivery_test_company_name', required: true, isPrimary: true },
        { fieldKey: 'delivery_test_filed_on' },
      ],
    },
    update: {
      resultFields: [
        { fieldKey: 'delivery_test_company_name', required: true, isPrimary: true },
        { fieldKey: 'delivery_test_filed_on' },
      ],
    },
  });

  // A service that returns nothing — not everything we sell delivers a record.
  await prisma.service.upsert({
    where: { id: PLAIN_SERVICE_ID },
    create: {
      id: PLAIN_SERVICE_ID,
      iconKey: 'default',
      name: 'Delivery Test Advisory',
      description: 'Fixture service with no result schema.',
      features: [],
      footer: { label: '' },
    },
    update: { resultFields: [] },
  });
}

let orderId: string;

async function seedOrder(serviceId: string): Promise<string> {
  const order = await prisma.order.create({
    data: {
      reference: `ORD-DT-${Math.floor(Math.random() * 1_000_000)}`,
      customerId: CUSTOMER_ID,
      assigneeId: ADMIN_ID,
      status: 'PROCESSING',
      items: {
        create: {
          serviceId,
          serviceName: 'Fixture service',
          answers: {},
        },
      },
    },
    include: { items: true },
  });

  orderId = order.id;
  return order.items[0]!.id;
}

beforeEach(async () => {
  await ensureUser(ADMIN_ID, 'admin');
  await ensureUser(CUSTOMER_ID, 'customer');
  await seedRegistry();
  await seedServices();
});

describe('the delivery gate', () => {
  it('refuses to deliver while a required field is blank', async () => {
    const itemId = await seedOrder(SERVICE_ID);
    await getItemResult(auth(ADMIN_ID), itemId);

    await expect(
      saveResult(auth(ADMIN_ID), itemId, {
        // Only the optional field — the required company name is missing.
        values: [{ fieldKey: 'delivery_test_filed_on', value: '2026-03-01' }],
        deliver: true,
      }),
    ).rejects.toMatchObject({ status: 422 });

    // The rejected delivery must leave the record a draft, so the customer still
    // sees nothing rather than a half-written filing.
    const result = await prisma.serviceResult.findFirstOrThrow({
      where: { orderItemId: itemId },
    });
    expect(result.status).toBe('DRAFT');

    const item = await prisma.orderItem.findFirstOrThrow({ where: { id: itemId } });
    expect(item.status).toBe('PENDING');
  });

  it('saves an incomplete draft without complaint', async () => {
    const itemId = await seedOrder(SERVICE_ID);
    await getItemResult(auth(ADMIN_ID), itemId);

    // The same payload the delivery above rejected — a draft is allowed to be
    // incomplete, which is the whole point of the two-button form.
    const saved = await saveResult(auth(ADMIN_ID), itemId, {
      values: [{ fieldKey: 'delivery_test_filed_on', value: '2026-03-01' }],
    });

    expect(saved.result?.status).toBe('draft');
    expect(saved.result?.missingRequired).toContain('delivery_test_company_name');
  });

  it('delivers once every required field is filled, completing the item', async () => {
    const itemId = await seedOrder(SERVICE_ID);
    await getItemResult(auth(ADMIN_ID), itemId);

    const saved = await saveResult(auth(ADMIN_ID), itemId, {
      values: [
        { fieldKey: 'delivery_test_company_name', value: 'North Peak LLC' },
        { fieldKey: 'delivery_test_filed_on', value: '2026-03-01' },
      ],
      deliver: true,
    });

    expect(saved.status).toBe('completed');
    expect(saved.result?.status).toBe('active');
    expect(saved.result?.missingRequired).toHaveLength(0);
    // The title is snapshotted from the primary field so the customer's list can
    // sort and search on it.
    expect(saved.result?.title).toBe('North Peak LLC');

    const item = await prisma.orderItem.findFirstOrThrow({ where: { id: itemId } });
    expect(item.status).toBe('COMPLETED');
    expect(item.completedAt).not.toBeNull();
  });

  it('rejects a value that does not parse as its field type', async () => {
    const itemId = await seedOrder(SERVICE_ID);
    await getItemResult(auth(ADMIN_ID), itemId);

    await expect(
      saveResult(auth(ADMIN_ID), itemId, {
        values: [
          { fieldKey: 'delivery_test_company_name', value: 'North Peak LLC' },
          { fieldKey: 'delivery_test_filed_on', value: 'not-a-date' },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  /*
   * The gate would be worthless if the plain status endpoint could step around
   * it — that is the second way to complete a service, and the two must agree.
   */
  it('will not complete a result-bearing item through the status endpoint', async () => {
    const itemId = await seedOrder(SERVICE_ID);

    await expect(
      updateOrderItemStatus(auth(ADMIN_ID), itemId, { status: 'completed' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('completes a service with no result schema directly', async () => {
    const itemId = await seedOrder(PLAIN_SERVICE_ID);

    const updated = await updateOrderItemStatus(auth(ADMIN_ID), itemId, {
      status: 'completed',
    });

    expect(updated.status).toBe('completed');
    expect(updated.hasResultSchema).toBe(false);
    expect(updated.result).toBeNull();
  });

  it('hides another staff member’s order item', async () => {
    const itemId = await seedOrder(SERVICE_ID);
    await ensureUser('delivery_test_stranger', 'staff');

    // A staff member without `orders.all` works only what is assigned to them,
    // so somebody else's item is a 404 rather than a 403 — the same rule the
    // rest of the admin portal follows.
    await expect(
      getItemResult(auth('delivery_test_stranger', Role.STAFF), itemId),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('order cleanup', () => {
  it('leaves no fixture orders behind', async () => {
    // The fixtures cascade from the order, so removing them keeps the shared
    // test database from growing a row per run.
    await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
    expect(orderId).toBeTruthy();
  });
});
