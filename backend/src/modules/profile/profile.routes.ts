import { Router } from 'express';

import { apiRateLimit, requireAuth, sensitiveRateLimit } from '../../guards/index.js';
import * as controller from './profile.controller.js';

const router = Router();

// Every route reads or writes the signed-in customer's own account; the whole
// router sits behind requireAuth and the service scopes each query to
// req.auth.userId — an id is never taken from the path or body.
//
// Changing a password is not here: Better Auth owns password handling and serves
// its own route under /api/auth/* (AGENTS.md, Auth).
router.use(requireAuth);

router.get('/', apiRateLimit, controller.getProfile);
// A profile write can change the account's email, so it takes the tighter limiter.
router.patch('/', sensitiveRateLimit, controller.updateProfile);

router.get('/company', apiRateLimit, controller.getCompany);
router.patch('/company', sensitiveRateLimit, controller.updateCompany);

router.get(
  '/notification-preferences',
  apiRateLimit,
  controller.getNotificationPreferences,
);
router.patch(
  '/notification-preferences',
  apiRateLimit,
  controller.updateNotificationPreferences,
);

export const profileRouter = router;
