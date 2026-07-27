import { Router } from 'express';

import { requireAuth, sensitiveRateLimit } from '../../guards/index.js';
import * as controller from './uploads.controller.js';

/*
 * One endpoint, used by every screen that attaches a file: it mints a presigned
 * PUT the browser uploads to directly, so the bytes never touch this process.
 *
 * Rate-limited as a write even though it stores nothing — each call hands out a
 * credential to write into our bucket, which is exactly the thing not to let a
 * caller mint in a loop.
 */

const router = Router();

router.use(requireAuth);

router.post('/', sensitiveRateLimit, controller.requestUpload);

export const uploadsRouter = router;
