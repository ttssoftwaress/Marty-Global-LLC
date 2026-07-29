import { Prisma, type ResultFieldDefinition } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import { storedResultRefs } from '../../results/results.fields.js';
import {
  resultFieldConfigSchema,
  type ResultFieldConfig,
} from '../../results/results.validation.js';
import { iso } from '../admin.views.js';
import type {
  CreateResultFieldInput,
  ListResultFieldsQuery,
  UpdateResultFieldInput,
} from './result-fields.validation.js';

/*
 * The result registry — the vocabulary of facts services deliver. All Prisma
 * access for `ResultFieldDefinition` lives here.
 *
 * The same two rules as the request registry, and for the same reasons:
 *
 *   1. A key is immutable. `ServiceResultValue` rows are stored under it, so
 *      renaming one would orphan every delivered record. The update input
 *      carries no key at all.
 *
 *   2. A field's TYPE is frozen once a service returns it. Values already
 *      delivered were validated against the old control — switching a live text
 *      field to a date would leave stored values that no longer parse, and the
 *      customer's page renders them.
 *
 *   3. A field anything has ever referenced cannot be deleted. Deleting one is
 *      offered — a fact registered by mistake should be removable rather than
 *      sitting archived forever — but only while no service returns it and no
 *      delivered record holds a value for it. A delivered record must stay
 *      readable (AGENTS.md — ask before any hard delete), so anything else is
 *      archived, which retires the field from the picker and leaves every record
 *      intact. The `Restrict` on `ServiceResultValue.definition` is the same rule
 *      at the database level — the guard below is what turns it into an
 *      explanation instead of a foreign-key error.
 */

export type ResultFieldDefinitionView = {
  id: string;
  key: string;
  label: string;
  type: string;
  hint?: string;
  category?: string;
  config: ResultFieldConfig;
  isPrimary: boolean;
  showInList: boolean;
  archived: boolean;
  sortOrder: number;
  updatedAt: string;
  // How many catalog services currently return this fact — the blast radius of
  // an edit, and what the UI reads to explain why a live field's type is locked.
  usageCount: number;
  /*
   * Whether removing this field outright is available at all. False as soon as a
   * service returns it or a delivered record holds a value for it — resolved by
   * `isDeletable`, the same helper `deleteResultField` refuses on, so a hidden
   * button and a refused call cannot disagree.
   */
  canDelete: boolean;
};

export type ResultFieldDefinitionPage = {
  fields: ResultFieldDefinitionView[];
  nextCursor: string | null;
  totalResults: number;
};

function toView(
  definition: ResultFieldDefinition,
  usageCount: number,
  canDelete: boolean,
): ResultFieldDefinitionView {
  const parsed = resultFieldConfigSchema.safeParse(definition.config ?? {});

  return {
    id: definition.id,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    ...(definition.hint ? { hint: definition.hint } : {}),
    ...(definition.category ? { category: definition.category } : {}),
    config: parsed.success ? parsed.data : {},
    isPrimary: definition.isPrimary,
    showInList: definition.showInList,
    archived: definition.archived,
    sortOrder: definition.sortOrder,
    updatedAt: iso(definition.updatedAt),
    usageCount,
    canDelete,
  };
}

/*
 * The one expression of rule 3's "removing this outright is still available".
 *
 * Every caller reads it from here — the list, the update response, and the
 * delete guard's own refusal — because the same predicate written out twice is
 * the drift that lets a visible button meet a refused call. The delivered-value
 * side arrives as a boolean rather than a count so the list (a grouped id probe)
 * and the write paths (a count for one field) can both use it.
 */
function isDeletable(usageCount: number, hasDeliveredValues: boolean): boolean {
  return usageCount === 0 && !hasDeliveredValues;
}

// Strip config keys that don't belong to the field's type, so a field switched
// from select to text can't keep carrying options a later reader might act on.
function configFor(
  type: string,
  config: ResultFieldConfig | undefined,
): ResultFieldConfig {
  if (!config) return {};

  switch (type) {
    case 'select':
      return config.options ? { options: config.options } : {};
    case 'status':
      return config.statusOptions ? { statusOptions: config.statusOptions } : {};
    case 'textarea':
      return config.rows !== undefined ? { rows: config.rows } : {};
    case 'file':
      return {
        ...(config.accept?.length ? { accept: config.accept } : {}),
        ...(config.maxSizeMb !== undefined ? { maxSizeMb: config.maxSizeMb } : {}),
      };
    case 'number':
      return {
        ...(config.prefix ? { prefix: config.prefix } : {}),
        ...(config.suffix ? { suffix: config.suffix } : {}),
        ...(config.decimals !== undefined ? { decimals: config.decimals } : {}),
      };
    case 'date':
      return config.withTime ? { withTime: true } : {};
    default:
      return {};
  }
}

