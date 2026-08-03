import { PrismaPg } from '@prisma/adapter-pg';
import {
  ConversationCategory,
  FeedNotificationCategory,
  MailItemStatus,
  MailRoomStatus,
  MessageAuthor,
  OrderActivityAuthor,
  OrderDocumentSource,
  OrderDocumentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  QuoteStatus,
} from '@prisma/client';

import { seedAdminDemo } from './seed-admin-demo.js';
import { FIELDS, RESULT_FIELDS, SERVICES } from './seed-catalog.js';
import { seedLocations } from './seed-locations.js';
import {
  seedDemoCatalogPricing,
  seedDemoReferenceData,
} from './seed-reference.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — cannot seed.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});


/*
 * Demo customer — the portal has a screen for every domain (orders, mail rooms,
 * messages, billing, notifications), and each renders an empty state until rows
 * exist. This block seeds one realistic customer so every screen can be opened
 * and reviewed against real data instead of an empty state.
 *
 * It is development data only: it is skipped unless SEED_DEMO=true, and it never
 * creates the auth account. Better Auth owns password hashing (AGENTS.md: no
 * custom password handling), so the demo user must be registered through the
 * normal sign-up flow first — the seed then attaches its portal records by
 * email, and no-ops with a notice if that account doesn't exist.
 *
 * Idempotent like the catalog above: every record upserts on a stable id, so
 * re-running refreshes the demo data in place rather than duplicating it.
 */

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@martyglobal.test';

// Fixed offsets from the seed run, so the demo data always reads as "recent"
// (an order submitted 12 days ago, mail that arrived this week) no matter when
// it is seeded. Dates are UTC — the UI converts at render (AGENTS.md, Dates).
const NOW = new Date();
const daysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

