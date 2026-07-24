import { Router } from 'express';

import { apiRateLimit, requireAuth, sensitiveRateLimit } from '../../guards/index.js';
import * as controller from './orders.controller.js';

const router = Router();

// Every route is for the signed-in customer's own orders; the whole router sits
// behind requireAuth and the service scopes each query to req.auth.userId.
router.use(requireAuth);

// Creating an order is a state change — the tighter limiter, like other writes.
router.post('/', sensitiveRateLimit, controller.createOrder);
router.get('/', apiRateLimit, controller.listOrders);
router.get('/:id', apiRateLimit, controller.getOrder);

export const ordersRouter = router;
