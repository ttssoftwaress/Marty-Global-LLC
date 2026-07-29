import { redis } from '../../config/redis.js';
import { closeQueues } from '../../jobs/queues.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { ensureAdminAccount } from './admin-bootstrap.service.js';

// `npm run admin:setup` — the same reconciliation the server runs on boot, as a
// one-off. Useful for provisioning or rotating the admin password against a
// database without starting the API.
try {
  const outcome = await ensureAdminAccount();
  logger.info({ outcome }, 'Admin bootstrap finished');
  if (outcome === 'skipped') {
    logger.warn('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then re-run.');
  }
} catch (err) {
  logger.error({ err }, 'Admin bootstrap failed');
  process.exitCode = 1;
} finally {
  // config/auth.ts reaches the notifications service, which pulls in the BullMQ
  // queue — its Redis connection is opened at import time and would keep this
  // one-off script alive forever. Release every handle we transitively opened.
  await closeQueues();
  redis.disconnect();
  await prisma.$disconnect();
}
