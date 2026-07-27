import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import * as controller from './notifications.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff).
 *
 * Deliberately not narrowed by a permission area, for the same reason the
 * dashboard isn't: this is the signed-in member's own inbox, scoped by userId in
 * the service, not a window onto anyone else's records. A member without the
 * `payments` grant can be told a payment failed — following the link is what the
 * permission guard stops. Adding a `notifications` permission would instead let
 * a member be locked out of their own messages.
 */

const router = Router();

router.get('/', apiRateLimit, controller.listFeed);
router.post('/read-all', apiRateLimit, controller.markAllRead);
router.post('/:id/read', apiRateLimit, controller.markRead);

export const adminNotificationsRouter = router;
