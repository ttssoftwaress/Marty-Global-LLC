import { Prisma } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { iso, money, type Money } from '../admin.views.js';
import {
  assertDependenciesSatisfied,
  assertFieldsExist,
} from '../fields/fields.service.js';
import { assertResultFieldsExist } from '../result-fields/result-fields.service.js';
import type {
  CreateServiceInput,
  ListServicesQuery,
  UpdateRequestTypesInput,
  UpdateResultSchemaInput,
  UpdateServiceInput,
} from './catalog.validation.js';

/*
 * The admin service catalog — the write side of what the customer portal reads
 * in its "Order new service" flow. All Prisma access for the catalog lives here.
 *
 * Every mutation is a state change on what customers can order and what they
 * will be quoted, so each one writes an audit entry (AGENTS.md).
 *
 * MONEY: a tier's price is stored exactly as it arrives — integer minor units
 * plus its ISO 4217 code. Nothing in this file does arithmetic on an amount.
 */

// --- Regions -------------------------------------------------------------
export type ServiceRegionView = { code: string; label: string; flag: string };

export async function listRegions(): Promise<ServiceRegionView[]> {
  const regions = await prisma.region.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
  });

  return regions.map((region) => ({
    code: region.code,
    label: region.label,
    flag: region.flag,
  }));
}

// --- List ----------------------------------------------------------------
export type CatalogServiceRow = {
  id: string;
  name: string;
  regions: ServiceRegionView[];
  tierCount: number;
  updatedAt: string;
  active: boolean;
  /*
   * Whether removing this service is available at all — false as soon as a
   * customer has ordered it or a record has been delivered under it. Computed
   * here rather than in the UI so the rule has one definition, and re-checked in
   * `deleteService` so it is a guard and not just a hidden button.
   */
  canDelete: boolean;
};

export type CatalogServicePage = {
  rows: CatalogServiceRow[];
  nextCursor: string | null;
  totalResults: number;
};

// Only regions the service is actually offered in appear on the row; a disabled
// offering is history, not a chip.
const listInclude = {
  regions: {
    where: { enabled: true },
    include: { region: true },
    orderBy: { sortOrder: 'asc' },
  },
  _count: {
    select: {
      pricingTiers: { where: { deletedAt: null } },
      // What decides `canDelete`: the two things a customer owns that point at a
      // service. Counted in the same query the rows come from, so the list costs
      // no more than it did.
      orderItems: true,
      results: true,
    },
  },
} satisfies Prisma.ServiceInclude;

