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
/*
 * A short-TTL link to one document on the order — the View and Download controls
 * on the Documents card. A GET because it reads; the service audits it anyway,
 * since what it hands back is access to the customer's own paperwork.
 */
router.get(
  '/:orderId/documents/:documentId',
  apiRateLimit,
  controller.getDocumentLink,
);
router.patch('/:orderId', sensitiveRateLimit, controller.updateOrder);
// Replying to a customer is a write that leaves the building (it queues them an
// email), so it takes the same limiter as the status change beside it.
router.post('/:orderId/activity', sensitiveRateLimit, controller.addActivity);

export const adminOrdersRouter = router;
