import type { NextFunction, Request, Response } from 'express';

import * as service from './dashboard.service.js';

// Thin: call service → respond with the { data } envelope. The summary takes no
// input beyond the session, so there is nothing to validate.

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getSummary(req) });
  } catch (error) {
    next(error);
  }
}
