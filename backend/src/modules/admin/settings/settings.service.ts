import type { MailCarrier, Region } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { iso } from '../admin.views.js';
import type {
  CreateCarrierInput,
  CreateLocationInput,
  ReorderCarriersInput,
  ReorderLocationsInput,
  UpdateCarrierInput,
  UpdateLocationInput,
} from './settings.validation.js';

/*
 * Business settings — the reference data every other admin section picks FROM.
 * All Prisma access for `Region` and `MailCarrier` lives here.
 *
 * These two tables used to exist only because a seed script inserted them, which
 * made the list of jurisdictions we operate in a code change. They are
 * operational decisions, not fixtures: opening a new country, retiring one, or
 * dropping a carrier we no longer ship with all belong to whoever runs the
 * business. This module is what makes that true — nothing seeds them any more,
 * and `/admin/settings` is where they come from.
 *
 * Three rules shape the file, and each is enforced here rather than left to the UI:
 *
 *   1. A code is immutable. Orders, region offerings, and mail requests store
 *      the code, not a foreign key to a surrogate id, so renaming one would
 *      detach every row already pointing at it. The update inputs carry no code.
 *
 *   2. A row in use is deactivated, never deleted. `active: false` closes a
 *      location to new orders and drops it from every picker while leaving the
 *      historical rows that reference it resolvable (AGENTS.md — ask before any
 *      hard delete). Deleting is offered only for a row nothing references at
 *      all, which is the genuine "added by mistake" case.
 *
 *      That delete no longer lives in this file. Both tables now route through
 *      `modules/admin/trash`, which soft-deletes the row and files a restorable
 *      entry, and the two "nothing references it" rules moved to the `location`
 *      and `carrier` descriptors in `trash.registry.ts` — the same sentences,
 *      one copy each. What stayed here is `locationUsage` / `carrierUsage`,
 *      because this screen prints those counts in its "Used by" column and
 *      derives its `canDelete` flag from them.
 *
 *   3. Order is a property of the list. Positions are rewritten as one complete
 *      sequence in one transaction — a partial payload is completed with the
 *      codes it omitted (`orderedCodes`) rather than renumbering a subset — so
 *      two admins reordering at once cannot interleave into a ranking neither of
 *      them chose, and no two rows end up sharing a position.
 */

/*
 * Rows not in the Trash. Spread into every read on this screen and into the two
 * "does this code exist" checks that gate an edit.
 *
 * Deliberately absent from the two create paths: `code` is the primary key on
 * both tables, so a trashed row still holds its code, and a create that filtered
 * it out would fail on the unique constraint with a message naming nothing the
 * admin can see. They look the row up unfiltered and say where it actually is.
 *
 * Also absent from `locationUsage` / `carrierUsage`: those answer "does anything
 * point at this code", which a soft delete does not change.
 */
const LIVE = { deletedAt: null } as const;

// --- Views ---------------------------------------------------------------

export type LocationUsage = {
  // How many catalog services currently offer this location.
  services: number;
  // How many price points are scoped to it.
  pricingTiers: number;
  // How many orders have been filed under it. The reason a used location is
  // retired rather than removed: these are filings, and filings are retained.
  orders: number;
};

export type LocationView = {
  code: string;
  label: string;
  flag: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  usage: LocationUsage;
  // Whether a hard delete is available, resolved server-side so the UI never has
  // to re-derive the rule from the counts and drift from it.
  canDelete: boolean;
};

export type CarrierUsage = {
  // How many forwarding requests have shipped with this carrier.
  shipments: number;
};

export type CarrierView = {
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
  usage: CarrierUsage;
  canDelete: boolean;
};

/*
 * The flag emoji for a two-letter country code, built from the Unicode regional
 * indicator block (U+1F1E6 is "A").
 *
 * Derived rather than typed, so registering a country is a one-field action —
 * the same ergonomic the field registry gets from deriving a key off its label.
 * A code that isn't two letters ("EU" is, and resolves; a slug like "LATAM" is
 * not) simply has no flag, and the admin can paste one in.
 */
