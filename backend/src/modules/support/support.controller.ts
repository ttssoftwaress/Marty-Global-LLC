import type { NextFunction, Request, Response } from 'express';

import { getAuth } from '../../guards/index.js';
import { AppError } from '../../lib/app-error.js';
import * as service from './support.service.js';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
} from './support.validation.js';

// Thin: validate → call service → respond with the { data } envelope. The
// AuthContext is resolved here, so the service takes identity rather than a
// request and the socket handlers can call exactly the same functions.

export async function listConversations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = listConversationsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw AppError.validation('Invalid conversations query', parsed.error.issues);
    }

    const conversations = await service.listConversations(getAuth(req), parsed.data);
    res.json({ data: conversations });
  } catch (error) {
    next(error);
  }
}

export async function getConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = requireParam(req.params.id, 'Conversation id is required');
    const thread = await service.getConversation(getAuth(req), id);
    res.json({ data: thread });
  } catch (error) {
    next(error);
  }
}

export async function createConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createConversationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid conversation payload', parsed.error.issues);
    }

    const conversation = await service.createConversation(getAuth(req), parsed.data);
    res.status(201).json({ data: conversation });
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
    const id = requireParam(req.params.id, 'Conversation id is required');

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.validation('Invalid message payload', parsed.error.issues);
    }

    const message = await service.sendMessage(getAuth(req), id, parsed.data);
    res.status(201).json({ data: message });
  } catch (error) {
    next(error);
  }
}

export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    const id = requireParam(req.params.id, 'Conversation id is required');
    const result = await service.markCustomerRead(getAuth(req), id);
    res.json({ data: result });
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
