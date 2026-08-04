import type { Server } from 'socket.io';

import { logger } from '../lib/logger.js';
import { countUnreadFeed } from '../modules/notifications/notifications.service.js';
import * as support from '../modules/support/support.service.js';
import {
  ORDERS_ALL_ROOM,
  SUPPORT_ALL_ROOM,
  ServerEvent,
  conversationRoom,
  conversationStaffRoom,
  userRoom,
} from './events.js';

/*
 * How a REST request tells the live inbox that something changed.
 *
 * A message sent over a socket is broadcast by the handler that persisted it.
 * A *conversation* is different: it is created by the portal's "New message"
 * dialog and by the marketing widget's first POST, and it is reassigned by an
 * admin over a PATCH — all of them ordinary HTTP requests with no socket in
 * hand. Without this, an agent's inbox only learned about a new chat when they
 * reloaded the page.
 *
 * The rules this file keeps:
 *
 *   - It is still persist-then-emit (AGENTS.md, Live Chat). Services call these
 *     after the row is written, never before, and never instead of writing.
 *   - The payload is IDS ONLY — no subject, no preview, no body. The client
 *     re-reads the list through the API, which applies the same scope the socket
 *     would, so the event can never be a way around it. That also keeps message
 *     PII out of a broadcast entirely.
 *   - It is fire-and-forget. A dropped notification costs a stale list until the
 *     next fetch; a throw here would fail the customer's message, which is the
 *     part that actually matters.
 *
 * The server instance is registered at boot rather than imported, because
 * sockets/index.ts creates it — and because a test or a CLI script that never
 * starts a socket server must still be able to call the services below.
 */

let io: Server | null = null;

export function registerBroadcaster(server: Server): void {
  io = server;
}

// Test seam, and what a graceful shutdown should leave behind.
export function clearBroadcaster(): void {
  io = null;
}

export type ConversationChange = {
  conversationId: string;
  // Who owns the thread now. Null for a thread nobody has been given yet.
  assigneeId: string | null;
  /*
   * Who owned it a moment ago, when this is a reassignment. They are told too —
   * the thread has just left their inbox, and a list that only ever gains rows
   * would keep showing them a conversation they can no longer open.
   */
  previousAssigneeId?: string | null;
};

/*
 * Tell everyone entitled to know that a conversation appeared, moved, or
 * changed.
 *
 * Three audiences, and no fourth: the agent who holds it, the agent who just
 * lost it, and the supervisors who see the whole queue. A staff member with no
 * claim on the thread is never told it exists — which is the same boundary the
 * list endpoint draws, expressed as room membership rather than as a filter on
 * the receiving end.
 */
export function emitConversationChanged(change: ConversationChange): void {
  broadcastChange(SUPPORT_ALL_ROOM, change);
}

/*
 * The same three audiences for an ORDER thread, addressed through the orders
 * supervisor room instead of the support one.
 *
 * It needs its own entry point because the two queues are governed by two
 * different grants: "My conversations" scopes itself with `canSeeAll(…, 'orders')`,
 * so a member holding the whole order queue but not the support inbox has to be
 * told here and must not be told by the call above.
 *
 * This is also the only live signal an order thread has. Both sides of it post
 * over REST — there is no socket transport for that conversation — so without
 * this the assignee's list only learned about a customer's message when they
 * reloaded the page.
 */
export function emitOrderConversationChanged(change: ConversationChange): void {
  broadcastChange(ORDERS_ALL_ROOM, change);
}

function broadcastChange(supervisorRoom: string, change: ConversationChange): void {
  if (!io) return;

  const rooms = new Set<string>([supervisorRoom]);
  if (change.assigneeId) rooms.add(userRoom(change.assigneeId));
  if (change.previousAssigneeId) rooms.add(userRoom(change.previousAssigneeId));

  const payload = {
    conversationId: change.conversationId,
    assigneeId: change.assigneeId,
  };

  try {
    io.to([...rooms]).emit(ServerEvent.CONVERSATION, payload);
  } catch (error) {
    logger.error(
      { err: error, conversationId: change.conversationId },
      'Failed to broadcast a conversation change',
    );
  }
}

/*
 * Turn one user's sockets out of a conversation's rooms.
 *
 * Access is re-derived on every join, but a socket already in a room stays there
 * — so an admin moving a thread to another agent would otherwise keep delivering
 * the customer's next message to the agent it was taken from, for as long as they
 * left the tab open. This is the transport catching up with a decision the
 * database has already made.
 *
 * It evicts unconditionally rather than re-deriving the leaver's permissions,
 * because the repair is cheaper than the check: a client that still has the
 * thread open re-joins when the `conversation:updated` event lands, and that join
 * runs the real access check. Someone still entitled is back in the room a moment
 * later; someone who is not is refused — the same answer a permission lookup here
 * would have produced, arrived at by the code that is already the authority on it.
 */
export function evictFromConversation(conversationId: string, userId: string): void {
  if (!io) return;

  io.in(userRoom(userId)).socketsLeave([
    conversationRoom(conversationId),
    conversationStaffRoom(conversationId),
  ]);
}

/*
 * Read someone's two unread counters. The one query behind both the live push
 * below and the REST endpoint the badge falls back to, so a number that arrives
 * live and the same number fetched on load cannot disagree.
 */
async function readUnread(
  userId: string,
): Promise<{ messages: number; notifications: number }> {
  const [messages, notifications] = await Promise.all([
    support.countUnreadConversations(userId),
    countUnreadFeed(userId),
  ]);

  return { messages, notifications };
}

/*
 * Push one user's unread counters to every tab they have open.
 *
 * Scoped to that user's room, never broadcast: an unread count is derived from
 * conversations they own, so sending it anywhere else would leak the fact that
 * those conversations exist.
 *
 * The awaitable form, for a caller already inside an async handler that wants
 * the push ordered with its own work. Everything else uses `emitUnreadChanged`.
 */
export async function pushUnread(userId: string): Promise<void> {
  const server = io;
  if (!server) return;

  server.to(userRoom(userId)).emit(ServerEvent.UNREAD, await readUnread(userId));
}

/*
 * Tell one user their unread counters moved.
 *
 * This is the half of the notification pipeline that reaches a customer sitting
 * on a page with nothing to refetch. It is called from wherever a feed row is
 * written — including the payments job worker, which has no socket in hand and
 * is the reason this lives beside the other broadcasters rather than inside the
 * chat handlers.
 *
 * Fire-and-forget, like everything else in this file: the count is already
 * correct in the database, and a failed push costs a stale badge until the next
 * fetch. It must never fail the write that produced it.
 */
export function emitUnreadChanged(userId: string): void {
  void pushUnread(userId).catch((error: unknown) => {
    logger.error({ err: error, userId }, 'Failed to push unread counters');
  });
}
