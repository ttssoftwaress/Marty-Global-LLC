import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { env } from '../config/env.js';
import { ErrorCode } from '../lib/error-codes.js';

// Rate limiting for the Better Auth subtree (AGENTS.md "Auth" / "API
// Conventions"). Better Auth owns every route under /api/auth/*, and those
// routes are not all equal: /sign-in/email is the brute-force surface, while
// /get-session is a cheap read the SPA fires on every page load. One blanket
// bucket has to serve both, so it is either too loose to stop credential
// stuffing or so tight that normal browsing locks a user out of signing in.
// This splits the subtree into tiers and dispatches on the request path.

const message = {
  error: {
    code: ErrorCode.RATE_LIMITED,
    message: 'Too many requests, try again later',
  },
};

function ipKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? '');
}

function make(windowMs: number, limit: number, keyGenerator = ipKey) {
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

// Credential attempts: sign-in, sign-up, password reset, OTP verification.
// Tight, and counted even on success — a valid password does not buy a caller
// more attempts, so a working account cannot be used as a free oracle.
const credentialsLimiter = make(15 * 60 * 1000, 10);

// A second, slower bucket over the same endpoints. The 15-minute window above
// stops a burst; this one stops a patient attacker who paces just under it.
const credentialsDailyLimiter = make(60 * 60 * 1000, 40);

// Anything that sends mail or SMS — verification links, reset links, magic
// links. Costs us money per call and spams the recipient's inbox, so it is the
// tightest tier and keyed per IP.
const dispatchLimiter = make(60 * 60 * 1000, 5);

// Session reads. Cheap, and the SPA calls /get-session on every page load and
// every tab focus, so this is generous — it exists to catch a runaway client,
// not to police normal use.
const sessionLimiter = make(60 * 1000, 60);

// Everything else Better Auth exposes: sign-out, account listing, token
// refresh, the admin plugin's routes.
const defaultLimiter = make(15 * 60 * 1000, 60);

// Matched against the path *below* /api/auth. Prefixes, because Better Auth
// nests (/sign-in/email, /sign-up/email) and plugins add their own suffixes.
const CREDENTIAL_PATHS = [
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/change-password',
  '/change-email',
  '/delete-user',
  '/two-factor',
  '/email-otp',
];

const DISPATCH_PATHS = [
  '/send-verification-email',
  '/forget-password',
  '/request-password-reset',
  '/verify-email',
  '/magic-link',
];

const SESSION_PATHS = ['/get-session', '/session'];

// The mount uses a wildcard, so req.path is already relative to /api/auth. Fall
// back to stripping the prefix off the full URL in case the mount ever changes.
function authPath(req: Request): string {
  const raw = req.path || '/';
  const path = raw.startsWith('/api/auth')
    ? raw.slice('/api/auth'.length) || '/'
    : raw;
  return path.toLowerCase();
}

function matches(path: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

// Runs a list of limiters in order so an endpoint can sit under both a burst
// window and a slower sustained one. The first to reject ends the chain.
function chain(limiters: RequestHandler[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    const step = (err?: unknown): void => {
      if (err) return next(err);
      const limiter = limiters[index++];
      if (!limiter) return next();
      limiter(req, res, step);
    };
    step();
  };
}

const credentialsChain = chain([credentialsLimiter, credentialsDailyLimiter]);

/**
 * Tiered rate limiter for the whole `/api/auth/*` subtree. Mount it ahead of
 * Better Auth's handler; it dispatches per request path and never reads the
 * body, so Better Auth still receives the raw stream.
 */
export const betterAuthRateLimit: RequestHandler = (req, res, next) => {
  const path = authPath(req);

  if (matches(path, DISPATCH_PATHS)) return dispatchLimiter(req, res, next);
  if (matches(path, CREDENTIAL_PATHS)) return credentialsChain(req, res, next);
  if (matches(path, SESSION_PATHS)) return sessionLimiter(req, res, next);

  return defaultLimiter(req, res, next);
};

// Exported for the tests, which assert each path lands in the tier it should.
export const authRateLimitTiers = {
  CREDENTIAL_PATHS,
  DISPATCH_PATHS,
  SESSION_PATHS,
  authPath,
  matches,
} as const;
