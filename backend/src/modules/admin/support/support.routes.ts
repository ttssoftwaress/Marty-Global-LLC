import { Router } from 'express';

import {
  apiRateLimit,
  chatRateLimit,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './support.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `support` area.
 *
 * Posting a reply uses the chat limiter rather than the write one: replying is
 * the job, and a support agent working a busy inbox would trip a 10/minute
 * budget doing nothing wrong (AGENTS.md — inbound messages are rate-limited per
 * actor, the same posture as the socket path this will share).
 */

const router = Router();

router.use(requirePermission('support'));

router.get('/conversations', apiRateLimit, controller.listConversations);
router.get('/conversations/:conversationId', apiRateLimit, controller.getThread);
router.post(
  '/conversations/:conversationId/messages',
  chatRateLimit,
  controller.sendMessage,
);
// The REST twin of the socket's read event, for a client without a live
// connection. Cheap and idempotent, so it carries the general limiter.
router.post('/conversations/:conversationId/read', apiRateLimit, controller.markRead);
router.patch(
  '/conversations/:conversationId',
  sensitiveRateLimit,
  controller.updateConversation,
);

export const adminSupportRouter = router;
