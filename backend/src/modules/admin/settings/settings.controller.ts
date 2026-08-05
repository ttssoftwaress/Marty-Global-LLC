import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as notifications from './settings.notifications.js';
import { trashRows } from '../trash/trash.service.js';
import * as service from './settings.service.js';
import {
  carrierCodeSchema,
  createCarrierSchema,
  createLocationSchema,
  locationCodeSchema,
  reorderCarriersSchema,
  reorderLocationsSchema,
  updateCarrierSchema,
  updateLocationSchema,
  updateNotificationSettingsSchema,
} from './settings.validation.js';

/*
 * Thin: validate → call service → respond with the { data } envelope.
 *
 * The path code goes through the same schema as the body's would, because a code
 * is normalised on the way in (locations upper-case, carriers lower-case) and a
 * URL is just another place it arrives from — `/locations/us` and `/locations/US`
 * must reach the same row.
 */

// --- Locations -----------------------------------------------------------

export async function listLocations(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.listLocations() });
  } catch (error) {
    next(error);
  }
}

export async function createLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid location', parsed.error.issues);
    }

    const created = await service.createLocation(getAuth(req), parsed.data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function updateLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid location update', parsed.error.issues);
    }

    const updated = await service.updateLocation(
      getAuth(req),
      locationCode(req),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

/*
 * The row's own Delete button, which now moves it to the Trash rather than
 * dropping it — one shared path with the bulk selection and with every other
 * admin table (`modules/admin/trash`).
 *
 * The endpoint's shape is unchanged, so the screen calling it did not have to
 * move: it still returns the code it removed. What changed is that the removal
 * is undoable and that the "nothing references it" rule is now stated once, on
 * the `location` descriptor in the registry.
 */
export async function deleteLocation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const code = locationCode(req);
    await trashRows(getAuth(req), 'location', [code]);

    res.json({ data: { code } });
  } catch (error) {
    next(error);
  }
}

export async function reorderLocations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = reorderLocationsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid location order', parsed.error.issues);
    }

    res.json({ data: await service.reorderLocations(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

// --- Mail carriers -------------------------------------------------------

export async function listCarriers(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await service.listCarriers() });
  } catch (error) {
    next(error);
  }
}

export async function createCarrier(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createCarrierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid carrier', parsed.error.issues);
    }

    const created = await service.createCarrier(getAuth(req), parsed.data);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
}

export async function updateCarrier(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateCarrierSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid carrier update', parsed.error.issues);
    }

    const updated = await service.updateCarrier(
      getAuth(req),
      carrierCode(req),
      parsed.data,
    );
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

// Same as `deleteLocation` above: to the Trash, not gone.
export async function deleteCarrier(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const code = carrierCode(req);
    await trashRows(getAuth(req), 'carrier', [code]);

    res.json({ data: { code } });
  } catch (error) {
    next(error);
  }
}

export async function reorderCarriers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = reorderCarriersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid carrier order', parsed.error.issues);
    }

    res.json({ data: await service.reorderCarriers(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

// --- Outbound email ------------------------------------------------------

export async function readNotificationSettings(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: await notifications.readNotificationSettings() });
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationSettings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateNotificationSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid email settings', parsed.error.issues);
    }

    res.json({
      data: await notifications.updateNotificationSettings(
        getAuth(req),
        parsed.data,
      ),
    });
  } catch (error) {
    next(error);
  }
}

function locationCode(req: Request): string {
  const parsed = locationCodeSchema.safeParse(pathParam(req, 'code'));
  if (!parsed.success) throw AppError.validation('Invalid location code');
  return parsed.data;
}

function carrierCode(req: Request): string {
  const parsed = carrierCodeSchema.safeParse(pathParam(req, 'code'));
  if (!parsed.success) throw AppError.validation('Invalid carrier code');
  return parsed.data;
}
