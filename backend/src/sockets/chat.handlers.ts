import { StaffAvailability } from '@prisma/client';
import type { Server, Socket } from 'socket.io';

import { isStaff } from '../guards/ownership.js';
import { AppError } from '../lib/app-error.js';
import { ErrorCode } from '../lib/error-codes.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import * as adminSupport from '../modules/admin/support/support.service.js';
import { canSeeAll } from '../modules/admin/admin.guards.js';
import * as guestChat from '../modules/guest/guest.service.js';
import * as support from '../modules/support/support.service.js';
import {
  customerConversationIds,
  resolveAccess,
  type ConversationAccess,
  type SocketIdentity,
} from './access.js';
import { pushUnread } from './broadcast.js';
import {
  ClientEvent,
  ORDERS_ALL_ROOM,
  ServerEvent,
  STAFF_ROOM,
  SUPPORT_ALL_ROOM,
  availabilityPayload,
  conversationPayload,
  conversationRoom,
  conversationStaffRoom,
  sendPayload,
  typingPayload,
  userRoom,
} from './events.js';
import * as presence from './presence.js';
import {
  checkMessageQuota,
  checkTypingQuota,
  createMessageBurstLimiter,
  createTypingBurstLimiter,
} from './socket-rate-limit.js';

/*
 * Live chat over Socket.io.
 *
 * Sockets are TRANSPORT ONLY (AGENTS.md, Live Chat). Every handler below
 * validates its payload against the module's Zod schema, calls the same service
 * the REST endpoint calls, and only then emits. Nothing is stored in a socket,
 * no business rule is decided here, and a message that fails to persist is never
 * broadcast — so a reconnect replays exactly the same history the API serves.
 *
 * PII: message bodies are never logged. Conversation and message ids only.
 */

// What a delivered message looks like on the wire, for every audience. Each
// client maps it to its own view — `mine` is a question only the receiver can
// answer, so `authorUserId` is sent and the comparison happens there.
type SocketMessage = {
  id: string;
  conversationId: string;
  author: 'customer' | 'agent' | 'internal_note';
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  sentAt: string;
  clientId?: string;
  attachments?: { id: string; name: string; size: number; href?: string }[];
};

function fail(socket: Socket, code: ErrorCode, message: string): void {
  socket.emit(ServerEvent.ERROR, { error: { code, message } });
}

// Handlers are async and event-driven, so nothing catches for them. One wrapper
// turns a thrown AppError into the same envelope the REST API would have
// returned, and anything else into a generic failure with the detail logged.
function guard(
  socket: Socket,
  name: string,
  handler: (payload: unknown) => Promise<void>,
) {
  return (payload: unknown) => {
    void handler(payload).catch((error: unknown) => {
      if (error instanceof AppError) {
        fail(socket, error.code, error.message);
        return;
      }

      logger.error({ err: error, event: name }, 'Socket handler failed');
      fail(socket, ErrorCode.INTERNAL_ERROR, 'Something went wrong');
    });
  };
}

// --- Presence broadcasts ---------------------------------------------------
function broadcastAvailability(io: Server): void {
  io.emit(ServerEvent.AVAILABILITY, { agentsAvailable: presence.availableAgentCount() });
}

/*
 * Tell a room whether the other party is here.
 *
 * Sent on join and on connection changes rather than polled: presence is a fact
 * about right now, and a client that missed the transition gets the current
 * answer the next time it joins.
 */
function emitPresence(
  io: Server,
  access: ConversationAccess,
): void {
  io.to(conversationRoom(access.conversationId)).emit(ServerEvent.PRESENCE, {
    conversationId: access.conversationId,
    customerOnline: access.customerId
      ? presence.isUserOnline(access.customerId)
      : presence.isGuestOnline(access.conversationId),
    agentsAvailable: presence.availableAgentCount(),
  });
}

// --- Message fan-out -------------------------------------------------------
/*
 * Deliver a persisted message to everyone entitled to it.
 *
 * An internal note goes to the staff room only. That is the single rule keeping
 * a note from the person it is hidden from, and it is enforced by which room the
 * emit targets rather than by a filter on the receiving end — a client-side
 * filter would put the note on the customer's machine and merely decline to draw
 * it.
 */
