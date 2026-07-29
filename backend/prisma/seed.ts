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
 * The field registry — the vocabulary every service form is built from
 * (AGENTS.md: the backend owns the catalog).
 *
 * An admin registers a question once here, then builds a service's form by
 * PICKING from this list. That is what keeps `OrderItem.answers` keyed by a
 * closed set: every answer key in the database is a `FieldDefinition.key`, not
 * whatever an admin happened to type on a particular service.
 *
 * It is also what makes the customer's merged master form exact. Two services
 * picking `company_name` are asking the same question by construction, so the
 * order flow asks it once and records the answer against both — no spelling
 * convention to remember, no near-duplicate keys to reconcile later.
 *
 * `config` holds the per-type extras: a select's `options`, a file field's
 * `accept` / `maxSizeMb` / `multiple`, a textarea's `rows`.
 */
type SeedField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea' | 'file';
  placeholder?: string;
  hint?: string;
  category?: string;
  config?: Record<string, unknown>;
};

const FIELDS: SeedField[] = [
  {
    key: 'company_name',
    label: 'Company name',
    type: 'text',
    placeholder: 'e.g. Marty Ventures LLC',
    category: 'Company details',
  },
  {
    key: 'jurisdiction',
    label: 'Jurisdiction',
    type: 'select',
    category: 'Company details',
    config: {
      options: [
        { value: 'us-de', label: 'United States — Delaware' },
        { value: 'us-wy', label: 'United States — Wyoming' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'eu', label: 'European Union' },
        { value: 'uae', label: 'United Arab Emirates' },
      ],
    },
  },
  {
    key: 'entity_type',
    label: 'Entity type',
    type: 'select',
    category: 'Company details',
    config: {
      options: [
        { value: 'llc', label: 'LLC' },
        { value: 'inc', label: 'INC / Corporation' },
        { value: 'ltd', label: 'LTD' },
      ],
    },
  },
  {
    key: 'business_activity',
    label: 'Primary business activity',
    type: 'textarea',
    placeholder: 'Briefly describe what the company will do.',
    category: 'Company details',
    config: { rows: 3 },
  },
  {
    key: 'identity_document',
    label: 'Photo ID for each owner',
    type: 'file',
    hint: 'Passport or national ID for every person owning 25% or more.',
    category: 'Identity documents',
    config: {
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      maxSizeMb: 10,
      multiple: true,
    },
  },
  {
    key: 'proof_of_address',
    label: 'Proof of address',
    type: 'file',
    hint: 'A utility bill or bank statement from the last three months.',
    category: 'Identity documents',
    config: {
      accept: ['application/pdf', 'image/jpeg', 'image/png'],
      maxSizeMb: 10,
    },
  },
  {
    key: 'address_region',
    label: 'Preferred address region',
    type: 'select',
    category: 'Mail & address',
    config: {
      options: [
        { value: 'us', label: 'United States' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'eu', label: 'European Union' },
      ],
    },
  },
  {
    key: 'mail_handling',
    label: 'Mail handling preference',
    type: 'select',
    category: 'Mail & address',
    config: {
      options: [
        { value: 'scan', label: 'Scan & notify' },
        { value: 'forward', label: 'Forward physically' },
        { value: 'both', label: 'Scan and forward' },
      ],
    },
  },
  {
    key: 'banking_region',
    label: 'Preferred banking region',
    type: 'select',
    category: 'Banking',
    config: {
      options: [
        { value: 'us', label: 'United States' },
        { value: 'uk', label: 'United Kingdom' },
        { value: 'ca', label: 'Canada' },
        { value: 'eu', label: 'European Union' },
      ],
    },
  },
  {
    key: 'marketplace',
    label: 'Target marketplace',
    type: 'select',
    category: 'E-commerce',
    config: {
      options: [
        { value: 'amazon', label: 'Amazon' },
        { value: 'ebay', label: 'eBay' },
        { value: 'walmart', label: 'Walmart' },
        { value: 'alibaba', label: 'Alibaba' },
      ],
    },
  },
  {
    key: 'store_name',
    label: 'Store / brand name',
    type: 'text',
    placeholder: 'e.g. North Peak Goods',
    category: 'E-commerce',
  },
  {
    key: 'product_categories',
    label: 'Product categories',
    type: 'textarea',
    placeholder: 'What do you plan to sell?',
    category: 'E-commerce',
    config: { rows: 3 },
  },
];

/*
 * The RESULT registry — the vocabulary of facts a completed service delivers
 * back to the customer.
 *
 * The mirror of `FIELDS` above, pointed the other way: that list is what we ASK,
 * this is what we RETURN. Same two rules, for the same reasons — a key is
 * immutable because delivered values are stored under it, and a fact registered
 * once is reused across every service that returns it.
 *
 * `isPrimary` and `showInList` here are DEFAULTS a picking service inherits. The
 * service's own reference overrides them, because the same "Company name" titles
 * a formation record and is an ordinary column elsewhere.
 */