export async function listServices(
  query: ListServicesQuery,
): Promise<CatalogServicePage> {
  // The admin catalog shows deactivated services too — that is the point of the
  // Active column — so only soft-deleted rows are excluded.
  const where: Prisma.ServiceWhereInput = { deletedAt: null };

  const [totalResults, rows] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      include: listInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
  ]);

  const page = takePage(rows, query.limit);

  return {
    rows: page.rows.map((service) => ({
      id: service.id,
      name: service.name,
      regions: service.regions.map((offering) => ({
        code: offering.region.code,
        label: offering.region.label,
        flag: offering.region.flag,
      })),
      tierCount: service._count.pricingTiers,
      updatedAt: iso(service.updatedAt),
      active: service.active,
      canDelete: service._count.orderItems === 0 && service._count.results === 0,
    })),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

// --- Detail --------------------------------------------------------------
/*
 * A service's form is stored as references into the field registry. The detail
 * screen edits those references — which registered questions this service asks,
 * in what order, grouped into which steps, and whether each is required here —
 * so this is the shape it reads and writes. What a question LOOKS like is the
 * registry's business, fetched separately by the form builder's picker.
 */
type FieldRefView = { fieldKey: string; required?: boolean };

export type ServicePricingTierView = {
  id: string;
  name: string;
  price: Money;
  regionCode: string | null;
  turnaround?: string;
  description?: string;
};

export type CatalogServiceDetail = {
  id: string;
  iconKey: string;
  name: string;
  shortName?: string;
  description: string;
  features: string[];
  footer: { label: string; chips?: string[] };
  detailFields: FieldRefView[];
  formSteps?: {
    key: string;
    title: string;
    description?: string;
    fields: FieldRefView[];
  }[];
  regionCodes: string[];
  pricingTiers: ServicePricingTierView[];
  // What this service DELIVERS, as references into the result registry, plus the
  // wording the customer's page for it uses.
  resultFields: ResultFieldRefView[];
  resultPageTitle?: string;
  resultNoun?: string;
  // The follow-up actions it offers. Inactive types are included so the editor
  // can show and re-enable them; the customer's page filters to active.
  requestTypes: ServiceRequestTypeView[];
  active: boolean;
  sortOrder: number;
  updatedAt: string;
};

type ResultFieldRefView = FieldRefView & {
  isPrimary?: boolean;
  showInList?: boolean;
};

export type ServiceRequestTypeView = {
  id: string;
  key: string;
  label: string;
  description?: string;
  iconKey?: string;
  turnaround?: string;
  fields: FieldRefView[];
  active: boolean;
};

const detailInclude = {
  regions: { include: { region: true }, orderBy: { sortOrder: 'asc' } },
  pricingTiers: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  },
  requestTypes: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.ServiceInclude;

type ServiceWithDetail = Prisma.ServiceGetPayload<{ include: typeof detailInclude }>;

// `detailFields`, `formSteps`, and `footer` are Json columns. They were written
// through the Zod schemas above, so the shape is known — but a column is still
// `JsonValue` to the client, and a defensive cast here beats an `any` at every
// read site.
function asFields(value: Prisma.JsonValue | null): FieldRefView[] {
  return Array.isArray(value) ? (value as FieldRefView[]) : [];
}

// Every field key a write references, flat list and steps together — what the
// registry check below is run against.
function referencedKeys(input: {
  detailFields?: readonly { fieldKey: string }[];
  formSteps?: readonly { fields: readonly { fieldKey: string }[] }[];
}): string[] {
  return [
    ...(input.detailFields?.map((ref) => ref.fieldKey) ?? []),
    ...(input.formSteps?.flatMap((step) =>
      step.fields.map((ref) => ref.fieldKey),
    ) ?? []),
  ];
}

/*
 * Both shapes a form can be stored in, each in the order a customer reads it.
 *
 * Checked as two sequences rather than one concatenation: the flat list and the
 * steps are two views of the same questions (the steps card writes `detailFields`
 * as the flattened union of its steps), so concatenating them would judge each
 * question twice and see a parent "after" its child across the seam.
 */
function orderedFormSequences(input: {
  detailFields?: readonly { fieldKey: string }[];
  formSteps?: readonly { fields: readonly { fieldKey: string }[] }[];
}): string[][] {
  return [
    input.detailFields?.map((ref) => ref.fieldKey) ?? [],
    input.formSteps?.flatMap((step) => step.fields.map((ref) => ref.fieldKey)) ?? [],
  ].filter((sequence) => sequence.length > 0);
}

function toDetail(service: ServiceWithDetail): CatalogServiceDetail {
  const footer = (service.footer ?? {}) as { label?: string; chips?: string[] };
  const steps = service.formSteps as CatalogServiceDetail['formSteps'] | null;

  return {
    id: service.id,
    iconKey: service.iconKey,
    name: service.name,
    ...(service.shortName ? { shortName: service.shortName } : {}),
    description: service.description,
    features: service.features,
    footer: {
      label: footer.label ?? '',
      ...(footer.chips?.length ? { chips: footer.chips } : {}),
    },
    detailFields: asFields(service.detailFields),
    ...(steps?.length ? { formSteps: steps } : {}),
    // Only enabled offerings — the same rule the list row follows, so the form
    // opens with the chips the table printed.
    regionCodes: service.regions
      .filter((offering) => offering.enabled)
      .map((offering) => offering.regionCode),
    pricingTiers: service.pricingTiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: money(tier.price, tier.currency),
      regionCode: tier.regionCode,
      ...(tier.turnaround ? { turnaround: tier.turnaround } : {}),
      ...(tier.description ? { description: tier.description } : {}),
    })),
    resultFields: asFields(service.resultFields) as ResultFieldRefView[],
    ...(service.resultPageTitle ? { resultPageTitle: service.resultPageTitle } : {}),
    ...(service.resultNoun ? { resultNoun: service.resultNoun } : {}),
    requestTypes: service.requestTypes.map((type) => ({
      id: type.id,
      key: type.key,
      label: type.label,
      ...(type.description ? { description: type.description } : {}),
      ...(type.iconKey ? { iconKey: type.iconKey } : {}),
      ...(type.turnaround ? { turnaround: type.turnaround } : {}),
      fields: asFields(type.fields),
      active: type.active,
    })),
    active: service.active,
    sortOrder: service.sortOrder,
    updatedAt: iso(service.updatedAt),
  };
}

