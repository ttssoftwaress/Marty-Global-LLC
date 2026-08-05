import type { PrismaClient } from '@prisma/client';

/*
 * The scaffold seed — the configuration a fresh database needs before the app is
 * testable at all, and nothing else.
 *
 * The problem it solves: `db:seed` puts in the field registries and the service
 * catalog, but a service with no region offered and no price point is not
 * orderable, the mail room has no carrier to forward with, and `/admin/settings`
 * opens on an empty list. So every fresh database used to start with a manual
 * pass through `/admin/settings` and `/admin/catalog/:serviceId` before anything
 * could be exercised. That pass is what this file replaces.
 *
 * The line it does NOT cross: this seeds CONFIGURATION only — locations,
 * carriers, per-service coverage, price points. No customers, no orders, no
 * quotes, no payments, no mail, no conversations. Those are fixtures and they
 * live in `seed-admin-demo.ts` / the demo customer block behind `SEED_DEMO=true`,
 * because data that looks like real trading has no business appearing in a
 * database that was only meant to be usable.
 *
 * This is the same split `reset.ts` already draws: everything written here is in
 * that script's "configuration" group, so `db:reset` keeps it and only `--all`
 * clears it. Re-running this after `--all` is the way back.
 *
 * A deliberate overlap with `seed-reference.ts`: that file seeds the same KINDS
 * of row as a demo fixture (its comment explains why they were pulled off the
 * normal path — coverage and pricing are operational decisions, not a list in a
 * script). Nothing changes about that. The difference is intent: this is an
 * explicitly-invoked "set my dev database up so I can test", not something the
 * normal seed does behind your back. Both upsert on the same stable ids, so
 * running both is safe and idempotent rather than duplicating anything.
 *
 * Idempotent throughout: every row upserts on a stable code or id, so re-running
 * refreshes in place. Nothing here is ever destructive.
 *
 * MONEY: integer minor units + ISO 4217 (AGENTS.md, Money). 59900 = $599.00 —
 * never a float, at any step.
 */

// --- Locations -----------------------------------------------------------
/*
 * The jurisdictions services are offered in. `code` is ISO 3166-1 alpha-2 where
 * the region is a country and a stable slug where it is not ("EU"); `flag` is an
 * emoji, which is text rather than an exported glyph asset (Design.md, Icons).
 *
 * The order is the one every dropdown prints.
 */
type ScaffoldRegion = {
  code: string;
  label: string;
  flag: string;
  sortOrder: number;
};

const REGIONS: ScaffoldRegion[] = [
  { code: 'US', label: 'United States', flag: '🇺🇸', sortOrder: 1 },
  { code: 'GB', label: 'United Kingdom', flag: '🇬🇧', sortOrder: 2 },
  { code: 'CA', label: 'Canada', flag: '🇨🇦', sortOrder: 3 },
  { code: 'EU', label: 'European Union', flag: '🇪🇺', sortOrder: 4 },
  { code: 'AE', label: 'United Arab Emirates', flag: '🇦🇪', sortOrder: 5 },
  { code: 'SG', label: 'Singapore', flag: '🇸🇬', sortOrder: 6 },
  { code: 'AU', label: 'Australia', flag: '🇦🇺', sortOrder: 7 },
];

// --- Mail carriers -------------------------------------------------------
// What a forwarded parcel can ship with. The operator picks one when they
// process a forwarding request, so an empty table makes that form unusable.
type ScaffoldCarrier = { code: string; label: string; sortOrder: number };

const CARRIERS: ScaffoldCarrier[] = [
  { code: 'dhl', label: 'DHL Express', sortOrder: 1 },
  { code: 'fedex', label: 'FedEx', sortOrder: 2 },
  { code: 'ups', label: 'UPS', sortOrder: 3 },
  { code: 'usps', label: 'USPS Priority', sortOrder: 4 },
  { code: 'royal-mail', label: 'Royal Mail', sortOrder: 5 },
];

