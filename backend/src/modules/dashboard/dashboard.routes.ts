import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './dashboard.controller.js';

const router = Router();

// The dashboard serves the signed-in customer's own summary; the service scopes
// every figure to req.auth.userId.
router.use(requireAuth);

router.get('/summary', apiRateLimit, controller.getSummary);

export const dashboardRouter = router;
