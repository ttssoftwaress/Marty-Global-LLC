import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import * as service from './me.service.js';

// Thin: read the session → call service → respond with the { data } envelope.
// No input to validate — the endpoint describes the caller, never a lookup.

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await service.getAdminMe(getAuth(req)) });
  } catch (error) {
    next(error);
  }
}
