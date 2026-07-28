import { Redis } from 'ioredis';

import { logger } from '../lib/logger.js';
import { env } from './env.js';

// BullMQ blocks on Redis (BRPOPLPUSH) and re-issues its own commands after a
// reconnect, so the connection must never cap retries or queue commands while
// offline — both defaults would make workers throw instead of resume.
const connectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
} as const;

export function createRedisConnection(name: string): Redis {
  const connection = new Redis(env.REDIS_URL, {
    ...connectionOptions,
    connectionName: name,
  });

  connection.on('error', (error: Error) => {
    logger.error({ err: error, connection: name }, 'Redis connection error');
  });

  return connection;
}

// Producers (the API) share one connection; every worker gets its own, because
// a blocking read would otherwise starve the enqueue path.
export const redis = createRedisConnection('marty-producer');

/*
 * The rate limiter's connection, deliberately NOT the producer above.
 *
 * The options that make the BullMQ connection correct make it wrong here.
 * `maxRetriesPerRequest: null` retries a command forever — what a worker
 * resuming a blocking read wants, and what must never happen in front of a
 * request. A limiter check sits ahead of every route, so an unbounded wait would
 * stop being a rate-limiting problem and become an availability one: requests
 * hanging until the client gives up.
 *
 * `commandTimeout` is what actually bounds that, not `enableOfflineQueue`.
 * Disabling the offline queue looks like the fail-fast option and is a trap: it
 * also rejects the commands issued during the initial connect, before the socket
 * is up, so the first requests after every boot are unlimited and each reconnect
 * silently drops the protection for its duration. Keeping the queue lets those
 * few milliseconds resolve normally; the timeout still caps a real outage at one
 * second per command, after which the store fails open (guards/
 * rate-limit-store.ts).
 */
export const rateLimitRedis = new Redis(env.REDIS_URL, {
  connectionName: 'marty-rate-limit',
  maxRetriesPerRequest: 2,
  commandTimeout: 1000,
});

rateLimitRedis.on('error', (error: Error) => {
  logger.error({ err: error, connection: 'marty-rate-limit' }, 'Redis connection error');
});
