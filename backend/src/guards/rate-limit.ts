import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';
import { ErrorCode } from '../lib/error-codes.js';
import { createRateLimitStore, storeFailureOptions } from './rate-limit-store.js';

// One place that knows the rate-limit response shape, so a 429 matches the
// error envelope in AGENTS.md "API Conventions" like every other failure.
const message = {
  error: {
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests, try again later',
  },
};

// Signed-in callers are limited per user; anonymous ones per IP. Without this a
// whole office behind one NAT shares a single bucket. ipKeyGenerator normalises
// IPv6 to a /64 so a single host can't cycle addresses to reset its own limit.
function keyGenerator(req: Request): string {
  return req.auth ? `user:${req.auth.userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

// `name` namespaces the limiter's counters in Redis. Each limiter gets its own
// prefix so the buckets stay separate — sharing one would mean a caller who had
// spent their upload budget arrived at the payments endpoint already limited,
// since both key on the same `user:<id>`.
function make(name: string, windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    // Counters live in Redis, not in this process (guards/rate-limit-store.ts).
    store: createRateLimitStore(name),
    ...storeFailureOptions,
    // Local dev and tests would otherwise trip the limiter constantly.
    skip: () => env.NODE_ENV === 'test',
  });
}

// Public, unauthenticated surface — contact form, anything a bot can reach.
export const publicRateLimit = make('public', 15 * 60 * 1000, 10);

// Better Auth's own endpoints are limited per-route in auth-rate-limit.ts, not
// from this file — credential attempts and session reads need different budgets.

// General authenticated API traffic — generous, it only catches runaway clients.
export const apiRateLimit = make('api', 60 * 1000, 120);

// Money movement and other expensive writes.
export const sensitiveRateLimit = make('sensitive', 60 * 1000, 10);

/*
 * Minting presigned uploads. Separate from `sensitiveRateLimit` because it is
 * counted per FILE, not per user action: one presign is minted for each file in
 * a batch, and the batches are large by design — a mail-room operator files a
 * scan of up to 50 pages in one submit, and an order can carry 30 documents.
 *
 * At 10/min those flows failed on the eleventh file, and since a batch aborts on
 * the first failure the customer lost the whole submission along with the
 * objects already in the bucket. The ceiling is two full batches a minute, which
 * covers the largest legitimate submit plus one retry.
 */
export const uploadRateLimit = make('upload', 60 * 1000, 100);

// Inbound socket messages and other per-actor bursts.
export const chatRateLimit = make('chat', 60 * 1000, 60);
