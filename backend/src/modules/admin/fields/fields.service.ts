import { Prisma, type FieldDefinition } from '@prisma/client';

import type { AuthContext } from '../../../guards/auth-context.js';
import { AppError } from '../../../lib/app-error.js';
import { cursorArgs, takePage } from '../../../lib/pagination.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import {
  fieldConfigSchema,
  fieldRefsSchema,
  formStepRefsSchema,
  type FieldConfig,
} from '../../services/services.validation.js';
import { iso } from '../admin.views.js';
import type {
  CreateFieldInput,
  ListFieldsQuery,
  UpdateFieldInput,
} from './fields.validation.js';

/*
 * The field registry — the vocabulary every service form is built from. All
 * Prisma access for `FieldDefinition` lives here.
 *
 * Two rules give the registry its value, and both are enforced in this file
 * rather than left to the UI:
 *
 *   1. A key is immutable. Answers are stored under it, so renaming one would
 *      orphan every answer already recorded. The update input carries no key at
 *      all, so this is mostly structural — `usageOf` exists for the second rule.
 *
 *   2. A field's TYPE may not change once a service references it. Switching a
 *      live text question to a dropdown would invalidate every answer already
 *      given, and the orders module validates a select's value against its
 *      options — so previously-valid answers would start failing.
 *
 * Deleting is not offered: a field a historical order holds an answer for must
 * stay resolvable (AGENTS.md — ask before any hard delete). Archiving retires it
 * from the picker while leaving every existing form and answer intact.
 */

export type FieldDefinitionView = {
  id: string;
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  hint?: string;
  category?: string;
  config: FieldConfig;
  archived: boolean;
  sortOrder: number;
  updatedAt: string;
  // How many catalog services currently ask this question. What makes the
  // management screen honest about the blast radius of an edit — and what the UI
  // reads to explain why a live field's type is locked.
  usageCount: number;
};

export type FieldDefinitionPage = {
  fields: FieldDefinitionView[];
  nextCursor: string | null;
  totalResults: number;
};

function toView(
  definition: FieldDefinition,
  usageCount: number,
): FieldDefinitionView {
  const parsed = fieldConfigSchema.safeParse(definition.config ?? {});

  return {
    id: definition.id,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    ...(definition.placeholder ? { placeholder: definition.placeholder } : {}),
    ...(definition.hint ? { hint: definition.hint } : {}),
    ...(definition.category ? { category: definition.category } : {}),
    config: parsed.success ? parsed.data : {},
    archived: definition.archived,
    sortOrder: definition.sortOrder,
    updatedAt: iso(definition.updatedAt),
    usageCount,
  };
}

/*
 * Strip config keys that don't belong to the field's type, so a field switched
 * from select to text can't keep carrying options a later reader might act on.
 */
function configFor(type: string, config: FieldConfig | undefined): FieldConfig {
  if (!config) return {};

  switch (type) {
    case 'select':
      return config.options ? { options: config.options } : {};
    case 'textarea':
      return config.rows !== undefined ? { rows: config.rows } : {};
    case 'file':
      return {
        ...(config.accept?.length ? { accept: config.accept } : {}),
        ...(config.maxSizeMb !== undefined ? { maxSizeMb: config.maxSizeMb } : {}),
        ...(config.multiple ? { multiple: true } : {}),
      };
    default:
      return {};
  }
}

/*
 * How many services reference each key.
 *
 * The references live in two Json columns, so this counts them in memory rather
 * than through a Json query: the catalog is a small, admin-curated table (tens of
 * rows), and an index-less Json probe across two columns would be both slower and
 * far harder to keep honest as the stored shape evolves.
 */
