import type { NextFunction, Request, Response } from 'express';

import { auth } from '../config/auth.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../lib/logger.js';
import { Role, isRole } from '../lib/roles.js';
import type { AuthContext } from './auth-context.js';

// Better Auth reads the session from the request headers (cookie or bearer). It
// expects a WHATWG Headers object, which Express doesn't give us.
function toHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function resolveSession(req: Request): Promise<AuthContext | null> {
  const result = await auth.api.getSession({ headers: toHeaders(req) });
  if (!result) return null;

  const { user, session } = result;

  // A banned user keeps a valid session cookie until it expires, so the ban is
  // only real if we check it on every request. Better Auth's admin plugin
  // stores an optional expiry — a lapsed ban is no longer a ban.
  if (user.banned && (!user.banExpires || user.banExpires > new Date())) {
    throw AppError.unauthorized('Account suspended');
  }

  // A user row with a missing or unrecognised role is a data problem, not an
  // authorization decision — fall back to the least privilege we have.
  const role = isRole(user.role) ? user.role : Role.CUSTOMER;
  if (!isRole(user.role)) {
    logger.warn({ userId: user.id, role: user.role }, 'User has unrecognised role, treating as customer');
  }

  return {
    userId: user.id,
    role,
    sessionId: session.id,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

// The default posture from AGENTS.md: every endpoint is authenticated unless it
// is explicitly marked public. Mount this before any role guard.
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const context = await resolveSession(req);
    if (!context) {
      throw AppError.unauthenticated();
    }
    req.auth = context;
    next();
  } catch (err) {
    next(err);
  }
}

// For the rare route that serves both signed-in and anonymous callers and
// changes its response rather than rejecting. Never use this as a substitute for
// requireAuth on a protected route.
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    req.auth = (await resolveSession(req)) ?? undefined;
    next();
  } catch (err) {
    // A suspended account still gets rejected — it is not "just anonymous".
    if (err instanceof AppError && err.status === 403) {
      next(err);
      return;
    }
    logger.warn({ err }, 'Optional auth session lookup failed, continuing anonymous');
    next();
  }
}
