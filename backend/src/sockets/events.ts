import { z } from 'zod';

/*
 * The live-chat wire contract.
 *
 * Socket.io has no equivalent of a route table, so this file is it: every event
 * name the server understands, and the Zod schema its payload is parsed against
 * before a handler touches it (AGENTS.md — Zod schemas are the wire contract's
 * source of truth, on this transport exactly as on REST).
 *
 * Naming is `noun:verb`. Client→server events are imperatives the server may
 * refuse; server→client events are statements of fact that already happened.
 */

export const ClientEvent = {
  // Join the room for a conversation. The server re-checks access on every join;
  // being in a room is never itself the authorisation to be there.
  JOIN: 'conversation:join',
  LEAVE: 'conversation:leave',
  SEND: 'message:send',
  READ: 'conversation:read',
  TYPING: 'conversation:typing',
  // Staff only — the Online/Away switch in the admin shell.
  AVAILABILITY: 'agent:availability',
} as const;

export const ServerEvent = {
  MESSAGE: 'message:new',
  // Someone opened the thread and read up to a point in time. Draws the "Seen"
  // tick on the other side's messages.
  READ: 'conversation:read',
  TYPING: 'conversation:typing',
  // A thread's assignee or status changed; the inbox re-reads it.
  CONVERSATION: 'conversation:updated',
  // The other party's connection state, per conversation.
  PRESENCE: 'conversation:presence',
  // How many staff are online and available right now — what the customer's
  // widget prints as "we're here" or "we'll email you back".
  AVAILABILITY: 'support:availability',
  // The viewer's own unread counters changed. Sent only to that user's sockets.
  UNREAD: 'support:unread',
  // A handler refused something. Carries a code from the same enum the REST
  // envelope uses, so a client handles a failure identically either way.
  ERROR: 'support:error',
} as const;

/*
 * Which thread an event is about.
 *
 * A guest never sends this: their conversation is derived from their token, so
 * accepting an id from them would make any id a way into a stranger's chat. The
 * handlers enforce that rather than the schema, because the shape is shared.
 */
export const conversationPayload = z.object({
  conversationId: z.string().min(1).max(64),
});

export const sendPayload = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  body: z.string().trim().max(5_000),
  /*
   * A client-generated id echoed back on the delivered message.
   *
   * The sender renders their own message optimistically the instant they hit
   * send; without this they cannot tell the server's copy of that message from a
   * second one, and every send appears twice until a refetch.
   */
  clientId: z.string().min(1).max(64).optional(),
  // Staff-only. A customer's payload can never produce a note — the handler
  // ignores this field unless the sender is staff.
  kind: z.enum(['reply', 'note']).optional(),
  attachments: z
    .array(
      z.object({
        objectKey: z.string().trim().min(1).max(500),
        name: z.string().trim().min(1).max(255),
        sizeBytes: z.coerce.number().int().min(1),
        contentType: z.string().trim().min(1).max(120).optional(),
      }),
    )
    .max(4)
    .optional(),
});

export const typingPayload = z.object({
  conversationId: z.string().min(1).max(64).optional(),
  typing: z.boolean(),
});

export const availabilityPayload = z.object({
  available: z.boolean(),
});

// Every conversation is its own room, which is what keeps a broadcast from
// reaching anyone who was not admitted to that thread.
export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

/*
 * The staff-only half of a conversation. Agents join both rooms; the customer
 * joins only the one above.
 *
 * This is what makes an internal note safe to broadcast at all. Filtering by role
 * at emit time would mean every future emit had to remember to do it — one room
 * that the customer is never admitted to cannot be forgotten.
 */
export function conversationStaffRoom(conversationId: string): string {
  return `conversation:${conversationId}:staff`;
}

// A per-user room, so "your unread count changed" reaches every tab that user
// has open without touching anybody else.
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

// Every connected staff member, for team-wide signals like the availability
// count.
export const STAFF_ROOM = 'staff';

/*
 * The supervisors: staff who read the whole support queue rather than their own
 * assigned threads (`support.all` or `support.assign`).
 *
 * A separate room from STAFF_ROOM because "a chat arrived" is not a team-wide
 * signal any more — an agent is told about the threads that are theirs, and
 * telling everyone would leak the existence of a colleague's conversation to
 * someone the list endpoint would never show it to. Joined at connect time after
 * the same permission check the REST inbox applies.
 */
export const SUPPORT_ALL_ROOM = 'support:all';
