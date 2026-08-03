import {
  ConversationCategory,
  ConversationStatus,
  FeedNotificationCategory,
  MailItemStatus,
  MailLogAction,
  MailRequestStatus,
  MailRequestType,
  MailRoomStatus,
  MessageAuthor,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  type PrismaClient,
  QuoteStatus,
  StaffStatus,
} from '@prisma/client';

import { resolveMemberPermissions } from '../src/lib/staff-permissions.js';
import { ensureSystemStaffRoles } from '../src/lib/staff-roles.js';

/*
 * Development fixture data for the admin portal.
 *
 * Every admin screen renders an empty state until rows exist, and several of
 * them — the reports charts, the revenue series, the funnel, the ledger's status
 * tabs — only prove anything against a spread of records. This seeds that
 * spread: staff across roles and statuses, customers across regions, orders
 * across every status, quotes and payments across every ledger state, mail in
 * every stage of handling, and conversations across the inbox filters.
 *
 * Two things it deliberately does NOT do:
 *
 *   - It never creates Better Auth `account` rows. Better Auth owns password
 *     hashing (AGENTS.md: no custom password handling), so a seeded person can
 *     be assigned work and appear in every list but cannot sign in until the
 *     account is registered through the normal flow. The bootstrap admin from
 *     ADMIN_EMAIL is the account you actually log in with, and this seed grants
 *     it a StaffProfile so the permission guards resolve for it.
 *   - It never invents money outside the rules: every amount is integer minor
 *     units plus an ISO 4217 code (AGENTS.md, Money).
 *
 * Idempotent: every row upserts on a stable id, so re-running refreshes the
 * fixture in place rather than duplicating it.
 */

const NOW = new Date();
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
const hoursFromNow = (hours: number) =>
  new Date(NOW.getTime() + hours * 60 * 60 * 1000);

// --- Staff ---------------------------------------------------------------
/*
 * A member is a role plus their own deviations from it. `overrides` is the
 * per-account decisions an admin took on the team screen — `false` for something
 * the role grants but this person is denied, `true` for something the role does
 * not grant. The effective set is computed from the two, exactly as the service
 * does, so the fixture cannot drift from the rule.
 *
 * Two members carry one deliberately, so the screen has an override to show:
 * Sarah cannot confirm wire payments despite managing operations, and Lena is a
 * reviewer with the reports section closed.
 */
type SeedStaff = {
  id: string;
  name: string;
  email: string;
  roleKey: string;
  status: StaffStatus;
  overrides: Record<string, boolean>;
  joinedDaysAgo: number | null;
};

const STAFF: SeedStaff[] = [
  {
    id: 'staff-sarah',
    name: 'Sarah Whitfield',
    email: 'sarah.whitfield@martyglobal.test',
    roleKey: 'operations-manager',
    status: StaffStatus.ACTIVE,
    // Runs the pipeline, but confirming a wire arrived is somebody else's call.
    overrides: { 'payments.settle': false },
    joinedDaysAgo: 420,
  },
  {
    id: 'staff-marcus',
    name: 'Marcus Tavares',
    email: 'marcus.tavares@martyglobal.test',
    roleKey: 'reviewer',
    status: StaffStatus.ACTIVE,
    overrides: {},
    joinedDaysAgo: 210,
  },
  {
    id: 'staff-priya',
    name: 'Priya Raghunathan',
    email: 'priya.raghunathan@martyglobal.test',
    roleKey: 'support-agent',
    status: StaffStatus.ACTIVE,
    overrides: {},
    joinedDaysAgo: 95,
  },
  {
    id: 'staff-diego',
    name: 'Diego Fernández',
    email: 'diego.fernandez@martyglobal.test',
    roleKey: 'mail-operator',
    status: StaffStatus.ACTIVE,
    overrides: {},
    joinedDaysAgo: 60,
  },
  {
    id: 'staff-lena',
    name: 'Lena Kowalski',
    email: 'lena.kowalski@martyglobal.test',
    roleKey: 'reviewer',
    status: StaffStatus.ACTIVE,
    // The same role as Marcus, one section short — which is the point of the
    // per-member switches, and the pair the team screen reads best against.
    overrides: { reports: false },
    joinedDaysAgo: 20,
  },
  {
    id: 'staff-tom',
    name: 'Tom Beckett',
    email: 'tom.beckett@martyglobal.test',
    roleKey: 'support-agent',
    status: StaffStatus.DEACTIVATED,
    overrides: {},
    joinedDaysAgo: 300,
  },
];

// --- Customers -----------------------------------------------------------
type SeedCustomer = {
  id: string;
  name: string;
  email: string;
  // The company's jurisdiction — the only place a customer's region is stated
  // now that signup no longer asks. A customer with no company has no region.
  country: string;
  createdDaysAgo: number;
  company?: { businessName: string; industry: string; address: string };
  // Drives the "Active" segment and the detail screen's status pill.
  lastSeenDaysAgo: number | null;
};

