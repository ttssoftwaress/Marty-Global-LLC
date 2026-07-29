import { ConversationKind, MessageAuthor, StaffStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { Role } from '../../lib/roles.js';

/*
 * The anonymous visitor chat.
 *
 * Its entire security model is one sentence — the token is the only way to reach
 * the thread, and the conversation id is never accepted from the client — so the
 * tests here are the ones that would catch that sentence becoming false:
 *
 *   1. A token reaches its own conversation and no other.
 *   2. Only the token's hash is ever stored.
 *   3. A guest thread is invisible to the customer portal, whose reads are
 *      scoped by `customerId` — a column a guest thread leaves null.
 *   4. An internal note never reaches a guest, the same rule the portal has.
 *   5. Retention actually deletes, and only past the window.
 *
 * Points 3 and 4 earn a test under AGENTS.md's "critical paths only" rule for the
 * same reason the internal-note suite does: a leak is not a bug you can take back.
 */

const { prisma } = await import('../../lib/prisma.js');
const guest = await import('./guest.service.js');
const portalSupport = await import('../support/support.service.js');
const adminSupport = await import('../admin/support/support.service.js');

const STAFF_ID = 'guest_test_staff';
const CUSTOMER_ID = 'guest_test_customer';

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

async function start(name: string, email: string, body = 'Hello, I have a question.') {
  return guest.startChat({ name, email, body });
}

// The visitor records the tests create, so cleanup takes their conversations and
// messages with them through the schema's cascade.
async function purgeTestGuests() {
  await prisma.guestVisitor.deleteMany({
    where: { email: { contains: '@guest-test.example' } },
  });
}

beforeEach(async () => {
  await purgeTestGuests();

  await prisma.user.upsert({
    where: { id: STAFF_ID },
    create: {
      id: STAFF_ID,
      name: 'Sam Agent',
      email: `${STAFF_ID}@example.test`,
      role: Role.STAFF,
    },
    update: { role: Role.STAFF },
  });

  await prisma.user.upsert({
    where: { id: CUSTOMER_ID },
    create: {
      id: CUSTOMER_ID,
      name: 'Real Customer',
      email: `${CUSTOMER_ID}@example.test`,
      role: Role.CUSTOMER,
    },
    update: { role: Role.CUSTOMER },
  });

  await prisma.staffProfile.upsert({
    where: { userId: STAFF_ID },
    create: {
      userId: STAFF_ID,
      roleKey: 'reviewer',
      status: StaffStatus.ACTIVE,
      permissions: ['support', 'support.all'],
    },
    update: { status: StaffStatus.ACTIVE, permissions: ['support', 'support.all'] },
  });
});

afterAll(async () => {
  await purgeTestGuests();
  await prisma.staffProfile.deleteMany({ where: { userId: STAFF_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [STAFF_ID, CUSTOMER_ID] } } });
  await prisma.$disconnect();
});

describe('guest identity', () => {
  it('resolves a token to its own conversation', async () => {
    const started = await start('Ada Lovelace', 'ada@guest-test.example');

    const identity = await guest.resolveGuest(started.token);

    expect(identity).not.toBeNull();
    expect(identity?.conversationId).toBe(started.thread.conversationId);
    expect(identity?.email).toBe('ada@guest-test.example');
  });

  /*
   * The property the whole module rests on. Two visitors, and neither token
   * reaches the other's thread — which holds because the conversation is derived
   * from the token rather than sent alongside it.
   */
  it('never resolves one visitor’s token to another’s conversation', async () => {
    const ada = await start('Ada', 'ada2@guest-test.example');
    const grace = await start('Grace', 'grace@guest-test.example');

    const adaIdentity = await guest.resolveGuest(ada.token);
    const graceIdentity = await guest.resolveGuest(grace.token);

    expect(adaIdentity?.conversationId).not.toBe(graceIdentity?.conversationId);
    expect(adaIdentity?.conversationId).toBe(ada.thread.conversationId);
  });

  it('rejects an unknown or malformed token', async () => {
    await expect(guest.resolveGuest('not-a-real-token')).resolves.toBeNull();
    await expect(guest.resolveGuest(undefined)).resolves.toBeNull();
    await expect(guest.resolveGuest('')).resolves.toBeNull();
  });

  // The token is a bearer credential with a 7-day life. A read-only leak of this
  // table must not hand out live conversations.
  it('stores only the token’s hash, never the token', async () => {
    const started = await start('Katherine', 'katherine@guest-test.example');

    const stored = await prisma.guestVisitor.findFirst({
      where: { email: 'katherine@guest-test.example' },
      select: { tokenHash: true },
    });

    expect(stored?.tokenHash).toBe(
      createHash('sha256').update(started.token).digest('hex'),
    );
    expect(stored?.tokenHash).not.toBe(started.token);
  });
});

