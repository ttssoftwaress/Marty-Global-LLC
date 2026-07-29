import { Router } from 'express';

import {
  apiRateLimit,
  requireAuth,
  requireIdempotencyKey,
  sensitiveRateLimit,
} from '../../guards/index.js';
import * as controller from './payments.controller.js';

const router = Router();

// Every route here is the signed-in customer's own money. The whole router sits
// behind requireAuth and the service scopes each query to req.auth.userId —
// there is no unauthenticated surface in this module (AGENTS.md: every endpoint
// authenticated and role-guarded by default).
router.use(requireAuth);

/*
 * Start (or resume) collecting on a quote.
 *
 * `sensitiveRateLimit` because this is money movement, and
 * `requireIdempotencyKey` because AGENTS.md requires mutating payment endpoints
 * to be retry-safe: the key is stored on the Payment row, so a retry resolves to
 * the same payment rather than asking for a second transfer.
 */
router.post(
  '/intents',
  sensitiveRateLimit,
  requireIdempotencyKey,
  controller.createIntent,
);

/*
 * Close an open payment window on purpose — the checkout's "Cancel transfer".
 *
 * `sensitiveRateLimit` for the same reason as the intent: it moves a payment's
 * state and frees the amount it was watching.
 *
 * `requireIdempotencyKey` because AGENTS.md asks for it on every mutating
 * payment endpoint, without carve-outs. What makes a retry safe here is still
 * the payment's own status — a repeat lands on an already-cancelled row and
 * returns it unchanged — so the key is a requirement met rather than the
 * mechanism. Keeping the rule literal means the next payment mutation starts
 * from "of course it has one".
 *
 * Mounted before `/:paymentId` would ever be considered for it; Express matches
 * on the full path, but keeping the specific route above the parameterised read
 * keeps the file's reading order honest.
 */
router.post(
  '/:paymentId/cancel',
  sensitiveRateLimit,
  requireIdempotencyKey,
  controller.cancelPayment,
);

// The checkout screen reads the quote it is collecting for, then polls the
// payment while the transfer confirms — both plain authenticated reads.
router.get('/quotes/:quoteId', apiRateLimit, controller.getCheckoutQuote);
router.get('/:paymentId', apiRateLimit, controller.getPayment);

export const paymentsRouter = router;
