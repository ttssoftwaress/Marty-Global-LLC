import { Router } from 'express';

import { requireAuth, requireStaff } from '../../guards/index.js';
import { adminAuditRouter } from './audit/audit.routes.js';
import { adminCatalogRouter } from './catalog/catalog.routes.js';
import { adminConversationsRouter } from './conversations/conversations.routes.js';
import { adminCustomersRouter } from './customers/customers.routes.js';
import { adminDashboardRouter } from './dashboard/dashboard.routes.js';
import {
  adminOrderItemsRouter,
  adminRecordsRouter,
  adminRequestsRouter,
} from './delivery/delivery.routes.js';
import { adminFieldsRouter } from './fields/fields.routes.js';
import { adminLeadsRouter } from './leads/leads.routes.js';
import { adminMailroomRouter } from './mailroom/mailroom.routes.js';
import { adminMeRouter } from './me/me.routes.js';
import { adminNotificationsRouter } from './notifications/notifications.routes.js';
import { adminOrdersRouter } from './orders/orders.routes.js';
import { adminPaymentSettingsRouter } from './payment-settings/payment-settings.routes.js';
import { adminPaymentsRouter } from './payments/payments.routes.js';
import { adminQuotesRouter } from './quotes/quotes.routes.js';
import { adminReportsRouter } from './reports/reports.routes.js';
import { adminResultFieldsRouter } from './result-fields/result-fields.routes.js';
import { adminRolesRouter } from './roles/roles.routes.js';
import { adminSettingsRouter } from './settings/settings.routes.js';
import { adminSupportRouter } from './support/support.routes.js';
import { adminTeamRouter } from './team/team.routes.js';

/*
 * The whole `/v1/admin` surface. Two guards apply to every route beneath it, so
 * no sub-router can be mounted without them:
 *
 *   requireAuth   → 401 without a session
 *   requireStaff  → 403 for a signed-in customer
 *
 * Each area then narrows further with `requirePermission`, and the writes that
 * hand out access or move money narrow again with `requireAdmin`. The frontend's
 * `RequireRole` wrapper on `/admin` is convenience only — this is the real
 * boundary (AGENTS.md, Auth).
 *
 * Three mounts stay un-narrowed on purpose — `/me`, `/dashboard`, and
 * `/notifications` — because every staff member needs them to render the shell
 * they land in. Each router's own comment gives its reason.
 */

const router = Router();

router.use(requireAuth, requireStaff);

router.use('/me', adminMeRouter);
router.use('/dashboard', adminDashboardRouter);
router.use('/notifications', adminNotificationsRouter);
/*
 * Quotes are raised from the order screen but are a billing decision, so they
 * hang off the order's path while carrying the `payments` area rather than
 * `orders`. Mounted ahead of the orders router for the same reason the customer
 * order conversation is (routes.ts): `/orders` matches this path as a prefix, so
 * mounting it second would put every quote behind the `orders` area too and make
 * the two grants inseparable.
 */
router.use('/orders/:orderId/quotes', adminQuotesRouter);
router.use('/orders', adminOrdersRouter);
/*
 * Result forms, hung off an order ITEM rather than an order: an order groups
 * several services and they do not finish together, so "completed" — and the
 * record delivered when it is — is answerable per item or not at all. A sibling
 * path rather than a child of `/orders/:orderId`, because an item id already
 * identifies its order and nesting would make every call carry a redundant
 * segment the service would then have to cross-check.
 */
router.use('/order-items', adminOrderItemsRouter);
router.use('/records', adminRecordsRouter);
router.use('/customers', adminCustomersRouter);
router.use('/catalog', adminCatalogRouter);
/*
 * The result registry — the vocabulary of facts services DELIVER, the mirror of
 * `/fields` below. A sibling of `/catalog` for the same reason that one is: it
 * is edited on its own screen and read by the delivery-schema builder, and both
 * carry the `catalog` area.
 */
router.use('/result-fields', adminResultFieldsRouter);
/*
 * The field registry — the vocabulary service forms are built from. A sibling of
 * `/catalog` rather than a child of it: it is edited on its own screen and read
 * by the form builder, and keeping it off the catalog's path means the two
 * routers stay independently mountable. Both carry the same `catalog` area.
 */
router.use('/fields', adminFieldsRouter);
/*
 * How we collect — the deposit address, the USD→USDT rate, the confirmation
 * depth, the automatic-verification switch, and the bank accounts customers wire
 * to. All of it used to be environment variables, so rotating a wallet or
 * adjusting a spread was a redeploy.
 *
 * A sibling of `/payments` rather than a child, and carrying the same `payments`
 * area: this is configuration, not a queue, and mounting it under `/payments`
 * would put it behind that router's own path matching for no gain. Deliberately
 * NOT under `/settings` — that router carries the `settings` area, which is the
 * location and carrier lists, and nobody who curates jurisdictions should
 * thereby be able to change where money is sent.
 */
router.use('/payment-settings', adminPaymentSettingsRouter);
router.use('/payments', adminPaymentsRouter);
router.use('/mailroom', adminMailroomRouter);
router.use('/team', adminTeamRouter);
// The job roles behind that screen's dropdown — the same `team` grant, its own
// mount so `/team/:memberId` cannot swallow the path (roles.routes.ts).
router.use('/roles', adminRolesRouter);
router.use('/support', adminSupportRouter);
// Order conversations the signed-in staff member is responsible for. Distinct
// from `/support`, which is the shared helpdesk queue any agent may claim from.
router.use('/conversations', adminConversationsRouter);
/*
 * Follow-up requests customers raise against a delivered service. Its own area
 * rather than part of `orders`, because it is a different job: an order is
 * worked once and filed, while a request is small after-sales work against
 * something already delivered — exactly what a support agent handles without
 * ever touching the filing pipeline.
 */
router.use('/requests', adminRequestsRouter);
router.use('/reports', adminReportsRouter);
// The marketing contact form's queue — its own `leads` area (lib/permissions.ts).
router.use('/leads', adminLeadsRouter);
/*
 * Business settings — the locations services are offered in and the carriers the
 * mail room ships with. Its own area rather than part of `/catalog`, because it
 * sits upstream of it: the orders queue, the customer list, and the mail room's
 * forwarding form all read this data without touching a service definition.
 *
 * Nothing seeds these tables any more. This router is the only way rows get
 * there, which is the point — which jurisdictions we operate in is an
 * operational decision, not a line in a seed script.
 */
router.use('/settings', adminSettingsRouter);
/*
 * The audit log — the read-only trail of who did what, across every section
 * above. Until this mount existed the `AuditLog` table was written by every
 * admin write and read by nothing, which makes a trail evidence nobody can
 * examine.
 *
 * Read-only, and deliberately so: it offers two GETs and no write of any kind.
 * Its own `audit` area rather than admin-only, so reviewing the trail can be
 * delegated without also handing over the power to change what it records.
 */
router.use('/audit', adminAuditRouter);

export const adminRouter = router;
