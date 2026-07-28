import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './documents.service.js';
import {
  documentSource,
  listDocumentsQuerySchema,
} from './documents.validation.js';

// Thin: validate → call service → respond with the { data } envelope. The current
// customer is read from req.auth inside the service, which also owns every
// ownership check.

export async function listDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listDocumentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid documents query', parsed.error.issues);
    }

    const page = await service.listDocuments(req, parsed.data);
    res.json({ data: page });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await service.getStats(req);
    res.json({ data: stats });
  } catch (error) {
    next(error);
  }
}

export async function getDownloadLink(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // The source is part of the path, not a query: an id is only unique within
    // its own source, so it is half of the document's address.
    const parsedSource = documentSource.safeParse(req.params.source);
    if (!parsedSource.success) {
      throw AppError.validation('Unknown document source');
    }

    const documentId = requireParam(req.params.documentId, 'Document id is required');

    const link = await service.getDownloadLink(req, parsedSource.data, documentId);
    res.json({ data: link });
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
