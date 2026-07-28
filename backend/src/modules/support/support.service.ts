import {
  ConversationCategory,
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
  OrderStatus,
  Prisma,
} from '@prisma/client';

import type { AuthContext } from '../../guards/auth-context.js';
import { assertFound } from '../../guards/ownership.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import { emitConversationChanged } from '../../sockets/broadcast.js';
import { assertKeyForPurpose } from '../uploads/uploads.service.js';
import {
  ensureAssigned,
  pickAssignee,
  recordAutoAssignment,
} from './support.assignment.js';
import { notifyNewSupportMessage } from './support.notifications.js';
import type {
  CreateConversationInput,
  ListConversationsQuery,
  SendMessageInput,
} from './support.validation.js';

/*
 * Support conversations — the portal's Messages screen and the persistence layer
 * the live-chat sockets call (AGENTS.md, Live Chat: sockets are transport only,
 * every message is a row first). This is the one layer touching Prisma for
 * support, so REST and Socket.io share the same logic and the same guards.
 *
 * Every function here takes an AuthContext rather than the Express request. A
 * socket has a session but no request, and the alternative — a second code path
 * for the socket transport — is exactly the duplication that lets a guard exist
 * on one transport and not the other.
 *
 * Message bodies are PII — never logged (AGENTS.md). Only ids appear in logs.
 */

// The frontend renders lowercase; Prisma stores the enum uppercase.
const CATEGORY_TO_VIEW: Record<ConversationCategory, string> = {
  [ConversationCategory.FORMATION]: 'formation',
  [ConversationCategory.ECOMMERCE]: 'ecommerce',
  [ConversationCategory.MAILROOM]: 'mailroom',
  [ConversationCategory.BILLING]: 'billing',
  [ConversationCategory.DOCUMENTS]: 'documents',
  [ConversationCategory.SUPPORT]: 'support',
};

// The inverse, for the category a customer picks when opening a thread. Written
// out rather than upper-casing the string, so an unknown value is a type error
// here instead of a runtime enum failure inside Prisma.
const VIEW_TO_CATEGORY: Record<string, ConversationCategory> = {
  formation: ConversationCategory.FORMATION,
  ecommerce: ConversationCategory.ECOMMERCE,
  mailroom: ConversationCategory.MAILROOM,
  billing: ConversationCategory.BILLING,
  documents: ConversationCategory.DOCUMENTS,
  support: ConversationCategory.SUPPORT,
};

// The list's status chip mirrors the linked order's status, read through the
// relation rather than duplicated on the conversation (schema.prisma: one
// definition, no drift).
const ORDER_STATUS_TO_VIEW: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'draft',
  [OrderStatus.SUBMITTED]: 'submitted',
  [OrderStatus.UNDER_REVIEW]: 'under_review',
  [OrderStatus.MISSING_INFO]: 'missing_info',
  [OrderStatus.APPROVED]: 'approved',
  [OrderStatus.PAID]: 'paid',
  [OrderStatus.PROCESSING]: 'processing',
  [OrderStatus.COMPLETED]: 'completed',
};

const AUTHOR_TO_VIEW: Record<MessageAuthor, string> = {
  [MessageAuthor.CUSTOMER]: 'customer',
  [MessageAuthor.AGENT]: 'agent',
  // Never reaches the portal — every read here excludes it (see CUSTOMER_VISIBLE
  // below). Mapped only so the record stays exhaustive over the enum.
  [MessageAuthor.INTERNAL_NOTE]: 'internal_note',
};

// An internal note is staff-only (schema.prisma, MessageAuthor). This module
// serves the customer's portal, so every message read filters on it — one
// constant rather than a repeated clause, so a new read cannot forget it.
const CUSTOMER_VISIBLE: Prisma.MessageWhereInput = {
  deletedAt: null,
  author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
};

// --- List ----------------------------------------------------------------
export type ConversationSummary = {
  id: string;
  subject: string;
  category: string;
  status?: string;
  orderId?: string;
  preview: string;
  lastMessageAt: string;
  unread: boolean;
};

// The unread dot is derived — `lastMessageAt > customerReadAt` — rather than a
// stored boolean, so it can never disagree with the thread's own timestamps.
function isUnread(
  lastMessageAt: Date | null,
  customerReadAt: Date | null,
): boolean {
  if (!lastMessageAt) return false;
  if (!customerReadAt) return true;
  return lastMessageAt > customerReadAt;
}

