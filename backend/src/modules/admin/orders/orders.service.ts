import {
  ConversationKind,
  FeedNotificationCategory,
  OrderActivityAuthor,
  OrderDocumentSource,
  OrderDocumentStatus,
  type OrderDocument,
  OrderItemStatus,
  OrderStatus,
  Prisma,
  ServiceResultStatus,
  StaffStatus,
} from '@prisma/client';

import { publicAppUrl } from '../../../config/env.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { withIdempotency } from '../../../lib/idempotency.js';
import { toInitials } from '../../../lib/initials.js';
import { logger } from '../../../lib/logger.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { presignObject } from '../../../lib/storage.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { syncAssignee } from '../../conversations/conversations.service.js';
import { channelsFor } from '../../notifications/notifications.preferences.js';
import { queueEmail } from '../../notifications/notifications.service.js';
import { notifyFeed } from '../../notifications/notifications.feed.js';
import {
  notifyDocumentRequested,
  notifyOrderStatusChanged,
} from '../../orders/orders.notifications.js';
import {
  itemAnswerFields,
  orderAnswerKeys,
} from '../../orders/orders.service.js';
import { storedResultRefs } from '../../results/results.fields.js';
import { fieldsByKey } from '../../services/services.service.js';
import { canSeeAll, hasPermission } from '../admin.guards.js';
import { orderScope } from '../admin.scope.js';
import { serviceLabel } from '../customers/customers.service.js';
import {
  allowedNextStatuses,
  iso,
  isoOrNull,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_SEQUENCE,
  ORDER_STATUS_VIEW,
  OPEN_ORDER_STATUSES,
  party,
  type Party,
  regionView,
  type RegionView,
  toOrderStatus,
} from '../admin.views.js';
import type {
  AddActivityInput,
  DocumentLinkQuery,
  ListOrdersQuery,
  RequestDocumentInput,
  UpdateOrderInput,
} from './orders.validation.js';

/*
 * The admin orders queue — every customer's order, filtered and worked by staff.
 * All Prisma access for the queue lives here.
 *
 * Reassigning or advancing an order is a state change, so both write an audit
 * entry and an activity row the customer sees on their order detail (AGENTS.md).
 */

const ACTIVE_ORDERS: Prisma.OrderWhereInput = { deletedAt: null };

/*
 * What this actor is entitled to see in the queue.
 *
 * An employee works the filings they hold: a staff member's queue is the orders
 * assigned to them, and an order that is not theirs is not theirs to read or to
 * act on either. This is the same assignee lock the order conversation already
 * applies (modules/conversations) — the queue that leads to the thread agrees
 * with it, rather than listing work the thread would refuse to open.
 *
 * The rule itself lives in `canSeeAll` (admin.guards.ts), which is what the team
 * screen's "All data" column writes and what every other admin module now asks.
 * Two actors come back unscoped: an admin, and a member granted `orders.assign`
 * — distributing work is impossible when the unassigned orders are invisible.
 *
 * Applied as a where clause on every read and every write, not as a filter over
 * results: the boundary has to be the query, or a member could reach any order by
 * typing its id (AGENTS.md: the backend guards are the real boundary).
 */
/*
 * Two different questions, deliberately kept apart below:
 *
 *   `visibleScope`  — what may this actor SEE. Widened by "All data" (orders) or
 *                     by `orders.assign`; this is `canSeeAll`.
 *   `canAssign`     — may this actor HAND WORK TO SOMEONE ELSE. That is
 *                     `orders.assign` alone. Granting a member "All data" lets
 *                     them read the whole pipeline; it must not silently also let
 *                     them reassign it, which is a rota decision with its own row
 *                     in the grid.
 */
async function visibleScope(actor: AuthContext): Promise<Prisma.OrderWhereInput> {
  return orderScope(actor);
}

async function canAssignOrders(actor: AuthContext): Promise<boolean> {
  return hasPermission(actor, 'orders.assign');
}

function dateCutoff(range: ListOrdersQuery['dateRange'], now: Date): Date | undefined {
  if (!range) return undefined;

  const cutoff = new Date(now);
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff;
}

