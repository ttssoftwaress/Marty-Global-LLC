import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './orders.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `orders` area.
 *
 * The PATCH stays staff-level rather than admin-only: advancing and assigning an
 * order is the daily work of the reviewers this area exists for. It is still
 * rate-limited as a write and fully audited.
 */

const router = Router();

router.use(requirePermission('orders'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/', apiRateLimit, controller.listOrders);
router.get('/:orderId', apiRateLimit, controller.getOrder);
router.patch('/:orderId', sensitiveRateLimit, controller.updateOrder);
// Replying to a customer is a write that leaves the building (it queues them an
// email), so it takes the same limiter as the status change beside it.
router.post('/:orderId/activity', sensitiveRateLimit, controller.addActivity);

export const adminOrdersRouter = router;
