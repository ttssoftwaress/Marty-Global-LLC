import {
  ConversationCategory,
  MessageAuthor,
  OrderStatus,
  Prisma,
} from '@prisma/client';

import { getAuth } from '../../guards/index.js';
import { assertFound } from '../../guards/ownership.js';
import { prisma } from '../../lib/prisma.js';
import { presignObject } from '../../lib/storage.js';
import type {
  ListConversationsQuery,
  SendMessageInput,
} from './support.validation.js';

/*
 * Support conversations — the portal's Messages screen and the persistence layer
 * the live-chat sockets will call (AGENTS.md, Live Chat: sockets are transport
 * only, every message is a row first). This is the one layer touching Prisma for
 * support, so REST and Socket.io share the same logic and the same guards.
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

// The list's status chip mirrors the linked order's status, read through the
// relation rather than duplicated on the conversation (schema.prisma: one
// definition, no drift).
const ORDER_STATUS_TO_VIEW: Record<OrderStatus, string> = {
  [OrderStatus.DRAFT]: 'draft',
  [OrderStatus.SUBMITTED]: 'submitted',
  [OrderStatus.UNDER_REVIEW]: 'under_review',
  [OrderStatus.MISSING_INFO]: 'missing_info',
  [OrderStatus.APPROVED]: 'approved',
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
  req: Parameters<typeof getAuth>[0],
  query: ListConversationsQuery,
): Promise<ConversationSummary[]> {
  const auth = getAuth(req);

  // A customer sees only their own threads; the ownership boundary is this where
  // clause, not a per-row check (AGENTS.md: guards are the real boundary).
  const where: Prisma.ConversationWhereInput = {
    customerId: auth.userId,
    deletedAt: null,
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

function toThread(conversation: ConversationWithThread): ConversationThread {
  return {
    id: conversation.id,
    subject: conversation.subject,
    category: CATEGORY_TO_VIEW[conversation.category],
    status: conversation.order
      ? ORDER_STATUS_TO_VIEW[conversation.order.status]
      : undefined,
    orderId: conversation.order?.id,
    messages: conversation.messages.map((message) => ({
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
      attachments:
        message.attachments.length > 0
          ? message.attachments.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              size: attachment.sizeBytes,
              // Short-TTL presigned URL, minted after the ownership check below
              // (AGENTS.md, Security & PII).
              href: presignObject(attachment.objectKey),
            }))
          : undefined,
    })),
  };
}

// Opening a thread marks it read — that is what clears the list's unread dot.
export async function getConversation(
  req: Parameters<typeof getAuth>[0],
  conversationId: string,
): Promise<ConversationThread> {
  const auth = getAuth(req);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    include: threadInclude,
  });

  // 404 (not 403) for another customer's thread, so the id isn't confirmed.
  const found = assertFound(conversation, auth, (c) => c.customerId);

  // Only the owning customer reading their thread clears the dot; staff opening
  // it must not mark it read on the customer's behalf.
  if (auth.userId === found.customerId) {
    await prisma.conversation.update({
      where: { id: found.id },
      data: { customerReadAt: new Date() },
    });
  }

  return toThread(found);
}

// --- Send ----------------------------------------------------------------
// Persist then emit (AGENTS.md, Live Chat): this writes the row and updates the
// thread's denormalised preview in one transaction. The socket layer will call
// this same function and emit afterwards, so history survives a reconnect.
export async function sendMessage(
  req: Parameters<typeof getAuth>[0],
  conversationId: string,
  input: SendMessageInput,
): Promise<MessageView> {
  const auth = getAuth(req);

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null },
    select: { id: true, customerId: true },
  });

  const found = assertFound(conversation, auth, (c) => c.customerId);

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
      },
    });

    await tx.conversation.update({
      where: { id: found.id },
      data: {
        lastMessageAt: sentAt,
        preview: input.body.slice(0, 160),
        // The sender has by definition read their own thread up to this message.
        ...(isOwner ? { customerReadAt: sentAt } : {}),
      },
    });

    return created;
  });

  return {
    id: message.id,
    author: AUTHOR_TO_VIEW[message.author],
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    senderName:
      message.author === MessageAuthor.AGENT
        ? message.authorName ?? undefined
        : undefined,
  };
}

// --- Cross-module summaries ----------------------------------------------
// The dashboard's "pending messages" metric — threads with a reply the customer
// hasn't opened yet. Derived from the same rule as the list's unread dot.
export async function countUnreadConversations(userId: string): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where: { customerId: userId, deletedAt: null },
    select: { lastMessageAt: true, customerReadAt: true },
  });

  return conversations.filter((conversation) =>
    isUnread(conversation.lastMessageAt, conversation.customerReadAt),
  ).length;
}
