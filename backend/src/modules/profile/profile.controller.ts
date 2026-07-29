import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './profile.service.js';
import {
  updateAvatarSchema,
  updateCompanySchema,
  updateNotificationPreferencesSchema,
  updateProfileSchema,
} from './profile.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getProfile(req) });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid profile payload', parsed.error.issues);
    }

    res.json({ data: await service.updateProfile(req, parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getCompany(req) });
  } catch (error) {
    next(error);
  }
}

export async function updateCompany(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid company payload', parsed.error.issues);
    }

    res.json({ data: await service.updateCompany(req, parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getNotificationPreferences(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getNotificationPreferences(req) });
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPreferences(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateNotificationPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation(
        'Invalid notification preferences payload',
        parsed.error.issues,
      );
    }

    res.json({
      data: await service.updateNotificationPreferences(req, parsed.data),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAvatar(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateAvatarSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid avatar payload', parsed.error.issues);
    }

    res.json({ data: await service.updateAvatar(req, parsed.data) });
  } catch (error) {
    next(error);
  }
}
