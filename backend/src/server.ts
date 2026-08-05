// Must stay the FIRST import: it initialises Sentry before Express, http, and
// Postgres are loaded, which is the only point at which they can be
// instrumented. See instrument.ts.
import './instrument.js';

import { createServer } from 'node:http';

import * as Sentry from '@sentry/node';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { scheduleGuestChatPurge, scheduleTrashPurge } from './jobs/queues.js';
import { closeWorkers, registerWorkers } from './jobs/workers.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { ensureSystemStaffRoles } from './lib/staff-roles.js';
import { ensureAdminAccount } from './modules/auth/admin-bootstrap.service.js';
import { createSocketServer } from './sockets/index.js';

const server = createServer(createApp());

// Live chat shares the HTTP server with the API — one process, one port
// (AGENTS.md, Live Chat).
const io = createSocketServer(server);

// One process: API + job workers (AGENTS.md "Backend").
registerWorkers();

/*
 * Reconcile the job-role catalogue and the env-defined admin account before we
 * accept traffic. Both are idempotent, so this runs on every boot, and the roles
 * go first: the admin account's StaffProfile points at `super-admin` by foreign
 * key, so the row has to exist before it can be provisioned.
 *
 * A failure here means nobody can reach /admin/*, which is a misconfiguration
 * worth refusing to start over.
 */
try {
  await ensureSystemStaffRoles(prisma);
  await ensureAdminAccount();
} catch (err) {
  logger.fatal({ err }, 'Admin account bootstrap failed');
  // A boot failure is the one error nobody is watching a dashboard for, so it
  // is reported and flushed before the process leaves — exiting first would
  // discard the still-buffered event.
  Sentry.captureException(err);
  await Sentry.flush(2000).catch(() => undefined);
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

/*
 * Trashed records are hard-deleted once their retention window closes. Same
 * shape as the sweep above, and daily rather than configurable: the window
 * itself is the admin setting (`TrashSettings.retentionDays`), and how often we
 * check a deadline measured in days is not a decision anybody needs to make.
 *
 * A failure to schedule must not stop the app — nothing is destroyed by the
 * sweep not running, which is the safe direction for this particular job to fail
 * in.
 */
const ONE_DAY_SECONDS = 24 * 60 * 60;

scheduleTrashPurge(ONE_DAY_SECONDS).catch((err: unknown) => {
  logger.error({ err }, 'Failed to schedule the trash purge');
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
      // Let in-flight jobs finish before the connections drop, then give Sentry
      // a bounded window to deliver whatever is still queued. On a SIGTERM from
      // the VPS/Docker the events that explain the restart are usually the most
      // recent ones, and an unflushed transport drops them.
      void closeWorkers()
        .finally(() => Sentry.flush(2000).catch(() => undefined))
        .finally(() => process.exit(0));
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
