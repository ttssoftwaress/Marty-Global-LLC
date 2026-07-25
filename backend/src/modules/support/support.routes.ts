import { Router } from 'express';

import { apiRateLimit, chatRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './support.controller.js';

const router = Router();

// Every route serves the signed-in customer's own conversations; the whole
// router sits behind requireAuth and the service asserts ownership per thread.
// Staff/admin reach any thread through the same service checks.
router.use(requireAuth);

router.get('/conversations', apiRateLimit, controller.listConversations);
router.get('/conversations/:id', apiRateLimit, controller.getConversation);

// Inbound messages carry the same rate limit as the socket transport
// (AGENTS.md, Live Chat) — one posture regardless of how a message arrives.
router.post('/conversations/:id/messages', chatRateLimit, controller.sendMessage);

export const supportRouter = router;
