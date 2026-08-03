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
  MAX_FIELD_DEPENDENCY_DEPTH,
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
 *   3. A field ANYTHING has ever referenced cannot be deleted. Deleting one is
 *      offered — a question registered by mistake should be removable rather
 *      than sitting archived forever — but it only ever reaches the write when
 *      no service form, no request type, no stored answer, and no dependent
 *      dropdown points at the key. Everything else is archived, which retires it
 *      from the picker while leaving every existing form and answer intact.
 *
 *   4. A dependency is a real edge, checked on both ends. A dropdown whose
 *      choices are filtered by another field's answer (`config.dependsOn`) can
 *      only point at a registered SELECT, never at itself, and never around a
 *      cycle; every choice's `when` must name a value that parent actually
 *      offers. The parent, in return, cannot change type, lose one of those
 *      values, or be deleted while a child is reading it. Without both halves a
 *      "country → state → address" chain silently degrades into a dropdown that
 *      offers nothing, which looks to a customer exactly like a broken form.
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
  /*
   * Whether removing this field outright is available at all. False the moment
   * any service form or request type references the key (`isDeletable`);
   * `deleteField` runs that same check plus stored answers, because a field
   * dropped from a form after orders were placed has a usage count of zero and
   * answers behind it.
   */
  canDelete: boolean;
  /*
   * The keys of the dropdowns filtered by this field's answer. Empty on almost
   * every field; on a "Country" it names its "State", which is what the screen
   * prints so an admin can see the chain before editing a link in it.
   */
  dependentKeys: string[];
};

export type FieldDefinitionPage = {
  fields: FieldDefinitionView[];
  nextCursor: string | null;
  totalResults: number;
};

function toView(
  definition: FieldDefinition,
  usageCount: number,
  canDelete: boolean,
  dependentKeys: string[] = [],
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
    canDelete,
    dependentKeys,
  };
}

/*
 * The one expression of the cheap half of rule 3 — "removing this outright is
 * still on offer" as the list and the update response can answer it.
 *
 * Written once because the same predicate spelled out at each call site is the
 * drift that lets a visible button meet a refused call. `deleteField` adds the
 * stored-answer check on top: a field dropped from every form after orders were
 * placed has a usage count of zero and answers behind it, and only the delete
 * path pays for that query.
 */
function isDeletable(
  usageCount: number,
  inRequestType: boolean,
  dependentCount: number,
): boolean {
  return usageCount === 0 && !inRequestType && dependentCount === 0;
}

/*
 * Strip config keys that don't belong to the field's type, so a field switched
 * from select to text can't keep carrying options a later reader might act on.
 */
