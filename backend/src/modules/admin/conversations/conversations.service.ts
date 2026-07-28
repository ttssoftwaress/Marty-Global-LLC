import { ConversationKind, ConversationStatus, MessageAuthor } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { toInitials } from '../../../lib/initials.js';
import { prisma } from '../../../lib/prisma.js';
import { canSeeAll } from '../admin.guards.js';
import { iso } from '../admin.views.js';

/*
 * "My conversations" — the staff screen listing the order threads this member is
 * responsible for.
 *
 * This list exists because of the assignee lock. A support agent finds work by
 * opening the shared inbox and claiming from it; an order conversation cannot be
 * found that way, because only its assignee may see it. Without a screen scoped
 * to "orders assigned to me", a customer's message would sit unread until the
 * assignee happened to reopen the order.
 *
 * Scoped to the caller, never to a requested id: a staff member cannot list
 * another's threads, which is the same rule the thread endpoints enforce. An
 * admin sees every order thread, matching their ability to step into any of them.
 */

export type StaffConversationRow = {
  id: string;
  orderId: string;
  orderReference: string;
  customerName: string;
  customerInitials: string;
  preview: string;
  lastMessageAt: string;
  // The newest message came from the customer — "waiting on us", the same rule
  // the support inbox uses for its unread dot.
  awaitingReply: boolean;
  status: 'open' | 'pending' | 'resolved';
  to: string;
};

export type StaffConversationsView = {
  conversations: StaffConversationRow[];
  awaitingCount: number;
};

const STATUS_VIEW: Record<ConversationStatus, StaffConversationRow['status']> = {
  [ConversationStatus.OPEN]: 'open',
  [ConversationStatus.PENDING]: 'pending',
  [ConversationStatus.RESOLVED]: 'resolved',
};

export async function listMyConversations(
  actor: AuthContext,
): Promise<StaffConversationsView> {
  const conversations = await prisma.conversation.findMany({
    where: {
      kind: ConversationKind.ORDER,
      deletedAt: null,
      /*
       * The same scope the orders queue applies, asked through the same
       * predicate rather than off the auth role directly. The two must agree:
       * this list is the way into an order's thread, so a rule that let a member
       * see a thread for an order their queue hides would be the queue's scope
       * leaking out through the conversation.
       */
      ...((await canSeeAll(actor, 'orders')) ? {} : { assigneeId: actor.userId }),
      status: { not: ConversationStatus.RESOLVED },
      // A thread nobody has written in is not work yet — it is an empty record
      // created when someone opened the order.
      lastMessageAt: { not: null },
    },
    include: {
      customer: { select: { name: true } },
      order: { select: { id: true, reference: true } },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });

  if (conversations.length === 0) {
    return { conversations: [], awaitingCount: 0 };
  }

  // Who spoke last in each thread. Internal notes are excluded: a note is the
  // team talking to itself and does not answer the customer, so a thread whose
  // newest entry is a note is still waiting on a reply.
  const newest = await prisma.message.findMany({
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      deletedAt: null,
      author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
    },
    orderBy: { sentAt: 'desc' },
    select: { conversationId: true, author: true },
  });

  const latestAuthor = new Map<string, MessageAuthor>();
  for (const message of newest) {
    if (!latestAuthor.has(message.conversationId)) {
      latestAuthor.set(message.conversationId, message.author);
    }
  }

  const rows: StaffConversationRow[] = conversations.map((conversation) => {
    /*
     * `customerId` is nullable on the model only because of the anonymous chat
     * (schema.prisma), and a visitor cannot have an order. This query is scoped
     * to ORDER threads, so the customer is always there — the fallback exists to
     * satisfy the type, not because it is reachable.
     */
    const customerName = conversation.customer?.name ?? 'Unknown customer';

    return {
    id: conversation.id,
    orderId: conversation.order?.id ?? '',
    orderReference: conversation.order?.reference ?? '',
    customerName,
    customerInitials: toInitials(customerName),
    preview: conversation.preview ?? '',
    lastMessageAt: iso(conversation.lastMessageAt ?? conversation.createdAt),
    awaitingReply: latestAuthor.get(conversation.id) === MessageAuthor.CUSTOMER,
    status: STATUS_VIEW[conversation.status],
    // The thread is read on the order, not on a page of its own — that is what
    // keeps it tied to the work it is about.
    to: `/admin/orders/${conversation.order?.id ?? ''}`,
    };
  });

  // Waiting-on-us first: the list is a work queue, and a thread the customer is
  // waiting on outranks one we already answered.
  rows.sort((a, b) => Number(b.awaitingReply) - Number(a.awaitingReply));

  return {
    conversations: rows,
    awaitingCount: rows.filter((row) => row.awaitingReply).length,
  };
}