type SeedResultField = {
  key: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'select'
    | 'file'
    | 'date'
    | 'number'
    | 'url'
    | 'status';
  hint?: string;
  category?: string;
  config?: Record<string, unknown>;
  isPrimary?: boolean;
  showInList?: boolean;
};

const RESULT_FIELDS: SeedResultField[] = [
  {
    key: 'registered_name',
    label: 'Registered name',
    type: 'text',
    hint: 'Exactly as filed with the registry.',
    category: 'Registration',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'registration_number',
    label: 'Registration number',
    type: 'text',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'entity_status',
    label: 'Status',
    type: 'status',
    category: 'Registration',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'active', label: 'Active', tone: 'success' },
        { value: 'pending', label: 'Pending', tone: 'warning' },
        { value: 'dissolved', label: 'Dissolved', tone: 'error' },
      ],
    },
  },
  {
    key: 'formation_date',
    label: 'Formation date',
    type: 'date',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'registered_jurisdiction',
    label: 'Jurisdiction',
    type: 'text',
    category: 'Registration',
    showInList: true,
  },
  {
    key: 'ein',
    label: 'EIN / Tax ID',
    type: 'text',
    hint: 'Issued by the tax authority.',
    category: 'Tax',
  },
  {
    key: 'annual_report_due',
    label: 'Next annual report due',
    type: 'date',
    category: 'Compliance',
  },
  {
    key: 'registered_agent',
    label: 'Registered agent',
    type: 'text',
    category: 'Compliance',
  },
  {
    key: 'registry_listing_url',
    label: 'Public registry listing',
    type: 'url',
    hint: 'The jurisdiction’s own record of your entity.',
    category: 'Compliance',
  },
  {
    key: 'formation_certificate',
    label: 'Certificate of formation',
    type: 'file',
    category: 'Documents',
    config: { accept: ['application/pdf'], maxSizeMb: 20 },
  },
  {
    key: 'operating_agreement',
    label: 'Operating agreement',
    type: 'file',
    category: 'Documents',
    config: { accept: ['application/pdf'], maxSizeMb: 20 },
  },
  // --- Bank account -------------------------------------------------------
  {
    key: 'bank_name',
    label: 'Bank',
    type: 'text',
    category: 'Account',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'account_number_masked',
    label: 'Account number',
    type: 'text',
    // The full number is never stored here — an account is identified by its
    // last four, exactly as a card is (AGENTS.md, Security & PII).
    hint: 'Last four digits only.',
    category: 'Account',
    showInList: true,
  },
  {
    key: 'account_status',
    label: 'Status',
    type: 'status',
    category: 'Account',
    showInList: true,
    config: {
      statusOptions: [
        { value: 'open', label: 'Open', tone: 'success' },
        { value: 'pending', label: 'Pending activation', tone: 'warning' },
        { value: 'closed', label: 'Closed', tone: 'neutral' },
      ],
    },
  },
  {
    key: 'account_opened_on',
    label: 'Opened on',
    type: 'date',
    category: 'Account',
    showInList: true,
  },
  {
    key: 'online_banking_url',
    label: 'Online banking',
    type: 'url',
    category: 'Account',
  },
  // --- E-commerce ---------------------------------------------------------
  {
    key: 'store_name',
    label: 'Store name',
    type: 'text',
    category: 'Store',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'store_url',
    label: 'Store address',
    type: 'url',
    category: 'Store',
    showInList: true,
  },
  {
    key: 'store_platform',
    label: 'Platform',
    type: 'select',
    category: 'Store',
    showInList: true,
    config: {
      options: [
        { value: 'shopify', label: 'Shopify' },
        { value: 'woocommerce', label: 'WooCommerce' },
        { value: 'amazon', label: 'Amazon' },
      ],
    },
  },
  {
    key: 'store_launched_on',
    label: 'Launched on',
    type: 'date',
    category: 'Store',
    showInList: true,
  },
  {
    key: 'delivery_notes',
    label: 'Notes from your specialist',
    type: 'textarea',
    category: 'Store',
    config: { rows: 4 },
  },

  /*
   * Virtual mail room — the address a customer's room is opened at.
   *
   * These are the questions staff answer when they deliver the service, and
   * answering them is what OPENS the room (mailroom.provisioning.ts reads them
   * back by these keys). They are registry fields like any other, so an admin
   * can reword a label or add a question from `/admin/catalog` without a deploy
   * — but the KEYS are a contract, and renaming one detaches it from
   * provisioning.
   *
   * The service that uses them is flagged `resultInternal`, so none of this
   * becomes a customer-facing record page: what the customer gets is the mail
   * room at `/app/mailroom`.
   */
  {
    key: 'mail_room_name',
    label: 'Room name',
    type: 'text',
    hint: 'What the customer sees on the room card — e.g. "Main Office".',
    category: 'Mail room',
    isPrimary: true,
    showInList: true,
  },
  {
    key: 'mail_room_address_line1',
    label: 'Address line 1',
    type: 'text',
    hint: 'Street address of the mail room. Required to open the room.',
    category: 'Mail room',
    showInList: true,
  },
  {
    key: 'mail_room_address_line2',
    label: 'Address line 2',
    type: 'text',
    hint: 'Suite or unit number, if any.',
    category: 'Mail room',
  },
  { key: 'mail_room_city', label: 'City', type: 'text', category: 'Mail room' },
  {
    key: 'mail_room_address_region',
    label: 'State / region',
    type: 'text',
    category: 'Mail room',
  },
  {
    key: 'mail_room_postal_code',
    label: 'Postal code',
    type: 'text',
    category: 'Mail room',
  },
  {
    key: 'mail_room_address_country',
    label: 'Country',
    type: 'text',
    hint: 'ISO 3166-1 alpha-2 code — US, GB, CA.',
    category: 'Mail room',
  },
];

