import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { authenticate } from './authenticate.js';
import { registerChatHandlers } from './chat.handlers.js';

/*
 * The Socket.io server, attached to the same HTTP server as the API.
 *
 * One process runs the API, the job workers, and the sockets (AGENTS.md,
 * Backend). Spreading sockets across processes would require the Socket.io Redis
 * adapter — which the budget rule says to ask before adding — so the presence
 * map and the room membership here are correct precisely as long as this stays
 * a single process.
 */

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    // Exactly the frontend origin, from env — the same rule as the REST CORS
    // policy, and credentials because the handshake carries the session cookie.
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
    /*
     * Polling first, then upgrade. The marketing widget runs for visitors on
     * networks that block WebSocket, and a chat that silently fails to connect
     * for a fraction of them is worse than one extra round trip for everyone.
     */
    transports: ['polling', 'websocket'],
    // A message is small; anything approaching this is not one. Bounded here as
    // well as in the schemas, so an oversized frame is dropped before it is
    // parsed rather than after.
    maxHttpBufferSize: 256 * 1024,
    // Slightly above the client's default heartbeat, so a brief stall does not
    // read as a disconnect and churn presence.
    pingTimeout: 25_000,
  });

  // Authentication runs before any handler is registered: an unauthenticated
  // socket never reaches an event listener at all.
  io.use((socket, next) => {
    void authenticate(socket, next);
  });

  io.on('connection', (socket) => {
    // Ids only — never the session token, never a message body (AGENTS.md, PII).
    logger.debug(
      { socketId: socket.id, kind: socket.identity?.kind },
      'Socket connected',
    );

    registerChatHandlers(io, socket);
  });

  return io;
}
