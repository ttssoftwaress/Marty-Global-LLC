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
 * Two writes, neither of which moves money: chasing an unpaid invoice, and
 * closing out a stray transfer with a note. Nothing in this module sends funds
 * anywhere.
 */

const router = Router();

router.use(requirePermission('payments'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/revenue', apiRateLimit, controller.getRevenue);
router.get('/ledger', apiRateLimit, controller.listLedger);

/*
 * Chasing an unpaid invoice. Anyone holding the `payments` area may send one,
 * scoped to the invoices their own ledger already shows them — this is the work
 * that area exists for, not an administrator's judgement call.
 *
 * No Idempotency-Key: the 24-hour cooldown is claimed with a conditional update
 * before anything is queued, so a replay finds the claim taken and sends
 * nothing. `sensitiveRateLimit` because the side effect is an email to a
 * customer.
 */
router.post(
  '/ledger/:quoteId/remind',
  sensitiveRateLimit,
  controller.remindQuote,
);

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
/*
 * The manual settlement queue: payments only a person can close — every wire,
 * plus USDT while automatic verification is switched off.
 *
 * The list is readable by anyone with the `payments` area, scoped like the
 * ledger. The two writes take `payments.settle` on top: confirming that money we
 * cannot see arrived is the highest-consequence action in this module, since
 * nothing downstream will ever contradict it — there is no bank feed to
 * disagree with the person who clicked. Its own grantable area rather than
 * admin-only, so it can be delegated to whoever actually reads the statements
 * (lib/permissions.ts).
 *
 * No Idempotency-Key on either. Both writes are conditional on the payment still
 * being open, so a replay updates nothing and the first decision stands — the
 * retry-safety AGENTS.md asks for, with the status as the guard rather than a
 * key. `sensitiveRateLimit` because settling emails the customer and moves an
 * order to PAID.
 */
router.get('/settlements', apiRateLimit, controller.listSettlements);
router.post(
  '/settlements/:paymentId/settle',
  requirePermission('payments.settle'),
  sensitiveRateLimit,
  controller.settlePayment,
);
router.post(
  '/settlements/:paymentId/reject',
  requirePermission('payments.settle'),
  sensitiveRateLimit,
  controller.rejectSettlement,
);

router.get('/unmatched', apiRateLimit, controller.listUnmatched);
router.post(
  '/unmatched/:transferId/resolve',
  requireAdmin,
  sensitiveRateLimit,
  controller.resolveUnmatched,
);

export const adminPaymentsRouter = router;
