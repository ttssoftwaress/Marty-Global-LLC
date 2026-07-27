import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  requireIdempotencyKey,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './payments.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `payments` area.
 *
 * The refund is admin-only and carries an Idempotency-Key: it is a mutating
 * payment endpoint, and AGENTS.md requires those to be retry-safe. Moving money
 * back is exactly the "destructive" case the admin-only rule exists for.
 */

const router = Router();

router.use(requirePermission('payments'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/revenue', apiRateLimit, controller.getRevenue);
router.get('/ledger', apiRateLimit, controller.listLedger);
router.get('/refunds', apiRateLimit, controller.listRefunds);

router.post(
  '/:paymentId/refund',
  requireAdmin,
  requireIdempotencyKey,
  sensitiveRateLimit,
  controller.refundPayment,
);

export const adminPaymentsRouter = router;
