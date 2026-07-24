import type { NextFunction, Request, Response } from 'express';

import * as service from './services.service.js';

// Thin: call service → respond with the { data } envelope (AGENTS.md).

export async function getCatalog(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const services = await service.getCatalog();
    res.json({ data: { services } });
  } catch (error) {
    next(error);
  }
}
