import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
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

export async function deleteTeamMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await service.deleteTeamMember(
      getAuth(req),
      pathParam(req, 'memberId'),
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}
