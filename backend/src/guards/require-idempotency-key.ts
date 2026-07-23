import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/app-error.js';

const HEADER = 'idempotency-key';
const MIN_LENGTH = 8;
const MAX_LENGTH = 255;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

// AGENTS.md "API Conventions": mutating payment endpoints accept an
// Idempotency-Key and are retry-safe. This guard only validates and surfaces the
// key — replay detection belongs in the payments service, where the key is
// stored against the Payment row inside the same transaction that creates it.
export function requireIdempotencyKey(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const raw = req.get(HEADER);
    if (!raw) {
      throw AppError.validation(`Missing ${HEADER} header`);
    }

    const key = raw.trim();
    if (key.length < MIN_LENGTH || key.length > MAX_LENGTH) {
      throw AppError.validation(
        `${HEADER} must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
      );
    }

    req.idempotencyKey = key;
    next();
  } catch (err) {
    next(err);
  }
}
