import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './payments.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `payments` area.
 *
 * Every route here reads. The one write is closing out a stray transfer, which
 * is an annotation rather than a movement of money — nothing in this module
 * sends funds anywhere.
 */

const router = Router();

router.use(requirePermission('payments'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/revenue', apiRateLimit, controller.getRevenue);
router.get('/ledger', apiRateLimit, controller.listLedger);

/*
 * The unattributed-transfer queue: USDT that arrived matching no payment.
 *
 * Readable by anyone with the `payments` area — stray money is a reconciliation
 * problem, and hiding it from the people who work the ledger is what made it
 * invisible in the first place. Closing one out is admin-only: it is a judgement
 * about money nobody has claimed, and it is the only write here that a customer
 * record will never contradict.
 *
 * No Idempotency-Key. The resolve is conditional on the row still being open, so
 * a replay updates nothing and the first resolution stands — the retry-safety
 * AGENTS.md asks for, without a key to carry, because nothing here moves money.
 */
router.get('/unmatched', apiRateLimit, controller.listUnmatched);
router.post(
  '/unmatched/:transferId/resolve',
  requireAdmin,
  sensitiveRateLimit,
  controller.resolveUnmatched,
);

export const adminPaymentsRouter = router;
