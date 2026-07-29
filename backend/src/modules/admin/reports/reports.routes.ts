import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './reports.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `reports` area. Every route is a read.
 */

const router = Router();

router.use(requirePermission('reports'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/revenue', apiRateLimit, controller.getRevenue);
router.get('/breakdown/:dimension', apiRateLimit, controller.getBreakdown);
router.get('/funnel', apiRateLimit, controller.getFunnel);
router.get('/growth', apiRateLimit, controller.getGrowth);
// The export runs all five reads above in one request, so it carries the
// tighter limit rather than the general read allowance.
router.get('/export', sensitiveRateLimit, controller.getExport);

export const adminReportsRouter = router;
