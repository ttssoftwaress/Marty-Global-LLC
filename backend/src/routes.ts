import { Router } from 'express';

import { billingRouter } from './modules/billing/billing.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { mailroomRouter } from './modules/mailroom/mailroom.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';
import { supportRouter } from './modules/support/support.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/notifications', notificationsRouter);
router.use('/services', servicesRouter);
router.use('/orders', ordersRouter);
router.use('/dashboard', dashboardRouter);
router.use('/billing', billingRouter);
router.use('/mailrooms', mailroomRouter);
router.use('/support', supportRouter);
router.use('/profile', profileRouter);

export const routes = router;
