import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './result-fields.controller.js';

/*
 * The result registry — the vocabulary of facts services deliver. Mounted under
 * the admin router (requireAuth + requireStaff already applied), and carrying
 * the `catalog` area for the same reason the request registry does: these are
 * the facts services are built to return, so anyone who may shape a service's
 * delivery needs to read them.
 *
 * Writing is admin-only on top of that. A change here reshapes what every
 * service returning the field delivers — and what every record already delivered
 * under it renders — which is the account-level case AGENTS.md reserves for
 * admin.
 *
 * There is no DELETE, exactly as in the request registry: a delivered record
 * holding a value for a field must stay readable (AGENTS.md — ask before any
 * hard delete). Retiring one is a PATCH setting `archived`.
 */

const router = Router();

router.use(requirePermission('catalog'));

router.get('/', apiRateLimit, controller.listResultFields);

router.post('/', requireAdmin, sensitiveRateLimit, controller.createResultField);
router.patch(
  '/:fieldId',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateResultField,
);

export const adminResultFieldsRouter = router;
