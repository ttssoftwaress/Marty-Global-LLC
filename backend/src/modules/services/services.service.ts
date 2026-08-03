import type { FieldDefinition, Service } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  fieldConfigSchema,
  fieldRefsSchema,
  formStepRefsSchema,
  serviceFooterSchema,
  MAX_FIELD_DEPENDENCY_DEPTH,
  type FieldOption,
  type FieldRef,
  type ServiceField,
  type ServiceFormStep,
} from './services.validation.js';

/*
 * The service catalog (AGENTS.md: the backend owns the catalog). All Prisma
 * access lives here; the controller only shapes the response.
 *
 * A service stores its form as REFERENCES into the field registry
 * (`{ fieldKey, required? }`), never as inline field definitions. This module is
 * where those references are resolved: the registry supplies the label, control
 * type, and per-type config, and the reference supplies only whether this
 * service requires an answer.
 *
 * Resolving here — rather than in either frontend — means both apps keep
 * rendering the exact field shape they already did, and re-labelling a question
 * in the registry updates every service that asks it with no other change.
 */

export type CatalogService = {
  id: string;
  iconKey: string;
  name: string;
  shortName?: string;
  description: string;
  features: string[];
  footer: { label: string; chips?: string[] };
  detailFields: ServiceField[];
  formSteps?: ServiceFormStep[];
};

/*
 * A registered field plus one service's `required` flag → the field shape both
 * frontends render.
 *
 * The per-type config is read through the field's own type, so a `select` gets
 * its options and a `file` gets its upload settings while neither can inherit a
 * stray key the other left behind. A select whose options went missing is
 * dropped by the caller rather than rendered as an unanswerable empty dropdown.
 */
function resolveField(
  definition: FieldDefinition,
  required: boolean,
): ServiceField | null {
  const parsed = fieldConfigSchema.safeParse(definition.config ?? {});
  const config = parsed.success ? parsed.data : {};

  const base = {
    name: definition.key,
    label: definition.label,
    ...(required ? { required: true } : {}),
    ...(definition.placeholder ? { placeholder: definition.placeholder } : {}),
    ...(definition.hint ? { hint: definition.hint } : {}),
  };

  switch (definition.type) {
    case 'select': {
      // A dropdown with no choices cannot be answered; skip it rather than
      // render a control that can never be satisfied.
      if (!config.options?.length) {
        logger.warn(
          { fieldKey: definition.key },
          'Select field has no options — omitted from the form',
        );
        return null;
      }
      return {
        ...base,
        type: 'select',
        options: config.options,
        // Present only on a dependent dropdown; the registry guarantees the key
        // names another registered select.
        ...(config.dependsOn ? { dependsOn: config.dependsOn } : {}),
      };
    }
    case 'textarea':
      return {
        ...base,
        type: 'textarea',
        ...(config.rows !== undefined ? { rows: config.rows } : {}),
      };
    case 'file':
      return {
        ...base,
        type: 'file',
        ...(config.accept?.length ? { accept: config.accept } : {}),
        ...(config.maxSizeMb !== undefined ? { maxSizeMb: config.maxSizeMb } : {}),
        ...(config.multiple ? { multiple: true } : {}),
      };
    case 'text':
      return { ...base, type: 'text' };
    default:
      // A type this build doesn't know is an unrecognised row, not a reason to
      // fail the catalog — omit the question and let the log surface it.
      logger.warn(
        { fieldKey: definition.key, type: definition.type },
        'Unknown field type — omitted from the form',
      );
      return null;
  }
}

// Resolve a list of references against the registry, preserving the admin's
// order. A reference whose definition is missing or archived-away is skipped —
// the form renders what still exists rather than a blank row.
function resolveRefs(
  refs: FieldRef[],
  registry: Map<string, FieldDefinition>,
): ServiceField[] {
  const fields: ServiceField[] = [];

  for (const ref of refs) {
    const definition = registry.get(ref.fieldKey);
    if (!definition) {
      logger.warn(
        { fieldKey: ref.fieldKey },
        'Service references a field that is not in the registry — skipped',
      );
      continue;
    }

    const field = resolveField(definition, Boolean(ref.required));
    if (field) fields.push(field);
  }

  return fields;
}

/*
 * The parent, if this field is a dependent dropdown.
 *
 * One reader rather than the `type === 'select' && field.dependsOn` test spelled
 * out at each site — the union means a `text` field has no `dependsOn` property
 * at all, so every call site would otherwise repeat the narrowing.
 */
export function parentFieldKey(field: ServiceField): string | undefined {
  return field.type === 'select' ? field.dependsOn : undefined;
}

