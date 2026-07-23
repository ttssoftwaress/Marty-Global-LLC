import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../../lib/app-error.js';
import * as service from './notifications.service.js';
import { sendEmailSchema } from './notifications.validation.js';

// Thin: validate → call service → respond (AGENTS.md "Backend").

export async function queueEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = sendEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      throw AppError.validation(
        'Invalid notification payload',
        parsed.error.issues,
      );
    }

    const notification = await service.queueEmail(parsed.data);

    res.status(202).json({
      data: { id: notification.id, status: notification.status },
    });
  } catch (error) {
    next(error);
  }
}

export async function getNotification(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = req.params.id;

    if (typeof id !== 'string' || !id) {
      throw AppError.validation('Notification id is required');
    }

    const notification = await service.getNotification(id);

    // The rendered body and recipient are PII — the status view returns
    // delivery metadata only.
    res.json({
      data: {
        id: notification.id,
        channel: notification.channel,
        status: notification.status,
        template: notification.template,
        attempts: notification.attempts,
        providerRef: notification.providerRef,
        sentAt: notification.sentAt,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
