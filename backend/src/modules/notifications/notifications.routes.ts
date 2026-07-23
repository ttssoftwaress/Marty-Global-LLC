import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  requireAuth,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './notifications.controller.js';

const router = Router();

// Internal plumbing: other modules queue email by calling the service directly.
// These routes exist so admins can dispatch and inspect a notification — admin
// only, never public.
router.use(requireAuth, requireAdmin);

router.post('/email', sensitiveRateLimit, controller.queueEmail);
router.get('/:id', apiRateLimit, controller.getNotification);

export const notificationsRouter = router;
