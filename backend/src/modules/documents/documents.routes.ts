import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './documents.controller.js';

const router = Router();

/*
 * Every route serves the signed-in customer's own documents; the whole router
 * sits behind requireAuth and the service scopes each source query to
 * req.auth.userId.
 *
 * Read-only by design: nothing is uploaded here. A file is always attached to
 * the thing that owns it (an order, a record, a mail item), so this module
 * gathers and serves — it never writes.
 */
router.use(requireAuth);

router.get('/', apiRateLimit, controller.listDocuments);
router.get('/stats', apiRateLimit, controller.getStats);

// The download mints a short-TTL link per request rather than handing one out
// with the list. `:source` is half the address — see the controller.
router.get('/:source/:documentId/link', apiRateLimit, controller.getDownloadLink);

export const documentsRouter = router;
