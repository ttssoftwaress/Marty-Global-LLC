import { MessageAuthor, OrderStatus, StaffStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { Role } from '../../lib/roles.js';

/*
 * The rule this module exists to enforce, tested against a real database because
 * it is decided in Prisma queries and a transaction rather than in code a screen
 * could be trusted to repeat:
 *
 *   A customer's order conversation is answerable only by that order's assignee.
 *
 * That is the whole distinction from support, where a thread routes to whichever
 * agent is free. Three things make it real, and each is a test below: the wrong
 * staff member cannot read or post; reassigning the order moves the thread; and
 * an internal note never reaches the customer.
 *
 * The note case earns a test even under AGENTS.md's "critical paths only" rule,
 * for the same reason the admin orders suite tests its own: a leaked internal
 * note is not a bug you can take back.
 */

const { prisma } = await import('../../lib/prisma.js');
const { getOrderConversation, sendMessage } = await import(
  './conversations.service.js'
);
const { updateOrder } = await import('../admin/orders/orders.service.js');

const CUSTOMER_ID = 'conv_test_customer';
const OTHER_CUSTOMER_ID = 'conv_test_other_customer';
const ASSIGNEE_ID = 'conv_test_assignee';
const OTHER_STAFF_ID = 'conv_test_other_staff';
const ADMIN_ID = 'conv_test_admin';
const USER_IDS = [
  CUSTOMER_ID,
  OTHER_CUSTOMER_ID,
  ASSIGNEE_ID,
  OTHER_STAFF_ID,
  ADMIN_ID,
];

const COMPANY = 'company-formation';

function auth(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.com`,
    emailVerified: true,
  };
}

async function ensureUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.com`, role },
    update: { role },
  });
}

async function ensureStaff(id: string, roleKey: string) {
  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: {
      userId: id,
      roleKey,
      status: StaffStatus.ACTIVE,
      permissions: ['orders', 'support'],
    },
    update: { status: StaffStatus.ACTIVE, permissions: ['orders', 'support'] },
  });
}

/*
 * The catalog row every order below references. The id matches prisma/seed.ts so
 * the fixture reads like production data, but it is created here rather than
 * assumed: OrderItem.serviceId is a foreign key, so on a database that has never
 * been seeded every createOrder() fails to insert.
 */
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

async function createOrder(assigneeId: string | null) {
  return prisma.order.create({
    data: {
      reference: `ORD-C${Math.floor(10_000 + Math.random() * 89_999)}`,
      customerId: CUSTOMER_ID,
      status: OrderStatus.UNDER_REVIEW,
      assigneeId,
      submittedAt: new Date(),
      items: {
        create: {
          serviceId: COMPANY,
          serviceName: 'Company Formation',
          answers: { companyName: 'North Peak LLC', jurisdiction: 'us-de' },
          sortOrder: 0,
        },
      },
    },
  });
}

