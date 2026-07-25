import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './mailroom.service.js';
import { listMailItemsQuerySchema } from './mailroom.validation.js';

// Thin: validate → call service → respond with the { data } envelope. The current
// customer is read from req.auth inside the service, which also owns every
// ownership check.

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

export async function getRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = requireParam(req.params.roomId, 'Mail room id is required');
    const room = await service.getRoomDetail(req, roomId);
    res.json({ data: room });
  } catch (error) {
    next(error);
  }
}

export async function listItems(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const roomId = requireParam(req.params.roomId, 'Mail room id is required');

    const parsed = listMailItemsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid mail items query', parsed.error.issues);
    }

    const page = await service.listItems(req, roomId, parsed.data);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

export async function getItem(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = requireParam(req.params.roomId, 'Mail room id is required');
    const itemId = requireParam(req.params.itemId, 'Mail item id is required');

    const item = await service.getItem(req, roomId, itemId);
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
}

// Express types a route param as string | string[]; only a single segment is ever
// valid here, so an array is a malformed path rather than something to join.
function requireParam(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value) {
    throw AppError.validation(message);
  }
  return value;
}