function configFor(type: string, config: FieldConfig | undefined): FieldConfig {
  if (!config) return {};

  switch (type) {
    case 'select':
      return config.options
        ? {
            options: config.options,
            ...(config.dependsOn ? { dependsOn: config.dependsOn } : {}),
          }
        : {};
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

/*
 * The keys the follow-up request forms reference — the second place a service
 * points at this registry, `ServiceRequestType.fields` holding the same
 * `{ fieldKey }` shape.
 *
 * Read separately rather than folded into `usageByKey`, because the "Used by"
 * column answers a narrower question — how many services ASK this on their order
 * form — and a request type is not that. It still has to block a delete, so it
 * is counted here. Small, admin-curated table; same in-memory reasoning as above.
 */
async function requestTypeKeys(): Promise<Set<string>> {
  const types = await prisma.serviceRequestType.findMany({
    where: { deletedAt: null },
    select: { fields: true },
  });

  const keys = new Set<string>();

  for (const type of types) {
    const refs = fieldRefsSchema.safeParse(type.fields ?? []);
    if (refs.success) for (const ref of refs.data) keys.add(ref.fieldKey);
  }

  return keys;
}

// --- Dependencies ---------------------------------------------------------

type Dependency = { key: string; label: string; dependsOn?: string };

function configOf(definition: Pick<FieldDefinition, 'config'>): FieldConfig {
  const parsed = fieldConfigSchema.safeParse(definition.config ?? {});
  return parsed.success ? parsed.data : {};
}

/*
 * Every field that declares a parent, as a flat edge list.
 *
 * `config.dependsOn` lives in a Json column, so this reads the handful of select
 * rows and unpacks them in memory rather than through an index-less Json probe —
 * the same reasoning as `usageByKey` above, and it gives the whole graph in one
 * query for the cycle walk to reuse.
 */
async function dependencyEdges(): Promise<Dependency[]> {
  const rows = await prisma.fieldDefinition.findMany({
    where: { type: 'select' },
    select: { key: true, label: true, config: true },
  });

  return rows.map((row) => {
    const dependsOn = configOf(row).dependsOn;
    return {
      key: row.key,
      label: row.label,
      ...(dependsOn ? { dependsOn } : {}),
    };
  });
}

// The fields whose choices are filtered by this key's answer, in one edge list
// so the caller pays for the query once.
function dependentsOf(edges: Dependency[], key: string): Dependency[] {
  return edges.filter((edge) => edge.dependsOn === key);
}

/*
 * Rule 4's write-side check: a dependency must point at a registered dropdown,
 * up a chain that terminates, and every choice must name a value that parent
 * actually offers.
 *
 * `key` is the field being written. It may not exist yet (create), which is
 * exactly why the cycle walk starts at the parent and looks for `key` on the way
 * up rather than trusting the stored graph to already contain the new edge.
 */
async function assertDependencyIsSound(
  key: string,
  config: FieldConfig,
): Promise<void> {
  const parentKey = config.dependsOn;
  if (!parentKey) return;

  if (parentKey === key) {
    throw AppError.validation('A field cannot depend on itself', {
      fieldKey: key,
    });
  }

  const parent = await prisma.fieldDefinition.findUnique({
    where: { key: parentKey },
  });

  if (!parent) {
    throw AppError.validation(
      `"${parentKey}" is not a registered field, so this dropdown cannot depend on it`,
      { fieldKey: key, dependsOn: parentKey },
    );
  }

  if (parent.type !== 'select') {
    throw AppError.businessRule(
      `"${parent.label}" is not a dropdown, so its answer cannot filter this field's choices. Depend on a dropdown instead.`,
      { fieldKey: key, dependsOn: parentKey },
    );
  }

  const edges = await dependencyEdges();
  const byKey = new Map(edges.map((edge) => [edge.key, edge]));

  // Walk from the parent to the root. Reaching `key` means the new edge closes a
  // loop; running past the cap means the chain is longer than a customer could
  // reasonably be asked to fill in.
  let cursor: string | undefined = parentKey;
  for (let depth = 1; cursor; depth += 1) {
    if (cursor === key) {
      throw AppError.businessRule(
        `Depending on "${parent.label}" would make these fields depend on each other in a loop`,
        { fieldKey: key, dependsOn: parentKey },
      );
    }

    if (depth > MAX_FIELD_DEPENDENCY_DEPTH) {
      throw AppError.businessRule(
        `A dropdown can sit at most ${MAX_FIELD_DEPENDENCY_DEPTH} levels below the top of its chain`,
        { fieldKey: key, dependsOn: parentKey },
      );
    }

    cursor = byKey.get(cursor)?.dependsOn;
  }

  const parentValues = new Set(
    (configOf(parent).options ?? []).map((option) => option.value),
  );

  const unknown = [
    ...new Set(
      (config.options ?? []).flatMap((option) =>
        (option.when ?? []).filter((value) => !parentValues.has(value)),
      ),
    ),
  ];

  if (unknown.length > 0) {
    throw AppError.validation(
      `"${parent.label}" does not offer ${unknown.map((value) => `"${value}"`).join(', ')}, so no choice can be scoped to it`,
      { fieldKey: key, dependsOn: parentKey, unknownValues: unknown },
    );
  }
}

/*
 * Rule 4's other half: what this field's own children still need from it.
 *
 * Removing a choice from a parent orphans every child choice scoped to it, and
 * the orphan is invisible — the child simply stops offering those options for an
 * answer nobody can give any more. Refused with the values named, so the fix is
 * "edit the child first" rather than a form that quietly went half-empty.
 */
async function assertDependentsStillFit(
  existing: FieldDefinition,
  nextType: string,
  nextConfig: FieldConfig | undefined,
): Promise<void> {
  const edges = await dependencyEdges();
  const dependents = dependentsOf(edges, existing.key);
  if (dependents.length === 0) return;

  const names = dependents.map((child) => `"${child.label}"`).join(', ');

  if (nextType !== 'select') {
    throw AppError.businessRule(
      `${names} filter${dependents.length === 1 ? 's' : ''} its choices by this field's answer, so it must stay a dropdown. Change ${dependents.length === 1 ? 'that field' : 'those fields'} first.`,
      { fieldKey: existing.key, dependents: dependents.map((d) => d.key) },
    );
  }

  if (!nextConfig?.options) return;

  const nextValues = new Set(nextConfig.options.map((option) => option.value));

  for (const child of dependents) {
    const definition = await prisma.fieldDefinition.findUnique({
      where: { key: child.key },
      select: { config: true },
    });

    const orphaned = [
      ...new Set(
        (configOf(definition ?? { config: null }).options ?? []).flatMap(
          (option) => (option.when ?? []).filter((value) => !nextValues.has(value)),
        ),
      ),
    ];

    if (orphaned.length > 0) {
      throw AppError.businessRule(
        `"${child.label}" still has choices scoped to ${orphaned.map((value) => `"${value}"`).join(', ')}, so removing ${orphaned.length === 1 ? 'that choice' : 'those choices'} would leave them unreachable. Edit "${child.label}" first.`,
        { fieldKey: existing.key, dependent: child.key, orphanedValues: orphaned },
      );
    }
  }
}

/*
 * Whether any customer answer is stored under this key.
 *
 * `OrderItem.answers` and `ServiceRequest.answers` are Json objects keyed by
 * `FieldDefinition.key`, so this asks Postgres whether the key is present rather
 * than reading the blobs back. Called only when a delete is actually attempted:
 * a field dropped from a form after orders were placed has a usage count of zero
 * and answers sitting behind it, and that is the one case the cheap check the
 * list runs cannot see.
 */
async function hasStoredAnswers(key: string): Promise<boolean> {
  const [orderItems, requests] = await Promise.all([
    prisma.orderItem.count({
      where: { answers: { path: [key], not: Prisma.DbNull } },
    }),
    prisma.serviceRequest.count({
      where: { answers: { path: [key], not: Prisma.DbNull } },
    }),
  ]);

  return orderItems + requests > 0;
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

  const [totalResults, rows, usage, requestKeys, edges] = await Promise.all([
    prisma.fieldDefinition.count({ where }),
    prisma.fieldDefinition.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      ...cursorArgs(query.cursor, query.limit),
    }),
    usageByKey(),
    requestTypeKeys(),
    dependencyEdges(),
  ]);

  const page = takePage(rows, query.limit);

  return {
    fields: page.rows.map((row) => {
      const usageCount = usage.get(row.key) ?? 0;
      const dependents = dependentsOf(edges, row.key).map((child) => child.key);
      return toView(
        row,
        usageCount,
        isDeletable(usageCount, requestKeys.has(row.key), dependents.length),
        dependents,
      );
    }),
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

  const config = configFor(input.type, input.config);
  await assertDependencyIsSound(input.key, config);

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
      config,
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

  // Nothing can reference a field that did not exist a moment ago.
  return toView(definition, 0, true, []);
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

  const [usage, requestKeys] = await Promise.all([usageByKey(), requestTypeKeys()]);
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

  // Rule 4, both directions: what this field may point at, and what the fields
  // pointing at it still need from it. Checked before the write so a refusal
  // leaves the chain exactly as it was.
  if (config !== undefined) {
    await assertDependencyIsSound(existing.key, config);
    await assertDependentsStillFit(existing, type, config);
  } else if (input.type !== undefined) {
    await assertDependentsStillFit(existing, type, undefined);
  }

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

  const dependents = dependentsOf(await dependencyEdges(), definition.key).map(
    (child) => child.key,
  );

  return toView(
    definition,
    usageCount,
    isDeletable(usageCount, requestKeys.has(definition.key), dependents.length),
    dependents,
  );
}

/*
 * Remove a registered question outright — rule 3 above.
 *
 * A hard delete, unlike the catalog's own, and deliberately: a `FieldDefinition`
 * is configuration rather than a customer-facing record, so once nothing points
 * at it there is nothing to retain. The guard is what makes that safe, and it is
 * checked here rather than trusted from the UI — every place a key can be
 * referenced is counted before the row goes.
 *
 * A field that fails any of those checks is archived instead, which is the same
 * outcome the admin wanted (it leaves the picker) without orphaning the answers
 * already given under it (AGENTS.md — ask before any hard delete).
 */
export async function deleteField(
  actor: AuthContext,
  fieldId: string,
): Promise<{ id: string }> {
  const existing = await prisma.fieldDefinition.findUnique({
    where: { id: fieldId },
  });

  if (!existing) throw AppError.notFound('Field not found');

  const [usage, requestKeys, hasAnswers, edges] = await Promise.all([
    usageByKey(),
    requestTypeKeys(),
    hasStoredAnswers(existing.key),
    dependencyEdges(),
  ]);

  const usageCount = usage.get(existing.key) ?? 0;
  const inRequestType = requestKeys.has(existing.key);
  const dependents = dependentsOf(edges, existing.key);

  if (!isDeletable(usageCount, inRequestType, dependents.length) || hasAnswers) {
    const reason = hasAnswers
      ? 'customers have already answered it'
      : usageCount > 0
        ? `${usageCount} service${usageCount === 1 ? '' : 's'} still ask${usageCount === 1 ? 's' : ''} it`
        : dependents.length > 0
          ? `${dependents.map((child) => `"${child.label}"`).join(', ')} filter${dependents.length === 1 ? 's' : ''} its choices by this field's answer`
          : 'a service request form still asks it';

    throw AppError.businessRule(
      `"${existing.label}" cannot be deleted because ${reason}. Archive it instead — it leaves the picker and every form and answer already using it keeps working.`,
      {
        fieldKey: existing.key,
        usageCount,
        inRequestType,
        hasAnswers,
        dependents: dependents.map((child) => child.key),
      },
    );
  }

  await prisma.fieldDefinition.delete({ where: { id: fieldId } });

  void record({
    actor,
    action: AuditAction.FIELD_DELETED,
    entityType: 'FieldDefinition',
    entityId: fieldId,
    metadata: { key: existing.key, type: existing.type },
  });

  return { id: fieldId };
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

/*
 * A form may only ask a dependent dropdown if it also asks its parent, EARLIER.
 *
 * This is the rule that makes the cascade legible on the customer's side. A
 * dependent dropdown offers nothing until its parent is answered, so a form
 * asking "Address" without "State" is a control the customer can never open, and
 * one asking it above "State" is a control that sits dead until they scroll back
 * up. Both are authoring mistakes, and both are far cheaper to refuse here than
 * to explain from a support ticket.
 *
 * `keys` is the form in reading order — a flat list as stored, or the steps
 * flattened in step order, since a customer meets the screens in that sequence.
 * A chain split across two steps is fine as long as the parent's step comes
 * first.
 */
export async function assertDependenciesSatisfied(
  keys: readonly string[],
): Promise<void> {
  if (keys.length === 0) return;

  const definitions = await prisma.fieldDefinition.findMany({
    where: { key: { in: [...new Set(keys)] }, type: 'select' },
    select: { key: true, label: true, config: true },
  });

  const parents = new Map(
    definitions.map((definition) => [definition.key, configOf(definition).dependsOn]),
  );
  const labels = new Map(
    definitions.map((definition) => [definition.key, definition.label]),
  );

  const seen = new Set<string>();

  for (const key of keys) {
    const parentKey = parents.get(key);

    if (parentKey && !seen.has(parentKey)) {
      const label = labels.get(key) ?? key;
      const parentLabel = await parentLabelFor(parentKey);

      throw AppError.validation(
        keys.includes(parentKey)
          ? `"${label}" only offers choices once ${parentLabel} is answered, so ${parentLabel} has to come before it on the form`
          : `"${label}" filters its choices by ${parentLabel}, so this form has to ask ${parentLabel} too`,
        { fieldKey: key, dependsOn: parentKey },
      );
    }

    seen.add(key);
  }
}

// The parent's registered label for the message above, falling back to its key
// if the parent was removed from the registry — the form is still wrong, and a
// bare key is more useful in that message than no name at all.
async function parentLabelFor(key: string): Promise<string> {
  const parent = await prisma.fieldDefinition.findUnique({
    where: { key },
    select: { label: true },
  });

  return parent ? `"${parent.label}"` : `"${key}"`;
}
