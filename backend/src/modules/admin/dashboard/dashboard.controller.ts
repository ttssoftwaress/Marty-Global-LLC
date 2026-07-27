import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import * as service from './dashboard.service.js';
import { summaryQuerySchema } from './dashboard.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = summaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid dashboard query', parsed.error.issues);
    }

    res.json({
      data: await service.getSummary(getAuth(req), parsed.data.period),
    });
  } catch (error) {
    next(error);
  }
}
