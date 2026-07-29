import { Router } from 'express';

import {
  apiRateLimit,
  requireAuth,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './results.controller.js';

/*
 * The customer's delivered services — the per-service pages listing what they
 * own, and the follow-up requests they raise against a record.
 *
 * Every route serves the signed-in customer's own records: the whole router sits
 * behind requireAuth, and the service scopes each query to `auth.userId` rather
 * than trusting a path id. A record belonging to somebody else 404s exactly like
 * one that does not exist, so the URL is never an enumeration oracle.
 */

const router = Router();

router.use(requireAuth);

// The sidebar's "My services" group — which services this customer owns records
// for, with counts.
router.get('/services', apiRateLimit, controller.listOwnedServices);

// Every request across every service, for the customer's own requests view.
// Mounted ahead of `/:slug` so the literal segment is not swallowed by it.
router.get('/requests', apiRateLimit, controller.listRequests);

// One record, by id. Also ahead of `/:slug`, for the same reason.
router.get('/records/:resultId', apiRateLimit, controller.getResult);

// Raising a follow-up puts work in front of staff, so it is limited as a write.
router.post(
  '/records/:resultId/requests',
  sensitiveRateLimit,
  controller.createRequest,
);

// The per-service list page. Last, so it cannot shadow the literal paths above.
router.get('/:slug', apiRateLimit, controller.listResults);

export const resultsRouter = router;
