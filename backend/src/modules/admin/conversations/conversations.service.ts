import {
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
  type Prisma,
} from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { toInitials } from '../../../lib/initials.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { canSeeAll } from '../admin.guards.js';
import { iso } from '../admin.views.js';
import type { ListMyConversationsQuery } from './conversations.validation.js';

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
  // Over the whole scope, not the loaded page — the header pill has to stay
  // truthful as the list pages in, the same way the support inbox's counts do.
  awaitingCount: number;
  nextCursor: string | null;
};

const STATUS_VIEW: Record<ConversationStatus, StaffConversationRow['status']> = {
  [ConversationStatus.OPEN]: 'open',
  [ConversationStatus.PENDING]: 'pending',
  [ConversationStatus.RESOLVED]: 'resolved',
};

export async function listMyConversations(
  actor: AuthContext,
  query: ListMyConversationsQuery,
): Promise<StaffConversationsView> {
  const where: Prisma.ConversationWhereInput = {
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
  };

  const rows = await prisma.conversation.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      order: { select: { id: true, reference: true } },
    },
    // Recency, with `id` as the total tiebreak the cursor needs.
    orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(query.cursor, query.limit),
  });

  const page = takePage(rows, query.limit);

  const awaitingCount = await countAwaiting(where);

  if (page.rows.length === 0) {
    return { conversations: [], awaitingCount, nextCursor: null };
  }

  const latestAuthor = await newestAuthors(page.rows.map((row) => row.id));

  const conversations: StaffConversationRow[] = page.rows.map((conversation) => {
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

  /*
   * Waiting-on-us first: the list is a work queue, and a thread the customer is
   * waiting on outranks one we already answered.
   *
   * Applied to the page, after `nextCursor` has been taken from the row the
   * DATABASE ordered last. The stream itself stays strictly by recency — which
   * is what the cursor steps through — and this is presentation on top of it.
   */
  conversations.sort((a, b) => Number(b.awaitingReply) - Number(a.awaitingReply));

  return { conversations, awaitingCount, nextCursor: page.nextCursor };
}

/*
 * Who spoke last in each thread. Internal notes are excluded: a note is the team
 * talking to itself and does not answer the customer, so a thread whose newest
 * entry is a note is still waiting on a reply.
 */
async function newestAuthors(
  conversationIds: string[],
): Promise<Map<string, MessageAuthor>> {
  const messages = await prisma.message.findMany({
    where: {
      conversationId: { in: conversationIds },
      deletedAt: null,
      author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
    },
    orderBy: { sentAt: 'desc' },
    select: { conversationId: true, author: true },
  });

  const latest = new Map<string, MessageAuthor>();
  for (const message of messages) {
    if (!latest.has(message.conversationId)) {
      latest.set(message.conversationId, message.author);
    }
  }

  return latest;
}

/*
 * How many threads in the WHOLE scope are waiting on us, not just the loaded
 * page. It cannot be a `count`: "waiting" is a property of the newest message in
 * each thread, so the ids have to be gathered and their latest authors resolved.
 * Ids only, and the same two queries the page above already runs — the badge
 * would otherwise read "3 awaiting" on a queue of thirty.
 */
async function countAwaiting(where: Prisma.ConversationWhereInput): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where,
    select: { id: true },
  });

  if (conversations.length === 0) return 0;

  const latest = await newestAuthors(conversations.map((c) => c.id));

  return [...latest.values()].filter((author) => author === MessageAuthor.CUSTOMER)
    .length;
}
