import type { Socket } from 'socket.io';

import { auth } from '../config/auth.js';
import { logger } from '../lib/logger.js';
import { Role, isRole } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';

declare module 'socket.io' {
  interface Socket {
    auth?: AuthContext;
  }
}

// Socket.io middleware rejects a connection by calling next(err); the client
// receives err.message, so it must stay generic — no session detail leaks.
function reject(message = 'Unauthorized') {
  return new Error(message);
}

// AGENTS.md "Live Chat": every socket authenticates with the same Better Auth
// session as the REST API. The handshake carries the browser's cookies, so the
// same session lookup works — we just feed it the handshake headers.
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const headers = new Headers();
    const cookie = socket.handshake.headers.cookie;
    if (cookie) headers.set('cookie', cookie);

    const result = await auth.api.getSession({ headers });
    if (!result) {
      next(reject());
      return;
    }

    const { user, session } = result;

    if (user.banned && (!user.banExpires || user.banExpires > new Date())) {
      next(reject());
      return;
    }

    socket.auth = {
      userId: user.id,
      role: isRole(user.role) ? user.role : Role.CUSTOMER,
      sessionId: session.id,
      email: user.email,
      emailVerified: user.emailVerified,
    };

    next();
  } catch (err) {
    // Never log message content or session tokens — ids only (AGENTS.md "PII").
    logger.warn({ err }, 'Socket authentication failed');
    next(reject());
  }
}

// Role check for socket event handlers, mirroring requireRole on the REST side.
export function socketHasRole(
  socket: Socket,
  ...allowed: readonly Role[]
): boolean {
  return socket.auth !== undefined && allowed.includes(socket.auth.role);
}
