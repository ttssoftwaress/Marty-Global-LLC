import {
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
  NotificationChannel,
  StaffStatus,
} from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthContext } from '../../guards/auth-context.js';
import { Role } from '../../lib/roles.js';

/*
 * The offline → email handoff.
 *
 * A customer writes in, nobody is there, and a few minutes later we email them
 * so they are not left waiting on a tab they closed. The design decision worth
 * testing is where the "cancel" lives: the delayed job is never cancelled, it
 * re-reads the thread when it fires and does nothing if an agent has since
 * replied. Cancelling on reply would be racier — the reply and the cancellation
 * could cross — and this way one place decides, at the moment it matters.
 *
 * So these tests are about that decision, and about the two things that would
 * make it wrong: an internal note counting as an answer (it must not — the
 * customer has heard nothing), and a muted customer being emailed anyway.
 */

const { prisma } = await import('../../lib/prisma.js');
const { deliverOfflineHandoff } = await import('./support.notifications.js');
const adminSupport = await import('../admin/support/support.service.js');

const CUSTOMER_ID = 'handoff_test_customer';
const STAFF_ID = 'handoff_test_staff';
const USER_IDS = [CUSTOMER_ID, STAFF_ID];

function actor(userId: string, role: Role): AuthContext {
  return {
    userId,
    role,
    sessionId: `sess_${userId}`,
    email: `${userId}@example.test`,
    emailVerified: true,
  };
}

async function threadAwaitingUs() {
  const conversation = await prisma.conversation.create({
    data: {
      customerId: CUSTOMER_ID,
      kind: ConversationKind.SUPPORT,
      status: ConversationStatus.OPEN,
      subject: 'Handoff test',
      lastMessageAt: new Date(),
      preview: 'Any update on my filing?',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      author: MessageAuthor.CUSTOMER,
      authorUserId: CUSTOMER_ID,
      authorName: 'Handoff Customer',
      body: 'Any update on my filing?',
    },
  });

  return conversation;
}

// The email ledger row the handoff produces, if it produced one.
async function handoffEmails() {
  return prisma.notification.count({
    where: {
      userId: CUSTOMER_ID,
      channel: NotificationChannel.EMAIL,
      template: 'support-offline-handoff',
    },
  });
}

beforeEach(async () => {
  await prisma.user.upsert({
    where: { id: CUSTOMER_ID },
    create: {
      id: CUSTOMER_ID,
      name: 'Handoff Customer',
      email: `${CUSTOMER_ID}@example.test`,
      role: Role.CUSTOMER,
    },
    update: { role: Role.CUSTOMER },
  });

  await prisma.user.upsert({
    where: { id: STAFF_ID },
    create: {
      id: STAFF_ID,
      name: 'Handoff Agent',
      email: `${STAFF_ID}@example.test`,
      role: Role.STAFF,
    },
    update: { role: Role.STAFF },
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

  await prisma.notification.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.feedNotification.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.notificationPreference.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.conversation.deleteMany({ where: { customerId: CUSTOMER_ID } });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.feedNotification.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.notificationPreference.deleteMany({ where: { userId: CUSTOMER_ID } });
  await prisma.conversation.deleteMany({ where: { customerId: CUSTOMER_ID } });
  await prisma.staffProfile.deleteMany({ where: { userId: { in: USER_IDS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

describe('the offline handoff', () => {
  it('emails and files a feed row when nobody answered', async () => {
    const conversation = await threadAwaitingUs();

    const result = await deliverOfflineHandoff(conversation.id);

    expect(result.sent).toBe(true);
    expect(await handoffEmails()).toBe(1);

    const feed = await prisma.feedNotification.count({
      where: { userId: CUSTOMER_ID, category: 'MESSAGE' },
    });
    expect(feed).toBe(1);
  });

  // The cancel. Not an actual cancellation — the job simply finds the thread
  // answered when it fires.
  it('sends nothing once an agent has replied', async () => {
    const conversation = await threadAwaitingUs();

    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), conversation.id, {
      body: 'On it — the filing goes out today.',
      kind: 'reply',
    });

    const result = await deliverOfflineHandoff(conversation.id);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('answered');
    expect(await handoffEmails()).toBe(0);
  });

  /*
   * An internal note is the team talking to itself. Treating one as an answer
   * would silence the handoff on a conversation the customer has heard nothing
   * about — the exact failure the handoff exists to prevent.
   */
  it('still sends when the only staff activity was an internal note', async () => {
    const conversation = await threadAwaitingUs();

    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), conversation.id, {
      body: 'Internal: check whether their ID expired before replying.',
      kind: 'note',
    });

    const result = await deliverOfflineHandoff(conversation.id);

    expect(result.sent).toBe(true);
    expect(await handoffEmails()).toBe(1);
  });

  // Idempotent: the processor may retry, and the job's decision is re-derived
  // each time rather than trusted from when it was enqueued.
  it('is safe to run twice on an answered thread', async () => {
    const conversation = await threadAwaitingUs();

    await adminSupport.sendMessage(actor(STAFF_ID, Role.STAFF), conversation.id, {
      body: 'Replying now.',
      kind: 'reply',
    });

    await deliverOfflineHandoff(conversation.id);
    await deliverOfflineHandoff(conversation.id);

    expect(await handoffEmails()).toBe(0);
  });

  it('respects the customer’s notification preferences', async () => {
    const conversation = await threadAwaitingUs();

    await prisma.notificationPreference.create({
      data: { userId: CUSTOMER_ID, newMessagesEmail: false, newMessagesInApp: false },
    });

    const result = await deliverOfflineHandoff(conversation.id);

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('muted');
    expect(await handoffEmails()).toBe(0);
  });

  // The account-wide switch gates every email, so an enabled category still
  // sends nothing while it is off — what the settings screen promises.
  it('sends no email while the master switch is off, but still files the feed row', async () => {
    const conversation = await threadAwaitingUs();

    await prisma.notificationPreference.create({
      data: { userId: CUSTOMER_ID, emailMaster: false, newMessagesEmail: true },
    });

    const result = await deliverOfflineHandoff(conversation.id);

    expect(result.sent).toBe(true);
    expect(await handoffEmails()).toBe(0);
    expect(
      await prisma.feedNotification.count({ where: { userId: CUSTOMER_ID } }),
    ).toBe(1);
  });

  it('drops quietly when the conversation is gone', async () => {
    const result = await deliverOfflineHandoff('no_such_conversation');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing');
  });
});
