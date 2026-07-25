import { Router } from 'express';

import { apiRateLimit, requireAuth } from '../../guards/index.js';
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

export const mailroomRouter = router;
