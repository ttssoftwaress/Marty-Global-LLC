import { ConversationStatus, MessageAuthor } from '@prisma/client';
import type { Request } from 'express';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../../guards/auth-context.js';
import { Role } from '../../../lib/roles.js';

const { prisma } = await import('../../../lib/prisma.js');
const adminSupport = await import('./support.service.js');
const portalSupport = await import('../../support/support.service.js');

/*
 * The internal-note boundary.
 *
 * A note is stored as a message on the same thread the customer reads, so the
 * only thing keeping it private is that every portal-side read filters the
 * INTERNAL_NOTE author out. That is a single `where` clause standing between a
 * staff aside and the customer's screen, which makes it exactly the kind of
 * invariant worth a test: a future read added without the filter would leak, and
 * nothing about the types would complain.
 */

const CUSTOMER_ID = 'note_test_customer';
const STAFF_ID = 'note_test_staff';
// A second agent on the same thread — the viewer `mine` has to tell apart.
const OTHER_STAFF_ID = 'note_test_staff_other';
const CONVERSATION_ID = 'note_test_conversation';

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

const reqAs = (auth: AuthContext) => ({ auth }) as unknown as Request;

const NOTE_BODY = 'Internal: waive the notary requirement, do not tell the customer yet.';
const REPLY_BODY = 'We have everything we need — the filing goes out today.';

beforeEach(async () => {
  for (const [id, role] of [
    [CUSTOMER_ID, Role.CUSTOMER],
    [STAFF_ID, Role.STAFF],
    [OTHER_STAFF_ID, Role.STAFF],
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      create: { id, name: `Test ${id}`, email: `${id}@example.test`, role },
      update: {},
    });
  }

  await prisma.message.deleteMany({ where: { conversationId: CONVERSATION_ID } });
  await prisma.conversation.deleteMany({ where: { id: CONVERSATION_ID } });

  await prisma.conversation.create({
    data: {
      id: CONVERSATION_ID,
      customerId: CUSTOMER_ID,
      subject: 'Formation question',
      status: ConversationStatus.OPEN,
      lastMessageAt: new Date(),
      preview: 'Initial question',
      messages: {
        create: [
          {
            author: MessageAuthor.CUSTOMER,
            authorUserId: CUSTOMER_ID,
            authorName: 'Test customer',
            body: 'Initial question',
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { conversationId: CONVERSATION_ID } });
  await prisma.conversation.deleteMany({ where: { id: CONVERSATION_ID } });
  await prisma.user.deleteMany({
    where: { id: { in: [CUSTOMER_ID, STAFF_ID, OTHER_STAFF_ID] } },
  });
  await prisma.$disconnect();
});

describe('internal notes', () => {
  it('are visible to staff in the admin thread', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: NOTE_BODY,
      kind: 'note',
    });

    const thread = await adminSupport.getThread(
      actor(STAFF_ID, Role.STAFF),
      CONVERSATION_ID,
    );
    const note = thread.messages.find((message) => message.kind === 'internal_note');

    expect(note?.body).toBe(NOTE_BODY);
  });

  it('are never returned to the customer', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: NOTE_BODY,
      kind: 'note',
    });

    const thread = await portalSupport.getConversation(
      reqAs(actor(CUSTOMER_ID, Role.CUSTOMER)),
      CONVERSATION_ID,
    );

    expect(thread.messages.map((message) => message.body)).not.toContain(NOTE_BODY);
    expect(JSON.stringify(thread)).not.toContain('waive the notary');
  });

  it('never become the preview the customer sees in their list', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: NOTE_BODY,
      kind: 'note',
    });

    const conversations = await portalSupport.listConversations(
      reqAs(actor(CUSTOMER_ID, Role.CUSTOMER)),
      {},
    );

    const thread = conversations.find((entry) => entry.id === CONVERSATION_ID);
    expect(thread?.preview).not.toContain('waive the notary');
  });

  it('do not move the thread status, unlike a reply', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: NOTE_BODY,
      kind: 'note',
    });

    const afterNote = await prisma.conversation.findUniqueOrThrow({
      where: { id: CONVERSATION_ID },
    });
    expect(afterNote.status).toBe(ConversationStatus.OPEN);

    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: REPLY_BODY,
      kind: 'reply',
    });

    const afterReply = await prisma.conversation.findUniqueOrThrow({
      where: { id: CONVERSATION_ID },
    });
    // A reply hands the thread back to the customer.
    expect(afterReply.status).toBe(ConversationStatus.PENDING);
    expect(afterReply.preview).toBe(REPLY_BODY.slice(0, 160));
  });

  /*
   * `mine` drives which side of the thread a bubble sits on, and it is resolved
   * per-viewer rather than from the author kind: every agent's reply is `staff`,
   * so keying alignment off the kind would show a colleague's message as the
   * reader's own. Two agents on one thread is the case that proves it.
   */
  it('marks only the reading agent’s own replies as mine', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: REPLY_BODY,
      kind: 'reply',
    });

    const asAuthor = await adminSupport.getThread(
      actor(STAFF_ID, Role.STAFF),
      CONVERSATION_ID,
    );
    const asColleague = await adminSupport.getThread(
      actor(OTHER_STAFF_ID, Role.STAFF),
      CONVERSATION_ID,
    );

    const reply = (thread: { messages: { body: string; mine: boolean }[] }) =>
      thread.messages.find((message) => message.body === REPLY_BODY);

    expect(reply(asAuthor)?.mine).toBe(true);
    expect(reply(asColleague)?.mine).toBe(false);

    // The customer's own message is never the agent's, from either desk.
    const opening = asAuthor.messages.find((message) => message.kind === 'customer');
    expect(opening?.mine).toBe(false);
  });

  it('lets a staff reply reach the customer', async () => {
    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), CONVERSATION_ID, {
      body: REPLY_BODY,
      kind: 'reply',
    });

    const thread = await portalSupport.getConversation(
      reqAs(actor(CUSTOMER_ID, Role.CUSTOMER)),
      CONVERSATION_ID,
    );

    expect(thread.messages.map((message) => message.body)).toContain(REPLY_BODY);
  });
});
