import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import {
  seedScaffoldCatalogConfig,
  seedScaffoldLocations,
} from './seed-scaffold.js';

/*
 * `npm run db:scaffold` — set a database up so the app is testable, without
 * putting a single row of pretend trading data in it.
 *
 * What it writes: locations, mail carriers, per-service coverage, and price
 * points — the configuration that otherwise has to be typed in by hand at
 * `/admin/settings` and `/admin/catalog/:serviceId` before a service can be
 * ordered or a parcel forwarded.
 *
 * What it does NOT write: customers, orders, quotes, payments, mail,
 * conversations, notifications. That is `SEED_DEMO=true npm run db:seed`, and
 * keeping the two apart is the point — a database you can exercise is a
 * different thing from a database that looks like it has been trading for four
 * months, and conflating them is how fixture money ends up somewhere it reads as
 * real.
 *
 * The registries and the service catalog come from `db:seed`, which this does
 * not duplicate: coverage references a service, so seed first, scaffold second.
 * Running scaffold alone against an empty catalog is not an error — it says
 * which services it skipped and why.
 *
 * Safe by construction: every write is an upsert on a stable code or id, and
 * there is no delete anywhere in this path. Re-run it as often as you like. It
 * needs no production guard for the same reason — the worst it can do to a live
 * database is restore configuration to the values in this file, which is why the
 * one destructive script (`reset.ts`) carries the guard instead.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set — cannot scaffold.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  await seedScaffoldLocations(prisma);
  await seedScaffoldCatalogConfig(prisma);

  /*
   * The catalog is the one piece of scaffolding this script cannot supply
   * itself — `seed.ts` owns the registries and the services, and duplicating
   * either here would give the two files different ideas of what a field is.
   * So point at it rather than half-doing it.
   */
  const services = await prisma.service.count({ where: { deletedAt: null } });
  if (services === 0) {
    console.info(
      'Scaffold — the service catalog is empty. Run "npm run db:seed" to load the field registries and services, then re-run this.',
    );
    return;
  }

  console.info('Scaffold complete — the app is configured and ready to test.');
}

main()
  .catch((err) => {
    console.error('Scaffold failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
