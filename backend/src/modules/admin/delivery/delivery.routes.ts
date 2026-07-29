import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './delivery.controller.js';

/*
 * Service delivery, split across two routers because the two halves are two
 * different jobs gated by two different areas:
 *
 *   `orders`   — filling in what a customer receives. It is the last step of
 *                working the filing, so whoever works the order does it.
 *   `requests` — the follow-up queue. After-sales work against something already
 *                delivered, which a support agent handles without ever touching
 *                the filing pipeline.
 *
 * Neither is admin-only. Unlike the catalog — where a change reshapes what every
 * customer sees — these write one customer's record, which is exactly the work a
 * staff member is employed to do. The row-level scope in `admin.scope.ts` is
 * what keeps a member to their own.
 */

// --- Result forms, hung off an order item ---------------------------------
const resultsRouter = Router();

resultsRouter.use(requirePermission('orders'));

// GET creates the DRAFT record on first open, so the form is a plain edit screen
// — see `getItemResult`. That makes it a write in effect, hence the tighter limit.
resultsRouter.get('/:orderItemId/result', sensitiveRateLimit, controller.getItemResult);
resultsRouter.put('/:orderItemId/result', sensitiveRateLimit, controller.saveResult);
resultsRouter.patch(
  '/:orderItemId/status',
  sensitiveRateLimit,
  controller.updateOrderItemStatus,
);

export const adminOrderItemsRouter = resultsRouter;

// --- Delivered records ----------------------------------------------------
const recordsRouter = Router();

recordsRouter.use(requirePermission('orders'));

recordsRouter.patch(
  '/:resultId/status',
  sensitiveRateLimit,
  controller.updateResultStatus,
);

/*
 * A short-TTL link to a document already on the record — the View and Download
 * controls beside a `file` field on the result form.
 *
 * Hung off the RECORD rather than off the order item, so both entry points into
 * that form (the order screen and the follow-up queue, which resolves through the
 * same order-item path) reach it with the id they already hold. The service
 * applies the same `orders` scope either way, and audits every call.
 */
recordsRouter.get(
  '/:resultId/files/:fieldKey',
  apiRateLimit,
  controller.getResultFileLink,
);

export const adminRecordsRouter = recordsRouter;

// --- The follow-up queue --------------------------------------------------
const requestsRouter = Router();

requestsRouter.use(requirePermission('requests'));

requestsRouter.get('/', apiRateLimit, controller.listRequests);
requestsRouter.get('/:requestId', apiRateLimit, controller.getRequest);
requestsRouter.patch('/:requestId', sensitiveRateLimit, controller.updateRequest);

/*
 * The record behind a request, so staff can amend the delivered data without
 * leaving the queue — "edit the result page as per the request".
 *
 * Reached through the request rather than by record id, which is what keeps the
 * `requests` area from becoming a way to browse every delivered record: a member
 * gets to exactly the records they hold a request for.
 */
requestsRouter.get(
  '/:requestId/result',
  sensitiveRateLimit,
  controller.getRequestResult,
);

/*
 * Saving that amendment. It resolves the request to its order item and runs the
 * same `saveResult` the order screen does — one write path, so the
 * required-field gate and the audit entry are identical whichever screen the
 * edit came from.
 */
requestsRouter.put(
  '/:requestId/result',
  sensitiveRateLimit,
  controller.saveRequestResult,
);

export const adminRequestsRouter = requestsRouter;
