import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './fields.service.js';
import {
  createFieldSchema,
  listFieldsQuerySchema,
  updateFieldSchema,
} from './fields.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listFields(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listFieldsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid field query', parsed.error.issues);
    }

    res.json({ data: await service.listFields(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function createField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid field', parsed.error.issues);
    }

    const created = await service.createField(getAuth(req), parsed.data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function updateField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid field update', parsed.error.issues);
    }

    const updated = await service.updateField(
      getAuth(req),
      pathParam(req, 'fieldId'),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}
