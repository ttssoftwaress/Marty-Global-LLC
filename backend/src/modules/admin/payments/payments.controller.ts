import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './payments.service.js';
import {
  listLedgerQuerySchema,
  listRefundsQuerySchema,
  refundSchema,
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

export async function listRefunds(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listRefundsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid refunds query', parsed.error.issues);
    }

    res.json({ data: await service.listRefunds(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function refundPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid refund', parsed.error.issues);
    }

    // The guard has already validated the header and put it on the request.
    const refund = await service.refundPayment(
      getAuth(req),
      pathParam(req, 'paymentId'),
      req.idempotencyKey ?? '',
      parsed.data,
    );
    res.status(201).json({ data: refund });
  } catch (error) {
    next(error);
  }
}