function deliver(io: Server, message: SocketMessage): void {
  const room =
    message.author === 'internal_note'
      ? conversationStaffRoom(message.conversationId)
      : conversationRoom(message.conversationId);

  io.to(room).emit(ServerEvent.MESSAGE, message);
}

// --- Connection ------------------------------------------------------------
export function registerChatHandlers(io: Server, socket: Socket): void {
  const identity = socket.identity;
  if (!identity) {
    socket.disconnect(true);
    return;
  }

  /*
   * The burst floor only. The limit that actually holds is the Redis-backed
   * quota keyed by this identity and the conversation, checked below once the
   * payload has named one — a counter that died with the connection would be
   * reset by a reconnect (AGENTS.md, Live Chat: rate-limited).
   */
  const messageBurst = createMessageBurstLimiter();
  const typingBurst = createTypingBurstLimiter();

  void onConnect(io, socket, identity);

  socket.on(
    ClientEvent.JOIN,
    guard(socket, ClientEvent.JOIN, async (raw) => {
      const parsed = conversationPayload.safeParse(raw);
      if (!parsed.success) return fail(socket, ErrorCode.VALIDATION_FAILED, 'Invalid room');

      const access = await resolveAccess(identity, parsed.data.conversationId);
      if (!access) return fail(socket, ErrorCode.NOT_FOUND, 'Conversation not found');

      await joinConversation(io, socket, access);
    }),
  );

  socket.on(
    ClientEvent.LEAVE,
    guard(socket, ClientEvent.LEAVE, async (raw) => {
      const parsed = conversationPayload.safeParse(raw);
      if (!parsed.success) return;

      await socket.leave(conversationRoom(parsed.data.conversationId));
      await socket.leave(conversationStaffRoom(parsed.data.conversationId));
    }),
  );

  socket.on(
    ClientEvent.SEND,
    guard(socket, ClientEvent.SEND, async (raw) => {
      if (!messageBurst.allow()) {
        return fail(
          socket,
          ErrorCode.RATE_LIMITED,
          `Too many messages — try again in ${messageBurst.retryAfterSeconds()}s`,
        );
      }

      const parsed = sendPayload.safeParse(raw);
      if (!parsed.success) {
        return fail(socket, ErrorCode.VALIDATION_FAILED, 'Invalid message');
      }

      // A guest's thread comes from their token; anything they name is ignored.
      const conversationId =
        identity.kind === 'guest'
          ? identity.guest.conversationId
          : parsed.data.conversationId;

      if (!conversationId) {
        return fail(socket, ErrorCode.VALIDATION_FAILED, 'Conversation is required');
      }

      // Resolved before the database is touched, so a caller over budget costs a
      // single Redis round trip rather than an access check and a write.
      const quota = await checkMessageQuota(socket, identity, conversationId);
      if (!quota.allowed) {
        return fail(
          socket,
          ErrorCode.RATE_LIMITED,
          `Too many messages — try again in ${quota.retryAfterSeconds}s`,
        );
      }

      await handleSend(io, socket, identity, conversationId, parsed.data);
    }),
  );

  socket.on(
    ClientEvent.TYPING,
    guard(socket, ClientEvent.TYPING, async (raw) => {
      if (!typingBurst.allow()) return;

      const parsed = typingPayload.safeParse(raw);
      if (!parsed.success) return;

      const conversationId =
        identity.kind === 'guest'
          ? identity.guest.conversationId
          : parsed.data.conversationId;

      if (!conversationId) return;

      // Dropped silently: an indicator the sender never sees is not worth an
      // error bubble, and a client that is over budget is already throttling.
      const quota = await checkTypingQuota(identity, conversationId);
      if (!quota.allowed) return;

      const access = await resolveAccess(identity, conversationId);
      if (!access) return;

      /*
       * Typing is ephemeral and never persisted (AGENTS.md). It is also the one
       * event broadcast to the room excluding the sender — nobody needs to be
       * told that they themselves are typing.
       */
      socket.to(conversationRoom(conversationId)).emit(ServerEvent.TYPING, {
        conversationId,
        typing: parsed.data.typing,
        from: access.as,
        name: displayName(identity),
      });
    }),
  );

  socket.on(
    ClientEvent.READ,
    guard(socket, ClientEvent.READ, async (raw) => {
      const parsed = conversationPayload.safeParse(raw);
      if (!parsed.success) return;

      const access = await resolveAccess(identity, parsed.data.conversationId);
      if (!access) return;

      await handleRead(io, identity, access);
    }),
  );

  socket.on(
    ClientEvent.AVAILABILITY,
    guard(socket, ClientEvent.AVAILABILITY, async (raw) => {
      if (identity.kind !== 'user' || !isStaff(identity.auth)) {
        return fail(socket, ErrorCode.UNAUTHORIZED, 'Insufficient permissions');
      }

      const parsed = availabilityPayload.safeParse(raw);
      if (!parsed.success) return;

      const availability = parsed.data.available
        ? StaffAvailability.ONLINE
        : StaffAvailability.AWAY;

      // Persisted, not just held in memory: the switch is a preference, so it has
      // to survive the agent closing their laptop.
      await prisma.staffProfile.updateMany({
        where: { userId: identity.auth.userId, deletedAt: null },
        data: { availability },
      });

      presence.setStaffAvailability(identity.auth.userId, availability);
      broadcastAvailability(io);
    }),
  );

  socket.on('disconnect', () => {
    void onDisconnect(io, identity);
  });
}