/*
 * How many services return each fact. Counted in memory over the catalog's
 * `resultFields` Json column for the same reason the request registry counts its
 * own: the catalog is a small admin-curated table, and an index-less Json probe
 * would be both slower and harder to keep honest as the stored shape evolves.
 */
async function usageByKey(): Promise<Map<string, number>> {
  const services = await prisma.service.findMany({
    where: { deletedAt: null },
    select: { resultFields: true },
  });

  const counts = new Map<string, number>();

  for (const service of services) {
    const keys = new Set(storedResultRefs(service).map((ref) => ref.fieldKey));
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

/*
 * The definition ids delivered records hold a value for.
 *
 * A grouped count rather than the in-memory pass `usageByKey` does, because this
 * one has a real relation and an index behind it (`ServiceResultValue.fieldId`)
 * — and unlike the catalog, the value table grows with every filing, so it is
 * the one thing here that must never be read into memory.
 */
async function deliveredFieldIds(): Promise<Set<string>> {
  const grouped = await prisma.serviceResultValue.groupBy({ by: ['fieldId'] });
  return new Set(grouped.map((row) => row.fieldId));
}

export async function listResultFields(
  query: ListResultFieldsQuery,
): Promise<ResultFieldDefinitionPage> {
  const where: Prisma.ResultFieldDefinitionWhereInput = {
    ...(query.includeArchived ? {} : { archived: false }),
    ...(query.type ? { type: query.type } : {}),
    ...(query.search
      ? {
          OR: [
            { label: { contains: query.search, mode: 'insensitive' } },
            { key: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [totalResults, rows, usage, delivered] = await Promise.all([
    prisma.resultFieldDefinition.count({ where }),
    prisma.resultFieldDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    usageByKey(),
    deliveredFieldIds(),
  ]);

  const page = takePage(rows, query.limit);

  return {
    fields: page.rows.map((row) => {
      const usageCount = usage.get(row.key) ?? 0;
      return toView(row, usageCount, isDeletable(usageCount, delivered.has(row.id)));
    }),
    nextCursor: page.nextCursor,
    totalResults,
  };
}

export async function createResultField(
  actor: AuthContext,
  input: CreateResultFieldInput,
): Promise<ResultFieldDefinitionView> {
  const existing = await prisma.resultFieldDefinition.findUnique({
    where: { key: input.key },
  });

  // A duplicate key is a conflict, not a silent merge: the admin is registering
  // a fact that already exists and should be told to reuse it.
  if (existing) {
    throw AppError.conflict(
      `A result field with the key "${input.key}" already exists`,
    );
  }

  const last = await prisma.resultFieldDefinition.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const definition = await prisma.resultFieldDefinition.create({
    data: {
      key: input.key,
      label: input.label,
      type: input.type,
      hint: input.hint || null,
      category: input.category || null,
      config: configFor(input.type, input.config),
      isPrimary: input.isPrimary ?? false,
      showInList: input.showInList ?? false,
      archived: input.archived ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  void record({
    actor,
    action: AuditAction.RESULT_FIELD_CREATED,
    entityType: 'ResultFieldDefinition',
    entityId: definition.id,
    metadata: { key: definition.key, type: definition.type },
  });

  // Nothing can reference a fact that did not exist a moment ago.
  return toView(definition, 0, true);
}

export async function updateResultField(
  actor: AuthContext,
  fieldId: string,
  input: UpdateResultFieldInput,
): Promise<ResultFieldDefinitionView> {
  const existing = await prisma.resultFieldDefinition.findUnique({
    where: { id: fieldId },
  });

  if (!existing) throw AppError.notFound('Result field not found');

  const [usage, valueCount] = await Promise.all([
    usageByKey(),
    prisma.serviceResultValue.count({ where: { fieldId } }),
  ]);
  const usageCount = usage.get(existing.key) ?? 0;

  /*
   * Rule 2: a live field's type is frozen. Every value already delivered was
   * validated against the old control — a text value stored under a field that
   * is now a `date` would fail to parse on the customer's own page.
   */
  if (input.type && input.type !== existing.type && usageCount > 0) {
    throw AppError.businessRule(
      `"${existing.label}" is returned by ${usageCount} service${usageCount === 1 ? '' : 's'}, so its type can no longer be changed. Register a new field instead.`,
      { fieldKey: existing.key, usageCount },
    );
  }

  const type = input.type ?? existing.type;

  // Config is replaced wholesale for the resolved type — the form submits the
  // complete set it holds, so a choice the admin removed must disappear.
  const config =
    input.config === undefined && input.type === undefined
      ? undefined
      : configFor(
          type,
          input.config ??
            resultFieldConfigSchema.safeParse(existing.config ?? {}).data,
        );

  const definition = await prisma.resultFieldDefinition.update({
    where: { id: fieldId },
    data: {
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.hint === undefined ? {} : { hint: input.hint || null }),
      ...(input.category === undefined
        ? {}
        : { category: input.category || null }),
      ...(config === undefined ? {} : { config }),
      ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
      ...(input.showInList === undefined ? {} : { showInList: input.showInList }),
      ...(input.archived === undefined ? {} : { archived: input.archived }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
  });

  void record({
    actor,
    action: AuditAction.RESULT_FIELD_UPDATED,
    entityType: 'ResultFieldDefinition',
    entityId: definition.id,
    // What changed, not the whole payload.
    metadata: { key: definition.key, fields: Object.keys(input), usageCount },
  });

  return toView(definition, usageCount, isDeletable(usageCount, valueCount > 0));
}

/*
 * Remove a registered fact outright — rule 3 above.
 *
 * A hard delete, unlike the catalog's own, and for the same reason the request
 * registry's is: a `ResultFieldDefinition` is configuration, not a
 * customer-facing record, so once nothing points at it there is nothing to
 * retain. The guard is what makes that safe, and it runs here rather than being
 * trusted from the UI.
 *
 * The `Restrict` on `ServiceResultValue.definition` would refuse a delete that
 * slipped past this check, but as a foreign-key error with nothing an admin can
 * act on — so the value count is read first and turned into a sentence.
 */
export async function deleteResultField(
  actor: AuthContext,
  fieldId: string,
): Promise<{ id: string }> {
  const existing = await prisma.resultFieldDefinition.findUnique({
    where: { id: fieldId },
  });

  if (!existing) throw AppError.notFound('Result field not found');

  const [usage, valueCount] = await Promise.all([
    usageByKey(),
    prisma.serviceResultValue.count({ where: { fieldId } }),
  ]);

  const usageCount = usage.get(existing.key) ?? 0;

  if (!isDeletable(usageCount, valueCount > 0)) {
    const reason =
      valueCount > 0
        ? `${valueCount} delivered record${valueCount === 1 ? '' : 's'} hold${valueCount === 1 ? 's' : ''} a value for it`
        : `${usageCount} service${usageCount === 1 ? '' : 's'} still return${usageCount === 1 ? 's' : ''} it`;

    throw AppError.businessRule(
      `"${existing.label}" cannot be deleted because ${reason}. Archive it instead — it leaves the picker and every record already using it keeps rendering.`,
      { fieldKey: existing.key, usageCount, valueCount },
    );
  }

  await prisma.resultFieldDefinition.delete({ where: { id: fieldId } });

  void record({
    actor,
    action: AuditAction.RESULT_FIELD_DELETED,
    entityType: 'ResultFieldDefinition',
    entityId: fieldId,
    metadata: { key: existing.key, type: existing.type },
  });

  return { id: fieldId };
}

/*
 * The catalog's write path calls this to reject a result schema referencing a
 * fact that isn't registered — the registry is only a closed set if the service
 * layer enforces it.
 */
export async function assertResultFieldsExist(
  keys: readonly string[],
): Promise<void> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return;

  const found = await prisma.resultFieldDefinition.findMany({
    where: { key: { in: unique } },
    select: { key: true },
  });

  const known = new Set(found.map((definition) => definition.key));
  const unknown = unique.filter((key) => !known.has(key));

  if (unknown.length > 0) {
    throw AppError.validation('Unknown result field key', { fieldKeys: unknown });
  }
}
