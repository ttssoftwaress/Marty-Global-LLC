import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './leads.controller.js';

const router = Router();

router.use(requirePermission('leads'));

router.get('/', apiRateLimit, controller.listLeads);
/*
 * One lead in full — the queue's expanded row. The list carries a preview only,
 * because the message is the record's one unbounded field and a page of the
 * queue would otherwise ship fifty of them to render four clamped lines.
 */
router.get('/:id', apiRateLimit, controller.getLead);
router.patch('/:id/handled', apiRateLimit, controller.setHandled);

export const adminLeadsRouter = router;
