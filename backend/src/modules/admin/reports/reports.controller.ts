import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './reports.service.js';
import {
  breakdownDimension,
  reportRangeSchema,
} from './reports.validation.js';

// Thin: validate → call service → respond with the { data } envelope. Every
// endpoint here takes the same range, so parsing it is shared.

function parseRange(req: Request) {
  const parsed = reportRangeSchema.safeParse(req.query);
  if (!parsed.success) {
    throw AppError.validation('Invalid report range', parsed.error.issues);
  }
  return parsed.data;
}

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getSummary(getAuth(req), parseRange(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getRevenue(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getRevenue(getAuth(req), parseRange(req)) });
  } catch (error) {
    next(error);
  }
}

export async function getBreakdown(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const dimension = breakdownDimension.safeParse(pathParam(req, 'dimension'));
    if (!dimension.success) {
      throw AppError.validation('Unknown breakdown dimension');
    }

    const breakdown = await service.getBreakdown(
      getAuth(req),
      dimension.data,
      parseRange(req),
    );
    res.json({ data: breakdown });
  } catch (error) {
    next(error);
  }
}

export async function getFunnel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const stages = await service.getFunnel(getAuth(req), parseRange(req));
    res.json({ data: { stages } });
  } catch (error) {
    next(error);
  }
}

export async function getGrowth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.getGrowth(getAuth(req), parseRange(req)) });
  } catch (error) {
    next(error);
  }
}

/*
 * The one endpoint here that does not return the `{ data }` envelope: the body
 * IS the file. A failure still leaves through the shared error middleware and
 * answers with the envelope, because nothing has been written to the response
 * until the CSV is in hand.
 */
export async function getExport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { filename, csv } = await service.exportCsv(
      getAuth(req),
      parseRange(req),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // The browser reads the name off this header, and a cross-origin fetch
    // cannot see a header that is not exposed.
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
