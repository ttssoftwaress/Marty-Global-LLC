import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './payments.service.js';
import {
  listLedgerQuerySchema,
  listUnmatchedQuerySchema,
  resolveUnmatchedSchema,
  revenueQuerySchema,
} from './payments.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getSummary(getAuth(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getRevenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = revenueQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid revenue query', parsed.error.issues);
    }

    res.json({ data: await service.getRevenue(getAuth(req), parsed.data.period) });
  } catch (error) {
    next(error);
  }
}

export async function listLedger(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listLedgerQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid ledger query', parsed.error.issues);
    }

    res.json({ data: await service.listLedger(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function listUnmatched(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listUnmatchedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid transfer query', parsed.error.issues);
    }

    res.json({
      data: await service.listUnmatchedTransfers(getAuth(req), parsed.data),
    });
  } catch (error) {
    next(error);
  }
}

export async function resolveUnmatched(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = resolveUnmatchedSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid resolution', parsed.error.issues);
    }

    res.json({
      data: await service.resolveUnmatchedTransfer(
        getAuth(req),
        pathParam(req, 'transferId'),
        parsed.data,
      ),
    });
  } catch (error) {
    next(error);
  }
}
