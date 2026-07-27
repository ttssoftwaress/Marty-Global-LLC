import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './quotes.service.js';
import { createQuoteSchema } from './quotes.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listOrderQuotes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const quotes = await service.listOrderQuotes(
      getAuth(req),
      pathParam(req, 'orderId'),
    );
    res.json({ data: quotes });
  } catch (error) {
    next(error);
  }
}

export async function listQuoteTemplates(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const templates = await service.listQuoteTemplates(
      getAuth(req),
      pathParam(req, 'orderId'),
    );
    res.json({ data: templates });
  } catch (error) {
    next(error);
  }
}

export async function createQuote(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid quote', parsed.error.issues);
    }

    const quote = await service.createQuote(
      getAuth(req),
      pathParam(req, 'orderId'),
      parsed.data,
    );
    res.status(201).json({ data: quote });
  } catch (error) {
    next(error);
  }
}

export async function cancelQuote(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const quote = await service.cancelQuote(
      getAuth(req),
      pathParam(req, 'orderId'),
      pathParam(req, 'quoteId'),
    );
    res.json({ data: quote });
  } catch (error) {
    next(error);
  }
}
