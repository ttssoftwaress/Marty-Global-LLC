import { Router } from 'express';

import { apiRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './audit.controller.js';

/*
 * The audit log viewer, mounted under the admin router (requireAuth +
 * requireStaff already applied) and narrowed to staff granted the `audit` area.
 *
 * Three GETs and nothing else. There is no write path here and there must never
 * be one: the trail is written by `modules/audit/audit.service.ts` and by
 * nothing else, and an endpoint that could edit or delete an entry would make
 * the whole table unusable as evidence. No POST, no PATCH, no DELETE.
 *
 * `audit` is its own grantable area rather than admin-only, because reviewing
 * the trail is a compliance job that does not require the power to change
 * anything — a member can see that a role changed without being able to change
 * one. It is not a default on any role except super-admin and operations
 * manager; an admin hands it out per member from the team screen.
 *
 * No data scope companion (`audit.all`). Every other section splits into "your
 * records" and "the org's", but a trail narrowed to the rows you yourself wrote
 * is not an audit of anything — it is your own history, which is the one view
 * with no oversight value. Holding the area means reading all of it, which is
 * exactly why it is granted deliberately rather than by default.
 */

const router = Router();

router.use(requirePermission('audit'));

router.get('/summary', apiRateLimit, controller.getSummary);
router.get('/', apiRateLimit, controller.listAudit);
/*
 * One entry in full — the viewer's expanded row. The list withholds `metadata`
 * and the caller's IP because the metadata column has no bounded size: it is
 * whatever the recording layer kept for that action, and a page of the trail
 * was shipping fifty blobs to print fifty two-value preview lines.
 */
router.get('/:id', apiRateLimit, controller.getEntry);

export const adminAuditRouter = router;
