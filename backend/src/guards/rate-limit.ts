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

/*
 * The per-IP bucket key. `ipKeyGenerator` normalises IPv6 to a /64 so a single
 * host can't cycle addresses to reset its own limit.
 *
 * `req.ip` is undefined whenever Express cannot resolve one — a misconfigured
 * `trust proxy`, or a socket already destroyed by the time the limiter runs.
 * Passing '' straight through would hash every such caller to the SAME bucket,
 * so fall back to the raw socket address first and only then to an explicit
 * shared bucket for callers we genuinely cannot identify.
 */
function ipKey(req: Request): string {
  const address = req.ip ?? req.socket.remoteAddress;
  return address ? ipKeyGenerator(address) : 'unresolved-ip';
}

// Signed-in callers are limited per user; anonymous ones per IP. Without this a
// whole office behind one NAT shares a single bucket.
function keyGenerator(req: Request): string {
  return req.auth ? `user:${req.auth.userId}` : `ip:${ipKey(req)}`;
}

// `name` namespaces the limiter's counters in Redis. Each limiter gets its own
// prefix so the buckets stay separate — sharing one would mean a caller who had
// spent their upload budget arrived at the payments endpoint already limited,
// since both key on the same `user:<id>`.
function make(
  name: string,
  windowMs: number,
  limit: number,
  key: (req: Request) => string = keyGenerator,
) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator: key,
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

/*
 * The outermost limiter on /v1, mounted ahead of the default-deny guard in
 * routes.ts. Every other limiter in this file runs AFTER the session has been
 * resolved, which leaves the resolution itself — a Better Auth session lookup,
 * i.e. a database round trip — reachable without any limit at all. An
 * unauthenticated caller can therefore make the API do real work on every
 * request while never getting past 401, which is the denial-of-service the
 * per-route limiters cannot see.
 *
 * Keyed per IP, not per user, because there is no user yet: the whole point is
 * to run before the lookup. That makes it a blunt instrument shared by everyone
 * behind one NAT, so the ceiling is deliberately high — this bounds abuse, it
 * does not police normal use. The SPA fires on the order of 20-30 calls per page
 * load, so 600/min leaves an office of ~20 people comfortable while capping a
 * single address at ten session lookups a second.
 */
export const gatewayRateLimit = make('gateway', 60 * 1000, 600, ipKey);

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
