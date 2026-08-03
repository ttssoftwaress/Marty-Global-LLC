import { Router } from 'express';

import {
  apiRateLimit,
  requireAdmin,
  sensitiveRateLimit,
} from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './roles.controller.js';

/*
 * Job roles — the definitions behind the Team & staff screen's role dropdown.
 *
 * Mounted under the admin router (requireAuth + requireStaff) and narrowed to the
 * `team` area, the same grant the member endpoints take: roles and members are
 * one screen to the person using them, so seeing one without the other would be
 * a list of names with no way to read what they mean.
 *
 * The three writes are admin-only on top of that, and take the sensitive rate
 * limit. The reason is stronger here than on the member endpoints: editing a role
 * changes what every account holding it can reach in a single request, so a
 * staff-level permission over this would be self-escalating for a whole group at
 * once.
 *
 * Its own module rather than a `/team/roles` branch: mounting it inside the team
 * router would put it behind that router's `/:memberId` route, where "roles"
 * reads as a member id.
 */

const router = Router();

router.use(requirePermission('team'));

router.get('/', apiRateLimit, controller.listRoles);
router.post('/', requireAdmin, sensitiveRateLimit, controller.createRole);
router.patch('/:roleId', requireAdmin, sensitiveRateLimit, controller.updateRole);
router.delete('/:roleId', requireAdmin, sensitiveRateLimit, controller.deleteRole);

export const adminRolesRouter = router;
