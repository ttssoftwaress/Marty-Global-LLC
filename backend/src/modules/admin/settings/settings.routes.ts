import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './settings.controller.js';

/*
 * Business settings, mounted under the admin router (requireAuth + requireStaff
 * already applied). Reading needs the `settings` area; writing is admin-only on
 * top of that.
 *
 * The write rule matches the catalog's for the same reason: closing a location
 * decides what every customer can order and removes a filter from every admin
 * queue, which is the "account-level" case AGENTS.md reserves for admin
 * (guards/require-role.ts).
 *
 * DELETE is offered here, unlike the catalog registries, but only ever succeeds
 * for a row nothing references — the service refuses it otherwise and the caller
 * deactivates instead. That keeps "added by mistake" cleanable without letting a
 * jurisdiction disappear out from under the filings made in it.
 */

const router = Router();

router.use(requirePermission('settings'));

// --- Locations -----------------------------------------------------------
router.get('/locations', apiRateLimit, controller.listLocations);
router.post('/locations', requireAdmin, sensitiveRateLimit, controller.createLocation);
/*
 * Reordering is declared before `/locations/:code` so the literal segment is not
 * swallowed by the parameter — Express matches in mount order, and "order" is a
 * valid-looking code.
 */
router.put(
  '/locations/order',
  requireAdmin,
  sensitiveRateLimit,
  controller.reorderLocations,
);
router.patch(
  '/locations/:code',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateLocation,
);
router.delete(
  '/locations/:code',
  requireAdmin,
  sensitiveRateLimit,
  controller.deleteLocation,
);

// --- Mail carriers -------------------------------------------------------
router.get('/carriers', apiRateLimit, controller.listCarriers);
router.post('/carriers', requireAdmin, sensitiveRateLimit, controller.createCarrier);
router.put(
  '/carriers/order',
  requireAdmin,
  sensitiveRateLimit,
  controller.reorderCarriers,
);
router.patch(
  '/carriers/:code',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateCarrier,
);
router.delete(
  '/carriers/:code',
  requireAdmin,
  sensitiveRateLimit,
  controller.deleteCarrier,
);

/*
 * --- Outbound email ------------------------------------------------------
 *
 * The switch that stops every email leaving the system, and the mirror of the
 * automatic-verification switch on the payments screen. Admin-only to write for
 * the same reason as everything else here, and more so: turning it off means
 * customers stop hearing about their filings, which is an account-level decision
 * rather than a curation one.
 *
 * Under `settings` rather than its own area — it is a single operational switch
 * on the same screen, not a section — and, unlike the customer notification
 * preferences at `/v1/notifications/preferences`, it is not anybody's choice
 * about what they receive.
 */
router.get('/notifications', apiRateLimit, controller.readNotificationSettings);
router.patch(
  '/notifications',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateNotificationSettings,
);

export const adminSettingsRouter = router;
