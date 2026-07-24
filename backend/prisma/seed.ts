import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

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
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