const CUSTOMERS: SeedCustomer[] = [
  {
    id: 'cust-elena',
    name: 'Elena Marchetti',
    email: 'elena.marchetti@example.test',
    country: 'EU',
    createdDaysAgo: 180,
    company: {
      businessName: 'Marchetti Design Studio',
      industry: 'Design & creative',
      address: 'Via Roma 42, 20121 Milan, Italy',
    },
    lastSeenDaysAgo: 2,
  },
  {
    id: 'cust-james',
    name: 'James Okonkwo',
    email: 'james.okonkwo@example.test',
    country: 'GB',
    createdDaysAgo: 120,
    company: {
      businessName: 'Okonkwo Trading Ltd',
      industry: 'Import & export',
      address: '71-75 Shelton Street, London WC2H 9JQ, United Kingdom',
    },
    lastSeenDaysAgo: 9,
  },
  {
    id: 'cust-mei',
    name: 'Mei Lin Chen',
    email: 'meilin.chen@example.test',
    country: 'SG',
    createdDaysAgo: 75,
    company: {
      businessName: 'Chen Logistics Pte',
      industry: 'Logistics',
      address: '10 Anson Road, #26-04, Singapore 079903',
    },
    lastSeenDaysAgo: 21,
  },
  {
    id: 'cust-tobias',
    name: 'Tobias Berg',
    email: 'tobias.berg@example.test',
    country: 'US',
    createdDaysAgo: 45,
    company: {
      businessName: 'Northbridge Supply Co',
      industry: 'E-commerce & retail',
      address: '1209 Orange Street, Wilmington, DE 19801, USA',
    },
    lastSeenDaysAgo: 1,
  },
  {
    id: 'cust-amara',
    name: 'Amara Diallo',
    email: 'amara.diallo@example.test',
    country: 'CA',
    createdDaysAgo: 30,
    lastSeenDaysAgo: 5,
  },
  {
    // No orders and long dormant — the "No orders" segment and the detail
    // screen's Inactive pill both need a row that reads this way.
    id: 'cust-viktor',
    name: 'Viktor Sørensen',
    email: 'viktor.sorensen@example.test',
    country: 'EU',
    createdDaysAgo: 200,
    lastSeenDaysAgo: 150,
  },
  {
    id: 'cust-rachel',
    name: 'Rachel Adeyemi',
    email: 'rachel.adeyemi@example.test',
    country: 'US',
    createdDaysAgo: 12,
    lastSeenDaysAgo: 3,
  },
  {
    id: 'cust-hassan',
    name: 'Hassan Al-Rashid',
    email: 'hassan.alrashid@example.test',
    country: 'AE',
    createdDaysAgo: 6,
    lastSeenDaysAgo: 0,
  },
];

// --- Orders --------------------------------------------------------------
type SeedOrder = {
  id: string;
  reference: string;
  customerId: string;
  status: OrderStatus;
  regionCode: string;
  assigneeId: string | null;
  serviceId: string;
  serviceName: string;
  answers: Record<string, string>;
  submittedDaysAgo: number;
};

