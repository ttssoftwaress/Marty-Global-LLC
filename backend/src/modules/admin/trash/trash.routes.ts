import { Router } from 'express';

import { apiRateLimit, requireAdmin, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './trash.controller.js';

/*
 * Two routers out of one module, because the two halves are gated by different
 * grants and one of them is mounted on a path every admin table posts to.
 *
 * `adminTrashRouter`  — the bin: reading it, restoring from it, emptying it.
 *                       Behind the `trash` area.
 * `adminRecycleRouter` — the delete every table calls. Behind `data.delete`,
 *                       and narrowed again per entity inside the service, which
 *                       is where the entity is known.
 *
 * They cannot share a `router.use`: a member who may delete rows from the orders
 * queue does not thereby get the bin, and a compliance reviewer with the bin
 * does not thereby get a delete button. Mounting one router with two grants
 * would make each imply the other.
 */

// --- The bin -------------------------------------------------------------

const trash = Router();

trash.use(requirePermission('trash'));

trash.get('/', apiRateLimit, controller.listTrash);
trash.get('/summary', apiRateLimit, controller.getSummary);

/*
 * Retention, read by everyone who can open the screen and written only by an
 * administrator. It decides when a deletion stops being reversible, which is the
 * same weight as the payment and email switches — and those narrow the same way.
 */
trash.get('/settings', apiRateLimit, controller.getSettings);
trash.patch('/settings', requireAdmin, sensitiveRateLimit, controller.updateSettings);

// The undo. `trash` alone, plus the deleted row's own area inside the service —
// restoring a customer takes `customers` however the bin was opened.
trash.post('/restore', sensitiveRateLimit, controller.restore);

/*
 * Emptying the bin ahead of its window: the one irreversible write in the
 * feature, and the only route here that narrows to an administrator.
 *
 * A POST rather than a DELETE, because it carries a body of entry ids and a
 * DELETE with a body is the shape proxies and fetch implementations are least
 * reliable about. The service re-checks the role — the guard is the boundary,
 * but a write that destroys data does not depend on being mounted correctly.
 */
trash.post('/purge', requireAdmin, sensitiveRateLimit, controller.purge);

export const adminTrashRouter = trash;

// --- The delete ----------------------------------------------------------

const recycle = Router();

/*
 * `sensitiveRateLimit`, not `apiRateLimit`. One request here can remove a
 * customer and everything hanging off them, which puts it in the same class as
 * settling a payment or editing a role rather than in with the list reads.
 */
recycle.post(
  '/',
  requirePermission('data.delete'),
  sensitiveRateLimit,
  controller.deleteRows,
);

export const adminRecycleRouter = recycle;
