import type { Server } from 'socket.io';

import { logger } from '../lib/logger.js';
import {
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
  if (!io) return;

  const rooms = new Set<string>([SUPPORT_ALL_ROOM]);
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
