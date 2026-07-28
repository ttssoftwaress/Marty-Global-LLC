import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { scheduleGuestChatPurge } from './jobs/queues.js';
import { closeWorkers, registerWorkers } from './jobs/workers.js';
import { logger } from './lib/logger.js';
import { ensureAdminAccount } from './modules/auth/admin-bootstrap.service.js';
import { createSocketServer } from './sockets/index.js';

const server = createServer(createApp());

// Live chat shares the HTTP server with the API — one process, one port
// (AGENTS.md, Live Chat).
const io = createSocketServer(server);

// One process: API + job workers (AGENTS.md "Backend").
registerWorkers();

// Reconcile the env-defined admin account before we accept traffic. It is
// idempotent, so this runs on every boot. A failure here means nobody can reach
// /admin/*, which is a misconfiguration worth refusing to start over.
try {
  await ensureAdminAccount();
} catch (err) {
  logger.fatal({ err }, 'Admin account bootstrap failed');
  process.exit(1);
}

/*
 * Anonymous chats are deleted once they go quiet. Registered on every boot —
 * BullMQ keys a repeatable job by name + pattern, so this re-registers the same
 * schedule rather than stacking a second one. A failure to schedule it must not
 * stop the app: the sweep is housekeeping, and the next boot will try again.
 */
scheduleGuestChatPurge(env.GUEST_CHAT_PURGE_INTERVAL_SECONDS).catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule the guest chat purge');
});

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);

  // Close the sockets first: an open connection would otherwise hold the HTTP
  // server open past its close callback and the process would linger.
  void io.close(() => {
    server.close(() => {
      // Let in-flight jobs finish before the connections drop.
      void closeWorkers().finally(() => process.exit(0));
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
