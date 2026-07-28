import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './catalog.controller.js';

/*
 * The catalog is mounted under the admin router, which already applies
 * requireAuth + requireStaff. Reading it needs the `catalog` permission area.
 *
 * Writing is admin-only on top of that: a catalog change decides what every
 * customer can order and what they will be quoted, which is the "destructive or
 * account-level" case AGENTS.md reserves for admin (guards/require-role.ts).
 */

const router = Router();

router.use(requirePermission('catalog'));

router.get('/regions', apiRateLimit, controller.listRegions);
router.get('/services', apiRateLimit, controller.listServices);
router.get('/services/:serviceId', apiRateLimit, controller.getService);

router.post('/services', requireAdmin, sensitiveRateLimit, controller.createService);
router.patch(
  '/services/:serviceId',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateService,
);
/*
 * DELETE is offered, but only ever succeeds for a service nothing was ordered or
 * delivered under — the service refuses it otherwise and the caller deactivates
 * instead. That keeps "added by mistake" cleanable without letting a service
 * disappear out from under the orders placed for it, and even a successful call
 * writes `deletedAt` rather than removing the row.
 */
router.delete(
  '/services/:serviceId',
  requireAdmin,
  sensitiveRateLimit,
  controller.deleteService,
);

/*
 * The delivery half of a service — what it RETURNS, and the follow-up actions it
 * offers. Separate endpoints from the service PATCH above because they are
 * edited on their own cards by a different decision: what a service sells is
 * settled when it is created, what it delivers once the team knows what the
 * filing produces.
 *
 * Admin-only for the same reason the rest of the catalog is: a change here
 * reshapes every record already delivered under the service, and adds or removes
 * buttons on every customer's page.
 */
router.put(
  '/services/:serviceId/result-schema',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateResultSchema,
);
router.put(
  '/services/:serviceId/request-types',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateRequestTypes,
);

export const adminCatalogRouter = router;
