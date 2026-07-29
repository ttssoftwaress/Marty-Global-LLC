import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/auth-context.js';
import * as service from './conversations.service.js';

// Thin: call service → respond with the { data } envelope. No input to validate —
// the list is scoped to the caller's own session, never to a requested id.

export async function listMyConversations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const view = await service.listMyConversations(getAuth(req));
    res.json({ data: view });
  } catch (error) {
    next(error);
  }
}
