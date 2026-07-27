import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './delivery.service.js';
import {
  listAdminRequestsQuerySchema,
  saveResultSchema,
  updateOrderItemStatusSchema,
  updateRequestSchema,
  updateResultStatusSchema,
} from './delivery.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getItemResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.getItemResult(
      getAuth(req),
      pathParam(req, 'orderItemId'),
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function saveResult(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = saveResultSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid result', parsed.error.issues);
    }

    const data = await service.saveResult(
      getAuth(req),
      pathParam(req, 'orderItemId'),
      parsed.data,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderItemStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateOrderItemStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid item status', parsed.error.issues);
    }

    const data = await service.updateOrderItemStatus(
      getAuth(req),
      pathParam(req, 'orderItemId'),
      parsed.data,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function updateResultStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateResultStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid record status', parsed.error.issues);
    }

    const data = await service.updateResultStatus(
      getAuth(req),
      pathParam(req, 'resultId'),
      parsed.data,
    );
    res.json({ data });
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
    const parsed = listAdminRequestsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid request query', parsed.error.issues);
    }

    const data = await service.listRequests(getAuth(req), parsed.data);
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await service.getRequest(
      getAuth(req),
      pathParam(req, 'requestId'),
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function updateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid request update', parsed.error.issues);
    }

    const data = await service.updateRequest(
      getAuth(req),
      pathParam(req, 'requestId'),
      parsed.data,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function getRequestResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await service.getRequestResult(
      getAuth(req),
      pathParam(req, 'requestId'),
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}

export async function saveRequestResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = saveResultSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid result', parsed.error.issues);
    }

    const data = await service.saveRequestResult(
      getAuth(req),
      pathParam(req, 'requestId'),
      parsed.data,
    );
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
