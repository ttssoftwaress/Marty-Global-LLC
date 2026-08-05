import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../../lib/app-error.js';
import * as service from './audit.service.js';
import { listAuditQuerySchema } from './audit.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getSummary(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getSummary() });
  } catch (error) {
    next(error);
  }
}

export async function listAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listAuditQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid audit filters', parsed.error.issues);
    }

    res.json({ data: await service.listAudit(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Audit entry id is required');
    }

    res.json({ data: await service.getEntry(id) });
  } catch (error) {
    next(error);
  }
}
