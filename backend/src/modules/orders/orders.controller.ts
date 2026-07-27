import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import { pathParam } from '../../lib/params.js';
import * as service from './orders.service.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  uploadOrderDocumentsSchema,
} from './orders.validation.js';

// Thin: validate → call service → respond with the { data } envelope. The
// current customer is read from req.auth inside the service (getAuth), so these
// handlers only shape input and output.

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid order payload', parsed.error.issues);
    }

    const confirmation = await service.createOrder(req, parsed.data);
    res.status(201).json({ data: confirmation });
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
      throw AppError.validation('Invalid list query', parsed.error.issues);
    }

    const page = await service.listOrders(req, parsed.data);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Order id is required');
    }

    const order = await service.getOrderDetail(req, id);
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
}

export async function attachDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = uploadOrderDocumentsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid documents payload', parsed.error.issues);
    }

    const result = await service.attachDocuments(
      req,
      pathParam(req, 'id'),
      parsed.data,
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDocumentLink(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const link = await service.getDocumentLink(
      req,
      pathParam(req, 'id'),
      pathParam(req, 'documentId'),
    );
    res.json({ data: link });
  } catch (error) {
    next(error);
  }
}
