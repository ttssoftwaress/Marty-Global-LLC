import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  requireAuth,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './notifications.controller.js';

const router = Router();

// Two audiences share this module, so they get two subtrees rather than one
// guard over both:
//   - the root paths are the signed-in customer's own in-app feed
//   - /deliveries/* is the outbound email ledger — admin only, never a customer
// The admin subtree is mounted first so its path can never be captured by the
// customer routes below.
router.use(requireAuth);

const deliveries = Router();
deliveries.use(requireAdmin);
deliveries.post('/email', sensitiveRateLimit, controller.queueEmail);
deliveries.get('/:id', apiRateLimit, controller.getNotification);

router.use('/deliveries', deliveries);

// The customer's in-app feed (`/app/notifications` and the top-bar panel).
router.get('/', apiRateLimit, controller.listFeed);
router.post('/read-all', apiRateLimit, controller.markAllRead);
router.post('/:id/read', apiRateLimit, controller.markRead);

export const notificationsRouter = router;