async function seedDemoCustomer(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL, deletedAt: null },
  });

  if (!user) {
    console.info(
      `Demo seed skipped — no account for ${DEMO_EMAIL}. Sign up with that email first, then re-run.`,
    );
    return;
  }

  const userId = user.id;

  // --- Profile, company, notification preferences ------------------------
  await prisma.customerProfile.upsert({
    where: { userId },
    create: { userId, phone: '+15551234567', timezone: 'America/New_York' },
    update: { phone: '+15551234567', timezone: 'America/New_York' },
  });

  await prisma.company.upsert({
    where: { ownerId: userId },
    create: {
      ownerId: userId,
      businessName: 'North Peak Goods LLC',
      country: 'US',
      industry: 'E-commerce & retail',
      address: '1209 Orange Street, Wilmington, DE 19801',
    },
    update: {},
  });

  // Defaults match the schema's — seeded explicitly so the settings matrix has a
  // record to load rather than falling back to the all-off empty state.
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, emailMaster: true, newMessagesSms: true },
    update: {},
  });

  // --- Orders ------------------------------------------------------------
  // Two orders across different statuses, so the My-orders filter tabs (all /
  // active / completed / attention) each have something to show.
  const formationOrder = await prisma.order.upsert({
    where: { reference: 'ORD-10432' },
    create: {
      reference: 'ORD-10432',
      customerId: userId,
      status: OrderStatus.UNDER_REVIEW,
      notes: 'Please prioritise the EIN application if possible.',
      submittedAt: daysFromNow(-12),
      // What the service derives from the "us-de" jurisdiction answer below, set
      // explicitly here so the demo order appears under the admin queue's region
      // filter exactly as a freshly submitted one would.
      regionCode: 'US',
      items: {
        create: [
          {
            serviceId: 'company-formation',
            serviceName: 'Company Formation',
            answers: {
              companyName: 'North Peak Goods LLC',
              jurisdiction: 'us-de',
              entityType: 'llc',
              businessActivity: 'Online retail of outdoor equipment.',
            },
            sortOrder: 0,
          },
          {
            serviceId: 'virtual-mail-room',
            serviceName: 'Virtual Mail Room',
            answers: { addressRegion: 'us', forwarding: 'both' },
            sortOrder: 1,
          },
        ],
      },
    },
    update: {
      status: OrderStatus.UNDER_REVIEW,
      submittedAt: daysFromNow(-12),
      regionCode: 'US',
    },
  });

  const ecommerceOrder = await prisma.order.upsert({
    where: { reference: 'ORD-10188' },
    create: {
      reference: 'ORD-10188',
      customerId: userId,
      status: OrderStatus.COMPLETED,
      submittedAt: daysFromNow(-64),
      items: {
        create: [
          {
            serviceId: 'e-commerce',
            serviceName: 'E-Commerce Account Setup',
            answers: {
              marketplace: 'amazon',
              storeName: 'North Peak Goods',
              productCategories: 'Camping gear, hiking accessories.',
            },
            sortOrder: 0,
          },
        ],
      },
    },
    update: { status: OrderStatus.COMPLETED, submittedAt: daysFromNow(-64) },
  });

  // Documents: one delivered, one still owed — the detail card renders an
  // available row and a disabled pending row.
  await upsertMany('orderDocument', [
    {
      id: 'demo-doc-articles',
      orderId: ecommerceOrder.id,
      name: 'Seller account confirmation.pdf',
      status: OrderDocumentStatus.AVAILABLE,
      source: OrderDocumentSource.TEAM,
      objectKey: 'demo/orders/ORD-10188/seller-confirmation.pdf',
      contentType: 'application/pdf',
      sizeBytes: 184_320,
    },
    {
      id: 'demo-doc-certificate',
      orderId: formationOrder.id,
      name: 'Certificate of Formation.pdf',
      status: OrderDocumentStatus.PENDING,
      source: OrderDocumentSource.TEAM,
    },
  ]);

  await upsertMany('orderActivity', [
    {
      id: 'demo-activity-submitted',
      orderId: formationOrder.id,
      author: OrderActivityAuthor.CUSTOMER,
      authorName: user.name,
      authorUserId: userId,
      message: 'Application submitted with 2 services.',
      occurredAt: daysFromNow(-12),
    },
    {
      id: 'demo-activity-review',
      orderId: formationOrder.id,
      author: OrderActivityAuthor.TEAM,
      authorName: 'Sarah — Client Success',
      message:
        'We have started the name availability check with the Delaware Division of Corporations.',
      occurredAt: daysFromNow(-9),
    },
  ]);

  // --- Mail room ---------------------------------------------------------
  const mailRoom = await prisma.mailRoom.upsert({
    where: { id: 'demo-mailroom-main' },
    create: {
      id: 'demo-mailroom-main',
      customerId: userId,
      name: 'Main Office',
      address: '1209 Orange Street, Suite 210, Wilmington, DE 19801, USA',
      line1: '1209 Orange Street',
      line2: 'Suite 210',
      city: 'Wilmington',
      region: 'DE',
      postalCode: '19801',
      country: 'US',
      status: MailRoomStatus.ACTIVE,
      renewsAt: daysFromNow(240),
    },
    update: { status: MailRoomStatus.ACTIVE, renewsAt: daysFromNow(240) },
  });

  // Three items covering the states the inbox renders differently: unread, an
  // action-requested row (red pill + "Respond"), and one still scanning.
  await upsertMany('mailItem', [
    {
      id: 'demo-mail-registry',
      roomId: mailRoom.id,
      sender: 'State Registry Office',
      status: MailItemStatus.NEW,
      receivedAt: daysFromNow(-3),
      storageExpiresAt: daysFromNow(27),
      scanReady: true,
    },
    {
      id: 'demo-mail-irs',
      roomId: mailRoom.id,
      sender: 'Internal Revenue Service',
      status: MailItemStatus.ACTION_REQUESTED,
      receivedAt: daysFromNow(-6),
      // Inside the 7-day window, so the inbox flags it as expiring soon.
      storageExpiresAt: daysFromNow(4),
      scanReady: true,
      note: 'Forwarding address required',
      responseDueAt: daysFromNow(9),
    },
    {
      id: 'demo-mail-bank',
      roomId: mailRoom.id,
      sender: 'Unknown Sender',
      status: MailItemStatus.NEW,
      receivedAt: daysFromNow(-1),
      storageExpiresAt: daysFromNow(29),
      scanReady: false,
    },
  ]);

  // Scan pages for the two ready items — object keys only; the service layer
  // presigns them at read time (AGENTS.md, Security & PII).
  await upsertManyBy(
    'mailItemScan',
    (row) => ({
      mailItemId_pageNumber: {
        mailItemId: row.mailItemId as string,
        pageNumber: row.pageNumber as number,
      },
    }),
    [
      {
        mailItemId: 'demo-mail-registry',
        pageNumber: 1,
        objectKey: 'demo/mail/demo-mail-registry/page-1.png',
      },
      {
        mailItemId: 'demo-mail-registry',
        pageNumber: 2,
        objectKey: 'demo/mail/demo-mail-registry/page-2.png',
      },
      {
        mailItemId: 'demo-mail-irs',
        pageNumber: 1,
        objectKey: 'demo/mail/demo-mail-irs/page-1.png',
      },
    ],
  );

  // --- Support conversations --------------------------------------------
  const formationThread = await prisma.conversation.upsert({
    where: { id: 'demo-conversation-formation' },
    create: {
      id: 'demo-conversation-formation',
      customerId: userId,
      subject: 'LLC Formation — USA',
      category: ConversationCategory.FORMATION,
      orderId: formationOrder.id,
      lastMessageAt: daysFromNow(-1),
      preview: 'Thanks — we will confirm the name availability by Thursday.',
      // Unread: the last message is newer than the last read.
      customerReadAt: daysFromNow(-2),
    },
    update: { lastMessageAt: daysFromNow(-1), customerReadAt: daysFromNow(-2) },
  });

  await prisma.conversation.upsert({
    where: { id: 'demo-conversation-billing' },
    create: {
      id: 'demo-conversation-billing',
      customerId: userId,
      subject: 'Question about my quote',
      category: ConversationCategory.BILLING,
      lastMessageAt: daysFromNow(-8),
      preview: 'Happy to help — the quote covers state filing fees.',
      customerReadAt: daysFromNow(-7),
    },
    update: { lastMessageAt: daysFromNow(-8) },
  });

  await upsertMany('message', [
    {
      id: 'demo-message-1',
      conversationId: formationThread.id,
      author: MessageAuthor.CUSTOMER,
      authorUserId: userId,
      authorName: user.name,
      body: 'Hi — is there anything else you need from me for the Delaware filing?',
      sentAt: daysFromNow(-2),
    },
    {
      id: 'demo-message-2',
      conversationId: formationThread.id,
      author: MessageAuthor.AGENT,
      authorName: 'Sarah — Client Success',
      body: 'Thanks — we will confirm the name availability by Thursday.',
      sentAt: daysFromNow(-1),
    },
  ]);

  // --- Billing & payments ------------------------------------------------
  // Money is integer minor units + ISO 4217 throughout (AGENTS.md, Money):
  // 89900 = $899.00. Never a float, here or anywhere else.
  const pendingQuote = await prisma.quote.upsert({
    where: { reference: 'QT-20451' },
    create: {
      reference: 'QT-20451',
      customerId: userId,
      orderId: formationOrder.id,
      status: QuoteStatus.PENDING,
      serviceName: 'Company Formation — Delaware LLC',
      subtotal: 89_900,
      discount: 10_000,
      tax: 0,
      total: 79_900,
      currency: 'USD',
      issuedAt: daysFromNow(-4),
      validUntil: daysFromNow(10),
      lineItems: {
        create: [
          { label: 'Delaware LLC formation', amount: 59_900, sortOrder: 0 },
          { label: 'Registered agent — 1 year', amount: 30_000, sortOrder: 1 },
          // Negative minor units — a credit line, which is why amounts are signed.
          { label: 'First-order discount', amount: -10_000, sortOrder: 2 },
        ],
      },
    },
    update: { status: QuoteStatus.PENDING, validUntil: daysFromNow(10) },
  });

  const paidQuote = await prisma.quote.upsert({
    where: { reference: 'QT-20190' },
    create: {
      reference: 'QT-20190',
      customerId: userId,
      orderId: ecommerceOrder.id,
      status: QuoteStatus.PAID,
      serviceName: 'E-Commerce Account Setup — Amazon',
      subtotal: 34_900,
      total: 34_900,
      currency: 'USD',
      issuedAt: daysFromNow(-62),
      validUntil: daysFromNow(-48),
      paidAt: daysFromNow(-60),
      lineItems: {
        create: [{ label: 'Amazon seller account setup', amount: 34_900, sortOrder: 0 }],
      },
    },
    update: { status: QuoteStatus.PAID, paidAt: daysFromNow(-60) },
  });

  // A settled USDT payment for the paid quote. The tx hash is a seed placeholder,
  // not a real Tron transaction — it only has to be unique, which is what the
  // never-double-credit constraint is checking.
  await upsertMany('payment', [
    {
      id: 'demo-payment-ecommerce',
      customerId: userId,
      quoteId: paidQuote.id,
      provider: PaymentProvider.USDT_TRC20,
      status: PaymentStatus.SUCCEEDED,
      amount: 34_900,
      currency: 'USD',
      providerRef: 'seed_demo_ecommerce',
      paidAt: daysFromNow(-60),
    },
  ]);

  // --- Notification feed -------------------------------------------------
  await upsertMany('feedNotification', [
    {
      id: 'demo-feed-quote',
      userId,
      category: FeedNotificationCategory.BILLING,
      message: `Your quote ${pendingQuote.reference} is ready — $799.00 due.`,
      href: '/app/billing',
      createdAt: daysFromNow(-4),
    },
    {
      id: 'demo-feed-mail',
      userId,
      category: FeedNotificationCategory.MAILROOM,
      message: 'New mail from Internal Revenue Service needs your response.',
      href: `/app/mailroom/${mailRoom.id}/demo-mail-irs`,
      createdAt: daysFromNow(-6),
    },
    {
      id: 'demo-feed-order',
      userId,
      category: FeedNotificationCategory.ORDER,
      message: `Order ${formationOrder.reference} is now under review.`,
      href: `/app/orders/${formationOrder.id}`,
      createdAt: daysFromNow(-11),
      readAt: daysFromNow(-10),
    },
  ]);

  console.info(`Demo seed complete — portal data attached to ${DEMO_EMAIL}.`);
}

