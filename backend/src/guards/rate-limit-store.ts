import type { Options, Store } from 'express-rate-limit';
import RedisStore, { type RedisReply } from 'rate-limit-redis';

import { env } from '../config/env.js';
import { rateLimitRedis } from '../config/redis.js';
import { logger } from '../lib/logger.js';

/*
 * Where rate-limit counters live.
 *
 * express-rate-limit's default store is a Map in the process. That is wrong for
 * this deployment in two compounding ways: counters reset on every restart, so a
 * deploy hands every caller a fresh budget; and each container keeps its own
 * Map, so N containers behind the proxy multiply every limit by N. The
 * credential limiter in auth-rate-limit.ts is the one that matters — "10 sign-in
 * attempts per 15 minutes" quietly becomes 10 per container per deploy, which is
 * not a brute-force defence.
 *
 * Redis is already in the stack for BullMQ, so the counters move there and every
 * limit means what it says regardless of how many processes are running.
 */

/**
 * Builds the store for one limiter.
 *
 * Every limiter needs its OWN store instance with its own prefix. Sharing one
 * would merge unrelated buckets: a caller who had spent their upload budget
 * would arrive at the payments endpoint already limited, because both would be
 * incrementing the same `user:<id>` key.
 *
 * Returns undefined under test so express-rate-limit falls back to its in-memory
 * store — the suite has no Redis, and the limiters skip there anyway.
 */
export function createRateLimitStore(prefix: string): Store | undefined {
  if (env.NODE_ENV === 'test') return undefined;

  return new RedisStore({
    /*
     * rate-limit-redis is client-agnostic and sends raw commands through this
     * hook: EVALSHA for the increment script, plus the odd SCRIPT LOAD / DECR /
     * DEL. ioredis types `call` as returning `unknown` because a raw command's
     * shape depends on the command, so the cast is asserting what the store
     * already documents it accepts (number | string | boolean, or an array).
     */
    sendCommand: (command: string, ...args: string[]) =>
      rateLimitRedis.call(command, args) as Promise<RedisReply>,
    prefix: `rl:${prefix}:`,
  });
}

/*
 * Shared limiter options: fail OPEN, and say so.
 *
 * A limiter is a guard, not a dependency. If Redis is unreachable the choice is
 * to reject everything — a Redis outage becomes a total API outage — or to stop
 * counting and let traffic through. Letting it through is the lesser failure:
 * the exposure is bounded by however long Redis is down, and every other guard
 * (auth, roles, ownership) is still enforcing, with Turnstile still in front of
 * the public forms.
 *
 * `passOnStoreError` is the library's own switch for this, so a store rejection
 * never reaches the error middleware and turns a Redis blip into a 500 on an
 * endpoint that was otherwise fine. Routing its logger into pino keeps the
 * degradation loud — the protection silently disappearing is the real danger
 * here — and keeps it out of console, which AGENTS.md forbids in committed code.
 */
export const storeFailureOptions = {
  passOnStoreError: true,
  logger: {
    error: (error: unknown, message?: string) =>
      logger.error({ err: error }, message ?? 'Rate limit store error'),
    warn: (error: unknown, message?: string) =>
      logger.warn({ err: error }, message ?? 'Rate limit store warning'),
  },
} satisfies Partial<Options>;
