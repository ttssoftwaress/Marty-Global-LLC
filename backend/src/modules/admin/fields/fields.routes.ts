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
 * There is no DELETE. A field a historical order holds an answer for must stay
 * resolvable (AGENTS.md — ask before any hard delete); retiring one is a PATCH
 * setting `archived`, which removes it from the picker without touching the
 * forms or answers that already reference it.
 */

const router = Router();

router.use(requirePermission('catalog'));

router.get('/', apiRateLimit, controller.listFields);

router.post('/', requireAdmin, sensitiveRateLimit, controller.createField);
router.patch('/:fieldId', requireAdmin, sensitiveRateLimit, controller.updateField);

export const adminFieldsRouter = router;