function displayName(identity: SocketIdentity): string {
  return identity.kind === 'guest' ? identity.guest.name : 'Marty Global team';
}

async function onConnect(
  io: Server,
  socket: Socket,
  identity: SocketIdentity,
): Promise<void> {
  if (identity.kind === 'guest') {
    presence.addGuest(identity.guest.conversationId);

    const access = await resolveAccess(identity, identity.guest.conversationId);
    if (access) await joinConversation(io, socket, access);
    return;
  }

  const { auth } = identity;
  presence.addUser(auth.userId);

  // Their own room, so unread counters reach every tab.
  await socket.join(userRoom(auth.userId));

  if (isStaff(auth)) {
    await socket.join(STAFF_ROOM);

    /*
     * Supervisors — whoever reads the whole queue — get the room that carries
     * every conversation change. An ordinary agent does not: they are told about
     * their own threads through their user room, and telling them about a
     * colleague's would leak a conversation the list endpoint would never show
     * them.
     */
    if (await canSeeAll(auth, 'support')) {
      await socket.join(SUPPORT_ALL_ROOM);
    }

    // The same rule for order threads, asked through the ORDERS scope — which is
    // the predicate the "My conversations" list itself uses, so the two agree on
    // who is a supervisor of that queue.
    if (await canSeeAll(auth, 'orders')) {
      await socket.join(ORDERS_ALL_ROOM);
    }

    await presence.loadStaffAvailability(auth.userId);
    broadcastAvailability(io);
    // An agent joins threads on demand — the inbox is too large to auto-join, and
    // a new chat routed to them arrives as a `conversation:updated` event.
    return;
  }

  /*
   * A customer is auto-joined to their open threads, so a reply reaches them
   * anywhere in the portal — the floating widget is not on the Messages screen,
   * and a notification that only arrived when you were already looking at the
   * conversation would be pointless.
   */
  for (const conversationId of await customerConversationIds(auth.userId)) {
    await socket.join(conversationRoom(conversationId));
  }

  socket.emit(ServerEvent.AVAILABILITY, {
    agentsAvailable: presence.availableAgentCount(),
  });
  await pushUnread(auth.userId);
}

async function onDisconnect(io: Server, identity: SocketIdentity): Promise<void> {
  if (identity.kind === 'guest') {
    if (presence.removeGuest(identity.guest.conversationId)) {
      io.to(conversationRoom(identity.guest.conversationId)).emit(
        ServerEvent.PRESENCE,
        { conversationId: identity.guest.conversationId, customerOnline: false },
      );
    }
    return;
  }

  const wentOffline = presence.removeUser(identity.auth.userId);

  // Only the last tab closing is a change worth announcing.
  if (wentOffline && isStaff(identity.auth)) broadcastAvailability(io);
}