async function usageByKey(): Promise<Map<string, number>> {
  const services = await prisma.service.findMany({
    where: { deletedAt: null },
    select: { detailFields: true, formSteps: true },
  });

  const counts = new Map<string, number>();

  for (const service of services) {
    // A service asking the same field in both its flat list and a step counts
    // once — this is "how many services ask it", not "how many references exist".
    const keys = new Set<string>();

    const flat = fieldRefsSchema.safeParse(service.detailFields ?? []);
    if (flat.success) for (const ref of flat.data) keys.add(ref.fieldKey);

    const steps = formStepRefsSchema.safeParse(service.formSteps ?? []);
    if (steps.success) {
      for (const step of steps.data) {
        for (const ref of step.fields) keys.add(ref.fieldKey);
      }
    }

    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export async function listFields(
  query: ListFieldsQuery,
): Promise<FieldDefinitionPage> {
  const where: Prisma.FieldDefinitionWhereInput = {
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
    prisma.fieldDefinition.count({ where }),
    prisma.fieldDefinition.findMany({
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

export async function createField(
  actor: AuthContext,
  input: CreateFieldInput,
): Promise<FieldDefinitionView> {
  const existing = await prisma.fieldDefinition.findUnique({
    where: { key: input.key },
  });

  // A duplicate key is a conflict, not a silent merge: the admin is registering
  // a question that already exists and should be told to reuse it.
  if (existing) {
    throw AppError.conflict(`A field with the key "${input.key}" already exists`);
  }

  const last = await prisma.fieldDefinition.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const definition = await prisma.fieldDefinition.create({
    data: {
      key: input.key,
      label: input.label,
      type: input.type,
      placeholder: input.placeholder || null,
      hint: input.hint || null,
      category: input.category || null,
      config: configFor(input.type, input.config),
      archived: input.archived ?? false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  void record({
    actor,
    action: AuditAction.FIELD_CREATED,
    entityType: 'FieldDefinition',
    entityId: definition.id,
    metadata: { key: definition.key, type: definition.type },
  });

  return toView(definition, 0);
}

export async function updateField(
  actor: AuthContext,
  fieldId: string,
  input: UpdateFieldInput,
): Promise<FieldDefinitionView> {
  const existing = await prisma.fieldDefinition.findUnique({
    where: { id: fieldId },
  });

  if (!existing) throw AppError.notFound('Field not found');

  const usage = await usageByKey();
  const usageCount = usage.get(existing.key) ?? 0;

  /*
   * Rule 2: a live field's type is frozen. Every answer already recorded was
   * given against the old control, and the orders module validates a select's
   * value against its options — so a type change would retroactively invalidate
   * answers that were correct when they were given.
   */
  if (input.type && input.type !== existing.type && usageCount > 0) {
    throw AppError.businessRule(
      `"${existing.label}" is used by ${usageCount} service${usageCount === 1 ? '' : 's'}, so its type can no longer be changed. Register a new field instead.`,
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
            fieldConfigSchema.safeParse(existing.config ?? {}).data,
        );

  const definition = await prisma.fieldDefinition.update({
    where: { id: fieldId },
    data: {
      ...(input.label === undefined ? {} : { label: input.label }),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.placeholder === undefined
        ? {}
        : { placeholder: input.placeholder || null }),
      ...(input.hint === undefined ? {} : { hint: input.hint || null }),
      ...(input.category === undefined
        ? {}
        : { category: input.category || null }),
      ...(config === undefined ? {} : { config }),
      ...(input.archived === undefined ? {} : { archived: input.archived }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    },
  });

  void record({
    actor,
    action: AuditAction.FIELD_UPDATED,
    entityType: 'FieldDefinition',
    entityId: definition.id,
    // What changed, not the whole payload.
    metadata: { key: definition.key, fields: Object.keys(input), usageCount },
  });

  return toView(definition, usageCount);
}

/*
 * The keys a set of references may point at. The catalog's write path calls this
 * to reject a form referencing a field that isn't registered — the registry is
 * only a closed set if the service layer enforces it.
 */
export async function assertFieldsExist(keys: readonly string[]): Promise<void> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return;

  const found = await prisma.fieldDefinition.findMany({
    where: { key: { in: unique } },
    select: { key: true },
  });

  const known = new Set(found.map((definition) => definition.key));
  const unknown = unique.filter((key) => !known.has(key));

  if (unknown.length > 0) {
    throw AppError.validation('Unknown field key', { fieldKeys: unknown });
  }
}
