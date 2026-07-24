import { Router } from 'express';

import { healthRouter } from './modules/health/health.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/notifications', notificationsRouter);
router.use('/services', servicesRouter);
router.use('/orders', ordersRouter);

export const routes = router;
