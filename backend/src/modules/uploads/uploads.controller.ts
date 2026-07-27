import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import * as service from './uploads.service.js';
import { requestUploadSchema } from './uploads.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function requestUpload(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = requestUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid upload request', parsed.error.issues);
    }

    const upload = await service.requestUpload(getAuth(req), parsed.data);
    res.status(201).json({ data: upload });
  } catch (error) {
    next(error);
  }
}
