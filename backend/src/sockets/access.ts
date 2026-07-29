import { ConversationKind, ConversationStatus } from '@prisma/client';

import type { AuthContext } from '../guards/auth-context.js';
import { isStaff } from '../guards/ownership.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission, canSeeAll } from '../modules/admin/admin.guards.js';
import type { GuestIdentity } from '../modules/guest/guest.service.js';

/*
 * Who is on the other end of a socket, and what they may reach.
 *
 * The rule this file exists to hold: a socket's room membership is never the
 * authorisation to be in it. Access is re-derived from the database on every
 * join, because the answer changes underneath a long-lived connection — a
 * conversation gets reassigned, a staff member is deactivated, a permission is
 * revoked — and a connection opened this morning must not still be trusted on
 * this afternoon's rules.
 */

export type SocketIdentity =
  | { kind: 'user'; auth: AuthContext }
  | { kind: 'guest'; guest: GuestIdentity };

export type ConversationAccess = {
  conversationId: string;
  // How this actor relates to the thread, which decides what they may see and
  // how their messages are attributed.
  as: 'customer' | 'staff' | 'guest';
  customerId: string | null;
  guestId: string | null;
  assigneeId: string | null;
};

/*
 * Can this identity work in this conversation?
 *
 * Returns null rather than throwing: a socket handler answers a refused join
 * with an error event, not an exception, and null keeps "no such thread" and
 * "not yours" indistinguishable — the same reason the REST services 404 instead
 * of 403 (guards/ownership.ts).
 *
 * Live chat is SUPPORT threads only. An ORDER conversation is answerable solely
 * by that order's assignee (modules/conversations), and that lock is not
 * enforced here — so admitting one to a room would be a way around it.
 */
export async function resolveAccess(
  identity: SocketIdentity,
  conversationId: string,
): Promise<ConversationAccess | null> {
  /*
   * A guest never names a conversation. Theirs comes from their token, so an id
   * they send is compared against it and otherwise ignored — without this, any
   * id would be a way into a stranger's chat.
   */
  if (identity.kind === 'guest') {
    if (conversationId !== identity.guest.conversationId) return null;

    return {
      conversationId,
      as: 'guest',
      customerId: null,
      guestId: identity.guest.id,
      assigneeId: null,
    };
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
    },
    select: { id: true, customerId: true, guestId: true, assigneeId: true },
  });

  if (!conversation) return null;

  const { auth } = identity;

  if (!isStaff(auth)) {
    // A customer reaches their own threads and nothing else. A guest thread has
    // a null customerId, which no user id matches.
    if (conversation.customerId !== auth.userId) return null;

    return { ...conversation, conversationId, as: 'customer' };
  }

  // Staff need the support area, exactly as the REST inbox requires it.
  if (!(await hasPermission(auth, 'support'))) return null;

  /*
   * And the same scope the inbox applies: a scoped agent works the threads
   * assigned to them and nothing else — not a colleague's, and not one nobody
   * owns yet. Re-checked here rather than assumed from the list they clicked
   * through, because that list was rendered at some earlier point in time and a
   * socket outlives it.
   *
   * This is also what makes reassignment mean something on the live transport: an
   * agent who was moved off a thread fails the check on their next join, and the
   * handler evicts the room membership they already had.
   */
  if (!(await canSeeAll(auth, 'support'))) {
    if (conversation.assigneeId !== auth.userId) return null;
  }

  return { ...conversation, conversationId, as: 'staff' };
}

/*
 * The threads a customer may be auto-joined to on connect, so a reply reaches
 * them wherever they are in the portal rather than only on the Messages screen.
 * Capped: a customer with hundreds of threads should not open hundreds of rooms.
 */
export async function customerConversationIds(
  userId: string,
  limit = 20,
): Promise<string[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      customerId: userId,
      kind: ConversationKind.SUPPORT,
      deletedAt: null,
      status: { not: ConversationStatus.RESOLVED },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: limit,
    select: { id: true },
  });

  return conversations.map((conversation) => conversation.id);
}
