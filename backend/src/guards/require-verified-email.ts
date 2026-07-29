import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/app-error.js';
import { getAuth } from './auth-context.js';

// Gate for actions that must be traceable to a real, reachable person — filings,
// payments, document uploads. Signup does not require verification today
// (config/auth.ts), so this is the enforcement point for the flows that do.
// 422: the request is well-formed and authorized, the account state blocks it.
export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const { emailVerified } = getAuth(req);
    if (!emailVerified) {
      throw AppError.businessRule('Email verification required', {
        reason: 'EMAIL_NOT_VERIFIED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}
