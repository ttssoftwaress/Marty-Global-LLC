import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../../guards/index.js';
import { AppError } from '../../../lib/app-error.js';
import { pathParam } from '../../../lib/params.js';
import * as service from './support.service.js';
import {
  listConversationsQuerySchema,
  sendMessageSchema,
  updateConversationSchema,
} from './support.validation.js';

// Thin: validate → call service → respond with the { data } envelope.

export async function listConversations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listConversationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid inbox query', parsed.error.issues);
    }

    res.json({ data: await service.listConversations(getAuth(req), parsed.data) });
  } catch (error) {
    next(error);
  }
}

export async function unattendedCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({ data: { count: await service.countUnattended(getAuth(req)) } });
  } catch (error) {
    next(error);
  }
}

export async function getThread(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    res.json({
      data: await service.getThread(getAuth(req), pathParam(req, 'conversationId')),
    });
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
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid message', parsed.error.issues);
    }

    const message = await service.sendMessage(
      getAuth(req),
      pathParam(req, 'conversationId'),
      parsed.data,
    );
    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await service.markStaffRead(getAuth(req), pathParam(req, 'conversationId')),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = updateConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid conversation update', parsed.error.issues);
    }

    const thread = await service.updateConversation(
      getAuth(req),
      pathParam(req, 'conversationId'),
      parsed.data,
    );
    res.json({ data: thread });
  } catch (error) {
    next(error);
  }
}
