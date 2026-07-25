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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — cannot seed.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/*
 * The orderable service catalog (AGENTS.md: the backend owns the catalog).
 * These are the four services the "Order new service" flow offers. Each carries
 * its Step 1 card copy and its Step 2 `detailFields` — the per-service form the
 * portal renders by field type. The flow is quote-based, so no service carries a
 * price; the team prices each order after review.
 *
 * `iconKey` names an intent the frontend maps to a lucide glyph; `footer` is the
 * card's uppercase meta line (`{ label, chips? }`). Copy is kept aligned with the
 * marketing Services page but trimmed to the portal card's shorter form.
 *
 * Idempotent: seeding upserts by a stable slug id, so re-running updates the
 * catalog in place rather than duplicating it.
 */

type SeedService = {
  id: string;
  iconKey: string;
  name: string;
  shortName: string;
  description: string;
  features: string[];
  footer: { label: string; chips?: string[] };
  detailFields: unknown[];
  sortOrder: number;
};

const SERVICES: SeedService[] = [
  {
    id: 'company-formation',
    iconKey: 'company-formation',
    name: 'Company Formation',
    shortName: 'Company Formation',
    description:
      'Register your LLC, INC, or LTD in any supported jurisdiction, with registered agent service included.',
    features: [
      'Full entity registration & filing',
      '1 year of Registered Agent service',
      'EIN / Tax ID application support',
    ],
    footer: { label: 'Coverage — US, UK, EU, UAE' },
    detailFields: [
      {
        type: 'text',
        name: 'companyName',
        label: 'Proposed company name',
        placeholder: 'e.g. Marty Ventures LLC',
        required: true,
      },
      {
        type: 'select',
        name: 'jurisdiction',
        label: 'Jurisdiction',
        required: true,
        options: [
          { value: 'us-de', label: 'United States — Delaware' },
          { value: 'us-wy', label: 'United States — Wyoming' },
          { value: 'uk', label: 'United Kingdom' },
          { value: 'ca', label: 'Canada' },
          { value: 'eu', label: 'European Union' },
          { value: 'uae', label: 'United Arab Emirates' },
        ],
      },
      {
        type: 'select',
        name: 'entityType',
        label: 'Entity type',
        required: true,
        options: [
          { value: 'llc', label: 'LLC' },
          { value: 'inc', label: 'INC / Corporation' },
          { value: 'ltd', label: 'LTD' },
        ],
      },
      {
        type: 'textarea',
        name: 'businessActivity',
        label: 'Primary business activity',
        placeholder: 'Briefly describe what the company will do.',
        rows: 3,
        required: false,
      },
    ],
    sortOrder: 1,
  },
  {
    id: 'virtual-mail-room',
    iconKey: 'virtual-mail-room',
    name: 'Virtual Mail Room',
    shortName: 'Virtual Mail Room',
    description:
      'A professional business address that receives, scans, and forwards your mail from anywhere in the world.',
    features: [
      'Real street address in a business corridor',
      'High-resolution mail scanning',
      'Worldwide package forwarding',
    ],
    footer: { label: 'Coverage — US, UK, CA, EU' },
    detailFields: [
      {
        type: 'select',
        name: 'addressRegion',
        label: 'Preferred address region',
        required: true,
        options: [
          { value: 'us', label: 'United States' },
          { value: 'uk', label: 'United Kingdom' },
          { value: 'ca', label: 'Canada' },
          { value: 'eu', label: 'European Union' },
        ],
      },
      {
        type: 'select',
        name: 'forwarding',
        label: 'Mail handling preference',
        required: true,
        options: [
          { value: 'scan', label: 'Scan & notify' },
          { value: 'forward', label: 'Forward physically' },
          { value: 'both', label: 'Scan and forward' },
        ],
      },
    ],
    sortOrder: 2,
  },
  {
    id: 'bank-account',
    iconKey: 'bank-account',
    name: 'Bank Account Opening Assistance',
    shortName: 'Bank Account Opening',
    description:
      'Guided applications with partner banks for non-residents and newly formed entities across all regions.',
    features: [
      'US, UK, Canadian & European accounts',
      'Guided application & compliance onboarding',
      'Non-resident & international founder support',
    ],
    footer: { label: 'Coverage — US, UK, CA, EU' },
    detailFields: [
      {
        type: 'select',
        name: 'accountRegion',
        label: 'Preferred banking region',
        required: true,
        options: [
          { value: 'us', label: 'United States' },
          { value: 'uk', label: 'United Kingdom' },
          { value: 'ca', label: 'Canada' },
          { value: 'eu', label: 'European Union' },
        ],
      },
      {
        type: 'text',
        name: 'entityName',
        label: 'Entity the account is for',
        placeholder: 'Your registered company name',
        required: true,
        hint: 'Leave blank if you are forming the company with us.',
      },
    ],
    sortOrder: 3,
  },
  {
    id: 'e-commerce',
    iconKey: 'e-commerce',
    name: 'E-Commerce Account Setup',
    shortName: 'E-Commerce Setup',
    description:
      'Get verified and set up seller accounts on major marketplaces that require a registered local entity.',
    features: [
      'Seller account setup & verification',
      'Identity & address verification support',
      'Localized compliance guidance',
    ],
    footer: {
      label: 'Marketplaces',
      chips: ['Amazon', 'eBay', 'Walmart', 'Alibaba'],
    },
    detailFields: [
      {
        type: 'select',
        name: 'marketplace',
        label: 'Target marketplace',
        required: true,
        options: [
          { value: 'amazon', label: 'Amazon' },
          { value: 'ebay', label: 'eBay' },
          { value: 'walmart', label: 'Walmart' },
          { value: 'alibaba', label: 'Alibaba' },
        ],
      },
      {
        type: 'text',
        name: 'storeName',
        label: 'Store / brand name',
        placeholder: 'e.g. North Peak Goods',
        required: true,
      },
      {
        type: 'textarea',
        name: 'productCategories',
        label: 'Product categories',
        placeholder: 'What do you plan to sell?',
        rows: 3,
        required: false,
      },
    ],
    sortOrder: 4,
  },
];

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
    update: { status: OrderStatus.UNDER_REVIEW, submittedAt: daysFromNow(-12) },
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
      status: MailItemStatus.SCANNED,
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

  // A settled card payment for the paid quote. Brand + last four only — the card
  // itself lives at Stripe (AGENTS.md, PCI). The `pi_…` reference is a test-mode
  // placeholder, not a real intent.
  await upsertMany('payment', [
    {
      id: 'demo-payment-ecommerce',
      customerId: userId,
      quoteId: paidQuote.id,
      provider: PaymentProvider.STRIPE,
      status: PaymentStatus.SUCCEEDED,
      amount: 34_900,
      currency: 'USD',
      cardBrand: 'visa',
      cardLast4: '4242',
      providerRef: 'pi_demo_ecommerce_seed',
      paidAt: daysFromNow(-60),
    },
  ]);

  await prisma.paymentMethod.upsert({
    where: { stripePaymentMethodId: 'pm_demo_visa_4242' },
    create: {
      customerId: userId,
      stripePaymentMethodId: 'pm_demo_visa_4242',
      brand: 'visa',
      last4: '4242',
      expMonth: 4,
      expYear: 2029,
      isDefault: true,
    },
    update: { isDefault: true },
  });

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
  for (const service of SERVICES) {
    const { id, footer, detailFields, ...rest } = service;
    await prisma.service.upsert({
      where: { id },
      create: {
        id,
        ...rest,
        footer: footer as object,
        detailFields: detailFields as object,
        active: true,
      },
      update: {
        ...rest,
        footer: footer as object,
        detailFields: detailFields as object,
        active: true,
      },
    });
  }

  console.info(`Seed complete — upserted ${SERVICES.length} services.`);

  // The catalog is real reference data and always seeds. The demo customer is
  // development-only fixture data, so it is opt-in.
  if (process.env.SEED_DEMO === 'true') {
    await seedDemoCustomer();
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
