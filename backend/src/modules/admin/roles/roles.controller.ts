import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import { trashRows } from '../trash/trash.service.js';
import * as service from './roles.service.js';
import {
  createStaffRoleSchema,
  updateStaffRoleSchema,
} from './roles.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listRoles(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.listRoles() });
  } catch (error) {
    next(error);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createStaffRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid role', parsed.error.issues);
    }

    const role = await service.createRole(getAuth(req), parsed.data);
    res.status(201).json({ data: role });
  } catch (error) {
    next(error);
  }
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateStaffRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid role update', parsed.error.issues);
    }

    const role = await service.updateRole(
      getAuth(req),
      pathParam(req, 'roleId'),
      parsed.data,
    );
    res.json({ data: role });
  } catch (error) {
    next(error);
  }
}

// Deleting a job role. To the Trash, with both of its rules — built-in roles
// cannot go, and neither can one any member still holds — on the `staff-role`
// descriptor in `trash.registry.ts`.
export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    const id = pathParam(req, 'roleId');
    await trashRows(getAuth(req), 'staff-role', [id]);

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}