export async function listConversations(
  auth: AuthContext,
  query: ListConversationsQuery,
): Promise<ConversationSummary[]> {
  // A customer sees only their own threads; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  //
  // It also excludes guest threads for free: theirs carry a null customerId,
  // which no user id can ever match.
  const where: Prisma.ConversationWhereInput = {
    customerId: auth.userId,
    deletedAt: null,
    // Support threads only. An order's conversation is a different thing with a
    // different routing rule (modules/conversations) and is read on the order's
    // own screen — listing it here would present two threads the customer cannot
    // tell apart, one of which only their assignee can answer.
    kind: ConversationKind.SUPPORT,
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: 'insensitive' } },
            { preview: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const conversations = await prisma.conversation.findMany({
    where,
    include: { order: { select: { id: true, status: true } } },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  });

  return conversations.map((conversation) => ({
    id: conversation.id,
    subject: conversation.subject,
    category: CATEGORY_TO_VIEW[conversation.category],
    status: conversation.order
      ? ORDER_STATUS_TO_VIEW[conversation.order.status]
      : undefined,
    orderId: conversation.order?.id,
    preview: conversation.preview ?? '',
    lastMessageAt: (
      conversation.lastMessageAt ?? conversation.createdAt
    ).toISOString(),
    unread: isUnread(conversation.lastMessageAt, conversation.customerReadAt),
  }));
}

// --- Thread --------------------------------------------------------------
export type MessageView = {
  id: string;
  author: string;
  body: string;
  sentAt: string;
  senderName?: string;
  /*
   * Whether the team has read this message. Only meaningful on the customer's own
   * messages — a "Seen" tick under an agent's reply would be telling the customer
   * about their own reading. Derived from the thread's `staffReadAt` marker
   * rather than stored per row, so it cannot disagree with itself.
   */
  seen?: boolean;
  attachments?: {
    id: string;
    name: string;
    size: number;
    href?: string;
  }[];
};

export type ConversationThread = {
  id: string;
  subject: string;
  category: string;
  status?: string;
  orderId?: string;
  messages: MessageView[];
};

const threadInclude = {
  order: { select: { id: true, status: true } },
  messages: {
    where: CUSTOMER_VISIBLE,
    orderBy: { sentAt: 'asc' },
    include: { attachments: true },
  },
} satisfies Prisma.ConversationInclude;

type ConversationWithThread = Prisma.ConversationGetPayload<{
  include: typeof threadInclude;
}>;

// A message is seen once the counterpart's read marker reaches its send time.
// One comparison, used by both sides of the thread.
export function isSeen(sentAt: Date, readAt: Date | null): boolean {
  return readAt !== null && readAt >= sentAt;
}

async function toThread(
  conversation: ConversationWithThread,
): Promise<ConversationThread> {
  const messages = await Promise.all(
    conversation.messages.map(async (message) => ({
      id: message.id,
      author: AUTHOR_TO_VIEW[message.author],
      body: message.body,
      sentAt: message.sentAt.toISOString(),
      // Only an agent message shows a sender name; the customer's own bubbles
      // are right-aligned without one.
      senderName:
        message.author === MessageAuthor.AGENT
          ? message.authorName ?? undefined
          : undefined,
      seen:
        message.author === MessageAuthor.CUSTOMER
          ? isSeen(message.sentAt, conversation.staffReadAt)
          : undefined,
      attachments:
        message.attachments.length > 0
          ? await Promise.all(
              message.attachments.map(async (attachment) => ({
                id: attachment.id,
                name: attachment.name,
                size: attachment.sizeBytes,
                // Short-TTL presigned URL, minted after the ownership check
                // below (AGENTS.md, Security & PII).
                href: await presignObject(attachment.objectKey),
              })),
            )
          : undefined,
    })),
  );

  return {
    id: conversation.id,
    subject: conversation.subject,
    category: CATEGORY_TO_VIEW[conversation.category],
    status: conversation.order
      ? ORDER_STATUS_TO_VIEW[conversation.order.status]
      : undefined,
    orderId: conversation.order?.id,
    messages,
  };
}

