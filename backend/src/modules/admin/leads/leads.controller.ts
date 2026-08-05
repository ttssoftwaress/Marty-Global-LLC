import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../../lib/app-error.js';
import * as service from './leads.service.js';
import { listLeadsQuerySchema } from './leads.validation.js';

export async function listLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listLeadsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid leads query', parsed.error.issues);
    }

    res.json({ data: await service.listLeads(parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function getLead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Lead id is required');
    }

    res.json({ data: await service.getLead(id) });
  } catch (error) {
    next(error);
  }
}

const setHandledSchema = z.object({ handled: z.boolean() });

export async function setHandled(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Lead id is required');
    }

    const parsed = setHandledSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid request', parsed.error.issues);
    }

    res.json({ data: await service.setHandled(id, parsed.data.handled) });
  } catch (error) {
    next(error);
  }
}
