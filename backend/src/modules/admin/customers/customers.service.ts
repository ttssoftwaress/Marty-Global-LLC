import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { toInitials } from '../../../lib/initials.js';
import { cursorArgs, takePage, totalPages } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { Role } from '../../../lib/roles.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { canSeeAll, hasPermission } from '../admin.guards.js';
import {
  customerScope,
  type DataScope,
  mailItemScope,
  orderScope,
  paymentScope,
  scopeLabel,
} from '../admin.scope.js';
import {
  iso,
  isoOrNull,
  money,
  type Money,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VIEW,
  OPEN_ORDER_STATUSES,
  regionView,
  type RegionView,
} from '../admin.views.js';
import type {
  BanCustomerInput,
  CustomerSegment,
  ListCustomerOrdersQuery,
  ListCustomersQuery,
} from './customers.validation.js';

/*
 * Admin customers — the list, one customer's record, their orders, and the one
 * write these screens have: suspending an account. All Prisma access for these
 * screens lives here.
 *
 * Nothing here edits a customer's own details. Their name, address, and contact
 * details are theirs to change in the portal (`modules/profile`), and an admin
 * changing them behind their back is a decision nobody has asked for. Ending
 * their access is a different thing entirely, which is why it is the exception —
 * and why it takes its own grant (`customers.ban`) rather than riding on the area
 * that opens the record.
 *
 * MONEY: `totalSpent` is a sum of integer minor units, added as integers and
 * passed through untouched (AGENTS.md, Money).
 */

// Every query here is scoped to customer accounts. Staff rows live in the same
// Better Auth table, so without this a team member would appear as a customer.
const CUSTOMER_SCOPE: Prisma.UserWhereInput = {
  deletedAt: null,
  OR: [{ role: Role.CUSTOMER }, { role: null }],
};

// "Active" means seen recently. 90 days is the window the segment tab means by
// it — long enough that a customer between filings still counts.
const ACTIVE_WINDOW_DAYS = 90;

function activeCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - ACTIVE_WINDOW_DAYS);
  return cutoff;
}

/*
 * A customer's region is their company's country — signup no longer asks for one,
 * so the company record is the only place a jurisdiction is stated. The filter
 * below mirrors this exactly — if the two disagreed, the list would show rows the
 * filter did not select.
 */
const regionWhere = (code: string): Prisma.UserWhereInput => ({
  company: { is: { country: code } },
});

function segmentWhere(
  segment: CustomerSegment,
  now: Date,
): Prisma.UserWhereInput {
  switch (segment) {
    case 'active':
      return {
        OR: [
          { sessions: { some: { createdAt: { gte: activeCutoff(now) } } } },
          { orders: { some: { createdAt: { gte: activeCutoff(now) }, deletedAt: null } } },
        ],
      };
    case 'has-open-orders':
      return {
        orders: { some: { status: { in: [...OPEN_ORDER_STATUSES] }, deletedAt: null } },
      };
    case 'no-orders':
      return { orders: { none: { deletedAt: null } } };
    case 'all':
      return {};
  }
}

function searchWhere(search: string | undefined): Prisma.UserWhereInput {
  if (!search) return {};
  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { company: { is: { businessName: { contains: search, mode: 'insensitive' } } } },
    ],
  };
}

function listWhere(query: ListCustomersQuery, now: Date): Prisma.UserWhereInput {
  return {
    ...CUSTOMER_SCOPE,
    AND: [
      segmentWhere(query.segment, now),
      searchWhere(query.search),
      ...(query.region ? [regionWhere(query.region)] : []),
    ],
  };
}

// --- Summary -------------------------------------------------------------
export type AdminCustomersSummary = {
  totalCustomers: number;
  // Whether these counts cover the whole book or only the customers this actor
  // deals with, so the header can say which figure it is printing.
  scope: DataScope;
  tabs: { value: CustomerSegment; label: string; count?: number }[];
  regions: { value: string; label: string }[];
};

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  all: 'All customers',
  active: 'Active',
  'has-open-orders': 'Open orders',
  'no-orders': 'No orders',
};