export async function getService(serviceId: string): Promise<CatalogServiceDetail> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    include: detailInclude,
  });

  if (!service) throw AppError.notFound('Service not found');
  return toDetail(service);
}

// --- Write ---------------------------------------------------------------
// A region code the catalogue doesn't know is a validation error, not a silently
// dropped chip — the admin picked it from a list this same module publishes, so
// a miss means the two are out of step and the operator should be told.
async function assertRegionsExist(codes: readonly string[]): Promise<void> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return;

  const found = await prisma.region.findMany({
    where: { code: { in: unique } },
    select: { code: true },
  });

  const known = new Set(found.map((region) => region.code));
  const unknown = unique.filter((code) => !known.has(code));

  if (unknown.length > 0) {
    throw AppError.validation('Unknown region code', { regionCodes: unknown });
  }
}

type TierInput = CreateServiceInput['pricingTiers'][number];

// Tiers are replaced wholesale rather than diffed: the form submits the complete
// set it holds, so a tier the admin removed must disappear. Existing ids are
// preserved where sent, which is what keeps a tier's identity stable across an
// edit.
function tierCreateData(tiers: readonly TierInput[]) {
  return tiers.map((tier, index) => ({
    ...(tier.id ? { id: tier.id } : {}),
    name: tier.name,
    price: tier.price.amount,
    currency: tier.price.currency,
    regionCode: tier.regionCode,
    turnaround: tier.turnaround ?? null,
    description: tier.description ?? null,
    sortOrder: index,
  }));
}

export async function createService(
  actor: AuthContext,
  input: CreateServiceInput,
): Promise<CatalogServiceDetail> {
  await assertRegionsExist([
    ...input.regionCodes,
    ...input.pricingTiers.flatMap((tier) => (tier.regionCode ? [tier.regionCode] : [])),
  ]);

  // The registry is only a closed set if the write path enforces it: a form may
  // reference a registered field or nothing at all.
  await assertFieldsExist(referencedKeys(input));

  // And a dependent dropdown is only answerable if its parent is asked first.
  for (const sequence of orderedFormSequences(input)) {
    await assertDependenciesSatisfied(sequence);
  }

  // A new service sorts after everything that exists, so the portal's card order
  // stays stable and the admin reorders deliberately rather than by accident.
  const last = await prisma.service.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const service = await prisma.service.create({
    data: {
      iconKey: input.iconKey,
      name: input.name,
      shortName: input.shortName ?? null,
      description: input.description,
      features: input.features,
      footer: input.footer,
      detailFields: input.detailFields,
      active: input.active,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      regions: {
        create: input.regionCodes.map((code, index) => ({
          regionCode: code,
          enabled: true,
          sortOrder: index,
        })),
      },
      pricingTiers: { create: tierCreateData(input.pricingTiers) },
    },
    include: detailInclude,
  });

  void record({
    actor,
    action: AuditAction.SERVICE_CREATED,
    entityType: 'Service',
    entityId: service.id,
    metadata: {
      name: service.name,
      active: service.active,
      regionCodes: input.regionCodes,
      tierCount: input.pricingTiers.length,
    },
  });

  return toDetail(service);
}

