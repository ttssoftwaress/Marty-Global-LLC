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

/*
 * The room picker, in two steps: rooms rather than customers, because a scan is
 * filed into one of a customer's addresses. `/rooms/names` returns the matching
 * names deduplicated, and `/rooms` the addresses under a chosen one — a name
 * alone cannot identify a room, since two rooms may share it.
 *
 * The literal segment is declared first so `/rooms/names` is never read as a
 * room lookup.
 */
router.get('/rooms/names', apiRateLimit, controller.searchRoomNames);
router.get('/rooms', apiRateLimit, controller.listRoomsByName);

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