beforeEach(async () => {
  await ensureService(COMPANY, 'Company Formation');
  await ensureUser(CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(OTHER_CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(ASSIGNEE_ID, Role.STAFF);
  await ensureUser(OTHER_STAFF_ID, Role.STAFF);
  await ensureUser(ADMIN_ID, Role.ADMIN);
  await ensureStaff(ASSIGNEE_ID, 'reviewer');
  await ensureStaff(OTHER_STAFF_ID, 'reviewer');
  await ensureStaff(ADMIN_ID, 'super-admin');
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.conversation.deleteMany({
    where: { customerId: { in: [CUSTOMER_ID, OTHER_CUSTOMER_ID] } },
  });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

describe('the assignee lock', () => {
  it('lets the assigned staff member read and reply', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    const message = await sendMessage(auth(ASSIGNEE_ID, Role.STAFF), order.id, {
      body: 'We have started your filing.',
    });

    expect(message.kind).toBe('staff');

    const thread = await getOrderConversation(auth(ASSIGNEE_ID, Role.STAFF), order.id);
    expect(thread.messages).toHaveLength(1);
    expect(thread.assignee?.id).toBe(ASSIGNEE_ID);
  });

  it('hides the thread from a staff member the order is not assigned to', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    // 404 rather than 403 — a staff member who is not on this order should not
    // have the order's existence confirmed to them by the error code.
    await expect(
      getOrderConversation(auth(OTHER_STAFF_ID, Role.STAFF), order.id),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      sendMessage(auth(OTHER_STAFF_ID, Role.STAFF), order.id, { body: 'Hello' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lets an admin step in on any order', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    const message = await sendMessage(auth(ADMIN_ID, Role.ADMIN), order.id, {
      body: 'Stepping in while your specialist is away.',
    });

    expect(message.kind).toBe('staff');
  });

  it("hides the thread from another customer's account", async () => {
    const order = await createOrder(ASSIGNEE_ID);

    await expect(
      getOrderConversation(auth(OTHER_CUSTOMER_ID, Role.CUSTOMER), order.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('an unassigned order', () => {
  it('is read-only for the customer, and says why', async () => {
    const order = await createOrder(null);

    const thread = await getOrderConversation(
      auth(CUSTOMER_ID, Role.CUSTOMER),
      order.id,
    );

    expect(thread.canReply).toBe(false);
    expect(thread.lockedReason).toBeTruthy();

    // The composer's disabled state and the endpoint must agree — the endpoint is
    // the real boundary, so it refuses rather than trusting the client.
    await expect(
      sendMessage(auth(CUSTOMER_ID, Role.CUSTOMER), order.id, { body: 'Any news?' }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('is claimed by the staff member who replies first', async () => {
    const order = await createOrder(null);

    await sendMessage(auth(OTHER_STAFF_ID, Role.STAFF), order.id, {
      body: 'Picking this up.',
    });

    const claimed = await prisma.order.findFirstOrThrow({ where: { id: order.id } });
    expect(claimed.assigneeId).toBe(OTHER_STAFF_ID);

    // And the customer can now reply, because there is finally someone to reply to.
    const thread = await getOrderConversation(
      auth(CUSTOMER_ID, Role.CUSTOMER),
      order.id,
    );
    expect(thread.canReply).toBe(true);
  });
});

describe('reassignment', () => {
  it('moves the conversation to the new assignee', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    await sendMessage(auth(ASSIGNEE_ID, Role.STAFF), order.id, { body: 'Started.' });

    await updateOrder(auth(ADMIN_ID, Role.ADMIN), order.id, {
      assigneeId: OTHER_STAFF_ID,
    });

    // The new holder of the work is now the one who can answer...
    const thread = await getOrderConversation(
      auth(OTHER_STAFF_ID, Role.STAFF),
      order.id,
    );
    expect(thread.assignee?.id).toBe(OTHER_STAFF_ID);
    expect(thread.messages).toHaveLength(1);

    // ...and the previous one is locked out, which is the half that would be easy
    // to get wrong: the thread must not stay readable by whoever held it before.
    await expect(
      getOrderConversation(auth(ASSIGNEE_ID, Role.STAFF), order.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('internal notes', () => {
  it('never reach the customer', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    await sendMessage(auth(ASSIGNEE_ID, Role.STAFF), order.id, {
      body: 'Checking the filing name against the registry.',
      kind: 'note',
    });

    const staffThread = await getOrderConversation(
      auth(ASSIGNEE_ID, Role.STAFF),
      order.id,
    );
    expect(staffThread.messages).toHaveLength(1);
    expect(staffThread.messages[0]?.kind).toBe('internal_note');

    const customerThread = await getOrderConversation(
      auth(CUSTOMER_ID, Role.CUSTOMER),
      order.id,
    );
    expect(customerThread.messages).toHaveLength(0);
  });

  it('never touch the preview the customer reads', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    await sendMessage(auth(ASSIGNEE_ID, Role.STAFF), order.id, {
      body: 'Visible reply.',
    });
    await sendMessage(auth(ASSIGNEE_ID, Role.STAFF), order.id, {
      body: 'Secret internal detail.',
      kind: 'note',
    });

    // The preview is customer-facing surface. A note writing into it would leak
    // its first 160 characters to exactly the person it is hidden from.
    const conversation = await prisma.conversation.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(conversation.preview).toBe('Visible reply.');
  });

  it('cannot be produced by a customer', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    // The customer route parses against a schema with no `kind` field, so even a
    // payload that asks for a note produces an ordinary customer message.
    await sendMessage(auth(CUSTOMER_ID, Role.CUSTOMER), order.id, {
      body: 'Trying to sneak a note.',
      kind: 'note',
    });

    const stored = await prisma.message.findFirstOrThrow({
      where: { conversation: { orderId: order.id } },
    });
    expect(stored.author).toBe(MessageAuthor.CUSTOMER);
  });
});

describe('conversation identity', () => {
  it('reuses one thread per order rather than creating a second', async () => {
    const order = await createOrder(ASSIGNEE_ID);

    const first = await getOrderConversation(auth(CUSTOMER_ID, Role.CUSTOMER), order.id);
    const second = await getOrderConversation(
      auth(ASSIGNEE_ID, Role.STAFF),
      order.id,
    );

    expect(second.id).toBe(first.id);

    const count = await prisma.conversation.count({
      where: { orderId: order.id, deletedAt: null },
    });
    expect(count).toBe(1);
  });

  it('is kept out of the support inbox', async () => {
    const order = await createOrder(ASSIGNEE_ID);
    await getOrderConversation(auth(CUSTOMER_ID, Role.CUSTOMER), order.id);

    const { listConversations } = await import('../admin/support/support.service.js');
    const inbox = await listConversations(auth(ADMIN_ID, Role.ADMIN), {
      filter: 'all',
      limit: 50,
    });

    // Support routes to whoever is free; an order thread belongs to its assignee.
    // Surfacing it in a queue any agent can claim would contradict the lock.
    expect(inbox.conversations.some((c) => c.subject === `Order ${order.reference}`)).toBe(
      false,
    );
  });
});
