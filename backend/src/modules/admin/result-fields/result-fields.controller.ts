import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './result-fields.service.js';
import {
  createResultFieldSchema,
  listResultFieldsQuerySchema,
  updateResultFieldSchema,
} from './result-fields.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listResultFields(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listResultFieldsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid result field query', parsed.error.issues);
    }

    res.json({ data: await service.listResultFields(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function createResultField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createResultFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid result field', parsed.error.issues);
    }

    const created = await service.createResultField(getAuth(req), parsed.data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function updateResultField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateResultFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid result field update', parsed.error.issues);
    }

    const updated = await service.updateResultField(
      getAuth(req),
      pathParam(req, 'fieldId'),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}
