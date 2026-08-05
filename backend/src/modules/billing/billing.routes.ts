import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './billing.controller.js';

const router = Router();

// Every route serves the signed-in customer's own billing; the whole router sits
// behind requireAuth and the service scopes every query to req.auth.userId.
router.use(requireAuth);

router.get('/overview', apiRateLimit, controller.getOverview);
router.get('/payments', apiRateLimit, controller.listPayments);

/*
 * The two expanded-row reads behind the billing screen's tables.
 *
 * Both exist so the lists above stay cheap: the overview is loaded by the
 * billing screen AND the dashboard's billing card, so itemising every open
 * quote on it costs twice; and the history was minting a presigned invoice URL
 * per row, which both signed twenty URLs to serve at most one and started every
 * TTL at page load. Each is fetched when a customer opens that row.
 *
 * Mounted after `/payments` so the static path is matched before `:paymentId`.
 */
router.get('/quotes/:quoteId', apiRateLimit, controller.getQuote);
router.get('/payments/:paymentId', apiRateLimit, controller.getPayment);

export const billingRouter = router;
