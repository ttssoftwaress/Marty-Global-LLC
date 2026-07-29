import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import * as controller from './dashboard.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff).
 *
 * Deliberately not narrowed by a permission area: the dashboard is the admin
 * portal's home screen and every staff member lands on it. Its figures are
 * aggregates — counts and totals, no customer record — so a member without the
 * `orders` grant sees that there are twelve open orders without being able to
 * open one.
 */

const router = Router();

router.get('/summary', apiRateLimit, controller.getSummary);

export const adminDashboardRouter = router;