async function joinConversation(
  io: Server,
  socket: Socket,
  access: ConversationAccess,
): Promise<void> {
  await socket.join(conversationRoom(access.conversationId));

  // Staff get the second room, which is what makes internal notes reach them and
  // only them.
  if (access.as === 'staff') {
    await socket.join(conversationStaffRoom(access.conversationId));
  }

  emitPresence(io, access);
}

// --- Send ------------------------------------------------------------------
async function handleSend(
  io: Server,
  socket: Socket,
  identity: SocketIdentity,
  // Resolved by the caller, which needs it to key the rate-limit quota. A guest's
  // thread comes from their token; anything they name is ignored.
  conversationId: string,
  payload: {
    conversationId?: string;
    body: string;
    clientId?: string;
    kind?: 'reply' | 'note';
    attachments?: {
      objectKey: string;
      name: string;
      sizeBytes: number;
      contentType?: string;
    }[];
  },
): Promise<void> {
  const access = await resolveAccess(identity, conversationId);
  if (!access) return fail(socket, ErrorCode.NOT_FOUND, 'Conversation not found');

  /*
   * Persist through the service, then emit. The service is the one layer that
   * touches Prisma and the one place the guards live, so a message sent over a
   * socket is subject to exactly the checks a message sent over REST is.
   */
  if (identity.kind === 'guest') {
    const message = await guestChat.sendMessage(identity.guest, {
      body: payload.body,
    });

    deliver(io, {
      id: message.id,
      conversationId,
      author: 'customer',
      authorUserId: null,
      authorName: identity.guest.name,
      body: message.body,
      sentAt: message.sentAt,
      clientId: payload.clientId,
    });

    // The inbox list is refreshed by the service, which emits it for both
    // transports (modules/guest/guest.service.ts).
    return;
  }

  const { auth } = identity;

  if (access.as === 'staff') {
    const isNote = payload.kind === 'note';

    const message = await adminSupport.sendMessage(auth, conversationId, {
      body: payload.body,
      kind: isNote ? 'note' : 'reply',
    });

    deliver(io, {
      id: message.id,
      conversationId,
      author: isNote ? 'internal_note' : 'agent',
      authorUserId: auth.userId,
      authorName: message.authorName,
      body: message.body,
      sentAt: message.sentAt,
      clientId: payload.clientId,
    });

    // A reply is what the customer's unread badge counts; a note is not.
    if (!isNote && access.customerId) await pushUnread(access.customerId);
    return;
  }

  const message = await support.sendMessage(auth, conversationId, {
    body: payload.body,
    attachments: payload.attachments,
  });

  deliver(io, {
    id: message.id,
    conversationId,
    author: 'customer',
    authorUserId: auth.userId,
    authorName: message.senderName ?? null,
    body: message.body,
    sentAt: message.sentAt,
    clientId: payload.clientId,
    attachments: message.attachments,
  });
}

// --- Read ------------------------------------------------------------------
async function handleRead(
  io: Server,
  identity: SocketIdentity,
  access: ConversationAccess,
): Promise<void> {
  /*
   * A guest's read is tracked on the same `customerReadAt` marker a customer's
   * is — it is the same side of the conversation, and the agent's "Seen" tick
   * asks one question regardless of who is on the other end.
   */
  if (identity.kind === 'guest') {
    await prisma.conversation.updateMany({
      where: { id: access.conversationId, guestId: identity.guest.id },
      data: { customerReadAt: new Date() },
    });

    io.to(conversationRoom(access.conversationId)).emit(ServerEvent.READ, {
      conversationId: access.conversationId,
      by: 'customer',
      readAt: new Date().toISOString(),
    });
    return;
  }

  const { auth } = identity;

  const result =
    access.as === 'staff'
      ? await adminSupport.markStaffRead(auth, access.conversationId)
      : await support.markCustomerRead(auth, access.conversationId);

  io.to(conversationRoom(access.conversationId)).emit(ServerEvent.READ, {
    conversationId: access.conversationId,
    by: access.as === 'staff' ? 'staff' : 'customer',
    readAt: result.readAt,
  });

  if (access.as !== 'staff') await pushUnread(auth.userId);
}
