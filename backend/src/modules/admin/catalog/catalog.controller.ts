import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './catalog.service.js';
import {
  createServiceSchema,
  listServicesQuerySchema,
  updateRequestTypesSchema,
  updateResultSchemaSchema,
  updateServiceSchema,
} from './catalog.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listRegions(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: { regions: await service.listRegions() } });
  } catch (error) {
    next(error);
  }
}

export async function listServices(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listServicesQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid catalog query', parsed.error.issues);
    }

    res.json({ data: await service.listServices(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getService(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getService(pathParam(req, 'serviceId')) });
  } catch (error) {
    next(error);
  }
}

export async function createService(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid service', parsed.error.issues);
    }

    const created = await service.createService(getAuth(req), parsed.data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function updateService(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid service update', parsed.error.issues);
    }

    const updated = await service.updateService(
      getAuth(req),
      pathParam(req, 'serviceId'),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

export async function updateResultSchema(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateResultSchemaSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid result schema', parsed.error.issues);
    }

    const updated = await service.updateResultSchema(
      getAuth(req),
      pathParam(req, 'serviceId'),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

export async function updateRequestTypes(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateRequestTypesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid request types', parsed.error.issues);
    }

    const updated = await service.updateRequestTypes(
      getAuth(req),
      pathParam(req, 'serviceId'),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}
