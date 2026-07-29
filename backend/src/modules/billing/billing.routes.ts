import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './billing.controller.js';

const router = Router();

// Both routes serve the signed-in customer's own billing; the whole router sits
// behind requireAuth and the service scopes every query to req.auth.userId.
router.use(requireAuth);

router.get('/overview', apiRateLimit, controller.getOverview);
router.get('/payments', apiRateLimit, controller.listPayments);

export const billingRouter = router;
