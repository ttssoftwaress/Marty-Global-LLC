import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import { trashRows } from '../trash/trash.service.js';
import * as service from './team.service.js';
import {
  createTeamMemberSchema,
  listTeamQuerySchema,
  updateTeamMemberSchema,
} from './team.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getSummary(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getSummary() });
  } catch (error) {
    next(error);
  }
}

export async function listTeam(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listTeamQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid team query', parsed.error.issues);
    }

    res.json({ data: await service.listTeam(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getTeamMember(pathParam(req, 'memberId')) });
  } catch (error) {
    next(error);
  }
}

export async function createTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid staff member', parsed.error.issues);
    }

    const member = await service.createTeamMember(getAuth(req), parsed.data);
    res.status(201).json({ data: member });
  } catch (error) {
    next(error);
  }
}

export async function updateTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid member update', parsed.error.issues);
    }

    const member = await service.updateTeamMember(
      getAuth(req),
      pathParam(req, 'memberId'),
      parsed.data,
    );
    res.json({ data: member });
  } catch (error) {
    next(error);
  }
}

/*
 * Removing a staff account. Routed through the Trash, which changes what "delete"
 * means here in one important way and leaves the rest alone.
 *
 * Unchanged: the account is shut out immediately — banned, every session
 * dropped, gone from these screens — and the three refusals still apply (you
 * cannot delete yourself, you cannot remove the last active admin, and an
 * account that owns customer records is revoked rather than dropped). All of
 * that now lives on the `staff-member` descriptor in `trash.registry.ts`.
 *
 * Changed: the row is not destroyed on the spot. It is soft-deleted with a
 * restorable entry, and the hard delete happens at the end of the retention
 * window — which is also when the credential is destroyed, so a restore inside
 * the window brings the member back able to sign in rather than needing a reset.
 */
export async function deleteTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = pathParam(req, 'memberId');
    await trashRows(getAuth(req), 'staff-member', [id]);

    res.json({ data: { id } });
  } catch (error) {
    next(error);
  }
}