// --- Coverage ------------------------------------------------------------
/*
 * Which locations each catalog service is offered in, and the processing
 * estimate printed beside it. Keyed by the service ids `seed.ts` upserts, and
 * skipped for any that isn't in the database — so this file never resurrects a
 * service an admin deactivated or removed.
 *
 * `processingTime` is free text and is only ever displayed, never parsed.
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
  /*
   * These two read off the real address book rather than the shorthand list
   * above: `seed-catalog.ts` offers banking and e-commerce in named countries
   * (BANKING_TIMES / ECOMMERCE_TIMES), so scaffolding an "EU" offering beside
   * them would put a jurisdiction on the order form that the catalog itself
   * does not know about.
   */
  'bank-account': [
    { code: 'US', processingTime: '10–20 business days' },
    { code: 'CA', processingTime: '10–20 business days' },
    { code: 'GB', processingTime: '7–14 business days' },
    { code: 'IE', processingTime: '10–20 business days' },
    { code: 'NL', processingTime: '14–21 business days' },
    { code: 'SG', processingTime: '10–15 business days' },
  ],
  'e-commerce': [
    { code: 'US', processingTime: '5–10 business days' },
    { code: 'CA', processingTime: '5–10 business days' },
    { code: 'GB', processingTime: '5–10 business days' },
    { code: 'IE', processingTime: '7–14 business days' },
    { code: 'NL', processingTime: '7–14 business days' },
    { code: 'ES', processingTime: '7–14 business days' },
    { code: 'IT', processingTime: '7–14 business days' },
    { code: 'SG', processingTime: '7–14 business days' },
  ],
};

// --- Price points --------------------------------------------------------
/*
 * The team's reference prices. The catalog is quote-based (AGENTS.md: the
 * binding figure is the itemised quote issued after review, and marketing never
 * names a number), so a tier is what staff quote FROM — it is never charged
 * automatically and never reaches the marketing site.
 *
 * `regionCode: null` means the tier applies everywhere the service is offered;
 * a code scopes it to one jurisdiction, which is how the same tier carries a
 * different price where government fees differ.
 *
 * Stable ids shared with `seed-reference.ts` on purpose — the two upsert the
 * same rows rather than creating a second set of near-duplicate price points.
 */
type ScaffoldTier = {
  id: string;
  name: string;
  price: number;
  regionCode: string | null;
  turnaround: string;
  description: string;
};

const SERVICE_TIERS: Record<string, ScaffoldTier[]> = {
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

export async function seedScaffoldLocations(prisma: PrismaClient): Promise<void> {
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
    `Scaffold — ${REGIONS.length} locations, ${CARRIERS.length} mail carriers. Manage these at /admin/settings.`,
  );
}

export async function seedScaffoldCatalogConfig(prisma: PrismaClient): Promise<void> {
  let offerings = 0;
  let tiers = 0;
  const missing: string[] = [];

  for (const [serviceId, regions] of Object.entries(SERVICE_REGIONS)) {
    /*
     * Only configure a service that actually exists. `seed.ts` must have run
     * first, and a service the admin has since removed must stay removed —
     * upserting coverage would recreate neither the service nor a usable state,
     * just an orphan the catalog screen would have to explain.
     */
    const service = await prisma.service.findFirst({
      where: { id: serviceId, deletedAt: null },
    });

    if (!service) {
      missing.push(serviceId);
      continue;
    }

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
        update: {
          enabled: true,
          processingTime: region.processingTime,
          sortOrder: index,
        },
      });
      offerings += 1;
    }

    for (const [index, tier] of (SERVICE_TIERS[serviceId] ?? []).entries()) {
      await prisma.servicePricingTier.upsert({
        where: { id: tier.id },
        create: {
          ...tier,
          serviceId,
          currency: 'USD',
          sortOrder: index,
          deletedAt: null,
        },
        update: {
          ...tier,
          serviceId,
          currency: 'USD',
          sortOrder: index,
          // Revive a tier that was soft-deleted, rather than leaving a row the
          // catalog screen hides and this script keeps claiming it wrote.
          deletedAt: null,
        },
      });
      tiers += 1;
    }
  }

  console.info(
    `Scaffold — ${offerings} region offerings, ${tiers} price points. Manage these at /admin/catalog/:serviceId.`,
  );

  if (missing.length > 0) {
    console.info(
      `Scaffold — skipped coverage for ${missing.join(', ')}: no such service. Run "npm run db:seed" first.`,
    );
  }
}
