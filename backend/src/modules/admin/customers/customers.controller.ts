import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './customers.service.js';
import {
  banCustomerSchema,
  listCustomerOrdersQuerySchema,
  listCustomersQuerySchema,
} from './customers.validation.js';

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

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listCustomersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid customers query', parsed.error.issues);
    }

    res.json({ data: await service.listCustomers(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const customer = await service.getCustomer(
      getAuth(req),
      pathParam(req, 'customerId'),
    );
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
}

export async function listCustomerOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listCustomerOrdersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid orders query', parsed.error.issues);
    }

    const page = await service.listCustomerOrders(
      getAuth(req),
      pathParam(req, 'customerId'),
      parsed.data,
    );
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

// Both suspension routes answer with the customer record the screen already
// renders, so the header reflects the new state without a second fetch.

export async function banCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = banCustomerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw AppError.validation('Invalid suspension', parsed.error.issues);
    }

    const customer = await service.banCustomer(
      getAuth(req),
      pathParam(req, 'customerId'),
      parsed.data,
    );
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
}

export async function unbanCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const customer = await service.unbanCustomer(
      getAuth(req),
      pathParam(req, 'customerId'),
    );
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
}
