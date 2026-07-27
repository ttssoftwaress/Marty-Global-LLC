import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../guards/auth-context.js';
import { isStaff } from '../../guards/ownership.js';
import { AppError } from '../../lib/app-error.js';
import * as service from './conversations.service.js';
import {
  sendMessageSchema,
  staffSendMessageSchema,
} from './conversations.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orderId = requireParam(req.params.orderId, 'Order id is required');
    const conversation = await service.getOrderConversation(getAuth(req), orderId);
    res.json({ data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const auth = getAuth(req);
    const orderId = requireParam(req.params.orderId, 'Order id is required');

    /*
     * Two schemas, chosen by who is asking. A customer's payload is parsed
     * against the one with no `kind` field at all, so a customer cannot post an
     * internal note even by sending the staff shape — the field is stripped
     * before the service ever sees it, rather than being checked away later.
     */
    const parsed = isStaff(auth)
      ? staffSendMessageSchema.safeParse(req.body)
      : sendMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      throw AppError.validation('Invalid message payload', parsed.error.issues);
    }

    const message = await service.sendMessage(auth, orderId, parsed.data);
    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

// Express types a route param as string | string[]; only a single segment is ever
// valid here, so an array is a malformed path rather than something to join.
function requireParam(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value) {
    throw AppError.validation(message);
  }
  return value;
}
