import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import * as controller from './me.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff).
 *
 * Deliberately not narrowed by a permission area, for the same reason the
 * dashboard isn't: every staff member needs it to render the shell. Narrowing it
 * would be circular anyway — this is the endpoint that says which areas the
 * caller holds, and it only ever describes the caller, so there is no other
 * member's data to guard.
 */

const router = Router();

router.get('/', apiRateLimit, controller.getMe);

export const adminMeRouter = router;
