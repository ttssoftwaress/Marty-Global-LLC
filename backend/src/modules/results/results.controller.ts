import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import { pathParam } from '../../lib/params.js';
import * as service from './results.service.js';
import {
  createServiceRequestSchema,
  listRequestsQuerySchema,
  listResultsQuerySchema,
} from './results.validation.js';

// Thin: validate → call service → respond with the { data } envelope (AGENTS.md).

export async function listOwnedServices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const services = await service.listOwnedServices(getAuth(req));
    res.json({ data: { services } });
  } catch (error) {
    next(error);
  }
}

export async function listResults(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listResultsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid record query', parsed.error.issues);
    }

    const data = await service.listResults(
      getAuth(req),
      pathParam(req, 'slug'),
      parsed.data,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getResult(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getResult(getAuth(req), pathParam(req, 'resultId'));
    res.json({ data });
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
    const parsed = createServiceRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid request', parsed.error.issues);
    }

    const created = await service.createRequest(
      getAuth(req),
      pathParam(req, 'resultId'),
      parsed.data,
    );
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function listRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listRequestsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid request query', parsed.error.issues);
    }

    const data = await service.listRequests(getAuth(req), parsed.data);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