const ORDERS: SeedOrder[] = [
  {
    id: 'ord-demo-1',
    reference: 'ORD-20481',
    customerId: 'cust-elena',
    status: OrderStatus.UNDER_REVIEW,
    regionCode: 'EU',
    assigneeId: 'staff-marcus',
    serviceId: 'company-formation',
    serviceName: 'Company Formation',
    answers: { companyName: 'Marchetti Ventures SRL', jurisdiction: 'eu', entityType: 'ltd' },
    submittedDaysAgo: 8,
  },
  {
    id: 'ord-demo-2',
    reference: 'ORD-20482',
    customerId: 'cust-james',
    status: OrderStatus.MISSING_INFO,
    regionCode: 'GB',
    assigneeId: 'staff-marcus',
    serviceId: 'bank-account',
    serviceName: 'Bank Account Opening Assistance',
    answers: { accountRegion: 'uk', entityName: 'Okonkwo Trading Ltd' },
    submittedDaysAgo: 14,
  },
  {
    id: 'ord-demo-3',
    reference: 'ORD-20483',
    customerId: 'cust-mei',
    status: OrderStatus.APPROVED,
    regionCode: 'SG',
    assigneeId: 'staff-sarah',
    serviceId: 'e-commerce',
    serviceName: 'E-Commerce Account Setup',
    answers: { marketplace: 'amazon', storeName: 'Chen Direct' },
    submittedDaysAgo: 22,
  },
  {
    id: 'ord-demo-4',
    reference: 'ORD-20484',
    customerId: 'cust-tobias',
    status: OrderStatus.COMPLETED,
    regionCode: 'US',
    assigneeId: 'staff-sarah',
    serviceId: 'company-formation',
    serviceName: 'Company Formation',
    answers: { companyName: 'Northbridge Supply LLC', jurisdiction: 'us-de', entityType: 'llc' },
    submittedDaysAgo: 40,
  },
  {
    // Unassigned and open — the dashboard's "unassigned" attention row needs one.
    id: 'ord-demo-5',
    reference: 'ORD-20485',
    customerId: 'cust-amara',
    status: OrderStatus.SUBMITTED,
    regionCode: 'CA',
    assigneeId: null,
    serviceId: 'virtual-mail-room',
    serviceName: 'Virtual Mail Room',
    answers: { addressRegion: 'ca', forwarding: 'scan' },
    submittedDaysAgo: 2,
  },
  {
    id: 'ord-demo-6',
    reference: 'ORD-20486',
    customerId: 'cust-rachel',
    status: OrderStatus.SUBMITTED,
    regionCode: 'US',
    assigneeId: null,
    serviceId: 'company-formation',
    serviceName: 'Company Formation',
    answers: { companyName: 'Adeyemi Consulting LLC', jurisdiction: 'us-wy', entityType: 'llc' },
    submittedDaysAgo: 1,
  },
  {
    id: 'ord-demo-7',
    reference: 'ORD-20487',
    customerId: 'cust-hassan',
    status: OrderStatus.UNDER_REVIEW,
    regionCode: 'AE',
    assigneeId: 'staff-marcus',
    serviceId: 'company-formation',
    serviceName: 'Company Formation',
    answers: { companyName: 'Al-Rashid Holdings', jurisdiction: 'uae', entityType: 'ltd' },
    submittedDaysAgo: 5,
  },
  {
    id: 'ord-demo-8',
    reference: 'ORD-20488',
    customerId: 'cust-tobias',
    status: OrderStatus.COMPLETED,
    regionCode: 'US',
    assigneeId: 'staff-sarah',
    serviceId: 'virtual-mail-room',
    serviceName: 'Virtual Mail Room',
    answers: { addressRegion: 'us', forwarding: 'both' },
    submittedDaysAgo: 55,
  },
  {
    id: 'ord-demo-9',
    reference: 'ORD-20489',
    customerId: 'cust-elena',
    status: OrderStatus.COMPLETED,
    regionCode: 'EU',
    assigneeId: 'staff-marcus',
    serviceId: 'bank-account',
    serviceName: 'Bank Account Opening Assistance',
    answers: { accountRegion: 'eu', entityName: 'Marchetti Design Studio' },
    submittedDaysAgo: 90,
  },
  {
    id: 'ord-demo-10',
    reference: 'ORD-20490',
    customerId: 'cust-james',
    status: OrderStatus.COMPLETED,
    regionCode: 'GB',
    assigneeId: 'staff-sarah',
    serviceId: 'e-commerce',
    serviceName: 'E-Commerce Account Setup',
    answers: { marketplace: 'ebay', storeName: 'Okonkwo Direct' },
    submittedDaysAgo: 120,
  },
];

/*
 * Quotes and their payments. The ledger's status is derived from the pair, so
 * this set deliberately covers every tab: paid, pending, and failed.
 *
 * MONEY: integer minor units. 59900 = $599.00.
 */
type SeedBilling = {
  quoteId: string;
  reference: string;
  orderId: string;
  customerId: string;
  serviceName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  quoteStatus: QuoteStatus;
  issuedDaysAgo: number;
  validDays: number;
  payment?: {
    id: string;
    status: PaymentStatus;
    provider: PaymentProvider;
    paidDaysAgo?: number;
  };
};

