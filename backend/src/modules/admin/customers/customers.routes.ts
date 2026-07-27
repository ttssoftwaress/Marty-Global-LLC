import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './customers.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `customers` area. Every route is a read — nothing on these screens
 * edits a customer, so there is no write side to guard.
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

export const adminCustomersRouter = router;
