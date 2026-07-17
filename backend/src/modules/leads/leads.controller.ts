import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { AppError } from '../../lib/app-error.js';
import * as leadsService from './leads.service.js';
import { createLeadSchema, listLeadsSchema } from './leads.validation.js';

export async function createLead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation(
        'Invalid lead payload',
        z.flattenError(parsed.error).fieldErrors,
      );
    }

    const lead = await leadsService.createLead(parsed.data);
    res.status(201).json({ data: lead });
  } catch (err) {
    next(err);
  }
}

export async function listLeads(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listLeadsSchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation(
        'Invalid query parameters',
        z.flattenError(parsed.error).fieldErrors,
      );
    }

    const { data, nextCursor } = await leadsService.listLeads(parsed.data);
    res.json({ data, nextCursor });
  } catch (err) {
    next(err);
  }
}
