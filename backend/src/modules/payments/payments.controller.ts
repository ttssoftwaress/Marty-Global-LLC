import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './payments.service.js';
import {
  createIntentSchema,
  paymentIdParamSchema,
  quoteIdParamSchema,
} from './payments.validation.js';

// Thin: validate → call service → respond with the { data } envelope
// (AGENTS.md, API Conventions). No business logic, no Prisma, no money maths.

export async function createIntent(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid payment request', parsed.error.issues);
    }

    // `requireIdempotencyKey` runs ahead of this handler and 400s without one,
    // so the key is present here; the non-null assertion is the guard's contract.
    const payment = await service.createIntent(
      req,
      parsed.data,
      req.idempotencyKey as string,
    );

    res.status(201).json({ data: payment });
  } catch (error) {
    next(error);
  }
}

export async function getPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = paymentIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw AppError.validation('Invalid payment id', parsed.error.issues);
    }

    const payment = await service.getPayment(req, parsed.data.paymentId);
    res.json({ data: payment });
  } catch (error) {
    next(error);
  }
}

export async function getCheckoutQuote(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = quoteIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw AppError.validation('Invalid quote id', parsed.error.issues);
    }

    const quote = await service.getQuoteForCheckout(req, parsed.data.quoteId);
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
}
