import type { PrismaClient } from '@prisma/client';

/*
 * Reference data — the jurisdictions services can be offered in and the carriers
 * the mail room ships with. Both are real operational data rather than fixtures,
 * so they always seed, exactly like the service catalog.
 *
 * They live in tables rather than as frontend constants because both apps read
 * them and neither should need a deploy to add a row: Design.md forbids exporting
 * flag glyphs as assets (so the emoji travels with the row), and AGENTS.md keeps
 * the catalog server-owned.
 *
 * Idempotent: every row upserts on its stable code.
 */

type SeedRegion = { code: string; label: string; flag: string; sortOrder: number };

// `code` is ISO 3166-1 alpha-2 where the region is a country, and a stable slug
// where it is not ("EU"). The order is the one the dropdowns print.
const REGIONS: SeedRegion[] = [
  { code: 'US', label: 'United States', flag: '🇺🇸', sortOrder: 1 },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', sortOrder: 2 },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', sortOrder: 3 },
  { code: 'EU', label: 'European Union', flag: '🇪🇺', sortOrder: 4 },
  { code: 'AE', label: 'United Arab Emirates', flag: '🇦🇪', sortOrder: 5 },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬', sortOrder: 6 },
  { code: 'AU', label: 'Australia', flag: '🇦🇺', sortOrder: 7 },
];

const CARRIERS = [
  { code: 'dhl', label: 'DHL Express', sortOrder: 1 },
  { code: 'fedex', label: 'FedEx', sortOrder: 2 },
  { code: 'ups', label: 'UPS', sortOrder: 3 },
  { code: 'usps', label: 'USPS Priority', sortOrder: 4 },
  { code: 'royal-mail', label: 'Royal Mail', sortOrder: 5 },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const region of REGIONS) {
    await prisma.region.upsert({
      where: { code: region.code },
      create: { ...region, active: true },
      update: { ...region, active: true },
    });
  }

  for (const carrier of CARRIERS) {
    await prisma.mailCarrier.upsert({
      where: { code: carrier.code },
      create: { ...carrier, active: true },
      update: { ...carrier, active: true },
    });
  }

  console.info(
    `Reference data seeded — ${REGIONS.length} regions, ${CARRIERS.length} carriers.`,
  );
}

/*
 * Which regions each seeded service is offered in, and its price points. The
 * catalog itself is quote-based, so a tier is the team's reference price rather
 * than something a customer is charged automatically.
 *
 * MONEY: integer minor units + ISO 4217 (AGENTS.md). 59900 = $599.00.
 */
const SERVICE_REGIONS: Record<string, { code: string; processingTime: string }[]> = {
  'company-formation': [
    { code: 'US', processingTime: '5–7 business days' },
    { code: 'GB', processingTime: '3–5 business days' },
    { code: 'CA', processingTime: '7–10 business days' },
    { code: 'EU', processingTime: '10–15 business days' },
    { code: 'AE', processingTime: '10–14 business days' },
  ],
  'virtual-mail-room': [
    { code: 'US', processingTime: '1–2 business days' },
    { code: 'GB', processingTime: '2–3 business days' },
    { code: 'CA', processingTime: '2–3 business days' },
    { code: 'EU', processingTime: '3–5 business days' },
  ],
  'bank-account': [
    { code: 'US', processingTime: '10–20 business days' },
    { code: 'GB', processingTime: '7–14 business days' },
    { code: 'CA', processingTime: '10–20 business days' },
    { code: 'EU', processingTime: '14–21 business days' },
  ],
  'e-commerce': [
    { code: 'US', processingTime: '5–10 business days' },
    { code: 'GB', processingTime: '5–10 business days' },
    { code: 'EU', processingTime: '7–14 business days' },
  ],
};

type SeedTier = {
  id: string;
  name: string;
  price: number;
  regionCode: string | null;
  turnaround: string;
  description: string;
};

const SERVICE_TIERS: Record<string, SeedTier[]> = {
  'company-formation': [
    {
      id: 'tier-formation-standard',
      name: 'Standard',
      price: 59_900,
      regionCode: null,
      turnaround: '7–10 business days',
      description: 'Entity registration, registered agent for 1 year, EIN support.',
    },
    {
      id: 'tier-formation-expedited',
      name: 'Expedited',
      price: 89_900,
      regionCode: null,
      turnaround: '2–3 business days',
      description: 'Everything in Standard with priority state filing.',
    },
    {
      id: 'tier-formation-uk',
      name: 'Standard — UK',
      price: 44_900,
      regionCode: 'GB',
      turnaround: '3–5 business days',
      description: 'Companies House registration and registered office for 1 year.',
    },
  ],
  'virtual-mail-room': [
    {
      id: 'tier-mail-annual',
      name: 'Annual',
      price: 24_900,
      regionCode: null,
      turnaround: '1–2 business days',
      description: 'Business address, unlimited scanning, 30-day storage.',
    },
    {
      id: 'tier-mail-monthly',
      name: 'Monthly',
      price: 2_900,
      regionCode: null,
      turnaround: '1–2 business days',
      description: 'Same coverage, billed month to month.',
    },
  ],
  'bank-account': [
    {
      id: 'tier-bank-standard',
      name: 'Standard',
      price: 39_900,
      regionCode: null,
      turnaround: '10–20 business days',
      description: 'Guided application with one partner bank.',
    },
    {
      id: 'tier-bank-multi',
      name: 'Multi-bank',
      price: 69_900,
      regionCode: null,
      turnaround: '15–25 business days',
      description: 'Parallel applications with up to three partner banks.',
    },
  ],
  'e-commerce': [
    {
      id: 'tier-ecom-single',
      name: 'Single marketplace',
      price: 34_900,
      regionCode: null,
      turnaround: '5–10 business days',
      description: 'Account setup and verification on one marketplace.',
    },
    {
      id: 'tier-ecom-bundle',
      name: 'Marketplace bundle',
      price: 79_900,
      regionCode: null,
      turnaround: '10–15 business days',
      description: 'Up to three marketplaces, verification included.',
    },
  ],
};

export async function seedCatalogPricing(prisma: PrismaClient): Promise<void> {
  for (const [serviceId, regions] of Object.entries(SERVICE_REGIONS)) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) continue;

    for (const [index, region] of regions.entries()) {
      await prisma.serviceRegionOffering.upsert({
        where: { serviceId_regionCode: { serviceId, regionCode: region.code } },
        create: {
          serviceId,
          regionCode: region.code,
          enabled: true,
          processingTime: region.processingTime,
          sortOrder: index,
        },
        update: { enabled: true, processingTime: region.processingTime, sortOrder: index },
      });
    }

    for (const [index, tier] of (SERVICE_TIERS[serviceId] ?? []).entries()) {
      await prisma.servicePricingTier.upsert({
        where: { id: tier.id },
        create: { ...tier, serviceId, currency: 'USD', sortOrder: index, deletedAt: null },
        update: { ...tier, serviceId, currency: 'USD', sortOrder: index, deletedAt: null },
      });
    }
  }

  console.info('Catalog pricing seeded — region offerings and tiers.');
}