/*
 * The orderable service catalog. These are the four services the "Order new
 * service" flow offers. Each carries its Step 1 card copy and its request form
 * as REFERENCES into the registry above — `{ fieldKey, required? }`, never an
 * inline field definition.
 *
 * A service therefore records only which registered questions it asks and
 * whether each is mandatory *here*: `identity_document` is optional on Company
 * Formation and required for a bank account, which is the one per-service
 * override that genuinely varies.
 *
 * Note `company_name` and `identity_document` appearing on two services each.
 * That is the point of the registry: a customer ordering both is asked for each
 * exactly once, and the answer is recorded against both order items.
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
  detailFields: { fieldKey: string; required?: boolean }[];
  sortOrder: number;
  /*
   * The delivery half — what this service RETURNS once it is complete, as
   * references into the result registry below, plus the wording the customer's
   * page for it uses.
   *
   * A service with no `resultFields` delivers no structured record and therefore
   * gets no customer page. That is the case for the virtual mail room, which
   * keeps its own bespoke screens.
   */
  resultFields?: {
    fieldKey: string;
    required?: boolean;
    isPrimary?: boolean;
    showInList?: boolean;
  }[];
  resultPageTitle?: string;
  resultNoun?: string;
  /*
   * The result form is completed by the TEAM and produces no customer-facing
   * record. Set on the virtual mail room: staff enter the address the room opens
   * at, and what the customer receives is the room itself at `/app/mailroom`.
   */
  resultInternal?: boolean;
  // The follow-up actions offered on a delivered record — the buttons the
  // customer presses, each raising a ticket in the admin requests queue.
  requestTypes?: {
    key: string;
    label: string;
    description?: string;
    turnaround?: string;
    fields?: { fieldKey: string; required?: boolean }[];
  }[];
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
      { fieldKey: 'company_name', required: true },
      { fieldKey: 'jurisdiction', required: true },
      { fieldKey: 'entity_type', required: true },
      { fieldKey: 'business_activity' },
      { fieldKey: 'identity_document' },
    ],
    sortOrder: 1,
    /*
     * The worked example: a formation delivers a company record, and the
     * customer gets "My companies" — a table of every entity we have formed for
     * them, each row opening the full filing detail.
     *
     * The four required facts are what makes the record worth showing at all, so
     * the delivery gate holds until staff have them.
     */
    resultPageTitle: 'My companies',
    resultNoun: 'company',
    resultFields: [
      { fieldKey: 'registered_name', required: true, isPrimary: true },
      { fieldKey: 'registration_number', required: true },
      { fieldKey: 'entity_status', required: true },
      { fieldKey: 'formation_date', required: true },
      { fieldKey: 'registered_jurisdiction', showInList: true },
      { fieldKey: 'ein' },
      { fieldKey: 'registered_agent' },
      { fieldKey: 'annual_report_due' },
      { fieldKey: 'registry_listing_url' },
      { fieldKey: 'formation_certificate' },
      { fieldKey: 'operating_agreement' },
    ],
    requestTypes: [
      {
        key: 'certified-copy',
        label: 'Request a certified copy',
        description: 'A stamped copy of your formation documents.',
        turnaround: 'Typically 3–5 business days',
      },
      {
        key: 'amendment',
        label: 'File an amendment',
        description: 'Change your company name, address, or members.',
        turnaround: 'Typically 5–10 business days',
        // Reuses the request registry — the same question the order form asks.
        fields: [{ fieldKey: 'business_activity', required: true }],
      },
      {
        key: 'annual-report',
        label: 'File my annual report',
        description: 'We prepare and file it with the registry on your behalf.',
        turnaround: 'Filed within 5 business days',
      },
    ],
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
      { fieldKey: 'address_region', required: true },
      { fieldKey: 'mail_handling', required: true },
    ],
    sortOrder: 2,
    /*
     * The result form here is INTERNAL — see `resultInternal` below.
     *
     * The mail room has bespoke screens (`/app/mailroom`) with their own models;
     * a scanned inbox is not a table of facts, so it must not also appear as a
     * record page in the "My services" sidebar. But staff still need somewhere to
     * enter the address the room opens at, and that is what these fields are:
     * filling them in and delivering the item is what provisions the room
     * (mailroom.provisioning.ts matches them back by key).
     */
    resultFields: [
      { fieldKey: 'mail_room_name', isPrimary: true },
      { fieldKey: 'mail_room_address_line1', required: true },
      { fieldKey: 'mail_room_address_line2' },
      { fieldKey: 'mail_room_city', required: true },
      { fieldKey: 'mail_room_address_region' },
      { fieldKey: 'mail_room_postal_code', required: true },
      { fieldKey: 'mail_room_address_country', required: true },
    ],
    resultInternal: true,
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
      { fieldKey: 'banking_region', required: true },
      // Shared with Company Formation — asked once on the master form.
      { fieldKey: 'company_name', required: true },
      { fieldKey: 'identity_document', required: true },
      { fieldKey: 'proof_of_address', required: true },
    ],
    sortOrder: 3,
    resultPageTitle: 'My bank accounts',
    resultNoun: 'account',
    resultFields: [
      { fieldKey: 'bank_name', required: true, isPrimary: true },
      // Last four only — we never hold a full account number, the same rule that
      // keeps a PAN out of the payments tables (AGENTS.md, Security & PII).
      { fieldKey: 'account_number_masked', required: true },
      { fieldKey: 'account_status', required: true },
      { fieldKey: 'account_opened_on' },
      { fieldKey: 'online_banking_url' },
    ],
    requestTypes: [
      {
        key: 'bank-letter',
        label: 'Request a bank reference letter',
        description: 'A letter confirming your account, for suppliers or landlords.',
        turnaround: 'Typically 5–7 business days',
      },
      {
        key: 'update-signatory',
        label: 'Update a signatory',
        description: 'Add or remove someone authorised on the account.',
        turnaround: 'Typically 10 business days',
        fields: [{ fieldKey: 'identity_document', required: true }],
      },
    ],
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
      { fieldKey: 'marketplace', required: true },
      { fieldKey: 'store_name', required: true },
      { fieldKey: 'product_categories' },
    ],
    sortOrder: 4,
    resultPageTitle: 'My stores',
    resultNoun: 'store',
    /*
     * `store_name` here is the RESULT field of that key, not the request one.
     * The two registries are separate tables, so a fact and a question may share
     * a key without colliding — the store the customer asked for and the store
     * we actually set up are the same idea at two points in time.
     */
    resultFields: [
      { fieldKey: 'store_name', required: true, isPrimary: true },
      { fieldKey: 'store_url', required: true },
      { fieldKey: 'store_platform', required: true },
      { fieldKey: 'store_launched_on' },
      { fieldKey: 'delivery_notes' },
    ],
    requestTypes: [
      {
        key: 'reverify-store',
        label: 'Request re-verification',
        description: 'If the marketplace has suspended or flagged your account.',
        turnaround: 'We respond within 2 business days',
      },
      {
        key: 'add-marketplace',
        label: 'Add another marketplace',
        description: 'Set up a seller account on an additional platform.',
        turnaround: 'Typically 7–14 business days',
        fields: [{ fieldKey: 'marketplace', required: true }],
      },
    ],
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
  // The registry first: a service's form references these keys, and the catalog
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
      detailFields,
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
      detailFields: detailFields as object,
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

  console.info(`Seed complete — upserted ${SERVICES.length} services.`);

  /*
   * Locations, carriers, and per-service coverage/pricing are deliberately NOT
   * seeded here.
   *
   * They used to be, and that was the bug: the only way a jurisdiction existed
   * was for someone to add it to a script and re-seed, so `db:reset` wiped a
   * list nobody could put back from the app. They are operational decisions —
   * locations and carriers are managed at `/admin/settings`, a service's
   * coverage and price points at `/admin/catalog/:serviceId` — and a fresh
   * database now starts with none of them rather than with someone else's.
   *
   * The demo fixtures below still need rows to point at (an order is filed under
   * a location, a forwarded parcel shipped with a carrier), so they seed their
   * own beside the rest of the development data.
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