function flagFor(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';

  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

function locationView(region: Region, usage: LocationUsage): LocationView {
  return {
    code: region.code,
    label: region.label,
    flag: region.flag,
    active: region.active,
    sortOrder: region.sortOrder,
    updatedAt: iso(region.updatedAt),
    usage,
    canDelete:
      usage.services === 0 && usage.pricingTiers === 0 && usage.orders === 0,
  };
}

function carrierView(carrier: MailCarrier, usage: CarrierUsage): CarrierView {
  return {
    code: carrier.code,
    label: carrier.label,
    active: carrier.active,
    sortOrder: carrier.sortOrder,
    updatedAt: iso(carrier.updatedAt),
    usage,
    canDelete: usage.shipments === 0,
  };
}

const NO_LOCATION_USAGE: LocationUsage = {
  services: 0,
  pricingTiers: 0,
  orders: 0,
};

/*
 * The full sequence a reorder writes: the submitted codes in the order given,
 * then every code the payload omitted, in the order it already had.
 *
 * Rule 3 says positions are rewritten from a complete sequence, and this is what
 * keeps that true for a partial payload. Renumbering only the submitted codes
 * would leave an omitted row holding a position now also assigned to a submitted
 * one — today a tie broken by label in every read, but a ranking nobody chose as
 * soon as either list grows. Duplicates are collapsed so positions stay dense.
 */
function orderedCodes(
  submitted: readonly string[],
  existing: readonly string[],
): string[] {
  const unique = [...new Set(submitted)];
  const chosen = new Set(unique);

  return [...unique, ...existing.filter((code) => !chosen.has(code))];
}

// --- Locations -----------------------------------------------------------

/*
 * What references each location, counted across the three tables that store a
 * code. Grouped in one round trip per table rather than per row: the list is a
 * short admin-curated set, and the counts are what the screen renders in its
 * "Used by" column and what decides whether Delete is offered at all.
 *
 * Nothing filters on `deletedAt`: a soft-deleted service still holds its
 * offering row, and the question being answered is "does anything point at this
 * location", not "is that thing live". Only the offering is a `Restrict`
 * relation — a tier and an order would be silently nulled instead, which is a
 * worse outcome than a refusal and the reason they are counted here too.
 */
async function locationUsage(): Promise<Map<string, LocationUsage>> {
  const [offerings, tiers, orders] = await Promise.all([
    prisma.serviceRegionOffering.groupBy({
      by: ['regionCode'],
      _count: { _all: true },
    }),
    prisma.servicePricingTier.groupBy({
      by: ['regionCode'],
      _count: { _all: true },
    }),
    prisma.order.groupBy({ by: ['regionCode'], _count: { _all: true } }),
  ]);

  const usage = new Map<string, LocationUsage>();

  const bump = (
    code: string | null,
    key: keyof LocationUsage,
    count: number,
  ) => {
    if (!code) return;
    const current = usage.get(code) ?? { ...NO_LOCATION_USAGE };
    usage.set(code, { ...current, [key]: current[key] + count });
  };

  for (const row of offerings) bump(row.regionCode, 'services', row._count._all);
  for (const row of tiers) bump(row.regionCode, 'pricingTiers', row._count._all);
  for (const row of orders) bump(row.regionCode, 'orders', row._count._all);

  return usage;
}

export async function listLocations(): Promise<{ locations: LocationView[] }> {
  const [rows, usage] = await Promise.all([
    prisma.region.findMany({
      where: LIVE,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    locationUsage(),
  ]);

  return {
    locations: rows.map((row) =>
      locationView(row, usage.get(row.code) ?? { ...NO_LOCATION_USAGE }),
    ),
  };
}

export async function createLocation(
  actor: AuthContext,
  input: CreateLocationInput,
): Promise<LocationView> {
  const existing = await prisma.region.findUnique({ where: { code: input.code } });

  /*
   * A duplicate code is a conflict, not a silent merge: the admin is opening a
   * jurisdiction that already exists and should be pointed at the row they have.
   *
   * A trashed location still holds its code — `code` is the primary key and the
   * row is only soft-deleted — so the check deliberately does NOT filter on
   * `deletedAt`. It names the Trash instead of reporting a clash with a row the
   * admin cannot see, because the two have different answers: one is "you
   * already have this", the other is "restore it, or empty the Trash first".
   * Reviving the trashed row here would be the worst option of the three — old
   * data, wearing whatever labels this form just supplied.
   */
  if (existing) {
    throw existing.deletedAt
      ? AppError.conflict(
          `A location with the code "${input.code}" is in the Trash. Restore it, or delete it permanently, before creating another under the same code.`,
        )
      : AppError.conflict(
          `A location with the code "${input.code}" already exists`,
        );
  }

  const last = await prisma.region.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const region = await prisma.region.create({
    data: {
      code: input.code,
      label: input.label,
      flag: input.flag || flagFor(input.code),
      active: input.active ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  void record({
    actor,
    action: AuditAction.LOCATION_CREATED,
    entityType: 'Region',
    entityId: region.code,
    metadata: { code: region.code, active: region.active },
  });

  return locationView(region, { ...NO_LOCATION_USAGE });
}

export async function updateLocation(
  actor: AuthContext,
  code: string,
  input: UpdateLocationInput,
): Promise<LocationView> {
  const existing = await prisma.region.findFirst({ where: { code, ...LIVE } });
  if (!existing) throw AppError.notFound('Location not found');

  const region = await prisma.region.update({
    where: { code },
    data: {
      ...(input.label === undefined ? {} : { label: input.label }),
      // An empty flag falls back to the derived one rather than blanking the
      // chip — clearing the box on a country should restore its flag, not lose it.
      ...(input.flag === undefined ? {} : { flag: input.flag || flagFor(code) }),
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
  });

  const usage = (await locationUsage()).get(code) ?? { ...NO_LOCATION_USAGE };

  void record({
    actor,
    action: AuditAction.LOCATION_UPDATED,
    entityType: 'Region',
    entityId: region.code,
    // What changed, not the whole payload.
    metadata: { code: region.code, fields: Object.keys(input), usage },
  });

  return locationView(region, usage);
}

/*
 * Deleting a location no longer lives here.
 *
 * It goes through `modules/admin/trash`, like every other admin table's delete:
 * the row is soft-deleted, a restorable entry is filed, and the "nothing points
 * at this" rule that used to sit in this function is now the `location`
 * descriptor's guard in `trash.registry.ts` — same sentence, same three counts,
 * one copy. `locationUsage` above still answers the list's "Used by" column and
 * its `canDelete` flag, which is what that guard and this screen agree on.
 */

export async function reorderLocations(
  actor: AuthContext,
  input: ReorderLocationsInput,
): Promise<{ locations: LocationView[] }> {
  const known = await prisma.region.findMany({
    where: LIVE,
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { code: true },
  });
  const codes = new Set(known.map((row) => row.code));

  const unknown = input.codes.filter((code) => !codes.has(code));
  if (unknown.length > 0) {
    throw AppError.validation('Unknown location code', { codes: unknown });
  }

  const ordered = orderedCodes(
    input.codes,
    known.map((row) => row.code),
  );

  /*
   * One transaction: a half-applied reorder would leave two rows sharing a
   * position, and the list would come back in an order nobody chose.
   */
  await prisma.$transaction(
    ordered.map((code, index) =>
      prisma.region.update({ where: { code }, data: { sortOrder: index } }),
    ),
  );

  void record({
    actor,
    action: AuditAction.LOCATIONS_REORDERED,
    entityType: 'Region',
    entityId: 'all',
    metadata: { count: ordered.length, submitted: input.codes.length },
  });

  return listLocations();
}

// --- Mail carriers -------------------------------------------------------

/*
 * Shipments per carrier. `MailRequest.carrier` stores the code as plain text
 * rather than a foreign key — a shipped parcel's carrier is a historical fact
 * that must survive the carrier row being retired — so this counts by value.
 */
async function carrierUsage(): Promise<Map<string, number>> {
  const grouped = await prisma.mailRequest.groupBy({
    by: ['carrier'],
    _count: { _all: true },
  });

  const usage = new Map<string, number>();
  for (const row of grouped) {
    if (row.carrier) usage.set(row.carrier, row._count._all);
  }

  return usage;
}

export async function listCarriers(): Promise<{ carriers: CarrierView[] }> {
  const [rows, usage] = await Promise.all([
    prisma.mailCarrier.findMany({
      where: LIVE,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    }),
    carrierUsage(),
  ]);

  return {
    carriers: rows.map((row) =>
      carrierView(row, { shipments: usage.get(row.code) ?? 0 }),
    ),
  };
}

export async function createCarrier(
  actor: AuthContext,
  input: CreateCarrierInput,
): Promise<CarrierView> {
  const existing = await prisma.mailCarrier.findUnique({
    where: { code: input.code },
  });

  // Same rule as `createLocation` above, and for the same reason — a trashed
  // carrier keeps its code, so the clash is real and the message has to say
  // where the row actually is.
  if (existing) {
    throw existing.deletedAt
      ? AppError.conflict(
          `A carrier with the code "${input.code}" is in the Trash. Restore it, or delete it permanently, before creating another under the same code.`,
        )
      : AppError.conflict(
          `A carrier with the code "${input.code}" already exists`,
        );
  }

  const last = await prisma.mailCarrier.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const carrier = await prisma.mailCarrier.create({
    data: {
      code: input.code,
      label: input.label,
      active: input.active ?? true,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  void record({
    actor,
    action: AuditAction.CARRIER_CREATED,
    entityType: 'MailCarrier',
    entityId: carrier.code,
    metadata: { code: carrier.code, active: carrier.active },
  });

  return carrierView(carrier, { shipments: 0 });
}

export async function updateCarrier(
  actor: AuthContext,
  code: string,
  input: UpdateCarrierInput,
): Promise<CarrierView> {
  const existing = await prisma.mailCarrier.findFirst({ where: { code, ...LIVE } });
  if (!existing) throw AppError.notFound('Carrier not found');

  const carrier = await prisma.mailCarrier.update({
    where: { code },
    data: {
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
  });

  const shipments = (await carrierUsage()).get(code) ?? 0;

  void record({
    actor,
    action: AuditAction.CARRIER_UPDATED,
    entityType: 'MailCarrier',
    entityId: carrier.code,
    metadata: { code: carrier.code, fields: Object.keys(input), shipments },
  });

  return carrierView(carrier, { shipments });
}

// Deleting a carrier goes through `modules/admin/trash`, exactly as a location
// does — the "nothing has shipped with it" rule now lives on the `carrier`
// descriptor there, and `carrierUsage` above still feeds this screen's shipment
// count and its `canDelete` flag.

export async function reorderCarriers(
  actor: AuthContext,
  input: ReorderCarriersInput,
): Promise<{ carriers: CarrierView[] }> {
  const known = await prisma.mailCarrier.findMany({
    where: LIVE,
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { code: true },
  });
  const codes = new Set(known.map((row) => row.code));

  const unknown = input.codes.filter((code) => !codes.has(code));
  if (unknown.length > 0) {
    throw AppError.validation('Unknown carrier code', { codes: unknown });
  }

  const ordered = orderedCodes(
    input.codes,
    known.map((row) => row.code),
  );

  await prisma.$transaction(
    ordered.map((code, index) =>
      prisma.mailCarrier.update({ where: { code }, data: { sortOrder: index } }),
    ),
  );

  void record({
    actor,
    action: AuditAction.CARRIERS_REORDERED,
    entityType: 'MailCarrier',
    entityId: 'all',
    metadata: { count: ordered.length, submitted: input.codes.length },
  });

  return listCarriers();
}