export async function updateService(
  actor: AuthContext,
  serviceId: string,
  input: UpdateServiceInput,
): Promise<CatalogServiceDetail> {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true, name: true, active: true },
  });

  if (!existing) throw AppError.notFound('Service not found');

  // Both region shapes resolve to the same offering rows: the modal sends codes,
  // the detail card sends codes plus enabled/processingTime.
  const regionRows =
    input.regions?.map((region, index) => ({
      regionCode: region.code,
      enabled: region.enabled,
      processingTime: region.processingTime || null,
      sortOrder: index,
    })) ??
    input.regionCodes?.map((code, index) => ({
      regionCode: code,
      enabled: true,
      processingTime: null,
      sortOrder: index,
    }));

  await assertRegionsExist([
    ...(regionRows?.map((row) => row.regionCode) ?? []),
    ...(input.pricingTiers?.flatMap((tier) => (tier.regionCode ? [tier.regionCode] : [])) ?? []),
  ]);

  await assertFieldsExist(referencedKeys(input));

  for (const sequence of orderedFormSequences(input)) {
    await assertDependenciesSatisfied(sequence);
  }

  // One transaction: a half-applied edit would leave the portal rendering a form
  // whose fields no longer match the tiers priced against them.
  const service = await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: serviceId },
      data: {
        ...(input.iconKey === undefined ? {} : { iconKey: input.iconKey }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.shortName === undefined ? {} : { shortName: input.shortName || null }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.features === undefined ? {} : { features: input.features }),
        ...(input.footer === undefined ? {} : { footer: input.footer }),
        ...(input.detailFields === undefined ? {} : { detailFields: input.detailFields }),
        ...(input.formSteps === undefined ? {} : { formSteps: input.formSteps }),
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      },
    });

    if (regionRows) {
      // Replace rather than diff — the card submits the complete set it holds.
      await tx.serviceRegionOffering.deleteMany({ where: { serviceId } });
      if (regionRows.length > 0) {
        await tx.serviceRegionOffering.createMany({
          data: regionRows.map((row) => ({ ...row, serviceId })),
        });
      }
    }

    if (input.pricingTiers) {
      // Soft-delete the old set: a tier a historical quote was priced from must
      // stay resolvable (AGENTS.md — ask before any hard delete).
      await tx.servicePricingTier.updateMany({
        where: { serviceId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      for (const tier of tierCreateData(input.pricingTiers)) {
        // An id the form sent belongs to a row we just soft-deleted, so this
        // revives it in place instead of colliding on the primary key.
        if (tier.id) {
          await tx.servicePricingTier.upsert({
            where: { id: tier.id },
            create: { ...tier, serviceId },
            update: { ...tier, serviceId, deletedAt: null },
          });
        } else {
          await tx.servicePricingTier.create({ data: { ...tier, serviceId } });
        }
      }
    }

    return tx.service.findFirstOrThrow({
      where: { id: serviceId },
      include: detailInclude,
    });
  });

  void record({
    actor,
    action: AuditAction.SERVICE_UPDATED,
    entityType: 'Service',
    entityId: serviceId,
    // What changed, not the whole payload — the trail records the shape of the
    // edit without copying customer-facing copy into it.
    metadata: {
      fields: Object.keys(input),
      ...(input.active === undefined ? {} : { activeFrom: existing.active, activeTo: input.active }),
      ...(input.pricingTiers ? { tierCount: input.pricingTiers.length } : {}),
    },
  });

  return toDetail(service);
}

/*
 * Remove a service from the catalog.
 *
 * Two rules, and both are the reason this is offered at all rather than leaving
 * "deactivate" as the only exit:
 *
 *   1. It only ever reaches the write for a service nothing points at — no order
 *      line, no delivered record. A service a customer has bought is part of
 *      that order's history, so it is deactivated instead: the row stays
 *      resolvable and simply leaves the customer's catalog.
 *
 *   2. Even then it is `deletedAt`, not a row disappearing (AGENTS.md — ask
 *      before any hard delete). Every catalog read already filters soft-deleted
 *      rows, so the service leaves both apps immediately while the record of
 *      what was configured survives. `active: false` goes with it, so a row
 *      restored by hand comes back hidden rather than silently on sale.
 *
 * The service's own children — tiers, offerings, request types — are left as
 * they are: they are only ever read through the service, which no query can
 * reach any more, and untouching them keeps a restore lossless.
 */
export async function deleteService(
  actor: AuthContext,
  serviceId: string,
): Promise<{ id: string }> {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: { select: { orderItems: true, results: true } },
    },
  });

  if (!existing) throw AppError.notFound('Service not found');

  const usage = {
    orderItems: existing._count.orderItems,
    results: existing._count.results,
  };
  const references = usage.orderItems + usage.results;

  if (references > 0) {
    throw AppError.businessRule(
      `"${existing.name}" is on ${references} customer record${references === 1 ? '' : 's'}, so it cannot be deleted. Turn it off instead — it stays on those records and disappears from the customer's catalog.`,
      { serviceId, usage },
    );
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: { deletedAt: new Date(), active: false },
  });

  void record({
    actor,
    action: AuditAction.SERVICE_DELETED,
    entityType: 'Service',
    entityId: serviceId,
    metadata: { name: existing.name },
  });

  return { id: serviceId };
}

/*
 * The delivery half of a service: what it RETURNS, and how the customer's page
 * for it is worded.
 *
 * Its own endpoint rather than another branch of `updateService`, because it is
 * edited on its own card by a different decision — what a service sells is
 * settled when it is created, while what it delivers is settled once the team
 * knows what the filing actually produces.
 *
 * Every referenced key is checked against the result registry: the registry is
 * only a closed set if this layer enforces it, and a schema pointing at a fact
 * that was never registered would render blank rows on a customer's page.
 */