export async function getSummary(
  actor: AuthContext,
): Promise<AdminCustomersSummary> {
  const now = new Date();

  const segments: CustomerSegment[] = ['all', 'active', 'has-open-orders', 'no-orders'];

  // The tab counts read the same scope as the list behind them, so a tab can
  // never promise rows the list then refuses to show.
  const scope = await customerScope(actor);

  const [counts, regions] = await Promise.all([
    Promise.all(
      segments.map((segment) =>
        prisma.user.count({
          where: { ...CUSTOMER_SCOPE, ...scope, AND: [segmentWhere(segment, now)] },
        }),
      ),
    ),
    prisma.region.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { code: true, label: true },
    }),
  ]);

  return {
    // `all` is the first segment, so its count is the header's total.
    totalCustomers: counts[0] ?? 0,
    scope: scopeLabel(await canSeeAll(actor, 'customers')),
    tabs: segments.map((segment, index) => ({
      value: segment,
      label: SEGMENT_LABELS[segment],
      count: counts[index] ?? 0,
    })),
    // "All regions" is the frontend's ALL_REGIONS sentinel; it leads the list so
    // the dropdown opens on the unfiltered choice.
    regions: [
      { value: 'all', label: 'All regions' },
      ...regions.map((region) => ({ value: region.code, label: region.label })),
    ],
  };
}

// --- List ----------------------------------------------------------------
export type AdminCustomerRow = {
  id: string;
  name: string;
  initials: string;
  email: string;
  region: RegionView;
  totalOrders: number;
  totalSpent: Money;
  lastActivityAt: string | null;
  to: string;
};

export type AdminCustomersPage = {
  customers: AdminCustomerRow[];
  nextCursor: string | null;
  page: number;
  totalPages: number;
  totalResults: number;
};

const rowInclude = {
  company: { select: { country: true } },
  _count: { select: { orders: { where: { deletedAt: null } } } },
  // The newest of these two is "last seen": a sign-in, or work they filed.
  sessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
  orders: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true },
  },
} satisfies Prisma.UserInclude;

type CustomerRow = Prisma.UserGetPayload<{ include: typeof rowInclude }>;

function lastActivity(user: CustomerRow): Date | null {
  const candidates = [user.sessions[0]?.createdAt, user.orders[0]?.createdAt].filter(
    (date): date is Date => Boolean(date),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

/*
 * Total spent, per customer, in one grouped query rather than a sum per row.
 * Only settled money counts — a pending or failed attempt is not revenue.
 *
 * Scoped on the payment itself rather than on the customer: a member may deal
 * with a customer over one order and still have no claim on what that customer
 * paid against somebody else's, so the figure is what they can account for.
 */
async function spendByCustomer(
  actor: AuthContext,
  customerIds: readonly string[],
): Promise<Map<string, Money>> {
  if (customerIds.length === 0) return new Map();

  const grouped = await prisma.payment.groupBy({
    by: ['customerId', 'currency'],
    where: {
      ...(await paymentScope(actor)),
      customerId: { in: [...customerIds] },
      deletedAt: null,
      status: PaymentStatus.SUCCEEDED,
    },
    _sum: { amount: true },
  });

  const totals = new Map<string, Money>();
  for (const group of grouped) {
    // Grouped by currency as well as customer: summing two currencies into one
    // figure would be wrong, so the first currency a customer has wins and any
    // second one is left out of the headline rather than silently added to it.
    if (totals.has(group.customerId)) continue;
    totals.set(group.customerId, money(group._sum.amount ?? 0, group.currency));
  }

  return totals;
}

async function resolveRegions(
  codes: readonly string[],
): Promise<Map<string, { label: string; flag: string }>> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return new Map();

  const regions = await prisma.region.findMany({ where: { code: { in: unique } } });
  return new Map(regions.map((region) => [region.code, region]));
}

export async function listCustomers(
  actor: AuthContext,
  query: ListCustomersQuery,
): Promise<AdminCustomersPage> {
  const now = new Date();
  // One `where` for both calls below: scoping the rows but not the count leaves
  // a total that tells the member exactly how much they were not shown.
  const where: Prisma.UserWhereInput = {
    ...listWhere(query, now),
    ...(await customerScope(actor)),
  };

  const [totalResults, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: rowInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  const codes = page.rows
    .map((user) => user.company?.country)
    .filter((code): code is string => Boolean(code));

  const [spend, regions] = await Promise.all([
    spendByCustomer(actor, page.rows.map((user) => user.id)),
    resolveRegions(codes),
  ]);

  return {
    customers: page.rows.map((user) => {
      const code = user.company?.country ?? null;

      return {
        id: user.id,
        name: user.name,
        initials: toInitials(user.name),
        email: user.email,
        // A region code with no row in the catalogue still prints the code, so a
        // legacy value renders rather than disappearing.
        region: code
          ? regionView(regions.get(code) ?? { label: code, flag: '' }, code)
          : regionView(null),
        totalOrders: user._count.orders,
        totalSpent: spend.get(user.id) ?? money(0),
        lastActivityAt: isoOrNull(lastActivity(user)),
        to: `/admin/customers/${user.id}`,
      };
    }),
    nextCursor: page.nextCursor,
    // The numbered pager is a display convenience over the cursor stream; the
    // first fetch is page 1 and the cursor steps from there.
    page: query.cursor ? 0 : 1,
    totalPages: totalPages(totalResults, query.limit),
    totalResults,
  };
}

// --- Detail --------------------------------------------------------------
export type AdminCustomerDetail = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  country: { code: string; name: string; flag?: string };
  status: 'active' | 'inactive' | 'suspended';
  statusLabel: string;
  /*
   * The suspension, as three separate answers the screen needs at once: whether
   * the account is closed right now, why (the note whoever closed it left), and
   * whether this actor may change it. `canBan` is the same predicate the route
   * guard runs, so the screen never offers a control the endpoint would refuse.
   */
  isBanned: boolean;
  banReason: string | null;
  canBan: boolean;
  customerSince: string | null;
  metrics: {
    id: string;
    label: string;
    value: { kind: 'count'; count: number } | { kind: 'money'; money: Money };
  }[];
  messageThreadTo: string | null;
};

const STATUS_LABEL = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
} as const;

