import { Router } from 'express';

import { requireAuth } from './guards/index.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { billingRouter } from './modules/billing/billing.routes.js';
import { contactRouter } from './modules/contact/contact.routes.js';
import { conversationsRouter } from './modules/conversations/conversations.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { guestRouter } from './modules/guest/guest.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { mailroomRouter } from './modules/mailroom/mailroom.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { resultsRouter } from './modules/results/results.routes.js';
import { servicesRouter } from './modules/services/services.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';

const router = Router();

/*
 * Default-deny, applied before any module router is reached.
 *
 * Every module below still attaches its own guards and none of them are being
 * removed — those are the real boundary, and the role/permission narrowing only
 * exists there. What this adds is the failure mode: without it, a router that
 * ships without `requireAuth` is a public endpoint by omission, and nothing in
 * this file would say so. AGENTS.md is explicit that every endpoint is
 * authenticated by default and that a public one is *explicitly marked* — this
 * list is that marking, in one place, next to the mounts.
 *
 * Adding a public surface therefore means editing this list, which is the point.
 */
const PUBLIC_PREFIXES = ['/health', '/guest-chat', '/contact'] as const;

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

router.use((req, res, next) => {
  if (isPublic(req.path)) {
    next();
    return;
  }
  void requireAuth(req, res, next);
});

router.use('/health', healthRouter);
router.use('/notifications', notificationsRouter);
router.use('/services', servicesRouter);
/*
 * The order conversation is mounted ahead of the orders router because that
 * router is customer-scoped, and this thread is reached by both the customer and
 * the order's assigned staff member through one path. The service does the
 * participant check, so a staff request never needs a second URL.
 */
router.use('/orders/:orderId/conversation', conversationsRouter);
router.use('/orders', ordersRouter);
router.use('/dashboard', dashboardRouter);
router.use('/billing', billingRouter);
// `billing` owns what is owed; `payments` owns collecting it (AGENTS.md).
router.use('/payments', paymentsRouter);
router.use('/mailrooms', mailroomRouter);
/*
 * Every file the customer has, gathered into one list. Read-only: it aggregates
 * the three sources that already own files (order documents, delivered-record
 * file values, mail scans) rather than introducing a fourth table nothing writes
 * to — documents.service.ts records why.
 */
router.use('/documents', documentsRouter);
/*
 * Delivered services — what the customer GOT, as distinct from `/orders`, which
 * is what they asked for. The virtual mail room keeps its own router above: it
 * was built as a bespoke surface with its own models and screens, and folding a
 * shipped feature into this generic one would be a rewrite with nothing to gain.
 */
router.use('/my-services', resultsRouter);
router.use('/support', supportRouter);
/*
 * PUBLIC — the marketing site's chat bubble, for visitors with no account. Its
 * own module rather than a branch inside `support`, because its caller is
 * unauthenticated and its guards are therefore completely different: a bearer
 * token, a Turnstile challenge, and a hard retention window. The threads it
 * creates still land in the same admin inbox.
 */
router.use('/guest-chat', guestRouter);
// PUBLIC — the marketing contact form. Same guards as guest-chat's session
// creation: Turnstile server-side, per-IP rate limit.
router.use('/contact', contactRouter);
router.use('/profile', profileRouter);
/*
 * Shared by every surface that attaches a file — order documents, mail scans,
 * delivered results, avatars. It only mints presigned PUTs; what a file is
 * attached TO stays with the module that owns that record.
 */
router.use('/uploads', uploadsRouter);

// The staff surface. Guarded as a whole in admin.routes.ts, not here.
router.use('/admin', adminRouter);

export const routes = router;
