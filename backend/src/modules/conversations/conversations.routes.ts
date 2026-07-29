import { Router } from 'express';

import { apiRateLimit, chatRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './conversations.controller.js';

/*
 * Order conversations, mounted at `/v1/orders/:orderId/conversation`.
 *
 * One router serves both surfaces rather than a customer copy and a staff copy:
 * the participant rule is a property of the order (its customer and its
 * assignee), not of which portal the request came from, so splitting it in two
 * would mean maintaining the same lock twice. The service decides who may read
 * and who may post; both roles reach the same endpoints and get different views
 * of the same thread.
 *
 * `mergeParams` because `:orderId` is owned by the parent orders router.
 *
 * Posting uses the chat limiter rather than the write one — the same posture the
 * socket transport will carry, so a message is rate-limited identically however
 * it arrives (AGENTS.md, Live Chat).
 */

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', apiRateLimit, controller.getConversation);
router.post('/messages', chatRateLimit, controller.sendMessage);

export const conversationsRouter = router;
