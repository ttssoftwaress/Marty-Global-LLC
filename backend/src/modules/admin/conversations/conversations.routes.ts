import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './conversations.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `orders` area — order conversations are part of working an order,
 * not of the support queue, so they follow the orders permission rather than the
 * support one.
 *
 * Read-only. Replying happens on the order's own conversation endpoint, where the
 * assignee check lives; there is no second write path here that could miss it.
 */

const router = Router();

router.use(requirePermission('orders'));

router.get('/', apiRateLimit, controller.listMyConversations);

export const adminConversationsRouter = router;
