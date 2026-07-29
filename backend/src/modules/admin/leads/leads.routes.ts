import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './leads.controller.js';

const router = Router();

router.use(requirePermission('leads'));

router.get('/', apiRateLimit, controller.listLeads);
router.patch('/:id/handled', apiRateLimit, controller.setHandled);

export const adminLeadsRouter = router;