describe('the boundary with the customer portal', () => {
  /*
   * A guest thread carries a null `customerId`, and every portal read is scoped
   * `customerId: <their id>`. That is what makes a guest conversation invisible
   * to the portal by construction rather than by a filter someone has to
   * remember to write — so this test asserts the construction, not the filter.
   */
  it('keeps guest threads out of a customer’s conversation list', async () => {
    await start('Anonymous Visitor', 'visitor@guest-test.example');

    const page = await portalSupport.listConversations(
      actor(CUSTOMER_ID, Role.CUSTOMER),
      { limit: 20 },
    );

    expect(page.conversations).toHaveLength(0);
  });

  it('refuses a customer reading a guest thread by id', async () => {
    const started = await start('Anonymous Visitor', 'visitor2@guest-test.example');

    await expect(
      portalSupport.getConversation(
        actor(CUSTOMER_ID, Role.CUSTOMER),
        started.thread.conversationId,
      ),
    ).rejects.toThrow();
  });
});

describe('the admin inbox', () => {
  it('lists a guest thread beside customer threads, badged as a visitor', async () => {
    await start('Walk-in Visitor', 'walkin@guest-test.example');

    const page = await adminSupport.listConversations(actor(STAFF_ID, Role.STAFF), {
      filter: 'all',
      limit: 20,
    });

    const row = page.conversations.find((entry) =>
      entry.customerName.includes('Walk-in Visitor'),
    );

    expect(row).toBeDefined();
    expect(row?.isGuest).toBe(true);
  });

  it('surfaces the visitor’s email on the thread, since there is no account', async () => {
    const started = await start('Walk-in Visitor', 'walkin2@guest-test.example');

    const thread = await adminSupport.getThread(
      actor(STAFF_ID, Role.STAFF),
      started.thread.conversationId,
    );

    expect(thread.isGuest).toBe(true);
    expect(thread.guestEmail).toBe('walkin2@guest-test.example');
  });

  // The same rule the portal has, asserted on the guest surface too: the filter
  // that hides a note is the only thing keeping it private.
  it('never returns an internal note to the guest', async () => {
    const started = await start('Walk-in Visitor', 'walkin3@guest-test.example');
    const identity = await guest.resolveGuest(started.token);

    await adminSupport.sendMessage(
      actor(STAFF_ID, Role.STAFF),
      started.thread.conversationId,
      { body: 'Internal: this one looks like a tyre-kicker.', kind: 'note' },
    );

    const thread = await guest.getThread(identity!);

    expect(thread.messages.map((message) => message.body)).not.toContain(
      'Internal: this one looks like a tyre-kicker.',
    );
    expect(JSON.stringify(thread)).not.toContain('tyre-kicker');
  });

  it('delivers a staff reply to the guest', async () => {
    const started = await start('Walk-in Visitor', 'walkin4@guest-test.example');
    const identity = await guest.resolveGuest(started.token);

    await adminSupport.sendMessage(
      actor(STAFF_ID, Role.STAFF),
      started.thread.conversationId,
      { body: 'Happy to help — which country are you forming in?', kind: 'reply' },
    );

    const thread = await guest.getThread(identity!);
    const reply = thread.messages.find((message) => message.author === 'agent');

    expect(reply?.body).toBe('Happy to help — which country are you forming in?');
  });
});

