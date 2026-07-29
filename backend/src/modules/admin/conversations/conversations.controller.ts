import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import * as service from './conversations.service.js';
import { listMyConversationsQuerySchema } from './conversations.validation.js';

// Thin: validate → call service → respond with the { data } envelope. The only
// input is the cursor — whose list to load is the session's answer, never a
// parameter.

export async function listMyConversations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listMyConversationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid conversations query', parsed.error.issues);
    }

    const view = await service.listMyConversations(getAuth(req), parsed.data);
    res.json({ data: view });
  } catch (error) {
    next(error);
  }
}