function listWhere(query: ListOrdersQuery, now: Date): Prisma.OrderWhereInput {
  const status = query.status === 'all' ? undefined : toOrderStatus(query.status);
  const cutoff = dateCutoff(query.dateRange, now);

  return {
    ...ACTIVE_ORDERS,
    ...(status ? { status } : {}),
    ...(query.region ? { regionCode: query.region } : {}),
    ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    ...(query.service ? { items: { some: { serviceId: query.service } } } : {}),
    ...(query.search
      ? {
          OR: [
            { reference: { contains: query.search, mode: 'insensitive' } },
            { customer: { is: { name: { contains: query.search, mode: 'insensitive' } } } },
            { customer: { is: { email: { contains: query.search, mode: 'insensitive' } } } },
            { items: { some: { serviceName: { contains: query.search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
}

// --- Summary -------------------------------------------------------------
export type AdminOrdersSummary = {
  totalOrders: number;
  awaitingReview: number;
  /*
   * Whether these figures cover the whole pipeline or only this actor's own
   * filings. It travels with the summary so the queue can say which it is
   * printing: "12 total orders" and "12 orders assigned to you" are the same
   * number with very different meanings, and the browser must not infer which
   * from a role it does not hold.
   */
  scope: 'all' | 'assigned';
  tabs: { value: string; label: string; count: number }[];
  filterOptions: {
    services: { value: string; label: string }[];
    regions: { value: string; label: string }[];
    dateRanges: { value: string; label: string }[];
  };
};

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export async function getSummary(actor: AuthContext): Promise<AdminOrdersSummary> {
  // The header figures and the tab counts read the same scope as the list, so a
  // tab can never promise rows the queue then refuses to show.
  const seesAll = await canSeeAll(actor, 'orders');
  const scope: Prisma.OrderWhereInput = {
    ...ACTIVE_ORDERS,
    ...(await visibleScope(actor)),
  };

  const [totalOrders, awaitingReview, grouped, services, regions] = await Promise.all([
    prisma.order.count({ where: scope }),
    prisma.order.count({
      where: { ...scope, status: { in: [...OPEN_ORDER_STATUSES] } },
    }),
    // One grouped count rather than a query per tab.
    prisma.order.groupBy({
      by: ['status'],
      where: scope,
      _count: { _all: true },
    }),
    prisma.service.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.region.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { code: true, label: true },
    }),
  ]);

  const byStatus = new Map(grouped.map((row) => [row.status, row._count._all]));

  return {
    totalOrders,
    awaitingReview,
    scope: seesAll ? 'all' : 'assigned',
    tabs: [
      { value: 'all', label: 'All', count: totalOrders },
      ...ORDER_STATUS_SEQUENCE.map((status) => ({
        value: ORDER_STATUS_VIEW[status],
        label: ORDER_STATUS_LABEL[status],
        count: byStatus.get(status) ?? 0,
      })),
    ],
    // Each list leads with its pass-through option, which is the value the
    // frontend's DEFAULT_ORDER_FILTERS holds.
    filterOptions: {
      services: [
        { value: 'all', label: 'All services' },
        ...services.map((s) => ({ value: s.id, label: s.name })),
      ],
      regions: [
        { value: 'all', label: 'All regions' },
        ...regions.map((r) => ({ value: r.code, label: r.label })),
      ],
      dateRanges: DATE_RANGE_OPTIONS,
    },
  };
}

// --- List ----------------------------------------------------------------
export type AdminOrderRow = {
  id: string;
  reference: string;
  customer: Party;
  service: string;
  region: RegionView;
  submittedAt: string;
  status: string;
  statusLabel: string;
  assignee: Party | null;
  actionLabel: string;
  to: string;
};

export type AdminOrdersPage = {
  orders: AdminOrderRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

const rowInclude = {
  customer: { select: { name: true } },
  assignee: { select: { name: true } },
  region: { select: { label: true, flag: true } },
  items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { serviceName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderInclude;

// Open work is reviewed; a closed order can only be looked at. The backend owns
// this word so the queue never infers an action from a status.
function actionLabel(status: OrderStatus): string {
  return OPEN_ORDER_STATUSES.includes(status) ? 'Review' : 'View';
}

type OrderRowRecord = Prisma.OrderGetPayload<{ include: typeof rowInclude }>;

// The queue row, from the list and from a write's response. One mapper, so a row
// cannot change shape depending on which endpoint produced it.
function toRow(order: OrderRowRecord): AdminOrderRow {
  return {
    id: order.id,
    reference: order.reference,
    customer: party(order.customer.name),
    service: serviceLabel(order.items[0]?.serviceName, order._count.items),
    region: regionView(order.region),
    submittedAt: iso(order.submittedAt ?? order.createdAt),
    status: ORDER_STATUS_VIEW[order.status],
    statusLabel: ORDER_STATUS_LABEL[order.status],
    assignee: order.assignee ? party(order.assignee.name) : null,
    actionLabel: actionLabel(order.status),
    to: `/admin/orders/${order.id}`,
  };
}

export async function listOrders(
  actor: AuthContext,
  query: ListOrdersQuery,
): Promise<AdminOrdersPage> {
  const now = new Date();
  const where: Prisma.OrderWhereInput = {
    ...listWhere(query, now),
    ...(await visibleScope(actor)),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: rowInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    orders: page.rows.map(toRow),
    nextCursor: page.nextCursor,
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- Detail --------------------------------------------------------------
/*
 * One order, staff-side: everything the reviewer needs to act on it in a single
 * call — who filed it, what they answered, what has happened since, and the two
 * controls that move it on.
 *
 * The action choices come down with the record rather than being assembled in
 * the browser. Which statuses this actor may set depends on the pipeline and on
 * their role (admin overrides it), and both live in the backend — a frontend
 * copy of that rule would be a second source of truth that drifts, and the one
 * in the browser is the one an operator would believe.
 */

export type AdminOrderActivityEntry = {
  id: string;
  author: 'team' | 'customer' | 'system';
  authorName: string;
  initials: string;
  // A staff-only note. The customer's own order page never receives these.
  internal: boolean;
  occurredAt: string;
  message: string;
};

export type AdminOrderDocument = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  source: 'team' | 'customer';
  // What the card decides between "preview it" and "save it" with. Null on a row
  // filed before the type was captured — the screen still offers both, it just
  // cannot promise the tab will render it.
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  /*
   * Whether there is a file to open at all. A PENDING row is a placeholder for a
   * document we owe the customer and a REJECTED one has been set aside, so
   * neither has an object behind it. The backend decides this rather than the
   * screen inferring it from the status, because the endpoint refuses the same
   * two cases and the disabled control has to agree with it.
   */
  downloadable: boolean;
};

export type AdminOrderStatusOption = {
  value: string;
  label: string;
  // Whether this actor may move the order here from where it stands now. The
  // disallowed ones still travel so the control can draw the whole pipeline and
  // show what is out of reach, rather than hiding steps that exist.
  allowed: boolean;
  current: boolean;
  /*
   * Why a step is out of reach when the reason is the order's own state rather
   * than the pipeline or the actor's role, so the screen can say *why* instead of
   * leaving a dimmed row with no explanation:
   *   - `quote_required` on APPROVED — never priced, so there is nothing to pay.
   *   - `items_pending` on COMPLETED — a service line is still open, and a
   *     service that delivers a record is only completed by delivering it.
   *
   * A hint, not the boundary: `updateOrder` re-checks both (AGENTS.md — the
   * backend guards are the real boundary).
   */
  blockedReason?: 'quote_required' | 'items_pending';
};

export type AdminOrderAssigneeOption = {
  value: string;
  label: string;
  initials: string;
  roleLabel: string;
};

export type AdminOrderDetail = {
  id: string;
  reference: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  updatedAt: string;
  region: RegionView;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    initials: string;
    email: string;
    phone: string | null;
    to: string;
    messageThreadTo: string | null;
  };
  assignee: (Party & { id: string }) | null;
  /*
   * One service line, with where it has got to and whether it delivers a record.
   *
   * The delivery state is per item rather than per order because an order groups
   * several services that do not finish together — a mail room can be live weeks
   * before the formation clears. `deliversResult` tells the screen whether to
   * offer a result form at all: not every service returns something the customer
   * looks at afterwards, and one that doesn't completes with a plain status
   * change instead.
   */
  items: {
    id: string;
    serviceId: string;
    serviceName: string;
    fields: { label: string; value: string }[];
    status: 'pending' | 'in_progress' | 'completed';
    completedAt: string | null;
    deliversResult: boolean;
    resultId: string | null;
    resultStatus: 'draft' | 'active' | 'archived' | null;
  }[];
  documents: AdminOrderDocument[];
  activity: AdminOrderActivityEntry[];
  statusOptions: AdminOrderStatusOption[];
  assigneeOptions: AdminOrderAssigneeOption[];
  /*
   * Whether this actor may hand the order to someone else (`orders.assign`).
   * The backend decides it rather than the browser inferring it from a role:
   * the disabled control and the endpoint's 403 have to agree, and the endpoint
   * is the real boundary (AGENTS.md, Auth).
   */
  canAssign: boolean;
};

// Per-service delivery state on an order line. Distinct from the order's own
// status: an order groups several services that do not finish together.
const ORDER_ITEM_STATUS_VIEW: Record<
  OrderItemStatus,
  'pending' | 'in_progress' | 'completed'
> = {
  [OrderItemStatus.PENDING]: 'pending',
  [OrderItemStatus.IN_PROGRESS]: 'in_progress',
  [OrderItemStatus.COMPLETED]: 'completed',
};

const RESULT_STATUS_VIEW: Record<
  ServiceResultStatus,
  'draft' | 'active' | 'archived'
> = {
  [ServiceResultStatus.DRAFT]: 'draft',
  [ServiceResultStatus.ACTIVE]: 'active',
  [ServiceResultStatus.ARCHIVED]: 'archived',
};

const DOCUMENT_STATUS_VIEW: Record<OrderDocumentStatus, { value: string; label: string }> = {
  [OrderDocumentStatus.PENDING]: { value: 'pending', label: 'Pending' },
  [OrderDocumentStatus.AVAILABLE]: { value: 'available', label: 'Available' },
  [OrderDocumentStatus.REJECTED]: { value: 'rejected', label: 'Rejected' },
};

const ACTIVITY_AUTHOR_VIEW: Record<OrderActivityAuthor, 'team' | 'customer' | 'system'> = {
  [OrderActivityAuthor.TEAM]: 'team',
  [OrderActivityAuthor.CUSTOMER]: 'customer',
  [OrderActivityAuthor.SYSTEM]: 'system',
};

/*
 * Who an order can be handed to: an active staff member who holds the `orders`
 * area, plus every admin (the permission guard passes an admin unconditionally,
 * so excluding them here would offer a shorter list than the guard accepts).
 *
 * Deliberately not read from the `team` module: a reviewer has `orders` but not
 * `team`, and they are exactly the person who needs this list.
 */
async function assigneeOptions(): Promise<AdminOrderAssigneeOption[]> {
  const staff = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      status: StaffStatus.ACTIVE,
      OR: [{ permissions: { has: 'orders' } }, { user: { is: { role: Role.ADMIN } } }],
    },
    select: {
      userId: true,
      user: { select: { name: true } },
      // The admin's own wording for the job role — read off the row, since roles
      // are data now and no code catalogue knows every one of them.
      role: { select: { label: true } },
    },
  });

  return staff
    .map((member) => ({
      value: member.userId,
      label: member.user.name,
      initials: toInitials(member.user.name),
      roleLabel: member.role.label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/*
 * `hasQuote` gates APPROVED and `itemsPending` gates COMPLETED here exactly as
 * they do on the write path: an order nobody has priced cannot be approved by
 * hand, and an order with a service line still open cannot be closed by hand,
 * whatever the pipeline or the actor's role would otherwise permit (see
 * `updateOrder`).
 */
function statusOptions(
  current: OrderStatus,
  isAdmin: boolean,
  hasQuote: boolean,
  itemsPending: boolean,
): AdminOrderStatusOption[] {
  const allowed = new Set(allowedNextStatuses(current, isAdmin));

  return ORDER_STATUS_SEQUENCE.map((status) => {
    const blockedReason =
      status === OrderStatus.APPROVED && !hasQuote
        ? ('quote_required' as const)
        : status === OrderStatus.COMPLETED && itemsPending
          ? ('items_pending' as const)
          : undefined;

    return {
      value: ORDER_STATUS_VIEW[status],
      label: ORDER_STATUS_LABEL[status],
      allowed: allowed.has(status) && !blockedReason,
      current: status === current,
      ...(blockedReason ? { blockedReason } : {}),
    };
  });
}

const detailInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      profile: { select: { phone: true } },
    },
  },
  assignee: { select: { id: true, name: true } },
  region: { select: { label: true, flag: true } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      // `resultFields` decides whether this line offers a result form at all.
      service: { select: { resultFields: true } },
      result: { select: { id: true, status: true } },
    },
  },
  documents: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
  // Newest last, the reading order of a conversation. Internal notes are
  // included here and nowhere else.
  activity: { orderBy: { occurredAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderDetailRecord = Prisma.OrderGetPayload<{ include: typeof detailInclude }>;

function toDocument(document: OrderDocument): AdminOrderDocument {
  return {
    id: document.id,
    name: document.name,
    status: DOCUMENT_STATUS_VIEW[document.status].value,
    statusLabel: DOCUMENT_STATUS_VIEW[document.status].label,
    source: document.source === OrderDocumentSource.CUSTOMER ? 'customer' : 'team',
    contentType: document.contentType,
    sizeBytes: document.sizeBytes,
    createdAt: iso(document.createdAt),
    // Both conditions, not just the status: a row can be marked AVAILABLE by hand
    // with nothing uploaded behind it, and an enabled button that 422s is worse
    // than a disabled one that explains itself.
    downloadable:
      document.status === OrderDocumentStatus.AVAILABLE &&
      Boolean(document.objectKey),
  };
}

function toActivityEntry(
  entry: OrderDetailRecord['activity'][number],
): AdminOrderActivityEntry {
  return {
    id: entry.id,
    author: ACTIVITY_AUTHOR_VIEW[entry.author],
    authorName: entry.authorName,
    initials: toInitials(entry.authorName),
    internal: entry.internal,
    occurredAt: iso(entry.occurredAt),
    message: entry.message,
  };
}

export async function getOrder(
  actor: AuthContext,
  orderId: string,
): Promise<AdminOrderDetail> {
  // Seeing the order and being allowed to reassign it are separate grants.
  const canAssign = await canAssignOrders(actor);

  /*
   * Scoped in the query, and 404 rather than 403 when it misses — an order this
   * member does not hold is not an order they are told exists (guards/ownership.ts:
   * a refusal must never confirm an id). It is the same answer the order's own
   * conversation gives, so a link from anywhere else in the portal fails the same
   * way on both halves of the screen.
   */
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...ACTIVE_ORDERS, ...(await visibleScope(actor)) },
    include: detailInclude,
  });

  if (!order) throw AppError.notFound('Order not found');

  /*
   * The customer card's "message" button points at the general support thread,
   * which is a different conversation from this order's own — support is routed
   * to whoever is free, the order conversation only to this order's assignee. It
   * therefore looks for a SUPPORT thread specifically; picking the customer's
   * newest thread of any kind would send staff into the order conversation they
   * are already looking at, or into another order's.
   */
  // Answer labels come from the field registry — `OrderItem.answers` is keyed by
  // `FieldDefinition.key`, so this resolves every key the order holds at once.
  // Whether this order has ever been priced — what gates APPROVED on the status
  // control below. Read here rather than through the quotes module so a reviewer
  // without the `payments` area (whose quote list 403s) still gets a status
  // control that tells the truth.
  const [assignees, thread, fieldRegistry, quote] = await Promise.all([
    assigneeOptions(),
    /*
     * The customer's newest support thread, as the detail screen's "Message"
     * link. Scoped on the same rule the support queue applies (own or unclaimed),
     * because this resolves a thread by customer rather than by order: without
     * it, a member holding this order would be handed the id of a colleague's
     * thread with the same customer — a link that 404s on arrival, having already
     * disclosed the id it points at.
     */
    prisma.conversation.findFirst({
      where: {
        customerId: order.customerId,
        kind: ConversationKind.SUPPORT,
        deletedAt: null,
        ...((await canSeeAll(actor, 'support'))
          ? {}
          : { OR: [{ assigneeId: actor.userId }, { assigneeId: null }] }),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    }),
    fieldsByKey(orderAnswerKeys(order.items)),
    prisma.quote.findFirst({
      where: { orderId: order.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  return {
    id: order.id,
    reference: order.reference,
    status: ORDER_STATUS_VIEW[order.status],
    statusLabel: ORDER_STATUS_LABEL[order.status],
    submittedAt: iso(order.submittedAt ?? order.createdAt),
    updatedAt: iso(order.updatedAt),
    region: regionView(order.region),
    notes: order.notes,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      initials: toInitials(order.customer.name),
      email: order.customer.email,
      phone: order.customer.profile?.phone ?? null,
      to: `/admin/customers/${order.customer.id}`,
      // Null when there is no thread yet, so the button is never a dead target.
      messageThreadTo: thread ? `/admin/support/${thread.id}` : null,
    },
    assignee: order.assignee
      ? { id: order.assignee.id, ...party(order.assignee.name) }
      : null,
    // Grouped per service rather than flattened: two services can ask for the
    // same field name, and a reviewer needs to know which application each
    // answer belongs to.
    items: order.items.map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      fields: itemAnswerFields(item, fieldRegistry),
      status: ORDER_ITEM_STATUS_VIEW[item.status],
      completedAt: isoOrNull(item.completedAt),
      // A service with an empty result schema returns nothing, so the screen
      // completes it with a status change rather than a form.
      deliversResult: storedResultRefs(item.service).length > 0,
      resultId: item.result?.id ?? null,
      resultStatus: item.result ? RESULT_STATUS_VIEW[item.result.status] : null,
    })),
    documents: order.documents.map(toDocument),
    activity: order.activity.map(toActivityEntry),
    statusOptions: statusOptions(
      order.status,
      actor.role === Role.ADMIN,
      quote !== null,
      order.items.some((item) => item.status !== OrderItemStatus.COMPLETED),
    ),
    assigneeOptions: assignees,
    canAssign,
  };
}

// --- Documents -----------------------------------------------------------
/*
 * A short-TTL link to one of the order's documents — what the Documents card's
 * View and Download controls open.
 *
 * The mirror of the customer's own `orders.getDocumentLink`, with the ownership
 * check swapped for the queue's scope: a reviewer reaches a document because they
 * hold the order it hangs off, exactly as they reach everything else on the
 * screen. Minted per click and never stored (AGENTS.md, Security & PII) — a
 * presigned URL is a bearer token for a customer's identity paperwork, so it must
 * not sit in a cached response or survive in a shared screenshot.
 */
export async function getDocumentLink(
  actor: AuthContext,
  orderId: string,
  documentId: string,
  query: DocumentLinkQuery,
): Promise<{ id: string; name: string; url: string; contentType: string | null }> {
  // Same scope as the read: an order this member does not hold is an order whose
  // paperwork is not theirs either, and 404 rather than 403 so the refusal does
  // not confirm the id.
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...ACTIVE_ORDERS, ...(await visibleScope(actor)) },
    select: { id: true, reference: true },
  });

  if (!order) throw AppError.notFound('Order not found');

  const document = await prisma.orderDocument.findFirst({
    where: { id: documentId, orderId: order.id, deletedAt: null },
  });

  if (!document) throw AppError.notFound('Document not found');

  // A PENDING row is a placeholder for a document we owe the customer and a
  // REJECTED one has been set aside; neither has an object to sign.
  if (document.status !== OrderDocumentStatus.AVAILABLE || !document.objectKey) {
    throw AppError.businessRule('That document has no file behind it yet');
  }

  const url = await presignObject(document.objectKey, {
    disposition: query.disposition,
    fileName: document.name,
  });

  if (!url) {
    throw AppError.businessRule('That document cannot be opened right now');
  }

  /*
   * Audited as a read, which is the exception in this codebase and the point of
   * the endpoint: these are the customer's identity documents, and who opened one
   * is not recoverable from anywhere else. The filename stays out of the metadata
   * — it is the customer's own words and routinely names them.
   */
  void record({
    actor,
    action: AuditAction.ORDER_DOCUMENT_ACCESSED,
    entityType: 'OrderDocument',
    entityId: document.id,
    metadata: {
      orderId: order.id,
      reference: order.reference,
      source: document.source,
      disposition: query.disposition,
    },
  });

  return {
    id: document.id,
    name: document.name,
    url,
    contentType: document.contentType,
  };
}

// --- Write ---------------------------------------------------------------
export async function updateOrder(
  actor: AuthContext,
  orderId: string,
  input: UpdateOrderInput,
): Promise<AdminOrderRow> {
  const canAssign = await canAssignOrders(actor);

  // Same scope as the read: a member can only move an order they hold.
  const existing = await prisma.order.findFirst({
    where: { id: orderId, ...ACTIVE_ORDERS, ...(await visibleScope(actor)) },
    select: {
      id: true,
      status: true,
      assigneeId: true,
      reference: true,
      customerId: true,
    },
  });

  if (!existing) throw AppError.notFound('Order not found');

  const nextStatus = input.status ? toOrderStatus(input.status) : undefined;
  const statusChanged = nextStatus !== undefined && nextStatus !== existing.status;

  /*
   * The pipeline is enforced here, not in the browser. Staff advance an order a
   * step at a time; an admin may set any status, which is the escape hatch for a
   * mis-click. 422 rather than 400: the request is well-formed, the move is not
   * one this order can make from where it stands.
   */
  if (statusChanged && nextStatus) {
    const allowed = allowedNextStatuses(existing.status, actor.role === Role.ADMIN);

    if (!allowed.includes(nextStatus)) {
      throw AppError.businessRule(
        `An order in ${ORDER_STATUS_LABEL[existing.status]} cannot move to ${ORDER_STATUS_LABEL[nextStatus]}`,
        {
          from: ORDER_STATUS_VIEW[existing.status],
          to: ORDER_STATUS_VIEW[nextStatus],
          allowed: allowed.map((status) => ORDER_STATUS_VIEW[status]),
        },
      );
    }
  }

  /*
   * An order cannot be approved until it has been priced.
   *
   * APPROVED is the status the customer reads as "accepted — here is what it
   * costs", and their next step is to pay. Setting it with no quote on the order
   * puts them in front of a bill that does not exist: the billing screen has
   * nothing to show, the pay button has no amount behind it, and the only way out
   * is a support message. Sending the quote is what approves an order
   * (modules/admin/quotes) — this is the same rule stated from the other side, so
   * the manual control cannot reach a state the quote flow would never produce.
   *
   * Any quote counts, not just a live one: a lapsed or withdrawn offer still means
   * the order was reviewed and priced, and re-approving it is a deliberate act on
   * a decision that was already made. What this refuses is approving an order
   * nobody ever put a number on.
   *
   * Applies to admins too. The admin override exists to correct a mis-click in the
   * pipeline, not to bypass a rule the customer's screen depends on — and an admin
   * who genuinely wants the order approved has the same one-step path everyone
   * else does: send the quote.
   *
   * 422 rather than 403: the actor is entitled to approve orders, this one is just
   * not in a state that can be approved yet.
   */
  if (statusChanged && nextStatus === OrderStatus.APPROVED) {
    const priced = await prisma.quote.findFirst({
      where: { orderId, deletedAt: null },
      select: { id: true },
    });

    if (!priced) {
      throw AppError.businessRule(
        'This order has no quote yet. Send the customer a quote — that approves the order — before marking it approved.',
        {
          from: ORDER_STATUS_VIEW[existing.status],
          to: ORDER_STATUS_VIEW[OrderStatus.APPROVED],
          reason: 'quote_required',
        },
      );
    }
  }

  /*
   * An order cannot be completed while a service line is still open.
   *
   * COMPLETED is what the customer reads as "your filing is done, here is what
   * you got". A service that returns a record is completed by filling in and
   * delivering its result form — `delivery.updateOrderItemStatus` refuses to
   * complete such a line any other way, so the required-field gate cannot be
   * stepped around at the item level. Without this, the order-level control was
   * the way around it: closing the order left every line pending, the customer's
   * order read Completed, and the record they were promised was an empty draft
   * they could never see.
   *
   * Stated in terms of item status rather than results, because it is the same
   * rule for a service that delivers nothing: a line nobody marked done is work
   * nobody did.
   *
   * Applies to admins too, for the same reason the quote gate does — the admin
   * override corrects a mis-click in the pipeline, it does not bypass a rule the
   * customer's screen depends on. The one-step path is the same for everyone:
   * deliver the outstanding lines, then close the order.
   *
   * 422 rather than 403: the actor may complete orders, this one is just not
   * finished yet.
   */
  if (statusChanged && nextStatus === OrderStatus.COMPLETED) {
    const pending = await prisma.orderItem.findMany({
      where: { orderId, status: { not: OrderItemStatus.COMPLETED } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, serviceName: true },
    });

    if (pending.length > 0) {
      throw AppError.businessRule(
        `Every service on this order has to be delivered before it can be completed. Still open: ${pending
          .map((item) => item.serviceName)
          .join(', ')}`,
        {
          from: ORDER_STATUS_VIEW[existing.status],
          to: ORDER_STATUS_VIEW[OrderStatus.COMPLETED],
          reason: 'items_pending',
          pendingItemIds: pending.map((item) => item.id),
        },
      );
    }
  }

  const assigneeChanged =
    input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId;

  /*
   * Handing the order to someone else needs the `orders.assign` area on top of
   * `orders`, which the router already checked. A reviewer works the filings
   * they hold and answers their customer; deciding who owns one is a separate
   * grant an admin hands out per member.
   *
   * Checked only when the assignee actually changes, so re-sending the current
   * holder alongside a status change is not a 403 for someone entitled to that
   * status change.
   */
  if (assigneeChanged && !canAssign) {
    throw AppError.unauthorized(
      'You do not have permission to assign orders to staff',
    );
  }

  // An assignee must be a staff member in good standing. Assigning work to a
  // customer account or a deactivated member is a business-rule error, not a
  // silently ignored field.
  let assigneeName: string | null = null;

  if (input.assigneeId) {
    const assignee = await prisma.staffProfile.findFirst({
      where: {
        userId: input.assigneeId,
        deletedAt: null,
        status: StaffStatus.ACTIVE,
      },
      select: { user: { select: { name: true } } },
    });

    if (!assignee) {
      throw AppError.businessRule('Orders can only be assigned to an active staff member');
    }

    assigneeName = assignee.user.name;
  }

  const actorName = await staffDisplayName(actor.userId);

  /*
   * One transaction so an order can never change state without the activity row
   * that explains it — and a compare-and-set so it can never change state on top
   * of a decision someone else already made.
   *
   * Every gate above was decided from `existing`, a row read before this
   * transaction opened: the transition check, the quote requirement, the assignee
   * lookup. A plain update by id would let two reviewers pressing at the same
   * moment both clear those gates against the same stale row, and the second
   * write would silently overwrite the first — leaving the order in a state
   * neither transition was ever checked for, with two activity rows each claiming
   * to explain it.
   *
   * So the `where` pins the fields the gates were read from. The loser matches no
   * row, writes nothing, and is told to reload (409 — the request was valid, the
   * order simply moved underneath it).
   */
  // Filled inside the transaction, audited after it commits — the threads that
  // actually changed hands, which is not always "all of them" (a thread already
  // pointing at the new assignee is not a state change).
  let movedConversations: { id: string; from: string | null }[] = [];

  const order = await prisma.$transaction(async (tx) => {
    const written = await tx.order.updateMany({
      where: {
        id: orderId,
        ...ACTIVE_ORDERS,
        ...(statusChanged ? { status: existing.status } : {}),
        ...(assigneeChanged ? { assigneeId: existing.assigneeId } : {}),
      },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
      },
    });

    if (written.count === 0) {
      throw AppError.conflict(
        'This order changed while you were working on it. Reload the order and try again.',
        {
          from: ORDER_STATUS_VIEW[existing.status],
          ...(nextStatus ? { to: ORDER_STATUS_VIEW[nextStatus] } : {}),
        },
      );
    }

    /*
     * The order's conversation follows the work. A customer's order thread is
     * answerable only by the order's assignee, so a reassignment that left the
     * thread pointing at the previous holder would hand the conversation to
     * someone who no longer has the filing — and lock out the person who does.
     * In the same transaction, because those two facts must never disagree.
     */
    if (assigneeChanged) {
      movedConversations = await syncAssignee(tx, orderId, input.assigneeId ?? null);
    }

    /*
     * Two kinds of entry, and the split matters:
     *   - a status change is the customer's own order moving, so it is visible
     *   - who on the team holds the file is internal. Naming a staff member on
     *     the customer's feed tells them something about our rota that is not
     *     theirs to know, and would read as a hand-off they should react to.
     */
    const entries: { message: string; internal: boolean }[] = [];

    if (statusChanged && nextStatus) {
      entries.push({
        message: `Status changed to ${ORDER_STATUS_LABEL[nextStatus]}.`,
        internal: false,
      });
    }

    if (assigneeChanged) {
      entries.push({
        message: assigneeName ? `Assigned to ${assigneeName}.` : 'Unassigned.',
        internal: true,
      });
    }

    if (entries.length > 0) {
      await tx.orderActivity.createMany({
        data: entries.map((entry) => ({
          orderId,
          author: OrderActivityAuthor.TEAM,
          authorName: actorName,
          authorUserId: actor.userId,
          message: entry.message,
          internal: entry.internal,
        })),
      });
    }

    return tx.order.findFirstOrThrow({ where: { id: orderId }, include: rowInclude });
  });

  if (statusChanged && nextStatus) {
    void record({
      actor,
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: 'Order',
      entityId: orderId,
      metadata: { from: existing.status, to: order.status, reference: existing.reference },
    });

    /*
     * Tell the customer their filing moved.
     *
     * The activity row written inside the transaction is the order's history —
     * it is there whenever they open the order. This is the push that tells them
     * to go and look, which is a different thing and is the one they can mute.
     *
     * After the commit, never inside it: a rolled back status change must not
     * leave a notification claiming it happened. Fire-and-forget for the same
     * reason the audit call above is — a reviewer's status change must not fail
     * because the customer's feed row could not be written.
     */
    void notifyOrderStatusChanged({
      customerId: existing.customerId,
      orderId,
      reference: existing.reference,
      status: nextStatus,
    });
  }

  if (assigneeChanged) {
    void record({
      actor,
      action: AuditAction.ORDER_ASSIGNED,
      entityType: 'Order',
      entityId: orderId,
      metadata: { from: existing.assigneeId, to: input.assigneeId ?? null },
    });

    /*
     * The order's thread moved with it, and a conversation changing hands is
     * audited on the conversation wherever it happens — the support inbox writes
     * this entry for a manual reassignment and the router writes it for an
     * automatic one, so the order-driven path writes it too rather than leaving
     * the same state change traceable only through the order.
     */
    for (const conversation of movedConversations) {
      void record({
        actor,
        action: AuditAction.CONVERSATION_ASSIGNED,
        entityType: 'Conversation',
        entityId: conversation.id,
        metadata: {
          from: conversation.from,
          to: input.assigneeId ?? null,
          via: 'order_reassignment',
        },
      });
    }
  }

  return toRow(order);
}

// The name a team entry is signed with. Falls back to the business rather than
// to an empty string, so a feed row always reads as coming from someone.
async function staffDisplayName(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  return user?.name ?? 'Marty Global team';
}

/*
 * A staff reply on the order — the other half of "respond to it".
 *
 * A customer-visible reply is the one place this module reaches the customer
 * directly, so it also queues them an email through the notifications pipeline
 * (never inline, AGENTS.md). An internal note does neither: it stays on the
 * admin screen and sends nothing.
 *
 * The message body is never logged and never enters the audit metadata — the
 * trail records that a note was written and whether it was internal, which is
 * what an auditor needs, without copying customer correspondence into a second
 * table (AGENTS.md, Security & PII).
 *
 * Retry-safe by key rather than by shape (AGENTS.md, API Conventions): unlike
 * `updateOrder`, which compares against current state and so does nothing the
 * second time, there is no state here to compare — a repeated call is a
 * perfectly valid second reply. The key is what tells a retry apart from a
 * reviewer deliberately writing twice, and without it a double-submit put two
 * identical entries on the customer's order and emailed them both.
 */
export async function addActivity(
  actor: AuthContext,
  orderId: string,
  input: AddActivityInput,
  idempotencyKey: string,
): Promise<AdminOrderActivityEntry> {
  // Writing to an order's feed — and, for a customer-visible reply, emailing
  // them — is acting on the filing, so it takes the same scope as moving it.
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...ACTIVE_ORDERS, ...(await visibleScope(actor)) },
    select: {
      id: true,
      reference: true,
      customerId: true,
      customer: { select: { email: true } },
    },
  });

  if (!order) throw AppError.notFound('Order not found');

  const internal = input.visibility === 'internal';
  const authorName = await staffDisplayName(actor.userId);

  // The scope check above runs first, so a caller who cannot reach the order is
  // refused before a key is ever looked up — a spent key must not be a way to
  // learn anything about a filing that is not theirs.
  const { record: entry, replayed } = await withIdempotency({
    find: () => prisma.orderActivity.findUnique({ where: { idempotencyKey } }),
    create: () =>
      prisma.orderActivity.create({
        data: {
          orderId,
          author: OrderActivityAuthor.TEAM,
          authorName,
          authorUserId: actor.userId,
          message: input.message,
          internal,
          idempotencyKey,
        },
      }),
    owns: (found) => found.orderId === order.id,
  });

  // Nothing was written, so nothing below it happened either: no audit entry for
  // a reply that already has one, and above all no second email.
  if (replayed) return toActivityEntry(entry);

  void record({
    actor,
    action: AuditAction.ORDER_ACTIVITY_ADDED,
    entityType: 'Order',
    entityId: orderId,
    metadata: { internal, reference: order.reference },
  });

  /*
   * An internal note never reaches the customer at all; a visible reply is a
   * status update on their filing, so it is gated on that category. Muting it
   * only silences the email — the reply itself is already on the order page,
   * which is where a customer who turned emails off expects to read it.
   */
  const notify =
    !internal && (await channelsFor(order.customerId, 'statusUpdates')).email;

  /*
   * The in-app half of the same reply. Without it a customer with email muted
   * had no way at all to learn a reviewer had answered them — the reply sat on
   * the order page waiting to be stumbled upon, which is the gap the bell exists
   * to close. Gated independently of the email, because they are separate
   * toggles on the settings screen.
   */
  if (!internal) {
    void notifyFeed({
      userId: order.customerId,
      preference: 'statusUpdates',
      category: FeedNotificationCategory.ORDER,
      message: `${authorName} replied to your order ${order.reference}.`,
      href: `/app/orders/${order.id}`,
    });
  }

  if (notify) {
    // The reply is already committed; a failure to queue the email must not undo
    // it or fail the request. Log the ids and move on — the customer still sees
    // the reply on their order page.
    await queueOrderReply(order, input.message, authorName).catch((error) => {
      logger.error(
        {
          orderId,
          activityId: entry.id,
          err: error instanceof Error ? error.message : error,
        },
        'Failed to queue order reply email',
      );
    });
  }

  return toActivityEntry(entry);
}

/*
 * Ask the customer to upload a document.
 *
 * The row is the request. `OrderDocument` already models exactly this — a
 * PENDING row is a placeholder with no object behind it — so a request is that
 * row with `source: CUSTOMER`, meaning the customer owes us the file rather than
 * the other way round. Their upload endpoint fills the same row in, so nothing
 * downstream has to learn a second shape, and the Documents card renders the
 * outstanding request beside the documents that already exist.
 *
 * This is the only writer of the DOCUMENT feed category, and the only caller of
 * the `documentRequests` preference — the row of the settings screen that
 * offered a toggle over nothing until now.
 *
 * Retry-safe by key, for the same reason the reply above is: a resent request
 * would otherwise put a second identical placeholder on the Documents card and
 * chase the customer for paperwork they have already been asked for once.
 */
export async function requestDocument(
  actor: AuthContext,
  orderId: string,
  input: RequestDocumentInput,
  idempotencyKey: string,
): Promise<AdminOrderDocument> {
  // Same scope as replying to the customer: asking them for identity paperwork
  // is acting on the filing.
  const order = await prisma.order.findFirst({
    where: { id: orderId, ...ACTIVE_ORDERS, ...(await visibleScope(actor)) },
    select: { id: true, reference: true, customerId: true },
  });

  if (!order) throw AppError.notFound('Order not found');

  const authorName = await staffDisplayName(actor.userId);

  /*
   * The placeholder and the activity row in one transaction. A request the
   * customer can see on the card but that left no trace of who asked or when is
   * the drift worth designing against — the order's history is how they tell a
   * request from a document we simply have not filed yet.
   *
   * The key rides on the placeholder rather than on the activity row: the
   * placeholder is what the customer's upload fills in, so it is the record a
   * replay has to resolve back to.
   */
  const { record: document, replayed } = await withIdempotency({
    find: () => prisma.orderDocument.findUnique({ where: { idempotencyKey } }),
    create: () =>
      prisma.$transaction(async (tx) => {
        const created = await tx.orderDocument.create({
          data: {
            orderId,
            name: input.name,
            status: OrderDocumentStatus.PENDING,
            source: OrderDocumentSource.CUSTOMER,
            idempotencyKey,
          },
        });

        await tx.orderActivity.create({
          data: {
            orderId,
            author: OrderActivityAuthor.TEAM,
            authorName,
            authorUserId: actor.userId,
            message: `Requested ${input.name} from the customer.`,
            // The customer is being asked for it — hiding the ask would be absurd.
            internal: false,
          },
        });

        return created;
      }),
    owns: (found) => found.orderId === order.id,
  });

  // The request already exists and the customer has already been told about it.
  if (replayed) return toDocument(document);

  void record({
    actor,
    action: AuditAction.ORDER_DOCUMENT_REQUESTED,
    entityType: 'OrderDocument',
    entityId: document.id,
    // Ids and the order's reference only. The requested name is free text a
    // reviewer typed and routinely names the customer.
    metadata: { orderId, reference: order.reference },
  });

  // After the commit, so a rolled back request cannot email someone about a
  // document nobody is waiting for.
  void notifyDocumentRequested({
    customerId: order.customerId,
    orderId,
    reference: order.reference,
    documentLabel: input.name,
  });

  return toDocument(document);
}

async function queueOrderReply(
  order: {
    id: string;
    reference: string;
    customerId: string;
    customer: { email: string };
  },
  message: string,
  authorName: string,
): Promise<void> {
  await queueEmail({
    to: order.customer.email,
    subject: `Update on your order ${order.reference}`,
    template: 'generic',
    heading: `${authorName} replied to ${order.reference}`,
    body: message,
    actionLabel: 'View order',
    actionUrl: `${publicAppUrl}/app/orders/${order.id}`,
    userId: order.customerId,
  });
}
