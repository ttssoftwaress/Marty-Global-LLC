import { Router } from 'express';

import { apiRateLimit, sensitiveRateLimit } from '../../../guards/index.js';
import { requirePermission } from '../admin.guards.js';
import * as controller from './quotes.controller.js';

/*
 * Quotes raised against one order. Mounted under the admin router
 * (requireAuth + requireStaff), with `mergeParams` so `:orderId` from the mount
 * path reaches the controller.
 *
 * Guarded on `payments` — the "Quotes & payments" area — rather than on
 * `orders`. Pricing a customer's filing is a billing decision, and a reviewer
 * who advances statuses is not automatically the person who decides what we
 * charge. An admin holds both areas, so the common case is unaffected.
 *
 * Sending is deliberately staff-level rather than admin-only: quoting is the
 * daily work of the operations managers this area exists for, it is fully
 * audited, and unlike a refund it moves no money — a quote is an offer.
 */

const router = Router({ mergeParams: true });

router.use(requirePermission('payments'));

router.get('/', apiRateLimit, controller.listOrderQuotes);
// The catalog's pricing templates, scoped to this order's services and region —
// what the composer offers as quick-select lines. A read of policy prices the
// sender already has the `payments` area for, so no extra guard.
router.get('/templates', apiRateLimit, controller.listQuoteTemplates);
// Both writes reach the customer (an email and a feed entry), so they take the
// same limiter as the order's own customer-visible reply.
router.post('/', sensitiveRateLimit, controller.createQuote);
router.post('/:quoteId/cancel', sensitiveRateLimit, controller.cancelQuote);

export const adminQuotesRouter = router;