describe('retention', () => {
  it('leaves an active conversation alone', async () => {
    const started = await start('Active Visitor', 'active@guest-test.example');

    await guest.purgeExpired();

    await expect(guest.resolveGuest(started.token)).resolves.not.toBeNull();
    expect(started.thread.conversationId).toBeDefined();
  });

  /*
   * The hard delete, which AGENTS.md requires be deliberate — this asserts it
   * really removes the conversation and its messages rather than soft-deleting
   * them, because "we delete it after 7 days" is a promise made to the visitor.
   */
  it('deletes a stale visitor along with their conversation and messages', async () => {
    const started = await start('Stale Visitor', 'stale@guest-test.example');
    const conversationId = started.thread.conversationId;

    // Age the visitor past any plausible window rather than waiting for one.
    await prisma.guestVisitor.updateMany({
      where: { email: 'stale@guest-test.example' },
      data: { lastSeenAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
    });

    const { deleted } = await guest.purgeExpired();
    expect(deleted).toBeGreaterThanOrEqual(1);

    await expect(guest.resolveGuest(started.token)).resolves.toBeNull();

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    expect(conversation).toBeNull();

    const messages = await prisma.message.count({ where: { conversationId } });
    expect(messages).toBe(0);
  });

  // Between sweeps the promise still has to hold, so an expired token is refused
  // whether or not the job has run yet.
  it('refuses an expired token before the sweep has run', async () => {
    const started = await start('Expired Visitor', 'expired@guest-test.example');

    await prisma.guestVisitor.updateMany({
      where: { email: 'expired@guest-test.example' },
      data: { lastSeenAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) },
    });

    await expect(guest.resolveGuest(started.token)).resolves.toBeNull();
  });

  it('pushes the window out when the visitor writes again', async () => {
    const started = await start('Chatty Visitor', 'chatty@guest-test.example');
    const identity = await guest.resolveGuest(started.token);

    const before = await prisma.guestVisitor.findUniqueOrThrow({
      where: { id: identity!.id },
      select: { lastSeenAt: true },
    });

    await guest.sendMessage(identity!, { body: 'Still here — any update?' });

    const after = await prisma.guestVisitor.findUniqueOrThrow({
      where: { id: identity!.id },
      select: { lastSeenAt: true },
    });

    expect(after.lastSeenAt.getTime()).toBeGreaterThanOrEqual(
      before.lastSeenAt.getTime(),
    );
  });
});

describe('the conversation a guest opens', () => {
  it('is a SUPPORT thread with no customer, so it lands in the same queue', async () => {
    const started = await start('Queue Visitor', 'queue@guest-test.example');

    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: started.thread.conversationId },
      select: { kind: true, customerId: true, guestId: true },
    });

    expect(conversation.kind).toBe(ConversationKind.SUPPORT);
    expect(conversation.customerId).toBeNull();
    expect(conversation.guestId).not.toBeNull();
  });

  it('records the first message as the visitor’s, with no user behind it', async () => {
    const started = await start(
      'First Message Visitor',
      'first@guest-test.example',
      'Do you form companies in Wyoming?',
    );

    const message = await prisma.message.findFirstOrThrow({
      where: { conversationId: started.thread.conversationId },
      orderBy: { sentAt: 'asc' },
    });

    expect(message.author).toBe(MessageAuthor.CUSTOMER);
    expect(message.authorUserId).toBeNull();
    expect(message.authorName).toBe('First Message Visitor');
    expect(message.body).toBe('Do you form companies in Wyoming?');
  });
});
