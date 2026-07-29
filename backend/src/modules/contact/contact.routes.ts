import { Router } from 'express';

import { optionalAuth, publicRateLimit } from '../../guards/index.js';
import * as controller from './contact.controller.js';

/*
 * PUBLIC — no session required (AGENTS.md: public endpoints are explicitly
 * marked and rate-limited). Turnstile-verified server-side in the controller,
 * plus the same per-IP public limiter as guest-chat's session creation.
 * `optionalAuth` lets a signed-in visitor's submission carry their userId
 * without requiring one — the marketing site is public by design.
 */

const router = Router();

router.post('/', optionalAuth, publicRateLimit, controller.submit);

export const contactRouter = router;
