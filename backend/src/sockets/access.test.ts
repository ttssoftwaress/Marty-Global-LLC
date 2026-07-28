import {
  ConversationKind,
  ConversationStatus,
  OrderStatus,
  StaffStatus,
} from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../guards/auth-context.js';
import { Role } from '../lib/roles.js';

/*
 * Who a socket may reach.
 *
 * This is the guard for the whole live-chat transport, and it is the one that is
 * easiest to get subtly wrong, because a socket is long-lived: the connection is
 * opened once and the answer to "may they be in this room" changes underneath it
 * as threads are reassigned and permissions revoked. So access is re-derived on
 * every join, and these are the cases that prove the derivation:
 *
 *   - a customer reaches their own SUPPORT threads and nothing else
 *   - a guest reaches exactly the thread their token owns
 *   - staff need the `support` area, and a scoped agent gets ONLY the threads
 *     assigned to them — not a colleague's, and not one nobody owns
 *   - ORDER conversations are refused outright, because the assignee lock that
 *     governs them lives in modules/conversations and is NOT enforced here
 */

const { prisma } = await import('../lib/prisma.js');
const { resolveAccess } = await import('./access.js');
const guest = await import('../modules/guest/guest.service.js');

const CUSTOMER_ID = 'sock_test_customer';
const OTHER_CUSTOMER_ID = 'sock_test_other_customer';
const SCOPED_STAFF_ID = 'sock_test_scoped_staff';
const OTHER_STAFF_ID = 'sock_test_other_staff';
const NO_SUPPORT_STAFF_ID = 'sock_test_no_support_staff';
const USER_IDS = [
  CUSTOMER_ID,
  OTHER_CUSTOMER_ID,
  SCOPED_STAFF_ID,
  OTHER_STAFF_ID,
  NO_SUPPORT_STAFF_ID,
];

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

function asUser(userId: string, role: Role) {
  return { kind: 'user' as const, auth: actor(userId, role) };
}

async function ensureUser(id: string, role: Role) {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
    update: { role },
  });
}

async function ensureStaff(id: string, permissions: string[]) {
  await prisma.staffProfile.upsert({
    where: { userId: id },
    create: { userId: id, roleKey: 'reviewer', status: StaffStatus.ACTIVE, permissions },
    update: { status: StaffStatus.ACTIVE, permissions },
  });
}

async function createSupportThread(assigneeId: string | null) {
  return prisma.conversation.create({
    data: {
      customerId: CUSTOMER_ID,
      kind: ConversationKind.SUPPORT,
      status: ConversationStatus.OPEN,
      subject: 'Socket access test',
      assigneeId,
      lastMessageAt: new Date(),
    },
  });
}

