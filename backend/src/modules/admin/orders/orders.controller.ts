import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './orders.service.js';
import {
  addActivitySchema,
  listOrdersQuerySchema,
  updateOrderSchema,
} from './orders.validation.js';

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

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid orders query', parsed.error.issues);
    }

    res.json({ data: await service.listOrders(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await service.getOrder(getAuth(req), pathParam(req, 'orderId'));
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}

export async function addActivity(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = addActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid activity entry', parsed.error.issues);
    }

    const entry = await service.addActivity(
      getAuth(req),
      pathParam(req, 'orderId'),
      parsed.data,
    );
    res.status(201).json({ data: entry });
  } catch (error) {
    next(error);
  }
}

export async function updateOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid order update', parsed.error.issues);
    }

    const order = await service.updateOrder(
      getAuth(req),
      pathParam(req, 'orderId'),
      parsed.data,
    );
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}
