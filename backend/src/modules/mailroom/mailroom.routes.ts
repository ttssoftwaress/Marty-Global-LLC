import { Router } from 'express';

import {
  apiRateLimit,
  requireAuth,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './mailroom.controller.js';

const router = Router();

// Every route serves the signed-in customer's own mail rooms; the whole router
// sits behind requireAuth and the service asserts ownership of the room before
// any item is read.
router.use(requireAuth);

router.get('/overview', apiRateLimit, controller.getOverview);
router.get('/:roomId', apiRateLimit, controller.getRoom);
router.get('/:roomId/items', apiRateLimit, controller.listItems);
router.get('/:roomId/items/:itemId', apiRateLimit, controller.getItem);

// The write side: what the customer asks us to do with a piece of mail. Both put
// a row in front of the mail operator, so both are limited as writes.
router.post(
  '/:roomId/items/:itemId/requests',
  sensitiveRateLimit,
  controller.createRequest,
);
router.post(
  '/:roomId/items/:itemId/downloaded',
  sensitiveRateLimit,
  controller.recordDownload,
);

export const mailroomRouter = router;