/*
 * The keys of every dependent dropdown on a form whose parent the form doesn't
 * ask, including the ones orphaned by that removal further down the chain.
 *
 * A dependent dropdown offers nothing until its parent is answered, so a form
 * carrying the child without the parent renders a control the customer can never
 * open — the same unanswerable question as a select with no choices. The
 * catalog's write path refuses to store such a form; a form that reaches here
 * with one lost its parent afterwards, in the registry or in a later edit.
 *
 * Computed across the WHOLE service, not per step: a chain is routinely split
 * across screens (country on the first, state on the second), and judging a step
 * on its own would break exactly the arrangement the feature is for.
 */
export function orphanedDependents(fields: ServiceField[]): Set<string> {
  const orphaned = new Set<string>();

  // Iterated to a fixed point — dropping a parent orphans its own children, and
  // a chain runs several levels deep.
  for (;;) {
    const present = new Set(
      fields
        .filter((field) => !orphaned.has(field.name))
        .map((field) => field.name),
    );

    const found = fields.filter((field) => {
      if (orphaned.has(field.name)) return false;
      const parent = parentFieldKey(field);
      return parent !== undefined && !present.has(parent);
    });

    if (found.length === 0) return orphaned;

    for (const field of found) {
      logger.warn(
        { fieldKey: field.name, dependsOn: parentFieldKey(field) },
        'Dependent field has no parent on this form — omitted',
      );
      orphaned.add(field.name);
    }
  }
}

/*
 * The choices a dependent dropdown offers for a given set of answers.
 *
 * The one definition of the cascade rule, shared by every layer that needs it:
 * with the parent unanswered a dependent dropdown offers NOTHING (which is what
 * keeps a state list from showing before a country is picked), and once answered
 * it offers the choices scoped to that answer plus any choice scoped to none.
 *
 * An independent dropdown returns its full list, so callers never branch.
 */
export function visibleOptions(
  field: Extract<ServiceField, { type: 'select' }>,
  answers: Record<string, string>,
): FieldOption[] {
  if (!field.dependsOn) return field.options;

  const parentValue = (answers[field.dependsOn] ?? '').trim();
  if (!parentValue) return [];

  return field.options.filter(
    (option) => !option.when || option.when.includes(parentValue),
  );
}

/*
 * A form's questions with every parent ahead of its children.
 *
 * Answer validation has to read a parent's validated answer before it can decide
 * which choices its child may take, and the order a form was authored in is only
 * guaranteed within one list — a service's flat list and its steps are unioned,
 * and a merged master form interleaves several services. Sorting here means the
 * validator never depends on how the admin happened to arrange the screens.
 *
 * Stable: a field with no parent, or one whose parent isn't on this form, keeps
 * its original position relative to its siblings.
 */
export function orderByDependency(fields: ServiceField[]): ServiceField[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const ordered: ServiceField[] = [];
  const placed = new Set<string>();

  const place = (field: ServiceField, depth: number) => {
    if (placed.has(field.name)) return;

    // The registry rejects cycles and over-deep chains on write; the guard is
    // here so a row that predates that check cannot spin this loop.
    if (depth <= MAX_FIELD_DEPENDENCY_DEPTH) {
      const parentKey = parentFieldKey(field);
      const parent = parentKey ? byName.get(parentKey) : undefined;
      if (parent) place(parent, depth + 1);
    }

    if (placed.has(field.name)) return;
    placed.add(field.name);
    ordered.push(field);
  };

  for (const field of fields) place(field, 0);

  return ordered;
}

// Every field key a set of service rows references, so the registry can be
// loaded in one query rather than per service.
function referencedKeys(services: Service[]): string[] {
  const keys = new Set<string>();

  for (const service of services) {
    const flat = fieldRefsSchema.safeParse(service.detailFields ?? []);
    if (flat.success) for (const ref of flat.data) keys.add(ref.fieldKey);

    const steps = formStepRefsSchema.safeParse(service.formSteps ?? []);
    if (steps.success) {
      for (const step of steps.data) {
        for (const ref of step.fields) keys.add(ref.fieldKey);
      }
    }
  }

  return [...keys];
}

async function loadRegistry(
  services: Service[],
): Promise<Map<string, FieldDefinition>> {
  const keys = referencedKeys(services);
  if (keys.length === 0) return new Map();

  // Archived definitions are still resolved: a live service referencing one must
  // keep rendering it. Archiving removes a field from the PICKER, not from the
  // forms that already use it.
  const definitions = await prisma.fieldDefinition.findMany({
    where: { key: { in: keys } },
  });

  return new Map(definitions.map((definition) => [definition.key, definition]));
}

