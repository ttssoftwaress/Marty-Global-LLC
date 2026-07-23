import { Router } from 'express';

import { healthRouter } from './modules/health/health.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/notifications', notificationsRouter);

export const routes = router;
