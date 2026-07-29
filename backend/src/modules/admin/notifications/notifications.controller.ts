import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../../lib/app-error.js';
import * as service from './notifications.service.js';
import { listAdminFeedQuerySchema } from './notifications.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listFeed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listAdminFeedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid feed query', parsed.error.issues);
    }

    res.json({ data: await service.listFeed(req, parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.markAllRead(req) });
  } catch (error) {
    next(error);
  }
}

export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Notification id is required');
    }

    res.json({ data: await service.markRead(req, id) });
  } catch (error) {
    next(error);
  }
}