/*
 * Parse a Service row's Json columns and resolve its form against the registry.
 * A row whose stored shape is malformed shouldn't take the whole catalog down,
 * so its footer/form fall back to safe defaults and the problem is logged for an
 * admin to fix (the row is admin-authored, so a bad shape is an editing bug).
 */
function toCatalogService(
  service: Service,
  registry: Map<string, FieldDefinition>,
): CatalogService {
  const footer = serviceFooterSchema.safeParse(service.footer);
  const flat = fieldRefsSchema.safeParse(service.detailFields ?? []);
  const steps = formStepRefsSchema.safeParse(service.formSteps ?? []);

  if (!footer.success || !flat.success || !steps.success) {
    logger.warn(
      { serviceId: service.id },
      'Service row has a malformed footer/detailFields/formSteps shape — using fallback',
    );
  }

  const resolvedSteps = (steps.success ? steps.data : []).map((step) => ({
    key: step.key,
    title: step.title,
    ...(step.description ? { description: step.description } : {}),
    fields: resolveRefs(step.fields, registry),
  }));

  const detailFields = resolveRefs(flat.success ? flat.data : [], registry);

  // Judged across the flat list and every step together, so a chain the admin
  // split over two screens survives and only a genuinely parentless dropdown
  // goes.
  const orphaned = orphanedDependents([
    ...resolvedSteps.flatMap((step) => step.fields),
    ...detailFields,
  ]);

  const keep = (fields: ServiceField[]) =>
    orphaned.size === 0
      ? fields
      : fields.filter((field) => !orphaned.has(field.name));

  const formSteps: ServiceFormStep[] = resolvedSteps.map((step) => ({
    ...step,
    fields: keep(step.fields),
  }));

  return {
    id: service.id,
    iconKey: service.iconKey,
    name: service.name,
    shortName: service.shortName ?? undefined,
    description: service.description,
    features: service.features,
    footer: footer.success ? footer.data : { label: '' },
    detailFields: keep(detailFields),
    ...(formSteps.length > 0 ? { formSteps } : {}),
  };
}

// The catalog the Step 1 screen renders: active services only, in display order.
export async function getCatalog(): Promise<CatalogService[]> {
  const services = await prisma.service.findMany({
    where: { active: true, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const registry = await loadRegistry(services);
  return services.map((service) => toCatalogService(service, registry));
}

// Loads the active services for a set of ids, keyed by id, for the orders module
// to resolve a selection against. Returns only the services that exist and are
// active — the caller decides how to treat any missing ids.
export async function getActiveServicesByIds(
  ids: string[],
): Promise<Map<string, CatalogService>> {
  if (ids.length === 0) return new Map();

  const services = await prisma.service.findMany({
    where: { id: { in: ids }, active: true, deletedAt: null },
  });

  const registry = await loadRegistry(services);

  return new Map(
    services.map((service) => [service.id, toCatalogService(service, registry)]),
  );
}

/*
 * The registry entries for a set of answer keys, resolved to the field shape
 * every screen renders.
 *
 * This is how a stored order reads its own answers back: `OrderItem.answers` is
 * keyed by `FieldDefinition.key`, so the labels and option labels an order
 * displays come from the registry rather than from a copy frozen on the service.
 * Re-labelling a question therefore updates how every past order reads too,
 * which is the intended behaviour — it is the same question, worded better.
 *
 * Archived definitions resolve like any other: a historical order must stay
 * readable after its question has been retired from the picker.
 */
export async function fieldsByKey(
  keys: string[],
): Promise<Map<string, ServiceField>> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return new Map();

  const definitions = await prisma.fieldDefinition.findMany({
    where: { key: { in: unique } },
  });

  const resolved = new Map<string, ServiceField>();
  for (const definition of definitions) {
    // `required` is a per-service flag and means nothing when reading an answer
    // back, so it is false here.
    const field = resolveField(definition, false);
    if (field) resolved.set(definition.key, field);
  }

  return resolved;
}

/*
 * Every question a service asks, whichever shape it was authored in.
 *
 * The stepped and flat forms are two views of one set of questions: a stepped
 * service's `detailFields` is written as the flattened union of its steps, but a
 * service edited only through the flat surface has no steps at all. Taking the
 * union of both — de-duplicated by field name, steps first so their richer
 * definition wins — means answer validation can never miss a question just
 * because of how the admin happened to author it.
 */
export function serviceQuestions(service: CatalogService): ServiceField[] {
  const byName = new Map<string, ServiceField>();

  for (const field of service.formSteps?.flatMap((step) => step.fields) ?? []) {
    if (!byName.has(field.name)) byName.set(field.name, field);
  }
  for (const field of service.detailFields) {
    if (!byName.has(field.name)) byName.set(field.name, field);
  }

  return [...byName.values()];
}
