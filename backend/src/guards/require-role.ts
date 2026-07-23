import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/app-error.js';
import { Role } from '../lib/roles.js';
import { getAuth } from './auth-context.js';

// Role guard. Always mounted *after* requireAuth — it authorizes, it does not
// authenticate, so a missing context is a 401 from getAuth rather than a 403.
export function requireRole(...allowed: readonly Role[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction) {
    try {
      const { role } = getAuth(req);
      if (!allowed.includes(role)) {
        throw AppError.unauthorized();
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// The two shapes almost every route wants. `/admin/*` endpoints are staff+admin
// unless the action is destructive or account-level, which is admin only.
export const requireStaff = requireRole(Role.STAFF, Role.ADMIN);
export const requireAdmin = requireRole(Role.ADMIN);
export const requireCustomer = requireRole(Role.CUSTOMER);
