import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './billing.service.js';
import { listPaymentsQuerySchema } from './billing.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getOverview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const overview = await service.getOverview(req);
    res.json({ data: overview });
  } catch (error) {
    next(error);
  }
}

export async function listPayments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listPaymentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid payment history query', parsed.error.issues);
    }

    const page = await service.listPayments(req, parsed.data);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}
