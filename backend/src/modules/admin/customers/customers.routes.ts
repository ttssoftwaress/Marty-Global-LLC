import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './customers.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `customers` area. Every route here is a read except the two at the
 * bottom — nothing on these screens edits a customer's own details.
 *
 * `/summary` is declared before `/:customerId` so the literal wins; otherwise the
 * word "summary" would be read as a customer id.
 */

const router = Router();

router.use(requirePermission('customers'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/', apiRateLimit, controller.listCustomers);
router.get('/:customerId', apiRateLimit, controller.getCustomer);
router.get('/:customerId/orders', apiRateLimit, controller.listCustomerOrders);

/*
 * Suspending an account and restoring it. Both take `customers.ban` on top of
 * the area: opening a customer's record is ordinary admin work, while ending
 * their access is a decision about the relationship, so it is granted separately
 * and an admin hands it out per member (lib/permissions.ts).
 *
 * No Idempotency-Key. Each write is conditional on the account still being in
 * the state it is changing from, so a replay updates nothing and the first
 * decision stands — the retry-safety AGENTS.md asks for, with the ban flag as
 * the guard rather than a key. `sensitiveRateLimit` because a suspension ends
 * every session the customer holds.
 */
router.post(
  '/:customerId/ban',
  requirePermission('customers.ban'),
  sensitiveRateLimit,
  controller.banCustomer,
);
router.post(
  '/:customerId/unban',
  requirePermission('customers.ban'),
  sensitiveRateLimit,
  controller.unbanCustomer,
);

export const adminCustomersRouter = router;
