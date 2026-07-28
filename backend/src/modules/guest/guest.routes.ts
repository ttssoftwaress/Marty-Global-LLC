import { Router } from 'express';

import { chatRateLimit, publicRateLimit } from '../../guards/index.js';
import * as controller from './guest.controller.js';

/*
 * PUBLIC — no session, by design (AGENTS.md, API Conventions: public endpoints
 * are explicitly marked and rate-limited). This is the only unauthenticated
 * write surface on the backend, so it carries three separate protections:
 *
 *   1. Turnstile on thread creation, verified server-side in the controller.
 *   2. The public limiter on creation, which is per-IP because there is no user
 *      to key on — 10 per 15 minutes, the same budget as any other public form.
 *   3. The chat limiter on messages, so an established session cannot be used to
 *      flood the inbox either.
 *
 * Reads and writes after creation are authorised by the visitor's token, which
 * the service resolves. There is no endpoint here that takes a conversation id.
 */

const router = Router();

router.post('/sessions', publicRateLimit, controller.startChat);
router.get('/thread', chatRateLimit, controller.getThread);
router.post('/messages', chatRateLimit, controller.sendMessage);

export const guestRouter = router;
