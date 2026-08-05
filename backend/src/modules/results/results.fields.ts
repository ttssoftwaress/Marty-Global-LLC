import type { ResultFieldDefinition, Service } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import {
  resultFieldConfigSchema,
  resultFieldRefsSchema,
  type ResultField,
  type ResultFieldRef,
} from './results.validation.js';

/*
 * Resolving a service's result schema against the result registry.
 *
 * The exact counterpart of `resolveField`/`resolveRefs` in
 * `services.service.ts`, and split into its own file because both the customer
 * module and three admin modules need it — putting it in either service would
 * make one import the other for a pure function.
 *
 * The rules it inherits from the request registry, unchanged:
 *   - an archived definition still resolves (a delivered record must stay
 *     readable after its field is retired from the picker)
 *   - a reference to a key that no longer exists is skipped, not rendered blank
 *   - a choice-type field with no choices is dropped rather than rendered
 *     unanswerable
 */

/*
 * A registered definition plus one service's overrides → the field shape both
 * frontends render.
 *
 * `isPrimary` and `showInList` fall back to the definition's own defaults when
 * the reference doesn't override them, which is what makes a well-flagged
 * registry entry pay off across every service that picks it.
 */
export function resolveResultField(
  definition: ResultFieldDefinition,
  ref: Pick<ResultFieldRef, 'required' | 'isPrimary' | 'showInList'>,
): ResultField | null {
  const parsed = resultFieldConfigSchema.safeParse(definition.config ?? {});
  const config = parsed.success ? parsed.data : {};

  const isPrimary = ref.isPrimary ?? definition.isPrimary;
  const showInList = ref.showInList ?? definition.showInList;

  const base = {
    name: definition.key,
    label: definition.label,
    ...(ref.required ? { required: true } : {}),
    ...(definition.hint ? { hint: definition.hint } : {}),
    ...(definition.category ? { category: definition.category } : {}),
    ...(isPrimary ? { isPrimary: true } : {}),
    // The primary value titles the record, so it is always a list column —
    // otherwise the table's first column would be empty for that service.
    ...(showInList || isPrimary ? { showInList: true } : {}),
  };

  switch (definition.type) {
    case 'text':
      return { ...base, type: 'text' };
    case 'url':
      return { ...base, type: 'url' };
    case 'textarea':
      return {
        ...base,
        type: 'textarea',
        ...(config.rows !== undefined ? { rows: config.rows } : {}),
      };
    case 'date':
      return {
        ...base,
        type: 'date',
        ...(config.withTime ? { withTime: true } : {}),
      };
    case 'number':
      return {
        ...base,
        type: 'number',
        ...(config.prefix ? { prefix: config.prefix } : {}),
        ...(config.suffix ? { suffix: config.suffix } : {}),
        ...(config.decimals !== undefined ? { decimals: config.decimals } : {}),
      };
    case 'file':
      return {
        ...base,
        type: 'file',
        ...(config.accept?.length ? { accept: config.accept } : {}),
        ...(config.maxSizeMb !== undefined ? { maxSizeMb: config.maxSizeMb } : {}),
      };
    case 'select': {
      if (!config.options?.length) {
        logger.warn(
          { fieldKey: definition.key },
          'Result select field has no options — omitted from the schema',
        );
        return null;
      }
      return { ...base, type: 'select', options: config.options };
    }
    case 'status': {
      if (!config.statusOptions?.length) {
        logger.warn(
          { fieldKey: definition.key },
          'Result status field has no options — omitted from the schema',
        );
        return null;
      }
      return { ...base, type: 'status', statusOptions: config.statusOptions };
    }
    default:
      logger.warn(
        { fieldKey: definition.key, type: definition.type },
        'Unknown result field type — omitted from the schema',
      );
      return null;
  }
}

/*
 * Resolve a service's references in the admin's order.
 *
 * Exactly one field may be primary: it titles the record, and two titles is not
 * a thing a row can have. Rather than reject the service — which would take the
 * whole page down for an editing mistake — the first primary wins and the rest
 * are demoted, with the conflict logged for an admin to fix. A schema with no
 * primary at all falls back to its first field, so a record always has a title.
 */
export function resolveResultRefs(
  refs: ResultFieldRef[],
  registry: Map<string, ResultFieldDefinition>,
): ResultField[] {
  const fields: ResultField[] = [];

  for (const ref of refs) {
    const definition = registry.get(ref.fieldKey);
    if (!definition) {
      logger.warn(
        { fieldKey: ref.fieldKey },
        'Service references a result field that is not in the registry — skipped',
      );
      continue;
    }

    const field = resolveResultField(definition, ref);
    if (field) fields.push(field);
  }

  let seenPrimary = false;
  for (const field of fields) {
    if (!field.isPrimary) continue;
    if (seenPrimary) {
      logger.warn(
        { fieldKey: field.name },
        'Service result schema declares more than one primary field — demoted',
      );
      field.isPrimary = false;
      continue;
    }
    seenPrimary = true;
  }

  const first = fields[0];
  if (!seenPrimary && first) {
    first.isPrimary = true;
    first.showInList = true;
  }

  return fields;
}

// The field a record's title is taken from. Always defined for a non-empty
// schema, because `resolveResultRefs` promotes the first field when the admin
// flagged none.
export function primaryField(fields: ResultField[]): ResultField | undefined {
  return fields.find((field) => field.isPrimary) ?? fields[0];
}

// The columns a service's list page prints, in schema order. The primary always
// leads, since it is the row's title.
export function listFields(fields: ResultField[]): ResultField[] {
  const primary = primaryField(fields);
  const rest = fields.filter((field) => field.showInList && field !== primary);
  return primary ? [primary, ...rest] : rest;
}

// Parse a Service row's stored result references. A malformed shape is an
// editing bug on an admin-authored row, so it degrades to "no result schema"
// rather than throwing — the service simply gets no portal page.
export function storedResultRefs(service: Pick<Service, 'resultFields'>): ResultFieldRef[] {
  const parsed = resultFieldRefsSchema.safeParse(service.resultFields ?? []);
  if (parsed.success) return parsed.data;

  logger.warn('Service row has a malformed resultFields shape — treated as empty');
  return [];
}

/*
 * Load the registry entries a set of services reference, in one query.
 *
 * Archived definitions are included for the reason the request registry gives:
 * archiving removes a field from the PICKER, never from the records that already
 * hold a value for it.
 */
export async function loadResultRegistry(
  services: Pick<Service, 'resultFields'>[],
): Promise<Map<string, ResultFieldDefinition>> {
  const keys = new Set<string>();
  for (const service of services) {
    for (const ref of storedResultRefs(service)) keys.add(ref.fieldKey);
  }

  if (keys.size === 0) return new Map();

  // Unfiltered on `deletedAt` deliberately — the mirror of the request registry's
  // resolver: this answers "what is this fact called", for records that already
  // hold a value under the key, and a delivered record must never render blank.
  const definitions = await prisma.resultFieldDefinition.findMany({
    where: { key: { in: [...keys] } },
  });

  return new Map(definitions.map((definition) => [definition.key, definition]));
}

// One service's resolved result schema — the shape every screen renders.
export async function resultSchemaFor(
  service: Pick<Service, 'resultFields'>,
): Promise<ResultField[]> {
  const registry = await loadResultRegistry([service]);
  return resolveResultRefs(storedResultRefs(service), registry);
}
