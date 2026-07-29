import { Router } from 'express';

import { requireAuth, uploadRateLimit } from '../../guards/index.js';
import * as controller from './uploads.controller.js';

/*
 * One endpoint, used by every screen that attaches a file: it mints a presigned
 * PUT the browser uploads to directly, so the bytes never touch this process.
 *
 * Rate-limited even though it stores nothing — each call hands out a credential
 * to write into our bucket, which is exactly the thing not to let a caller mint
 * in a loop. It gets its own limiter rather than the `sensitive` one because the
 * count here is per FILE, and the batches this endpoint exists to serve are
 * large (guards/rate-limit.ts).
 */

const router = Router();

router.use(requireAuth);

router.post('/', uploadRateLimit, controller.requestUpload);

export const uploadsRouter = router;
