import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
import * as controller from './services.controller.js';

const router = Router();

// The catalog is customer-facing but not public: only signed-in users reach the
// portal, so the whole router sits behind requireAuth like the rest of /v1.
router.use(requireAuth);

router.get('/catalog', apiRateLimit, controller.getCatalog);

export const servicesRouter = router;
