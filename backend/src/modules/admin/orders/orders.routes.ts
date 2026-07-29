import { Router } from 'express';

import {
  apiRateLimit,
  requireIdempotencyKey,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './orders.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `orders` area.
 *
 * The PATCH stays staff-level rather than admin-only: advancing and assigning an
 * order is the daily work of the reviewers this area exists for. It is still
 * rate-limited as a write and fully audited.
 *
 * Two of the writes here carry `requireIdempotencyKey`, and the PATCH does not.
 * The difference is not the surface but the shape: the PATCH compares the
 * requested status and assignee against what the order already holds and does
 * nothing when they match, so a replay is inert on its own. The two POSTs insert
 * a row and queue the customer a message every time they are called — there is
 * no current state for them to compare against — so retry-safety has to come
 * from the key (AGENTS.md, API Conventions).
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
/*
 * Asking the customer for a document. A write that leaves the building — it
 * queues them an email and puts a row on their order — so it takes the same
 * limiter as the reply below, and a key so a retry cannot ask them twice.
 */
router.post(
  '/:orderId/documents/request',
  sensitiveRateLimit,
  requireIdempotencyKey,
  controller.requestDocument,
);
router.patch('/:orderId', sensitiveRateLimit, controller.updateOrder);
// Replying to a customer is a write that leaves the building (it queues them an
// email), so it takes the same limiter as the status change beside it — and the
// same key as the document request above, for the same reason.
router.post(
  '/:orderId/activity',
  sensitiveRateLimit,
  requireIdempotencyKey,
  controller.addActivity,
);

export const adminOrdersRouter = router;