// Opening a thread marks it read — that is what clears the list's unread dot.
export async function getConversation(
  auth: AuthContext,
  conversationId: string,
): Promise<ConversationThread> {
  /*
   * Scoped to SUPPORT threads, which is a security boundary and not just a
   * filter: an order conversation may only be answered by that order's assignee,
   * and this module does not apply that rule. Without the `kind` clause, any
   * staff member could reach an order thread through the support endpoint and
   * bypass the lock entirely (modules/conversations owns that check).
   */
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, kind: ConversationKind.SUPPORT, deletedAt: null },
    include: threadInclude,
  });

  // 404 (not 403) for another customer's thread, so the id isn't confirmed.
  // A guest thread has no customerId at all, and '' matches no user id — so it
  // is unreachable here for anyone but staff, who have the admin inbox anyway.
  const found = assertFound(conversation, auth, (c) => c.customerId ?? '');

  // Only the owning customer reading their thread clears the dot; staff opening
  // it must not mark it read on the customer's behalf.
  if (auth.userId === found.customerId) {
    await prisma.conversation.update({
      where: { id: found.id },
      data: { customerReadAt: new Date() },
    });
  }

  return await toThread(found);
}

/*
 * Mark the customer's side of a thread read, without loading it.
 *
 * The socket calls this when the thread is on screen and a message arrives —
 * re-fetching the whole conversation just to move one timestamp would be a query
 * per keystroke of the other party. `updateMany` scoped to the owner means
 * someone else's id updates nothing rather than throwing something that would
 * confirm the thread exists.
 */
export async function markCustomerRead(
  auth: AuthContext,
  conversationId: string,
): Promise<{ conversationId: string; readAt: string }> {
  const readAt = new Date();

  await prisma.conversation.updateMany({
    where: { id: conversationId, customerId: auth.userId, deletedAt: null },
    data: { customerReadAt: readAt },
  });

  return { conversationId, readAt: readAt.toISOString() };
}

// --- Send ----------------------------------------------------------------
// Persist then emit (AGENTS.md, Live Chat): this writes the row and updates the
// thread's denormalised preview in one transaction. The socket layer will call
// this same function and emit afterwards, so history survives a reconnect.
export async function sendMessage(
  auth: AuthContext,
  conversationId: string,
  input: SendMessageInput,
): Promise<MessageView> {
  // SUPPORT only, for the same reason as the read above: posting into an order
  // thread from here would sidestep the assignee lock.
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, kind: ConversationKind.SUPPORT, deletedAt: null },
    select: { id: true, customerId: true, status: true, assigneeId: true },
  });

  const found = assertFound(conversation, auth, (c) => c.customerId ?? '');

  // The author comes from the session, never the payload: a customer posting into
  // their own thread is a CUSTOMER message, a staff reply is an AGENT one.
  const isOwner = auth.userId === found.customerId;
  const author = isOwner ? MessageAuthor.CUSTOMER : MessageAuthor.AGENT;

  const sentAt = new Date();

  // The guards pass identity only, so the display name is read here and
  // snapshotted onto the row — the thread still reads correctly after the author
  // is deleted (schema.prisma).
  const sender = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  /*
   * Attachment keys are checked before anything is written. They arrive from the
   * browser, which held them between minting and now, so the prefix check is what
   * stops a key minted for one purpose (or one customer) being attached here
   * (uploads.service.ts).
   */
  for (const attachment of input.attachments ?? []) {
    assertKeyForPurpose(auth, 'support-attachment', attachment.objectKey);
  }

  // One transaction so a message can never exist without the list preview that
  // sorts and displays it (schema.prisma: written in the same transaction).
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: found.id,
        author,
        authorUserId: auth.userId,
        authorName: sender?.name ?? null,
        body: input.body,
        sentAt,
        attachments: input.attachments?.length
          ? {
              create: input.attachments.map((attachment) => ({
                name: attachment.name,
                sizeBytes: attachment.sizeBytes,
                contentType: attachment.contentType,
                objectKey: attachment.objectKey,
              })),
            }
          : undefined,
      },
      include: { attachments: true },
    });

    await tx.conversation.update({
      where: { id: found.id },
      data: {
        lastMessageAt: sentAt,
        preview: input.body.slice(0, 160),
        /*
         * A customer's message puts the ball back in our court. Without this a
         * reply to a RESOLVED thread would leave it resolved — filtered out of
         * the inbox's default view, so nobody would ever see it.
         */
        ...(isOwner
          ? { customerReadAt: sentAt, status: ConversationStatus.OPEN }
          : { staffReadAt: sentAt, status: ConversationStatus.PENDING }),
      },
    });

    return created;
  });

  /*
   * The offline handoff, enqueued here rather than in the socket handler so it
   * fires whichever transport carried the message (AGENTS.md: never send inline —
   * this only schedules a delayed job, which the first staff reply cancels).
   */
  if (isOwner) {
    await notifyNewSupportMessage({ conversationId: found.id, messageId: message.id });

    /*
     * The routing safety net. A thread with no owner is a thread no agent can
     * see, so a customer writing into one — because it predates automatic
     * routing, or because its agent's account was removed — gets it routed now
     * rather than waiting for a supervisor to notice
     * (support.assignment.ts).
     */
    const assigneeId = found.assigneeId ?? (await ensureAssigned(found.id));

    /*
     * The agent's list row has changed — its preview, its time, its unread dot —
     * so the inbox is told here rather than in the socket handler, which would
     * only cover one of the two transports a message can arrive on.
     */
    emitConversationChanged({ conversationId: found.id, assigneeId });
  }

  return {
    id: message.id,
    author: AUTHOR_TO_VIEW[message.author],
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    senderName:
      message.author === MessageAuthor.AGENT
        ? message.authorName ?? undefined
        : undefined,
    // The sender's own message is unread by the other side by definition.
    seen: isOwner ? false : undefined,
    attachments:
      message.attachments.length > 0
        ? await Promise.all(
            message.attachments.map(async (attachment) => ({
              id: attachment.id,
              name: attachment.name,
              size: attachment.sizeBytes,
              href: await presignObject(attachment.objectKey),
            })),
          )
        : undefined,
  };
}