beforeEach(async () => {
  await ensureUser(CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(OTHER_CUSTOMER_ID, Role.CUSTOMER);
  await ensureUser(SCOPED_STAFF_ID, Role.STAFF);
  await ensureUser(OTHER_STAFF_ID, Role.STAFF);
  await ensureUser(NO_SUPPORT_STAFF_ID, Role.STAFF);

  // A scoped agent: holds `support` but neither `support.all` nor
  // `support.assign`, so they reach the threads assigned to them and nothing else.
  await ensureStaff(SCOPED_STAFF_ID, ['support']);
  await ensureStaff(OTHER_STAFF_ID, ['support']);
  // Holds an unrelated area only — the support socket must refuse them.
  await ensureStaff(NO_SUPPORT_STAFF_ID, ['orders']);

  await prisma.conversation.deleteMany({
    where: { customerId: { in: [CUSTOMER_ID, OTHER_CUSTOMER_ID] } },
  });
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
});

afterAll(async () => {
  await prisma.conversation.deleteMany({
    where: { customerId: { in: [CUSTOMER_ID, OTHER_CUSTOMER_ID] } },
  });
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.guestVisitor.deleteMany({
    where: { email: { contains: '@socket-test.example' } },
  });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

describe('a customer', () => {
  it('reaches their own support thread', async () => {
    const conversation = await createSupportThread(null);

    const access = await resolveAccess(
      asUser(CUSTOMER_ID, Role.CUSTOMER),
      conversation.id,
    );

    expect(access?.as).toBe('customer');
    expect(access?.conversationId).toBe(conversation.id);
  });

  it('is refused another customer’s thread', async () => {
    const conversation = await createSupportThread(null);

    const access = await resolveAccess(
      asUser(OTHER_CUSTOMER_ID, Role.CUSTOMER),
      conversation.id,
    );

    expect(access).toBeNull();
  });

  it('is refused a thread that does not exist', async () => {
    const access = await resolveAccess(
      asUser(CUSTOMER_ID, Role.CUSTOMER),
      'no_such_conversation',
    );

    expect(access).toBeNull();
  });
});

describe('a guest', () => {
  it('reaches exactly the thread their token owns', async () => {
    const started = await guest.startChat({
      name: 'Socket Visitor',
      email: 'visitor@socket-test.example',
      body: 'Hello',
    });
    const identity = await guest.resolveGuest(started.token);

    const access = await resolveAccess(
      { kind: 'guest', guest: identity! },
      identity!.conversationId,
    );

    expect(access?.as).toBe('guest');
  });

  /*
   * The property that makes the guest surface safe. A visitor never names a
   * conversation — theirs comes from their token — so an id they send that is
   * not their own is refused rather than joined.
   */
  it('is refused any conversation but their own, even a real one', async () => {
    const started = await guest.startChat({
      name: 'Socket Visitor',
      email: 'visitor2@socket-test.example',
      body: 'Hello',
    });
    const identity = await guest.resolveGuest(started.token);

    const someoneElses = await createSupportThread(null);

    const access = await resolveAccess(
      { kind: 'guest', guest: identity! },
      someoneElses.id,
    );

    expect(access).toBeNull();
  });
});

describe('staff', () => {
  /*
   * There is no claimable pool any more. Incoming chats are routed to an agent as
   * they arrive (modules/support/support.assignment.ts), so an agent's inbox is
   * exactly what is assigned to them — and a thread with no owner is a routing
   * failure for a supervisor to resolve, not a thread for anyone to walk into.
   */
  it('is refused an unassigned thread when scoped', async () => {
    const conversation = await createSupportThread(null);

    const access = await resolveAccess(
      asUser(SCOPED_STAFF_ID, Role.STAFF),
      conversation.id,
    );

    expect(access).toBeNull();
  });

  it('reaches a thread assigned to them', async () => {
    const conversation = await createSupportThread(SCOPED_STAFF_ID);

    const access = await resolveAccess(
      asUser(SCOPED_STAFF_ID, Role.STAFF),
      conversation.id,
    );

    expect(access?.as).toBe('staff');
  });

  // The scope the REST inbox applies, re-checked here rather than assumed from
  // the list the agent clicked through — that list was rendered earlier in time.
  it('is refused a colleague’s thread when scoped', async () => {
    const conversation = await createSupportThread(OTHER_STAFF_ID);

    const access = await resolveAccess(
      asUser(SCOPED_STAFF_ID, Role.STAFF),
      conversation.id,
    );

    expect(access).toBeNull();
  });

  it('is refused entirely without the support area', async () => {
    const conversation = await createSupportThread(NO_SUPPORT_STAFF_ID);

    const access = await resolveAccess(
      asUser(NO_SUPPORT_STAFF_ID, Role.STAFF),
      conversation.id,
    );

    // Assigned to them, and still refused: the area is checked before the
    // assignment is, so a stray assignment is not itself a way in.
    expect(access).toBeNull();
  });

  it('lets an admin reach any thread', async () => {
    const conversation = await createSupportThread(OTHER_STAFF_ID);

    const access = await resolveAccess(
      asUser('sock_test_admin_inline', Role.ADMIN),
      conversation.id,
    );

    expect(access?.as).toBe('staff');
  });
});

/*
 * The most important refusal in this file.
 *
 * An ORDER conversation is answerable only by that order's assignee, and that
 * lock lives in modules/conversations — not here. Admitting one to a socket room
 * would therefore be a way around it: any agent with `support` could read and
 * post into a filing that belongs to a colleague. Live chat is SUPPORT-only for
 * exactly this reason.
 */
describe('order conversations', () => {
  it('are refused on the socket, for every actor', async () => {
    const order = await prisma.order.create({
      data: {
        reference: `ORD-S${Math.floor(10_000 + Math.random() * 89_999)}`,
        customerId: CUSTOMER_ID,
        status: OrderStatus.UNDER_REVIEW,
        assigneeId: OTHER_STAFF_ID,
        submittedAt: new Date(),
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        customerId: CUSTOMER_ID,
        orderId: order.id,
        kind: ConversationKind.ORDER,
        status: ConversationStatus.OPEN,
        subject: `Order ${order.reference}`,
        assigneeId: OTHER_STAFF_ID,
      },
    });

    // Not even the order's own participants: the socket is not the transport for
    // this kind of thread at all, so there is no partial admission to reason about.
    await expect(
      resolveAccess(asUser(CUSTOMER_ID, Role.CUSTOMER), conversation.id),
    ).resolves.toBeNull();
    await expect(
      resolveAccess(asUser(OTHER_STAFF_ID, Role.STAFF), conversation.id),
    ).resolves.toBeNull();
    await expect(
      resolveAccess(asUser(SCOPED_STAFF_ID, Role.STAFF), conversation.id),
    ).resolves.toBeNull();
  });
});