export async function updateResultSchema(
  actor: AuthContext,
  serviceId: string,
  input: UpdateResultSchemaInput,
): Promise<CatalogServiceDetail> {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) throw AppError.notFound('Service not found');

  await assertResultFieldsExist(input.resultFields.map((ref) => ref.fieldKey));

  const service = await prisma.service.update({
    where: { id: serviceId },
    data: {
      resultFields: input.resultFields,
      // Empty clears the override, and the page falls back to the service name.
      ...(input.resultPageTitle === undefined
        ? {}
        : { resultPageTitle: input.resultPageTitle || null }),
      ...(input.resultNoun === undefined
        ? {}
        : { resultNoun: input.resultNoun || null }),
    },
    include: detailInclude,
  });

  void record({
    actor,
    action: AuditAction.RESULT_SCHEMA_UPDATED,
    entityType: 'Service',
    entityId: serviceId,
    metadata: {
      fieldCount: input.resultFields.length,
      fieldKeys: input.resultFields.map((ref) => ref.fieldKey),
    },
  });

  return toDetail(service);
}

/*
 * The follow-up actions a service offers — the buttons on the customer's result
 * page.
 *
 * A type the admin drops from the list is DEACTIVATED, never deleted: requests
 * already raised under it point at the row (`onDelete: Restrict`), and the queue
 * has to keep reading them. That is the same archive-not-delete rule the two
 * registries follow, applied to the third thing customers can reference.
 */
export async function updateRequestTypes(
  actor: AuthContext,
  serviceId: string,
  input: UpdateRequestTypesInput,
): Promise<CatalogServiceDetail> {
  const existing = await prisma.service.findFirst({
    where: { id: serviceId, deletedAt: null },
    select: { id: true },
  });

  if (!existing) throw AppError.notFound('Service not found');

  // Intake forms reference the REQUEST registry, so they are checked against it
  // — not the result one.
  await assertFieldsExist(
    input.requestTypes.flatMap((type) => type.fields?.map((ref) => ref.fieldKey) ?? []),
  );

  // Each intake form is its own sequence — a type asking "State" has to ask
  // "Country" itself, since the customer only ever sees one type's fields.
  for (const type of input.requestTypes) {
    await assertDependenciesSatisfied(type.fields?.map((ref) => ref.fieldKey) ?? []);
  }

  const { service, added, deactivated } = await prisma.$transaction(async (tx) => {
    const submittedKeys = new Set(input.requestTypes.map((type) => type.key));

    /*
     * Read before writing so the audit row can say which types this submission
     * actually introduced. The endpoint takes the whole list at once and upserts
     * every entry, so without this the trail records a batch write and nothing
     * about a new follow-up action appearing on a customer's result page.
     */
    const before = await tx.serviceRequestType.findMany({
      where: { serviceId, deletedAt: null },
      select: { key: true, active: true },
    });

    const liveKeys = new Set(before.map((row) => row.key));
    const added = [...submittedKeys].filter((key) => !liveKeys.has(key));
    const deactivated = before
      .filter((row) => row.active && !submittedKeys.has(row.key))
      .map((row) => row.key);

    // Anything the admin removed from the list stops being offered but stays
    // readable for the requests already raised under it.
    await tx.serviceRequestType.updateMany({
      where: { serviceId, deletedAt: null, key: { notIn: [...submittedKeys] } },
      data: { active: false },
    });

    for (const [index, type] of input.requestTypes.entries()) {
      const data = {
        label: type.label,
        description: type.description || null,
        iconKey: type.iconKey || null,
        turnaround: type.turnaround || null,
        fields: type.fields ?? [],
        active: type.active,
        sortOrder: index,
      };

      // Keyed on (serviceId, key) rather than on the optional id: a type the
      // admin re-adds after removing it must revive the existing row, or the
      // unique constraint would reject it and its history would be orphaned.
      await tx.serviceRequestType.upsert({
        where: { serviceId_key: { serviceId, key: type.key } },
        create: { ...data, serviceId, key: type.key },
        update: { ...data, deletedAt: null },
      });
    }

    const service = await tx.service.findFirstOrThrow({
      where: { id: serviceId },
      include: detailInclude,
    });

    return { service, added, deactivated };
  });

  void record({
    actor,
    action: AuditAction.REQUEST_TYPE_UPDATED,
    entityType: 'Service',
    entityId: serviceId,
    // Keys only — they are admin-authored identifiers, not customer data.
    metadata: {
      typeCount: input.requestTypes.length,
      keys: input.requestTypes.map((type) => type.key),
      added,
      deactivated,
    },
  });

  return toDetail(service);
}
