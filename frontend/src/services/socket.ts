import { io, type Socket } from 'socket.io-client';

/*
 * The live-chat socket client, shared by the portal, the admin inbox, and the
 * marketing widget (AGENTS.md, Live Chat).
 *
 * One connection per tab, not one per screen. A customer can have the Support
 * page and the floating widget mounted at once, and an agent can have the inbox
 * open beside a thread — each of those is a subscriber to the same socket, so
 * this module hands out a shared instance and reference-counts it.
 *
 * The connection carries no credentials of its own: a signed-in user is
 * authenticated by the session cookie the handshake sends (`withCredentials`),
 * exactly as the REST client does. A website visitor passes the chat token their
 * widget was issued, which is the only thing that ever travels in `auth`.
 */

const API_URL = import.meta.env.VITE_API_URL as string;

// The socket attaches to the API's own origin, so the /v1 path prefix the REST
// client uses has to come off.
const SOCKET_URL = API_URL.replace(/\/v1\/?$/, '');

export type SocketMessage = {
  id: string;
  conversationId: string;
  author: 'customer' | 'agent' | 'internal_note';
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  sentAt: string;
  // Echoed back from the send, so the sender can reconcile the server's copy
  // with the bubble it drew optimistically instead of rendering both.
  clientId?: string;
  attachments?: { id: string; name: string; size: number; href?: string }[];
};

export type SocketReadReceipt = {
  conversationId: string;
  by: 'customer' | 'staff';
  readAt: string;
};

export type SocketTyping = {
  conversationId: string;
  typing: boolean;
  from: 'customer' | 'staff' | 'guest';
  name: string;
};

export type SocketPresence = {
  conversationId: string;
  customerOnline: boolean;
  agentsAvailable?: number;
};

export type SocketAvailability = { agentsAvailable: number };

/*
 * A conversation appeared, moved between agents, or changed state.
 *
 * Ids only, by design: the receiver re-reads the inbox through the API, which
 * applies the same scope the socket does — so this event can never be a way
 * around it, and no message body or customer name ever rides on a broadcast
 * (AGENTS.md, PII). It reaches the assigned agent, whoever it was just taken
 * from, and the supervisors — nobody else is told the thread exists.
 */
export type SocketConversationChanged = {
  conversationId: string;
  assigneeId: string | null;
};

// The signed-in user's own counters. The staff-side `unassigned` figure this
// once carried is gone: the inbox counts now ride on the list response, which is
// the only thing that can scope them to the reader (backend/sockets/events.ts).
export type SocketUnread = {
  messages?: number;
  notifications?: number;
};

export type SocketError = { error: { code: string; message: string } };

// Mirrors backend/src/sockets/events.ts. Kept as a local copy per the two-apps
// rule — the backend is the source of truth and both are updated together.
export const SocketEvent = {
  JOIN: 'conversation:join',
  LEAVE: 'conversation:leave',
  SEND: 'message:send',
  READ: 'conversation:read',
  TYPING: 'conversation:typing',
  AVAILABILITY: 'agent:availability',

  MESSAGE: 'message:new',
  CONVERSATION: 'conversation:updated',
  PRESENCE: 'conversation:presence',
  SUPPORT_AVAILABILITY: 'support:availability',
  UNREAD: 'support:unread',
  ERROR: 'support:error',
} as const;

let socket: Socket | null = null;
let subscribers = 0;
// Held so a reconnect re-authenticates as the same visitor. A signed-in user
// needs no equivalent — their cookie rides along automatically.
let guestToken: string | null = null;

function create(): Socket {
  return io(SOCKET_URL, {
    withCredentials: true,
    // Matches the server: try polling first so visitors behind proxies that
    // block WebSocket still connect, then upgrade.
    transports: ['polling', 'websocket'],
    auth: guestToken ? { guestToken } : {},
    /*
     * Reconnect indefinitely with a backoff. A chat that gives up after a
     * handful of tries is worse than useless — the user sees a composer that
     * looks live and silently is not — and the server's history is authoritative,
     * so a late reconnect always catches up.
     */
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
  });
}

/*
 * Take a reference to the shared socket, connecting it if this is the first.
 *
 * The returned function releases it; the connection closes when the last
 * subscriber lets go. Callers should treat this as an effect's setup/cleanup
 * pair — anything else leaks a connection per mount.
 */
export function acquireSocket(): { socket: Socket; release: () => void } {
  socket ??= create();
  subscribers += 1;

  const current = socket;
  let released = false;

  return {
    socket: current,
    release() {
      // Guard against a double release (React 18 runs effects twice in dev),
      // which would otherwise drop the count below zero and close a socket other
      // screens are still using.
      if (released) return;
      released = true;

      subscribers -= 1;
      if (subscribers <= 0) {
        subscribers = 0;
        current.close();
        if (socket === current) socket = null;
      }
    },
  };
}

/*
 * Identify this browser as a returning website visitor.
 *
 * Called before the marketing widget connects. If a socket already exists it is
 * torn down and rebuilt: the token is read at handshake time, so an established
 * connection cannot adopt one.
 */
export function setGuestToken(token: string | null): void {
  if (guestToken === token) return;

  guestToken = token;

  if (socket) {
    socket.close();
    socket = null;
    // A live subscriber will reconnect on its next acquire; there is no way to
    // re-handshake in place, and this only happens once per visitor.
  }
}

// Signing out must not leave an authenticated socket open behind the login
// screen. Called by the auth client's sign-out path.
export function closeSocket(): void {
  subscribers = 0;
  guestToken = null;
  socket?.close();
  socket = null;
}
