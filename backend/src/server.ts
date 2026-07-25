import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeWorkers, registerWorkers } from './jobs/workers.js';
import { logger } from './lib/logger.js';
import { ensureAdminAccount } from './modules/auth/admin-bootstrap.service.js';

const server = createServer(createApp());

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

server.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    // Let in-flight jobs finish before the connections drop.
    void closeWorkers().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
