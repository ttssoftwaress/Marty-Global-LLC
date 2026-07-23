import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';
import { ErrorCode } from '../lib/error-codes.js';

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

function make(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    // Local dev and tests would otherwise trip the limiter constantly.
    skip: () => env.NODE_ENV === 'test',
  });
}

// Public, unauthenticated surface — contact form, anything a bot can reach.
export const publicRateLimit = make(15 * 60 * 1000, 10);

// Better Auth's own endpoints are limited per-route in auth-rate-limit.ts, not
// from this file — credential attempts and session reads need different budgets.

// General authenticated API traffic — generous, it only catches runaway clients.
export const apiRateLimit = make(60 * 1000, 120);

// Money movement and other expensive writes.
export const sensitiveRateLimit = make(60 * 1000, 10);

// Inbound socket messages and other per-actor bursts.
export const chatRateLimit = make(60 * 1000, 60);
