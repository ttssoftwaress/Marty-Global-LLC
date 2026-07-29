import { createHash, randomBytes } from 'node:crypto';

import {
  ConversationCategory,
  ConversationKind,
  ConversationStatus,
  MessageAuthor,
} from '@prisma/client';

import { env } from '../../config/env.js';
import { AppError } from '../../lib/app-error.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { emitConversationChanged } from '../../sockets/broadcast.js';
import {
  ensureAssigned,
  pickAssignee,
  recordAutoAssignment,
} from '../support/support.assignment.js';
import { notifyNewSupportMessage } from '../support/support.notifications.js';
import type { GuestMessageInput, StartGuestChatInput } from './guest.validation.js';

/*
 * Anonymous visitor chat — the bubble on the marketing site.
 *
 * A guest is not a User and never becomes one: there is no merge path, by
 * agreed design. Their identity is a bearer token their browser keeps, and their
 * conversation lands in the same admin inbox as any other support thread,
 * because it is routed by the identical rule.
 *
 * Two properties do all the security work here:
 *
 *   - The token is the ONLY way to reach the thread, and the conversation id is
 *     never accepted from the client. A guest can therefore only ever read and
 *     write their own conversation, and no enumeration of ids reaches anything.
 *   - Only the token's SHA-256 is stored. A read-only leak of this table hands
 *     out no live conversations.
 *
 * Everything a guest gives us is purged outright once the thread goes quiet
 * (`purgeExpired`).
 */

const GUEST_AUTHOR_NAME_FALLBACK = 'Visitor';

export type GuestIdentity = {
  id: string;
  name: string;
  email: string;
  conversationId: string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// 32 bytes of entropy: the token is a bearer credential with a 7-day life, so it
// has to be unguessable rather than merely unique.
function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

function retentionCutoff(): Date {
  return new Date(Date.now() - env.GUEST_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/*
 * Resolve a token to the visitor and their thread.
 *
 * Returns null rather than throwing for every failure mode — expired, purged,
 * unknown, malformed — because the widget's response to all of them is the same:
 * start a new conversation. Distinguishing them would only tell a token guesser
 * which guesses were close.
 */
export async function resolveGuest(
  token: string | undefined,
): Promise<GuestIdentity | null> {
  if (!token) return null;

  const guest = await prisma.guestVisitor.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      name: true,
      email: true,
      lastSeenAt: true,
      conversations: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!guest) return null;

  // Past the window but not yet swept up by the purge job. Treated as gone, so
  // the retention promise holds between sweeps rather than only after one.
  if (guest.lastSeenAt < retentionCutoff()) return null;

  const conversationId = guest.conversations[0]?.id;
  if (!conversationId) return null;

  return {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    conversationId,
  };
}

// --- Thread ---------------------------------------------------------------
export type GuestMessageView = {
  id: string;
  author: 'guest' | 'agent';
  body: string;
  sentAt: string;
  senderName?: string;
};

export type GuestThread = {
  conversationId: string;
  name: string;
  messages: GuestMessageView[];
};

export async function getThread(guest: GuestIdentity): Promise<GuestThread> {
  const messages = await prisma.message.findMany({
    where: {
      conversationId: guest.conversationId,
      deletedAt: null,
      // An internal note is staff-only. The guest surface filters it in the query
      // itself, so rows they may not see never enter this process's memory — the
      // same posture as modules/support.
      author: { in: [MessageAuthor.CUSTOMER, MessageAuthor.AGENT] },
    },
    orderBy: { sentAt: 'asc' },
    select: { id: true, author: true, body: true, sentAt: true, authorName: true },
  });

  return {
    conversationId: guest.conversationId,
    name: guest.name,
    messages: messages.map(toGuestView),
  };
}

function toGuestView(message: {
  id: string;
  author: MessageAuthor;
  body: string;
  sentAt: Date;
  authorName: string | null;
}): GuestMessageView {
  const fromAgent = message.author === MessageAuthor.AGENT;

  return {
    id: message.id,
    author: fromAgent ? 'agent' : 'guest',
    body: message.body,
    sentAt: message.sentAt.toISOString(),
    senderName: fromAgent ? (message.authorName ?? 'Marty Global team') : undefined,
  };
}

// --- Start ----------------------------------------------------------------
export type StartedGuestChat = {
  // Returned exactly once, at creation. It is never readable again — only its
  // hash is stored — so a visitor who loses it starts a new conversation.
  token: string;
  thread: GuestThread;
};

export async function startChat(
  input: StartGuestChatInput,
  createdIp?: string,
): Promise<StartedGuestChat> {
  const token = mintToken();
  const sentAt = new Date();

  // A visitor's thread is routed exactly like a customer's — same queue, same
  // balancing rule (support.assignment.ts). Chosen before the transaction so the
  // staff-table reads are not held inside it.
  const { assigneeId, assignedAt } = await pickAssignee();

  const { guest, conversation } = await prisma.$transaction(async (tx) => {
    const createdGuest = await tx.guestVisitor.create({
      data: {
        tokenHash: hashToken(token),
        name: input.name,
        email: input.email,
        createdIp: createdIp ?? null,
        lastSeenAt: sentAt,
      },
    });

    const createdConversation = await tx.conversation.create({
      data: {
        guestId: createdGuest.id,
        // Same kind as any other help request — it is routed by the same rule and
        // belongs in the same queue. The guest relation is what marks it as one.
        kind: ConversationKind.SUPPORT,
        category: ConversationCategory.SUPPORT,
        status: ConversationStatus.OPEN,
        subject: `Website chat — ${input.name}`,
        assigneeId,
        assignedAt,
        lastMessageAt: sentAt,
        preview: input.body.slice(0, 160),
      },
    });

    await tx.message.create({
      data: {
        conversationId: createdConversation.id,
        author: MessageAuthor.CUSTOMER,
        // No user row exists for a guest, which is exactly why this column is
        // nullable. The name is snapshotted so the thread reads correctly after
        // the visitor record is purged.
        authorUserId: null,
        authorName: input.name,
        body: input.body,
        sentAt,
      },
    });

    return { guest: createdGuest, conversation: createdConversation };
  });

  logger.info({ conversationId: conversation.id }, 'Guest chat started');

  if (assigneeId) await recordAutoAssignment(conversation.id, assigneeId);

  await notifyNewSupportMessage({ conversationId: conversation.id });

  // Persist, then emit — this is what drops the new chat into its agent's inbox
  // without a reload (sockets/broadcast.ts).
  emitConversationChanged({ conversationId: conversation.id, assigneeId });

  const identity: GuestIdentity = {
    id: guest.id,
    name: guest.name,
    email: guest.email,
    conversationId: conversation.id,
  };

  return { token, thread: await getThread(identity) };
}

// --- Send -----------------------------------------------------------------
export async function sendMessage(
  guest: GuestIdentity,
  input: GuestMessageInput,
): Promise<GuestMessageView> {
  const sentAt = new Date();

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId: guest.conversationId,
        author: MessageAuthor.CUSTOMER,
        authorUserId: null,
        authorName: guest.name || GUEST_AUTHOR_NAME_FALLBACK,
        body: input.body,
        sentAt,
      },
    });

    await tx.conversation.update({
      where: { id: guest.conversationId },
      data: {
        lastMessageAt: sentAt,
        preview: input.body.slice(0, 160),
        // Their own message is read by them by definition, and it puts the thread
        // back in the team's court.
        customerReadAt: sentAt,
        status: ConversationStatus.OPEN,
      },
    });

    // Every message in either direction pushes the retention window out, so an
    // active conversation is never purged mid-flow.
    await tx.guestVisitor.update({
      where: { id: guest.id },
      data: { lastSeenAt: sentAt },
    });

    return created;
  });

  await notifyNewSupportMessage({ conversationId: guest.conversationId });

  // The routing safety net, then the inbox refresh — both for the same reason as
  // the customer path (modules/support/support.service.ts).
  // `ensureAssigned` answers with the thread's owner whether or not this call is
  // the one that routed it, which is what the broadcast needs: it has to name
  // whichever agent's inbox refreshes.
  const assigneeId = await ensureAssigned(guest.conversationId);
  emitConversationChanged({ conversationId: guest.conversationId, assigneeId });

  return toGuestView({ ...message, authorName: message.authorName });
}