const BILLING: SeedBilling[] = [
  {
    quoteId: 'quote-demo-1',
    reference: 'QT-30481',
    orderId: 'ord-demo-4',
    customerId: 'cust-tobias',
    serviceName: 'Company Formation — Delaware LLC',
    subtotal: 59_900,
    discount: 0,
    tax: 0,
    total: 59_900,
    quoteStatus: QuoteStatus.PAID,
    issuedDaysAgo: 38,
    validDays: -24,
    payment: {
      id: 'pay-demo-1',
      status: PaymentStatus.SUCCEEDED,
      provider: PaymentProvider.USDT_TRC20,
      paidDaysAgo: 36,
    },
  },
  {
    quoteId: 'quote-demo-2',
    reference: 'QT-30482',
    orderId: 'ord-demo-8',
    customerId: 'cust-tobias',
    serviceName: 'Virtual Mail Room — Annual',
    subtotal: 24_900,
    discount: 0,
    tax: 0,
    total: 24_900,
    quoteStatus: QuoteStatus.PAID,
    issuedDaysAgo: 52,
    validDays: -38,
    payment: {
      id: 'pay-demo-2',
      status: PaymentStatus.SUCCEEDED,
      provider: PaymentProvider.USDT_TRC20,
      paidDaysAgo: 50,
    },
  },
  {
    quoteId: 'quote-demo-3',
    reference: 'QT-30483',
    orderId: 'ord-demo-9',
    customerId: 'cust-elena',
    serviceName: 'Bank Account Opening — EU',
    subtotal: 39_900,
    discount: 5_000,
    tax: 0,
    total: 34_900,
    quoteStatus: QuoteStatus.PAID,
    issuedDaysAgo: 88,
    validDays: -74,
    payment: {
      id: 'pay-demo-3',
      status: PaymentStatus.SUCCEEDED,
      provider: PaymentProvider.USDT_TRC20,
      paidDaysAgo: 86,
    },
  },
  {
    quoteId: 'quote-demo-4',
    reference: 'QT-30484',
    orderId: 'ord-demo-10',
    customerId: 'cust-james',
    serviceName: 'E-Commerce Account Setup — eBay',
    subtotal: 34_900,
    discount: 0,
    tax: 0,
    total: 34_900,
    quoteStatus: QuoteStatus.PAID,
    issuedDaysAgo: 118,
    validDays: -104,
    payment: {
      id: 'pay-demo-4',
      status: PaymentStatus.SUCCEEDED,
      provider: PaymentProvider.USDT_TRC20,
      paidDaysAgo: 116,
    },
  },
  {
    // Issued and unpaid, inside its window — the "Outstanding" KPI and the
    // pending_payment tab both read from rows like this.
    quoteId: 'quote-demo-5',
    reference: 'QT-30485',
    orderId: 'ord-demo-1',
    customerId: 'cust-elena',
    serviceName: 'Company Formation — EU Ltd',
    subtotal: 89_900,
    discount: 10_000,
    tax: 0,
    total: 79_900,
    quoteStatus: QuoteStatus.PENDING,
    issuedDaysAgo: 6,
    validDays: 8,
  },
  {
    // Expiring within the week — the dashboard's attention queue needs one.
    quoteId: 'quote-demo-6',
    reference: 'QT-30486',
    orderId: 'ord-demo-3',
    customerId: 'cust-mei',
    serviceName: 'E-Commerce Account Setup — Amazon',
    subtotal: 34_900,
    discount: 0,
    tax: 0,
    total: 34_900,
    quoteStatus: QuoteStatus.PENDING,
    issuedDaysAgo: 11,
    validDays: 3,
  },
  {
    quoteId: 'quote-demo-7',
    reference: 'QT-30487',
    orderId: 'ord-demo-7',
    customerId: 'cust-hassan',
    serviceName: 'Company Formation — UAE',
    subtotal: 129_900,
    discount: 0,
    tax: 0,
    total: 129_900,
    quoteStatus: QuoteStatus.PENDING,
    issuedDaysAgo: 4,
    validDays: 10,
    payment: {
      // A failed attempt with nothing settled after it — the `failed` tab.
      id: 'pay-demo-5',
      status: PaymentStatus.FAILED,
      provider: PaymentProvider.USDT_TRC20,
    },
  },
];

type Delegate = {
  upsert: (args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<unknown>;
};

function delegate(prisma: PrismaClient, model: string): Delegate {
  const found = (prisma as unknown as Record<string, Delegate | undefined>)[model];
  if (!found) throw new Error(`Unknown Prisma model in seed: ${model}`);
  return found;
}

async function upsertById(
  prisma: PrismaClient,
  model: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const row of rows) {
    await delegate(prisma, model).upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }
}

