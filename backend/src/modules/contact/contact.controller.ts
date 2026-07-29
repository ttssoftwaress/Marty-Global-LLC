import type { NextFunction, Request, Response } from 'express';

import { verifyTurnstile } from '../../config/turnstile.js';
import { AppError } from '../../lib/app-error.js';
import * as service from './contact.service.js';
import { contactSubmissionSchema } from './contact.validation.js';

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = contactSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid contact details', parsed.error.issues);
    }

    // Before anything is written — same rule as guest-chat's only other
    // unauthenticated write endpoint.
    const verified = await verifyTurnstile(parsed.data.turnstileToken, req.ip);
    if (!verified) {
      throw AppError.validation('Verification failed — please try again');
    }

    const submission = await service.createSubmission(parsed.data, req.auth?.userId);
    res.status(201).json({ data: submission });
  } catch (error) {
    next(error);
  }
}