/*
 * Is this account suspended *right now*?
 *
 * Better Auth's admin plugin stores an optional expiry, and a lapsed ban is no
 * longer a ban — `guards/require-auth.ts` reads it exactly this way on every
 * request. This screen has to agree with the guard: an account the guard lets in
 * must not be printed as suspended, and the suspend button must not be missing
 * from an account that can sign in.
 *
 * Nothing in this module ever sets an expiry — a suspension made here is
 * permanent until somebody lifts it — but the plugin's own routes can, so the
 * column is read rather than assumed.
 */
function isBanActive(
  user: { banned: boolean | null; banExpires: Date | null },
  now = new Date(),
): boolean {
  return Boolean(user.banned) && (!user.banExpires || user.banExpires > now);
}

export async function getCustomer(
  actor: AuthContext,
  customerId: string,
): Promise<AdminCustomerDetail> {
  const now = new Date();
  const seesAll = await canSeeAll(actor, 'customers');

  // In the `where`, not a check on the result: an out-of-scope customer then
  // 404s like any unknown id rather than confirming the record exists.
  const user = await prisma.user.findFirst({
    where: { id: customerId, ...CUSTOMER_SCOPE, ...(await customerScope(actor)) },
    include: {
      profile: { select: { phone: true } },
      company: { select: { country: true } },
      sessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      orders: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  if (!user) throw AppError.notFound('Customer not found');

  const code = user.company?.country ?? null;

  /*
   * Reaching the record does not mean reading all of it. Every figure below
   * carries its own model's scope so the metrics add up to what this actor may
   * open — a "12 orders" tile over a list of three is a count of work they
   * cannot see.
   */
  const [region, totalOrders, activeOrders, openMail, spend, thread] = await Promise.all([
    code ? prisma.region.findUnique({ where: { code } }) : Promise.resolve(null),
    prisma.order.count({
      where: { ...(await orderScope(actor)), customerId, deletedAt: null },
    }),
    prisma.order.count({
      where: {
        ...(await orderScope(actor)),
        customerId,
        deletedAt: null,
        status: { in: [...OPEN_ORDER_STATUSES] },
      },
    }),
    // "Open mail items" is mail the customer has not dealt with — new arrivals
    // and anything asking them to act.
    prisma.mailItem.count({
      where: {
        ...(await mailItemScope(actor)),
        deletedAt: null,
        room: { customerId, deletedAt: null },
        status: { in: ['NEW', 'ACTION_REQUESTED'] },
      },
    }),
    spendByCustomer(actor, [customerId]),
    /*
     * The thread link is scoped by who holds the conversation, not by order
     * assignment: support threads carry their own `assigneeId`, and the admin
     * support module already refuses a thread that is not the member's. Linking
     * to one they cannot open would be a button into a 404.
     */
    prisma.conversation.findFirst({
      where: {
        customerId,
        deletedAt: null,
        ...(seesAll ? {} : { assigneeId: actor.userId }),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    }),
  ]);

  // Banned is an explicit suspension; otherwise it comes down to whether they
  // have been seen inside the active window.
  const seen = [user.sessions[0]?.createdAt, user.orders[0]?.createdAt].filter(
    (date): date is Date => Boolean(date),
  );
  const lastSeen = seen.length > 0 ? seen.reduce((a, b) => (a > b ? a : b)) : null;

  const banned = isBanActive(user, now);

  const status: AdminCustomerDetail['status'] = banned
    ? 'suspended'
    : lastSeen && lastSeen >= activeCutoff(now)
      ? 'active'
      : 'inactive';

  return {
    id: user.id,
    name: user.name,
    initials: toInitials(user.name),
    email: user.email,
    phone: user.profile?.phone ?? null,
    country: {
      code: code ?? '',
      name: region?.label ?? code ?? 'Not specified',
      ...(region?.flag ? { flag: region.flag } : {}),
    },
    status,
    statusLabel: STATUS_LABEL[status],
    isBanned: banned,
    // Only while the ban is live. A stale note under a restored account reads as
    // a standing accusation against someone whose access is back.
    banReason: banned ? user.banReason : null,
    canBan: await hasPermission(actor, 'customers.ban'),
    customerSince: iso(user.createdAt),
    metrics: [
      { id: 'total-orders', label: 'Total orders', value: { kind: 'count', count: totalOrders } },
      {
        id: 'total-spent',
        label: 'Total spent',
        value: { kind: 'money', money: spend.get(customerId) ?? money(0) },
      },
      { id: 'active-orders', label: 'Active orders', value: { kind: 'count', count: activeOrders } },
      {
        id: 'open-mail-items',
        label: 'Open mail items',
        value: { kind: 'count', count: openMail },
      },
    ],
    // Null when there is no thread yet — the button then has nothing to open,
    // which the frontend renders rather than linking into a dead route.
    messageThreadTo: thread ? `/admin/support/${thread.id}` : null,
  };
}

// --- The customer's orders ----------------------------------------------
export type CustomerOrderRow = {
  id: string;
  reference: string;
  service: string;
  submittedAt: string;
  status: string;
  statusLabel: string;
  to: string;
};

export type CustomerOrdersPage = {
  orders: CustomerOrderRow[];
  nextCursor: string | null;
  totalResults: number;
};

export async function listCustomerOrders(
  actor: AuthContext,
  customerId: string,
  query: ListCustomerOrdersQuery,
): Promise<CustomerOrdersPage> {
  const exists = await prisma.user.findFirst({
    where: { id: customerId, ...CUSTOMER_SCOPE, ...(await customerScope(actor)) },
    select: { id: true },
  });

  if (!exists) throw AppError.notFound('Customer not found');

  // Every row here deep-links to an order page, so the list has to agree with
  // what the orders module will actually open — an unscoped row is a link into
  // a 404.
  const where: Prisma.OrderWhereInput = {
    ...(await orderScope(actor)),
    customerId,
    deletedAt: null,
  };

  const [totalResults, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    orders: page.rows.map((order) => ({
      id: order.id,
      reference: order.reference,
      service: serviceLabel(order.items[0]?.serviceName, order._count.items),
      submittedAt: iso(order.submittedAt ?? order.createdAt),
      status: ORDER_STATUS_VIEW[order.status],
      statusLabel: ORDER_STATUS_LABEL[order.status],
      to: `/admin/orders/${order.id}`,
    })),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

// --- Suspending an account -----------------------------------------------

/*
 * Suspend a customer, and lift a suspension.
 *
 * A ban closes two doors and both are needed. `banned` on the user row is what
 * Better Auth checks at sign-in and what `guards/require-auth.ts` re-checks on
 * every request; deleting the sessions is what ends the ones already issued,
 * since a cookie stays valid until it expires. Without the second half a
 * suspended customer keeps working in an open tab until they happen to sign out.
 *
 * Both writes claim the state they are changing FROM in the `where` — the same
 * shape as settling a payment. Two staff pressing Suspend on the same account
 * land one write and one 409, rather than a second audit entry saying an already
 * closed account was closed again.
 *
 * The suspension is permanent until somebody lifts it: no expiry is written. A
 * ban that quietly ends on its own is not a decision anybody made, and nothing
 * on this screen would show it was coming.
 *
 * What a ban does NOT do is delete anything. The customer's filings, payments,
 * and mail are under regulatory retention (AGENTS.md, Database) and are exactly
 * what the team still needs to read after the account is closed.
 */
export async function banCustomer(
  actor: AuthContext,
  customerId: string,
  input: BanCustomerInput,
): Promise<AdminCustomerDetail> {
  const now = new Date();
  const reason = input.reason ?? null;

  // Scoped like every read here, so a member who cannot open this record cannot
  // suspend it either — and an out-of-scope id 404s rather than confirming the
  // account exists.
  const scope = await customerScope(actor);

  const target = await prisma.user.findFirst({
    where: { id: customerId, ...CUSTOMER_SCOPE, ...scope },
    select: { id: true, banned: true, banExpires: true },
  });

  if (!target) throw AppError.notFound('Customer not found');

  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      // "Not currently banned", spelled the way the guard reads it: never
      // banned, un-banned, or holding a ban that has already lapsed.
      where: {
        id: customerId,
        ...CUSTOMER_SCOPE,
        OR: [{ banned: null }, { banned: false }, { banExpires: { lte: now } }],
      },
      data: { banned: true, banReason: reason, banExpires: null },
    });

    if (count === 0) return false;

    // Every session, not just the current one — a customer may be signed in on
    // several devices, and each cookie is a separate way back in.
    await tx.session.deleteMany({ where: { userId: customerId } });
    return true;
  });

  if (!claimed) throw AppError.conflict('This account is already suspended');

  void record({
    actor,
    action: AuditAction.ACCOUNT_BANNED,
    // The user row is what this happens to, matching `audit.auth-hook.ts` — the
    // two paths that can suspend an account write the same shape of entry.
    entityType: 'User',
    entityId: customerId,
    // The reason is staff-written text about our own decision, not the
    // customer's data, so it belongs in the trail: "why was this account closed"
    // is the question asked months later.
    metadata: { via: 'admin-portal', ...(reason === null ? {} : { reason }) },
  });

  return getCustomer(actor, customerId);
}

export async function unbanCustomer(
  actor: AuthContext,
  customerId: string,
): Promise<AdminCustomerDetail> {
  const scope = await customerScope(actor);

  const target = await prisma.user.findFirst({
    where: { id: customerId, ...CUSTOMER_SCOPE, ...scope },
    select: { id: true },
  });

  if (!target) throw AppError.notFound('Customer not found');

  // A lapsed ban is claimed by this too, and that is deliberate: the row still
  // says `banned`, the screen still has to be able to clear it, and clearing it
  // changes nothing the guard was doing anyway.
  const { count } = await prisma.user.updateMany({
    where: { id: customerId, ...CUSTOMER_SCOPE, banned: true },
    data: { banned: false, banReason: null, banExpires: null },
  });

  if (count === 0) throw AppError.conflict('This account is not suspended');

  void record({
    actor,
    action: AuditAction.ACCOUNT_UNBANNED,
    entityType: 'User',
    entityId: customerId,
    metadata: { via: 'admin-portal' },
  });

  // Restoring access does not restore the sessions the ban ended — the customer
  // signs in again, which is the correct outcome and not worth a second write.
  return getCustomer(actor, customerId);
}

/*
 * An order groups several services; the row has one column for them. The first
 * item names it and the rest become a count, so a two-service application reads
 * "Company Formation +1" rather than being truncated to look like a single one.
 */
export function serviceLabel(first: string | undefined, total: number): string {
  if (!first) return 'Order';
  return total > 1 ? `${first} +${total - 1}` : first;
}

// Kept beside the customer scope it shares, so other admin modules counting
// customers cannot drift from this definition.
export { CUSTOMER_SCOPE, OrderStatus };
