import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './fields.controller.js';

/*
 * The field registry, mounted under the admin router (requireAuth +
 * requireStaff already applied). It carries the `catalog` area, because the
 * registry IS part of the catalog: these are the questions services are built
 * from, and anyone who may shape a service's form needs to read them.
 *
 * Writing is admin-only on top of that, matching the catalog's own rule — a
 * change here reshapes what every service asking the field collects, which is
 * the "account-level" case AGENTS.md reserves for admin.
 *
 * DELETE only ever succeeds for a field nothing has ever referenced — no service
 * form, no request type, no stored answer. A question registered by mistake
 * should be removable rather than sitting archived forever, but a field a
 * historical order holds an answer for must stay resolvable (AGENTS.md — ask
 * before any hard delete), so the service refuses those and the caller archives
 * instead: a PATCH setting `archived`, which removes it from the picker without
 * touching the forms or answers that already reference it.
 */

const router = Router();

router.use(requirePermission('catalog'));

router.get('/', apiRateLimit, controller.listFields);

router.post('/', requireAdmin, sensitiveRateLimit, controller.createField);
router.patch('/:fieldId', requireAdmin, sensitiveRateLimit, controller.updateField);
router.delete('/:fieldId', requireAdmin, sensitiveRateLimit, controller.deleteField);

export const adminFieldsRouter = router;
