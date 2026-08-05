import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import * as service from './trash.service.js';
import {
  deleteRowsSchema,
  entryIdsSchema,
  listTrashSchema,
  trashSettingsSchema,
} from './trash.validation.js';

/*
 * Request/response only — every rule, guard, and Prisma call is in
 * `trash.service.ts` (AGENTS.md, Backend).
 */

export async function deleteRows(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = deleteRowsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid delete request', parsed.error.issues);
    }

    const result = await service.trashRows(
      getAuth(req),
      parsed.data.entityType,
      parsed.data.ids,
    );

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

export async function listTrash(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listTrashSchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid trash query', parsed.error.issues);
    }

    res.json({ data: await service.listTrash(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getTrashSummary(getAuth(req)) });
  } catch (error) {
    next(error);
  }
}

export async function restore(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = entryIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid restore request', parsed.error.issues);
    }

    res.json({ data: await service.restoreEntries(getAuth(req), parsed.data.ids) });
  } catch (error) {
    next(error);
  }
}

export async function purge(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = entryIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid delete request', parsed.error.issues);
    }

    res.json({ data: await service.purgeNow(getAuth(req), parsed.data.ids) });
  } catch (error) {
    next(error);
  }
}

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getSettings() });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = trashSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid settings', parsed.error.issues);
    }

    res.json({ data: await service.updateSettings(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}