export async function seedAdminDemo(prisma: PrismaClient): Promise<void> {
  // --- Staff -------------------------------------------------------------
  /*
   * Roles first — a StaffProfile points at one by foreign key, and the seed runs
   * against databases the server may never have booted against. Provisioning is
   * create-only, so re-seeding never widens a role an admin narrowed.
   */
  await ensureSystemStaffRoles(prisma);

  const roles = new Map(
    (await prisma.staffRole.findMany()).map((role) => [role.key, role]),
  );

  for (const member of STAFF) {
    const role = roles.get(member.roleKey);

    if (!role) {
      console.warn(`  ! skipped ${member.name}: role "${member.roleKey}" is missing`);
      continue;
    }

    await prisma.user.upsert({
      where: { id: member.id },
      create: {
        id: member.id,
        name: member.name,
        email: member.email,
        emailVerified: true,
        // The job role decides the authorization role the guards read, exactly
        // as the team service does it.
        role: role.authRole,
      },
      update: { name: member.name, email: member.email, role: role.authRole },
    });

    const shortName = member.name.split(' ')[0];
    const lastInitial = member.name.split(' ').at(-1)?.[0] ?? '';
    const permissions = resolveMemberPermissions(role, member.overrides);

    await prisma.staffProfile.upsert({
      where: { userId: member.id },
      create: {
        userId: member.id,
        roleKey: member.roleKey,
        status: member.status,
        permissionOverrides: member.overrides,
        permissions,
        shortName: `${shortName} ${lastInitial}.`,
        joinedAt: member.joinedDaysAgo === null ? null : daysFromNow(-member.joinedDaysAgo),
        lastActiveAt: member.status === StaffStatus.ACTIVE ? daysFromNow(-1) : null,
      },
      update: {
        roleKey: member.roleKey,
        status: member.status,
        permissionOverrides: member.overrides,
        permissions,
        joinedAt: member.joinedDaysAgo === null ? null : daysFromNow(-member.joinedDaysAgo),
      },
    });
  }

  /*
   * The bootstrap admin (ADMIN_EMAIL) is the account you actually sign in with.
   * Give it a StaffProfile so it appears in the team list — the permission guard
   * already lets an admin through every area, but a member with no profile would
   * be invisible on the screen that manages members.
   */
  const bootstrapAdmin = await prisma.user.findFirst({
    where: { role: 'admin', deletedAt: null, staffProfile: null },
    orderBy: { createdAt: 'asc' },
  });

  if (bootstrapAdmin) {
    await prisma.staffProfile.upsert({
      where: { userId: bootstrapAdmin.id },
      create: {
        userId: bootstrapAdmin.id,
        roleKey: 'super-admin',
        status: StaffStatus.ACTIVE,
        // No overrides: the account you sign in with holds exactly what the
        // Super Admin role gives, so narrowing it is a deliberate act on screen.
        permissionOverrides: {},
        permissions: resolveMemberPermissions(
          roles.get('super-admin') ?? { permissions: [], lockedPermissions: [] },
          {},
        ),
        shortName: bootstrapAdmin.name.split(' ')[0] ?? 'Admin',
        joinedAt: bootstrapAdmin.createdAt,
        lastActiveAt: NOW,
      },
      update: { status: StaffStatus.ACTIVE },
    });
  }

  // --- Customers ---------------------------------------------------------
  for (const customer of CUSTOMERS) {
    await prisma.user.upsert({
      where: { id: customer.id },
      create: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        emailVerified: true,
        role: 'customer',
        createdAt: daysFromNow(-customer.createdDaysAgo),
      },
      update: { name: customer.name },
    });

    if (customer.company) {
      await prisma.company.upsert({
        where: { ownerId: customer.id },
        create: { ownerId: customer.id, country: customer.country, ...customer.company },
        update: customer.company,
      });
    }

    /*
     * A session row is what "last seen" reads from, so the Active segment and
     * the detail screen's status pill have something real to derive from. It
     * carries an already-expired token: this is a timestamp for the activity
     * query, never a usable credential.
     */
    if (customer.lastSeenDaysAgo !== null) {
      await prisma.session.upsert({
        where: { id: `sess-seed-${customer.id}` },
        create: {
          id: `sess-seed-${customer.id}`,
          userId: customer.id,
          token: `seed-expired-${customer.id}`,
          expiresAt: daysFromNow(-customer.lastSeenDaysAgo + 1),
          createdAt: daysFromNow(-customer.lastSeenDaysAgo),
        },
        update: { createdAt: daysFromNow(-customer.lastSeenDaysAgo) },
      });
    }
  }

  // --- Orders ------------------------------------------------------------
  for (const order of ORDERS) {
    const submittedAt = daysFromNow(-order.submittedDaysAgo);

    await prisma.order.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        reference: order.reference,
        customerId: order.customerId,
        status: order.status,
        regionCode: order.regionCode,
        assigneeId: order.assigneeId,
        submittedAt,
        createdAt: submittedAt,
        items: {
          create: [
            {
              serviceId: order.serviceId,
              serviceName: order.serviceName,
              answers: order.answers,
              sortOrder: 0,
            },
          ],
        },
      },
      update: {
        status: order.status,
        regionCode: order.regionCode,
        assigneeId: order.assigneeId,
        submittedAt,
        createdAt: submittedAt,
      },
    });

    await upsertById(prisma, 'orderActivity', [
      {
        id: `activity-${order.id}`,
        orderId: order.id,
        author: 'CUSTOMER',
        authorName: CUSTOMERS.find((c) => c.id === order.customerId)?.name ?? 'Customer',
        authorUserId: order.customerId,
        message: 'Application submitted.',
        occurredAt: submittedAt,
      },
    ]);
  }

  // --- Billing -----------------------------------------------------------
  for (const entry of BILLING) {
    const issuedAt = daysFromNow(-entry.issuedDaysAgo);

    await prisma.quote.upsert({
      where: { id: entry.quoteId },
      create: {
        id: entry.quoteId,
        reference: entry.reference,
        customerId: entry.customerId,
        orderId: entry.orderId,
        status: entry.quoteStatus,
        serviceName: entry.serviceName,
        subtotal: entry.subtotal,
        discount: entry.discount,
        tax: entry.tax,
        total: entry.total,
        currency: 'USD',
        issuedAt,
        createdAt: issuedAt,
        validUntil: daysFromNow(-entry.issuedDaysAgo + entry.validDays + entry.issuedDaysAgo),
        paidAt:
          entry.quoteStatus === QuoteStatus.PAID && entry.payment?.paidDaysAgo !== undefined
            ? daysFromNow(-entry.payment.paidDaysAgo)
            : null,
        lineItems: {
          create: [
            { label: entry.serviceName, amount: entry.subtotal, sortOrder: 0 },
            ...(entry.discount > 0
              ? [{ label: 'Discount', amount: -entry.discount, sortOrder: 1 }]
              : []),
          ],
        },
      },
      update: {
        status: entry.quoteStatus,
        validUntil: daysFromNow(entry.validDays),
        total: entry.total,
      },
    });

    // The validity window is relative to now, so a "pending" quote stays inside
    // its window and an expired one stays outside it however long after the seed
    // the database is looked at.
    await prisma.quote.update({
      where: { id: entry.quoteId },
      data: { validUntil: daysFromNow(entry.validDays) },
    });

    if (entry.payment) {
      const paidAt =
        entry.payment.paidDaysAgo === undefined
          ? null
          : daysFromNow(-entry.payment.paidDaysAgo);

      await prisma.payment.upsert({
        where: { id: entry.payment.id },
        create: {
          id: entry.payment.id,
          customerId: entry.customerId,
          quoteId: entry.quoteId,
          provider: entry.payment.provider,
          status: entry.payment.status,
          amount: entry.total,
          currency: 'USD',
          providerRef: `seed_${entry.payment.id}`,
          paidAt,
          createdAt: paidAt ?? issuedAt,
          depositAddress: 'TSeedDemoAddressDoNotSendFunds00000',
          usdtDecimals: 6,
          // What actually landed on-chain — so only on a row that settled. A
          // failed attempt received nothing, and a settled amount on it would
          // read as money we hold.
          //
          // USDT has 6 decimals against USD's 2, so the raw on-chain integer is
          // the minor-unit amount with four more zeros. Built by appending digits
          // rather than multiplying: the column is Decimal(38,0) and no step of
          // this may pass through a float (AGENTS.md, Money).
          ...(paidAt ? { usdtAmountRaw: `${entry.total}0000` } : {}),
        },
        update: { status: entry.payment.status, paidAt },
      });
    }
  }

  // --- Mail rooms --------------------------------------------------------
  await upsertById(prisma, 'mailRoom', [
    {
      id: 'room-tobias',
      customerId: 'cust-tobias',
      name: 'Delaware HQ',
      address: '1209 Orange Street, Suite 210, Wilmington, DE 19801, USA',
      line1: '1209 Orange Street',
      line2: 'Suite 210',
      city: 'Wilmington',
      region: 'DE',
      postalCode: '19801',
      country: 'US',
      status: MailRoomStatus.ACTIVE,
      renewsAt: daysFromNow(210),
    },
    {
      id: 'room-james',
      customerId: 'cust-james',
      name: 'London Office',
      address: '71-75 Shelton Street, London WC2H 9JQ, United Kingdom',
      line1: '71-75 Shelton Street',
      city: 'London',
      postalCode: 'WC2H 9JQ',
      country: 'GB',
      status: MailRoomStatus.ACTIVE,
      renewsAt: daysFromNow(120),
    },
    {
      id: 'room-elena',
      customerId: 'cust-elena',
      name: 'Milan Office',
      address: 'Via Roma 42, 20121 Milan, Italy',
      city: 'Milan',
      postalCode: '20121',
      country: 'IT',
      status: MailRoomStatus.PENDING,
      renewsAt: daysFromNow(330),
    },
  ]);

  await upsertById(prisma, 'mailItem', [
    {
      id: 'mail-demo-1',
      roomId: 'room-tobias',
      sender: 'Delaware Division of Corporations',
      status: MailItemStatus.NEW,
      receivedAt: daysFromNow(-2),
      storageExpiresAt: daysFromNow(28),
      scanReady: true,
    },
    {
      id: 'mail-demo-2',
      roomId: 'room-tobias',
      sender: 'Internal Revenue Service',
      status: MailItemStatus.ACTION_REQUESTED,
      receivedAt: daysFromNow(-9),
      storageExpiresAt: daysFromNow(21),
      scanReady: true,
      note: 'Forwarding requested by the customer',
    },
    {
      id: 'mail-demo-3',
      roomId: 'room-james',
      sender: 'HM Revenue & Customs',
      status: MailItemStatus.ACTION_REQUESTED,
      receivedAt: daysFromNow(-4),
      storageExpiresAt: daysFromNow(26),
      scanReady: true,
      note: 'Shredding requested by the customer',
    },
    {
      id: 'mail-demo-4',
      roomId: 'room-james',
      sender: 'Companies House',
      status: MailItemStatus.FORWARDED,
      receivedAt: daysFromNow(-30),
      storageExpiresAt: daysFromNow(-1),
      scanReady: true,
    },
    {
      // Still processing — the inbox renders a "Scanning" preview for this one.
      id: 'mail-demo-5',
      roomId: 'room-tobias',
      sender: 'Unknown Sender',
      status: MailItemStatus.NEW,
      receivedAt: hoursFromNow(-6),
      storageExpiresAt: daysFromNow(30),
      scanReady: false,
    },
    {
      id: 'mail-demo-6',
      roomId: 'room-tobias',
      sender: 'Wells Fargo Business Banking',
      status: MailItemStatus.VIEWED,
      receivedAt: daysFromNow(-18),
      storageExpiresAt: daysFromNow(12),
      scanReady: true,
    },
  ]);

  for (const [itemId, pages] of Object.entries({
    'mail-demo-1': 2,
    'mail-demo-2': 3,
    'mail-demo-3': 1,
    'mail-demo-4': 1,
    'mail-demo-6': 2,
  })) {
    for (let page = 1; page <= pages; page += 1) {
      await prisma.mailItemScan.upsert({
        where: { mailItemId_pageNumber: { mailItemId: itemId, pageNumber: page } },
        create: {
          mailItemId: itemId,
          pageNumber: page,
          // An object key, never a URL — the service presigns at read time.
          objectKey: `demo/mail/${itemId}/page-${page}.png`,
        },
        update: {},
      });
    }
  }

  // The operator's queue: one waiting, one in flight, one already settled.
  await upsertById(prisma, 'mailRequest', [
    {
      id: 'mailreq-demo-1',
      mailItemId: 'mail-demo-2',
      customerId: 'cust-tobias',
      type: MailRequestType.FORWARDING,
      status: MailRequestStatus.PENDING,
      shippingAddress: '1209 Orange Street, Wilmington, DE 19801, USA',
      requestedAt: daysFromNow(-3),
    },
    {
      id: 'mailreq-demo-2',
      mailItemId: 'mail-demo-3',
      customerId: 'cust-james',
      type: MailRequestType.SHREDDING,
      status: MailRequestStatus.PROCESSING,
      requestedAt: daysFromNow(-2),
    },
    {
      id: 'mailreq-demo-3',
      mailItemId: 'mail-demo-4',
      customerId: 'cust-james',
      type: MailRequestType.FORWARDING,
      status: MailRequestStatus.COMPLETED,
      shippingAddress: '71-75 Shelton Street, London WC2H 9JQ, United Kingdom',
      carrier: 'royal-mail',
      trackingNumber: 'RM123456789GB',
      processedById: 'staff-diego',
      processedByName: 'Diego Fernández',
      requestedAt: daysFromNow(-28),
      processedAt: daysFromNow(-26),
    },
  ]);

  // The closed history behind the Mail log tab.
  await upsertById(prisma, 'mailActionLog', [
    {
      id: 'maillog-demo-1',
      mailItemId: 'mail-demo-4',
      customerId: 'cust-james',
      action: MailLogAction.FORWARDED,
      mailItemLabel: 'Companies House',
      processedById: 'staff-diego',
      processedByName: 'Diego Fernández',
      closedAt: daysFromNow(-26),
    },
    {
      id: 'maillog-demo-2',
      mailItemId: 'mail-demo-6',
      customerId: 'cust-tobias',
      action: MailLogAction.DOWNLOADED,
      mailItemLabel: 'Wells Fargo Business Banking',
      processedByName: 'Tobias Berg',
      closedAt: daysFromNow(-17),
    },
  ]);

  // --- Support -----------------------------------------------------------
  await upsertById(prisma, 'conversation', [
    {
      id: 'conv-demo-1',
      customerId: 'cust-elena',
      subject: 'Company Formation — EU Ltd',
      category: ConversationCategory.FORMATION,
      status: ConversationStatus.OPEN,
      assigneeId: 'staff-priya',
      orderId: 'ord-demo-1',
      lastMessageAt: hoursFromNow(-3),
      preview: 'Could you confirm whether the notarised passport copy is still needed?',
      customerReadAt: hoursFromNow(-3),
    },
    {
      // Unassigned and open — the inbox's amber "Unassigned" pill needs one.
      id: 'conv-demo-2',
      customerId: 'cust-james',
      subject: 'Bank application — missing document',
      category: ConversationCategory.DOCUMENTS,
      status: ConversationStatus.OPEN,
      assigneeId: null,
      orderId: 'ord-demo-2',
      lastMessageAt: hoursFromNow(-20),
      preview: 'I uploaded the utility bill yesterday — did it come through?',
      customerReadAt: hoursFromNow(-20),
    },
    {
      id: 'conv-demo-3',
      customerId: 'cust-mei',
      subject: 'Question about my quote',
      category: ConversationCategory.BILLING,
      status: ConversationStatus.PENDING,
      assigneeId: 'staff-priya',
      orderId: 'ord-demo-3',
      lastMessageAt: daysFromNow(-2),
      preview: 'Thanks — the quote covers marketplace verification as well.',
      customerReadAt: daysFromNow(-3),
    },
    {
      id: 'conv-demo-4',
      customerId: 'cust-tobias',
      subject: 'Mail forwarding to a new address',
      category: ConversationCategory.MAILROOM,
      status: ConversationStatus.RESOLVED,
      assigneeId: 'staff-diego',
      lastMessageAt: daysFromNow(-12),
      preview: 'All set — the forwarding address is updated.',
      customerReadAt: daysFromNow(-11),
      closedAt: daysFromNow(-11),
    },
  ]);

  await upsertById(prisma, 'message', [
    {
      id: 'msg-demo-1',
      conversationId: 'conv-demo-1',
      author: MessageAuthor.CUSTOMER,
      authorUserId: 'cust-elena',
      authorName: 'Elena Marchetti',
      body: 'Could you confirm whether the notarised passport copy is still needed?',
      sentAt: hoursFromNow(-3),
    },
    {
      // An internal note: staff-only, and the portal's reads filter it out.
      id: 'msg-demo-2',
      conversationId: 'conv-demo-1',
      author: MessageAuthor.INTERNAL_NOTE,
      authorUserId: 'staff-priya',
      authorName: 'Priya Raghunathan',
      body: 'Notary waived for EU filings since March — confirm with Marcus before replying.',
      sentAt: hoursFromNow(-2),
    },
    {
      id: 'msg-demo-3',
      conversationId: 'conv-demo-2',
      author: MessageAuthor.CUSTOMER,
      authorUserId: 'cust-james',
      authorName: 'James Okonkwo',
      body: 'I uploaded the utility bill yesterday — did it come through?',
      sentAt: hoursFromNow(-20),
    },
    {
      id: 'msg-demo-4',
      conversationId: 'conv-demo-3',
      author: MessageAuthor.CUSTOMER,
      authorUserId: 'cust-mei',
      authorName: 'Mei Lin Chen',
      body: 'Does the quote include the marketplace verification step?',
      sentAt: daysFromNow(-3),
    },
    {
      id: 'msg-demo-5',
      conversationId: 'conv-demo-3',
      author: MessageAuthor.AGENT,
      authorUserId: 'staff-priya',
      authorName: 'Priya Raghunathan',
      body: 'Thanks — the quote covers marketplace verification as well.',
      sentAt: daysFromNow(-2),
    },
    {
      id: 'msg-demo-6',
      conversationId: 'conv-demo-4',
      author: MessageAuthor.AGENT,
      authorUserId: 'staff-diego',
      authorName: 'Diego Fernández',
      body: 'All set — the forwarding address is updated.',
      sentAt: daysFromNow(-12),
    },
  ]);

  /*
   * --- Staff notification feed -------------------------------------------
   * The admin top-bar panel and `/admin/notifications` read the same
   * FeedNotification ledger the customer feed does, scoped to the signed-in
   * user. So the rows have to belong to the account you actually sign in with —
   * the bootstrap admin — rather than a seeded person who has no Better Auth
   * account and can never log in to see them.
   *
   * Every `href` points into `/admin/*` and at a record this seed created, so
   * following a row lands on a real screen. The messages are stored
   * display-ready, exactly as the app writes them.
   */
  if (bootstrapAdmin) {
    await upsertById(prisma, 'feedNotification', [
      {
        id: 'admin-feed-order-review',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.ORDER,
        message: 'Order ORD-20481 from Elena Marchetti is awaiting review.',
        href: '/admin/orders/ord-demo-1',
        createdAt: hoursFromNow(-2),
      },
      {
        id: 'admin-feed-support-reply',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.MESSAGE,
        message: 'Elena Marchetti replied in a support conversation.',
        href: '/admin/support/conv-demo-1',
        createdAt: hoursFromNow(-3),
      },
      {
        id: 'admin-feed-mail-request',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.MAILROOM,
        message: 'A new mail forwarding request is waiting to be processed.',
        href: '/admin/mailroom',
        createdAt: hoursFromNow(-9),
      },
      {
        id: 'admin-feed-payment-received',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.PAYMENT,
        message: 'Payment of $349.00 received from James Okonkwo.',
        href: '/admin/payments',
        createdAt: daysFromNow(-2),
      },
      {
        id: 'admin-feed-quote-issued',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.BILLING,
        message: 'Quote QT-30485 was issued and is awaiting customer approval.',
        href: '/admin/payments',
        createdAt: daysFromNow(-4),
        readAt: daysFromNow(-3),
      },
      {
        id: 'admin-feed-document-uploaded',
        userId: bootstrapAdmin.id,
        category: FeedNotificationCategory.DOCUMENT,
        message: 'James Okonkwo uploaded a proof-of-address document.',
        href: '/admin/customers/cust-james',
        createdAt: daysFromNow(-11),
        readAt: daysFromNow(-10),
      },
    ]);
  }

  console.info(
    `Admin demo seeded — ${STAFF.length} staff, ${CUSTOMERS.length} customers, ` +
      `${ORDERS.length} orders, ${BILLING.length} quotes.`,
  );
  console.info(
    'Seeded people have no Better Auth account and cannot sign in; use ADMIN_EMAIL for that.',
  );
}