/*
 * Push the retention window out when an AGENT writes into a guest thread.
 *
 * Called from the admin side, because the window has to track the conversation
 * rather than the visitor's activity alone: a thread the team is actively
 * answering must not be deleted out from under them because the visitor happens
 * to be asleep.
 */
export async function touchGuestForConversation(
  conversationId: string,
): Promise<void> {
  await prisma.guestVisitor.updateMany({
    where: { conversations: { some: { id: conversationId } } },
    data: { lastSeenAt: new Date() },
  });
}

// --- Retention ------------------------------------------------------------
/*
 * Delete anonymous chats past the window — a real DELETE, agreed explicitly
 * (AGENTS.md, Database: ask before any hard delete). The conversation and its
 * messages go with the visitor through the schema's cascade, so this one
 * statement removes every trace.
 *
 * Nothing regulatory attaches to a pre-sales chat: there is no filing, no
 * payment, and no customer record behind it. Retaining the name, email, and
 * message history of someone who never became a customer past its usefulness is
 * a liability rather than a record.
 */
export async function purgeExpired(): Promise<{ deleted: number }> {
  const cutoff = retentionCutoff();

  const { count } = await prisma.guestVisitor.deleteMany({
    where: { lastSeenAt: { lt: cutoff } },
  });

  if (count > 0) {
    logger.info({ deleted: count, cutoff }, 'Purged expired guest chats');
  }

  return { deleted: count };
}

// Used by the routes to turn a missing/expired token into the one answer the
// widget knows how to handle.
export function assertGuest(guest: GuestIdentity | null): GuestIdentity {
  if (!guest) {
    throw AppError.unauthenticated('Your chat session has expired');
  }
  return guest;
}