/*
 * Open a new support thread.
 *
 * The subject and category come from the customer; everything that decides who
 * answers it does not. The thread is routed to an agent as it is created
 * (support.assignment.ts) — balanced across the team, preferring whoever is
 * online — because an agent's inbox is the threads assigned to them, so a chat
 * nobody owns is a chat nobody sees.
 */
export async function createConversation(
  auth: AuthContext,
  input: CreateConversationInput,
): Promise<ConversationSummary> {
  const sentAt = new Date();

  const sender = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  for (const attachment of input.attachments ?? []) {
    assertKeyForPurpose(auth, 'support-attachment', attachment.objectKey);
  }

  // Chosen before the transaction: it is several reads across the staff table,
  // and holding a transaction open for them would put the whole team's load
  // figures inside the lock every new chat takes out.
  const { assigneeId, assignedAt } = await pickAssignee();

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({
      data: {
        customerId: auth.userId,
        subject: input.subject,
        category: VIEW_TO_CATEGORY[input.category],
        kind: ConversationKind.SUPPORT,
        status: ConversationStatus.OPEN,
        assigneeId,
        assignedAt,
        lastMessageAt: sentAt,
        preview: input.body.slice(0, 160),
        customerReadAt: sentAt,
      },
    });

    await tx.message.create({
      data: {
        conversationId: created.id,
        author: MessageAuthor.CUSTOMER,
        authorUserId: auth.userId,
        authorName: sender?.name ?? null,
        body: input.body,
        sentAt,
        attachments: input.attachments?.length
          ? {
              create: input.attachments.map((attachment) => ({
                name: attachment.name,
                sizeBytes: attachment.sizeBytes,
                contentType: attachment.contentType,
                objectKey: attachment.objectKey,
              })),
            }
          : undefined,
      },
    });

    return created;
  });

  if (assigneeId) await recordAutoAssignment(conversation.id, assigneeId);

  await notifyNewSupportMessage({ conversationId: conversation.id });

  /*
   * Persist, then emit (AGENTS.md, Live Chat). This is what puts the chat in
   * front of its agent without a page reload — the request that created it is an
   * ordinary POST with no socket in hand, so the broadcast helper carries it.
   */
  emitConversationChanged({ conversationId: conversation.id, assigneeId });

  return {
    id: conversation.id,
    subject: conversation.subject,
    category: CATEGORY_TO_VIEW[conversation.category],
    preview: conversation.preview ?? '',
    lastMessageAt: sentAt.toISOString(),
    unread: false,
  };
}

// --- Cross-module summaries ----------------------------------------------
/*
 * The dashboard's "pending messages" metric — threads with a reply the customer
 * hasn't opened yet. Derived from the same rule as the list's unread dot.
 *
 * Deliberately spans both kinds, unlike every other read in this module: the
 * metric answers "does anything need my attention", and an unread reply from the
 * specialist on an order counts just as much as one from support. The screens are
 * separate; the customer's attention is not.
 */
export async function countUnreadConversations(userId: string): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where: { customerId: userId, deletedAt: null },
    select: { lastMessageAt: true, customerReadAt: true },
  });

  return conversations.filter((conversation) =>
    isUnread(conversation.lastMessageAt, conversation.customerReadAt),
  ).length;
}
