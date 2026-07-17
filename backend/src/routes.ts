import { Router } from 'express';

import { healthRouter } from './modules/health/health.routes.js';
import { leadsRouter } from './modules/leads/leads.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/leads', leadsRouter);

export const routes = router;
