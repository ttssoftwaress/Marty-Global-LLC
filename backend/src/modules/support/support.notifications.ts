import { FeedNotificationCategory, MessageAuthor } from '@prisma/client';

import { env } from '../../config/env.js';
import { enqueueSupportHandoff } from '../../jobs/queues.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { queueEmail } from '../notifications/notifications.service.js';

/*
 * The offline handoff: making sure a customer who writes into a support thread
 * hears back even when nobody was there to answer live.
 *
 * The shape of it is one delayed job per thread, and a decision taken when that
 * job fires rather than when it was created (jobs/queues.ts explains why the
 * "cancel on reply" is a re-read rather than an actual cancellation).
 *
 * Message bodies are PII and are not quoted in the email or the feed row — the
 * notice says a reply is waiting and links to the thread. That also keeps an
 * internal note from ever reaching an inbox.
 */

export async function notifyNewSupportMessage(input: {
  conversationId: string;
  messageId?: string;
}): Promise<void> {
  try {
    await enqueueSupportHandoff(
      { conversationId: input.conversationId },
      env.SUPPORT_HANDOFF_DELAY_MINUTES * 60 * 1000,
    );
  } catch (error) {
    // A customer's message must not fail because Redis did. The message is
    // already persisted; the worst case is that no email goes out.
    logger.error(
      { err: error, conversationId: input.conversationId },
      'Failed to arm support offline handoff',
    );
  }
}

/*
 * Does this thread still need the handoff?
 *
 * Answered here rather than at enqueue time, because the whole point is what
 * happened during the delay. An agent reply after the customer's last message is
 * the answer that cancels it — regardless of which agent, which transport, or
 * whether they were "online" when it arrived.
 */
async function stillWaiting(conversationId: string): Promise<boolean> {
  const newest = await prisma.message.findFirst({
    where: {
      conversationId,
      deletedAt: null,
      // An internal note is not a reply to the customer. Treating one as an
      // answer would silence the handoff for a conversation the customer has
      // heard nothing about.
      author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
    },
    orderBy: { sentAt: 'desc' },
    select: { author: true },
  });

  return newest?.author === MessageAuthor.CUSTOMER;
}

/*
 * Which channels this customer wants. Mirrors mailroom.notifications.ts: the
 * master switch gates every email account-wide, and an absent preference row
 * means the schema defaults (on), which is what a customer who has never opened
 * the settings screen would see there.
 */
async function channels(
  customerId: string,
): Promise<{ email: boolean; inApp: boolean }> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: customerId },
    select: {
      emailMaster: true,
      newMessagesEmail: true,
      newMessagesInApp: true,
    },
  });

  if (!preference) return { email: true, inApp: true };

  return {
    email: preference.emailMaster && preference.newMessagesEmail,
    inApp: preference.newMessagesInApp,
  };
}

/*
 * Run by the job processor once the delay has elapsed. Idempotent and safe to
 * retry: it re-derives everything from the thread's current state, so running it
 * twice on an answered conversation sends nothing both times.
 */
export async function deliverOfflineHandoff(conversationId: string): Promise<{
  sent: boolean;
  reason?: 'answered' | 'missing' | 'muted';
}> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    select: {
      id: true,
      subject: true,
      customerId: true,
      customer: { select: { email: true, name: true } },
      guest: { select: { email: true, name: true } },
    },
  });

  if (!conversation) return { sent: false, reason: 'missing' };

  if (!(await stillWaiting(conversationId))) {
    return { sent: false, reason: 'answered' };
  }

  /*
   * A guest has no account, so no notification preferences and no in-app feed to
   * write to — the email address they gave when opening the chat is the only way
   * to reach them, and giving it was the point of asking.
   */
  if (!conversation.customerId) {
    if (!conversation.guest) return { sent: false, reason: 'missing' };

    await queueEmail({
      to: conversation.guest.email,
      subject: 'We received your message — Marty Global',
      template: 'support-offline-handoff',
      heading: `Thanks for getting in touch, ${firstWord(conversation.guest.name)}`,
      body: "Our team has your message and will reply here shortly. You can reopen the chat on our site at any time to pick up where you left off — we'll keep your conversation for 7 days.",
      actionLabel: 'Return to the site',
      actionUrl: env.FRONTEND_ORIGIN,
    });

    return { sent: true };
  }

  const { email, inApp } = await channels(conversation.customerId);
  const href = `/app/messages/${conversation.id}`;

  if (!email && !inApp) return { sent: false, reason: 'muted' };

  if (inApp) {
    await prisma.feedNotification.create({
      data: {
        userId: conversation.customerId,
        category: FeedNotificationCategory.MESSAGE,
        message: `Our team will reply to "${conversation.subject}" shortly.`,
        href,
      },
    });
  }

  if (email && conversation.customer) {
    await queueEmail({
      to: conversation.customer.email,
      subject: 'We received your message — Marty Global',
      template: 'support-offline-handoff',
      heading: `Thanks for getting in touch, ${firstWord(conversation.customer.name)}`,
      body: `Our team has your message about "${conversation.subject}" and will reply as soon as possible. You can follow the conversation in your portal.`,
      actionLabel: 'Open the conversation',
      actionUrl: `${env.FRONTEND_ORIGIN}${href}`,
      userId: conversation.customerId,
    });
  }

  return { sent: true };
}

// The greeting wants a first name, and a display name is not reliably two words.
function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}
