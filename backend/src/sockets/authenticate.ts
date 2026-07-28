import type { Socket } from 'socket.io';

import { authenticateSocket } from '../guards/socket-auth.js';
import { logger } from '../lib/logger.js';
import { resolveGuest } from '../modules/guest/guest.service.js';
import type { SocketIdentity } from './access.js';

declare module 'socket.io' {
  interface Socket {
    identity?: SocketIdentity;
  }
}

/*
 * Two ways onto this server, and no third.
 *
 * A signed-in customer or agent authenticates with the same Better Auth session
 * as the REST API (guards/socket-auth.ts) — the handshake carries the cookie, so
 * it is the identical session lookup. A website visitor presents the bearer
 * token their chat was issued.
 *
 * Anything else is refused. There is no anonymous connection: even the guest
 * path requires a token that only `POST /v1/guest-chat/sessions` mints, behind
 * Turnstile and the public rate limiter.
 *
 * The guest token is read from the handshake's `auth` payload rather than a
 * header, because that is the one channel Socket.io gives a client that survives
 * an automatic reconnect — a token in a header would be lost the moment the
 * connection dropped, which is exactly when it is needed.
 */

export async function authenticate(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const handshakeAuth = socket.handshake.auth as { guestToken?: unknown };
  const guestToken =
    typeof handshakeAuth.guestToken === 'string' ? handshakeAuth.guestToken : undefined;

  if (guestToken) {
    try {
      const guest = await resolveGuest(guestToken);

      if (!guest) {
        // Expired, purged, or never valid — one answer for all three, so a token
        // guesser learns nothing from which failure they got.
        next(new Error('Unauthorized'));
        return;
      }

      socket.identity = { kind: 'guest', guest };
      next();
      return;
    } catch (err) {
      logger.warn({ err }, 'Guest socket authentication failed');
      next(new Error('Unauthorized'));
      return;
    }
  }

  // Falls through to the session path, which sets `socket.auth` or rejects.
  await authenticateSocket(socket, (err?: Error) => {
    if (err) {
      next(err);
      return;
    }

    if (!socket.auth) {
      next(new Error('Unauthorized'));
      return;
    }

    socket.identity = { kind: 'user', auth: socket.auth };
    next();
  });
}
