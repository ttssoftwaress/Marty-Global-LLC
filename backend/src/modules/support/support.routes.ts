import { Router } from 'express';

import {
  apiRateLimit,
  chatRateLimit,
  requireAuth,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './support.controller.js';

const router = Router();

// Every route serves the signed-in customer's own conversations; the whole
// router sits behind requireAuth and the service asserts ownership per thread.
// Staff/admin reach any thread through the same service checks.
router.use(requireAuth);

router.get('/conversations', apiRateLimit, controller.listConversations);
router.get('/conversations/:id', apiRateLimit, controller.getConversation);

/*
 * Opening a thread is limited harder than posting into one: a customer replies to
 * an existing conversation many times an hour and legitimately, but nobody opens
 * ten new support cases a minute. Each one lands in the team's queue.
 */
router.post('/conversations', sensitiveRateLimit, controller.createConversation);

// Inbound messages carry the same rate limit as the socket transport
// (AGENTS.md, Live Chat) — one posture regardless of how a message arrives.
router.post('/conversations/:id/messages', chatRateLimit, controller.sendMessage);

// The REST twin of the socket's read event, for the client that has just loaded
// a thread without a live connection.
router.post('/conversations/:id/read', apiRateLimit, controller.markRead);

export const supportRouter = router;
