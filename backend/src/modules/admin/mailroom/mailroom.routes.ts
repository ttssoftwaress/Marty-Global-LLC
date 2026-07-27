import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './mailroom.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `mailroom` area.
 *
 * The writes stay staff-level: filing a scan and working the queue is the mail
 * operator's daily job, and that role exists precisely to do it without an admin
 * present. All three are rate-limited as writes and audited.
 */

const router = Router();

router.use(requirePermission('mailroom'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/customers', apiRateLimit, controller.searchCustomers);

router.get('/scans', apiRateLimit, controller.listScans);
router.post('/scans', sensitiveRateLimit, controller.uploadScan);

// The literal segments are declared before `/:requestId` so a route like
// `/requests/detail` could never be read as an id.
router.get('/requests', apiRateLimit, controller.listRequests);
router.get('/requests/:requestId', apiRateLimit, controller.getRequest);
router.post('/requests/:requestId/process', sensitiveRateLimit, controller.processRequest);
router.post('/requests/:requestId/resolve', sensitiveRateLimit, controller.resolveRequest);

router.get('/log', apiRateLimit, controller.listLog);

export const adminMailroomRouter = router;
