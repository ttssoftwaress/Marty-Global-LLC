import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import { pathParam } from '../../lib/params.js';
import * as service from './mailroom.service.js';
import {
  createMailRequestSchema,
  listMailItemsQuerySchema,
} from './mailroom.validation.js';

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
    const roomId = pathParam(req, 'roomId');
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
    const roomId = pathParam(req, 'roomId');

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
    const roomId = pathParam(req, 'roomId');
    const itemId = pathParam(req, 'itemId');

    const item = await service.getItem(req, roomId, itemId);
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
}

export async function createRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const roomId = pathParam(req, 'roomId');
    const itemId = pathParam(req, 'itemId');

    const parsed = createMailRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid mail request', parsed.error.issues);
    }

    const request = await service.createRequest(req, roomId, itemId, parsed.data);
    res.status(201).json({ data: request });
  } catch (error) {
    next(error);
  }
}

export async function recordDownload(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const roomId = pathParam(req, 'roomId');
    const itemId = pathParam(req, 'itemId');

    const result = await service.recordDownload(req, roomId, itemId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
