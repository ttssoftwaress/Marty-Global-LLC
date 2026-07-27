import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './team.controller.js';

/*
 * Mounted under the admin router (requireAuth + requireStaff), narrowed to staff
 * granted the `team` area.
 *
 * The three writes are admin-only on top of that. Creating a login, editing a
 * member's role or grants, and deleting an account are all how access to every
 * other admin area is handed out or taken away — the account-level case
 * AGENTS.md reserves for admin, and the endpoints where a staff-level permission
 * would be self-escalating. They take the sensitive rate limit for the same
 * reason.
 */

const router = Router();

router.use(requirePermission('team'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/', apiRateLimit, controller.listTeam);
router.post('/', requireAdmin, sensitiveRateLimit, controller.createTeamMember);
router.get('/:memberId', apiRateLimit, controller.getTeamMember);
router.patch(
  '/:memberId',
  requireAdmin,
  sensitiveRateLimit,
  controller.updateTeamMember,
);
router.delete(
  '/:memberId',
  requireAdmin,
  sensitiveRateLimit,
  controller.deleteTeamMember,
);

export const adminTeamRouter = router;
