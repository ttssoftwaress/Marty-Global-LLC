import type { NextFunction, Request, Response } from 'express';

import { verifyTurnstile } from '../../config/turnstile.js';
import { AppError } from '../../lib/app-error.js';
import * as service from './guest.service.js';
import { guestMessageSchema, startGuestChatSchema } from './guest.validation.js';

/*
 * The public face of the anonymous chat. Thin like every controller, with one
 * addition: it is the only place in the app that reads a caller's identity from
 * a header rather than a session, so that read is isolated here.
 */

// The token travels in a header rather than a cookie: the widget runs on the
// marketing site and a cookie would be sent on every request to the API,
// including authenticated ones, where it has no business being.
const GUEST_TOKEN_HEADER = 'x-guest-token';

function readToken(req: Request): string | undefined {
  const value = req.headers[GUEST_TOKEN_HEADER];
  return typeof value === 'string' && value ? value : undefined;
}

export async function startChat(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = startGuestChatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid chat details', parsed.error.issues);
    }

    // Before anything is written. This endpoint is the one door into the database
    // that needs no session, so the challenge is the door's lock.
    const verified = await verifyTurnstile(parsed.data.turnstileToken, req.ip);
    if (!verified) {
      throw AppError.validation('Verification failed — please try again');
    }

    const started = await service.startChat(parsed.data, req.ip);
    res.status(201).json({ data: started });
  } catch (error) {
    next(error);
  }
}

export async function getThread(req: Request, res: Response, next: NextFunction) {
  try {
    const guest = service.assertGuest(await service.resolveGuest(readToken(req)));
    res.json({ data: await service.getThread(guest) });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = guestMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid message payload', parsed.error.issues);
    }

    const guest = service.assertGuest(await service.resolveGuest(readToken(req)));
    const message = await service.sendMessage(guest, parsed.data);
    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}