/*
 * Upsert helpers. Prisma's delegates are individually typed, so a generic over
 * the model name keeps these seeds idempotent without repeating an upsert block
 * per model. Seed-only convenience — nothing in `src/` casts Prisma like this.
 */
type Delegate = {
  upsert: (args: {
    where: Record<string, unknown>;
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<unknown>;
};

function delegate(model: string): Delegate {
  const found = (prisma as unknown as Record<string, Delegate | undefined>)[model];
  if (!found) throw new Error(`Unknown Prisma model in seed: ${model}`);
  return found;
}

// Upsert rows keyed by their `id`.
async function upsertMany(
  model: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  await upsertManyBy(model, (row) => ({ id: row.id }), rows);
}

// Upsert rows keyed by a composite unique the caller builds.
async function upsertManyBy(
  model: string,
  where: (row: Record<string, unknown>) => Record<string, unknown>,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const row of rows) {
    await delegate(model).upsert({ where: where(row), create: row, update: row });
  }
}

async function main() {
  /*
   * Locations first. A service's coverage points at `Region.code`, and the
   * address cascade in the field registry is generated from the same address
   * book, so nothing below can be written until the jurisdictions exist.
   *
   * They are seeded on the NORMAL path, not behind SEED_DEMO: where we operate
   * is a fact about the business, not a development fixture. Retiring one is
   * still an admin action at `/admin/settings` — this only guarantees a fresh
   * database starts with the list we actually hold desks in.
   */
  await seedLocations(prisma);

  // The registry next: a service's form references these keys, and the catalog
  // write path rejects a reference to a field that isn't registered.
  for (const [index, field] of FIELDS.entries()) {
    const row = {
      key: field.key,
      label: field.label,
      type: field.type,
      placeholder: field.placeholder ?? null,
      hint: field.hint ?? null,
      category: field.category ?? null,
      config: (field.config ?? {}) as object,
      // Retired questions stay registered and leave the picker. Set explicitly
      // so re-seeding also REVIVES a field that came back into use.
      archived: field.archived ?? false,
      sortOrder: index,
    };

    await prisma.fieldDefinition.upsert({
      where: { key: field.key },
      create: row,
      update: row,
    });
  }

  console.info(`Field registry seeded — ${FIELDS.length} fields.`);

  // The result registry, for the same reason: a service's delivery schema
  // references these keys, and the catalog write path rejects an unregistered one.
  for (const [index, field] of RESULT_FIELDS.entries()) {
    const row = {
      key: field.key,
      label: field.label,
      type: field.type,
      hint: field.hint ?? null,
      category: field.category ?? null,
      config: (field.config ?? {}) as object,
      isPrimary: field.isPrimary ?? false,
      showInList: field.showInList ?? false,
      archived: field.archived ?? false,
      sortOrder: index,
    };

    await prisma.resultFieldDefinition.upsert({
      where: { key: field.key },
      create: row,
      update: row,
    });
  }

  console.info(`Result registry seeded — ${RESULT_FIELDS.length} fields.`);

  for (const service of SERVICES) {
    const {
      id,
      footer,
      formSteps,
      coverage,
      resultFields,
      requestTypes,
      resultPageTitle,
      resultNoun,
      resultInternal,
      ...rest
    } = service;

    const row = {
      ...rest,
      footer: footer as object,
      /*
       * The form lives in `formSteps`, and the flat list is empty.
       *
       * Both columns are read and de-duplicated by key (services.service.ts), so
       * carrying the same questions in both would work — but it would also mean
       * two places to keep in step, and the one that lost an edit would keep
       * rendering. The stepped shape is the one the customer meets, so it is the
       * only one written.
       */
      detailFields: [] as object,
      formSteps: formSteps as object,
      resultFields: (resultFields ?? []) as object,
      resultPageTitle: resultPageTitle ?? null,
      resultNoun: resultNoun ?? null,
      resultInternal: resultInternal ?? false,
      active: true,
    };

    await prisma.service.upsert({
      where: { id },
      create: { id, ...row },
      update: row,
    });

    /*
     * Where the service is offered. `enabled: false` is how the admin closes a
     * jurisdiction, so the upsert re-enables only the rows this seed names and
     * leaves any extra one the team added alone.
     */
    for (const [index, region] of coverage.entries()) {
      await prisma.serviceRegionOffering.upsert({
        where: { serviceId_regionCode: { serviceId: id, regionCode: region.code } },
        create: {
          serviceId: id,
          regionCode: region.code,
          enabled: true,
          processingTime: region.processingTime,
          sortOrder: index,
        },
        update: {
          enabled: true,
          processingTime: region.processingTime,
          sortOrder: index,
        },
      });
    }

    /*
     * The follow-up actions, keyed on (serviceId, key) so re-seeding revives a
     * row in place rather than colliding on the unique constraint — requests
     * already raised under a type point at it, so it must never be recreated.
     */
    for (const [index, type] of (requestTypes ?? []).entries()) {
      const typeRow = {
        label: type.label,
        description: type.description ?? null,
        turnaround: type.turnaround ?? null,
        fields: (type.fields ?? []) as object,
        active: true,
        sortOrder: index,
        deletedAt: null,
      };

      await prisma.serviceRequestType.upsert({
        where: { serviceId_key: { serviceId: id, key: type.key } },
        create: { serviceId: id, key: type.key, ...typeRow },
        update: typeRow,
      });
    }
  }

  /*
   * Anything else in the catalog is a service we no longer sell — deactivated,
   * never deleted.
   *
   * Deactivating hides it from the order flow and leaves every order, quote, and
   * delivered record that references it intact and readable (schema.prisma,
   * `Service.active`). Hard-deleting would take the customer's history with it,
   * which is exactly the thing AGENTS.md says to ask before doing.
   */
  const retired = await prisma.service.updateMany({
    where: { id: { notIn: SERVICES.map((service) => service.id) }, active: true },
    data: { active: false },
  });

  console.info(
    `Catalog seeded — ${SERVICES.length} services` +
      (retired.count > 0 ? `, ${retired.count} older service(s) deactivated.` : '.'),
  );

  /*
   * Carriers and per-service PRICING are deliberately still not seeded here.
   *
   * Who the mail room ships with is an operational choice made at
   * `/admin/settings`, and what a service costs is set per region at
   * `/admin/catalog/:serviceId` — the catalog is quote-based, so a seeded price
   * would be a number nobody agreed to, printed beside a real service.
   *
   * The demo fixtures below still need rows to point at (a forwarded parcel
   * ships with a carrier), so they seed their own beside the rest of the
   * development data.
   */
  if (process.env.SEED_DEMO === 'true') {
    await seedDemoReferenceData(prisma);
    await seedDemoCatalogPricing(prisma);
    await seedDemoCustomer();
    await seedAdminDemo(prisma);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
