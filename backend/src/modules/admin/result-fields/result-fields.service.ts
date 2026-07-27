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
 * Deleting is not offered. A delivered record holding a value for a field must
 * stay readable (AGENTS.md — ask before any hard delete); archiving retires the
 * field from the picker while leaving every record intact. The `Restrict` on
 * `ServiceResultValue.definition` enforces the same thing at the database level.
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
};

export type ResultFieldDefinitionPage = {
  fields: ResultFieldDefinitionView[];
  nextCursor: string | null;
  totalResults: number;
};

function toView(
  definition: ResultFieldDefinition,
  usageCount: number,
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
  };
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

  const [totalResults, rows, usage] = await Promise.all([
    prisma.resultFieldDefinition.count({ where }),
    prisma.resultFieldDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    usageByKey(),
  ]);

  const page = takePage(rows, query.limit);

  return {
    fields: page.rows.map((row) => toView(row, usage.get(row.key) ?? 0)),
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

  return toView(definition, 0);
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

  const usage = await usageByKey();
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

  return toView(definition, usageCount);
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
