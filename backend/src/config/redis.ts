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
