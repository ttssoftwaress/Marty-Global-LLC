import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './mailroom.service.js';
import {
  customerSearchQuerySchema,
  listLogQuerySchema,
  listRequestsQuerySchema,
  listScansQuerySchema,
  resolveRequestSchema,
  uploadScanSchema,
} from './mailroom.validation.js';

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

export async function searchCustomers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = customerSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid customer search', parsed.error.issues);
    }

    const customers = await service.searchCustomers(
      getAuth(req),
      parsed.data.search,
    );
    res.json({ data: { customers } });
  } catch (error) {
    next(error);
  }
}

export async function listScans(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listScansQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid scans query', parsed.error.issues);
    }

    res.json({ data: await service.listScans(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function uploadScan(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = uploadScanSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid scan', parsed.error.issues);
    }

    const upload = await service.uploadScan(getAuth(req), parsed.data);
    res.status(201).json({ data: upload });
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
      throw AppError.validation('Invalid requests query', parsed.error.issues);
    }

    res.json({ data: await service.listRequests(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({
      data: await service.getRequest(getAuth(req), pathParam(req, 'requestId')),
    });
  } catch (error) {
    next(error);
  }
}

export async function processRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const row = await service.processRequest(
      getAuth(req),
      pathParam(req, 'requestId'),
    );
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
}

export async function resolveRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = resolveRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw AppError.validation('Invalid resolution', parsed.error.issues);
    }

    const row = await service.resolveRequest(
      getAuth(req),
      pathParam(req, 'requestId'),
      parsed.data,
    );
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
}

export async function listLog(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listLogQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid log query', parsed.error.issues);
    }

    res.json({ data: await service.listLog(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}
