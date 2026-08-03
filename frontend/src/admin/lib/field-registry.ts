import { format, parseISO } from 'date-fns';

/*
 * The plumbing both field registries share.
 *
 * There are two of them — the questions a service ASKS (`lib/fields`) and the
 * facts it RETURNS (`lib/result-fields`) — and their schemas genuinely differ:
 * only one has status tones, a primary flag, or a file `accept` list. What never
 * differed is everything in this file: how a key is derived from a label, how a
 * choice line is parsed and written back, what makes a key invalid, and how
 * fields group under a category heading. Both registries store under the same
 * key format, so two copies of that derivation would be two chances to drift
 * from the backend's `fieldKeySchema`.
 */

export type RegistryOption = { value: string; label: string; when?: string[] };

/*
 * "Company name" → "company_name". The admin types a label; the key is derived
 * so they never have to invent a machine identifier, which is precisely the
 * inconsistency the registries exist to eliminate.
 *
 * Lowercase with underscores, matching the backend's `fieldKeySchema` — a key
 * that fails there would be a round trip wasted.
 */
export function deriveKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/g, '')
    .slice(0, 60);
}

/*
 * The key error, or undefined when it passes. The backend's Zod schema is the
 * real contract (AGENTS.md — validation is server-side and authoritative); this
 * only spares the admin a round trip and points at the control that needs
 * attention.
 */
export function validateKey(key: string): string | undefined {
  if (!key) return 'A field key is required.';
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    return 'Use lowercase letters, numbers, and underscores, starting with a letter.';
  }
  return undefined;
}

export function optionSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/*
 * A choice is typed as either "value|Label" or just "Label", the second deriving
 * a slug value — the admin shouldn't have to invent a machine key for every
 * option, but can when the stored answer needs a specific one.
 */
export function parseOptions(value: string): RegistryOption[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // `split` always yields at least one element, which the index signature
      // can't express under `noUncheckedIndexedAccess`.
      const [rawValue = '', rawLabel] = line.split('|');
      if (rawLabel !== undefined) {
        return { value: rawValue.trim(), label: rawLabel.trim() };
      }
      const label = rawValue.trim();
      return { value: optionSlug(label), label };
    });
}

// The inverse: a line keeps its explicit value only when the slug would not
// produce it, so a round trip through the textarea does not add noise.
export function serializeOptions(options: RegistryOption[]): string {
  return options.map(optionLine).join('\n');
}

function optionLine(option: RegistryOption): string {
  return option.value === optionSlug(option.label)
    ? option.label
    : `${option.value}|${option.label}`;
}

/*
 * A dependent dropdown's choices, grouped by the parent answer they belong to.
 *
 * `[us]` on its own line opens a group; every choice below it is scoped to the
 * parent value `us` until the next header. Choices typed before any header
 * belong to no group and are offered under every parent answer — the "Other"
 * escape hatch.
 *
 * A textarea with header lines rather than a control per parent value: a country
 * list runs to two hundred entries, and a form that rendered a box for each
 * would be unusable long before it was complete. It also keeps the whole tree
 * copy-pasteable, which is how an admin actually loads one.
 */
export function parseGroupedOptions(value: string): RegistryOption[] {
  const options: RegistryOption[] = [];
  let group: string | null = null;

  for (const raw of value.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      group = header[1]?.trim() || null;
      continue;
    }

    const [option] = parseOptions(line);
    if (!option) continue;

    options.push(group ? { ...option, when: [group] } : option);
  }

  return mergeByValue(options);
}

/*
 * The same choice under two headers is one choice offered under both parents,
 * not two rows with the same value — a dropdown can only ever store one of them,
 * and the second would silently win. Merging here means an admin can list
 * "Remote" under every country without thinking about it.
 */
function mergeByValue(options: RegistryOption[]): RegistryOption[] {
  const byValue = new Map<string, RegistryOption>();

  for (const option of options) {
    const existing = byValue.get(option.value);

    if (!existing) {
      byValue.set(option.value, option);
      continue;
    }

    // An unscoped copy wins outright: it already shows everywhere, so narrowing
    // it to the other's group would take choices away.
    if (!existing.when || !option.when) {
      byValue.set(option.value, { value: option.value, label: existing.label });
      continue;
    }

    byValue.set(option.value, {
      ...existing,
      when: [...new Set([...existing.when, ...option.when])],
    });
  }

  return [...byValue.values()];
}

/*
 * The inverse, written back as headers. Unscoped choices come first so they read
 * as the defaults they are; the rest group under their parent value in the order
 * those values first appear. A choice offered under two parents is written under
 * each — which is exactly what `parseGroupedOptions` merges back.
 */
export function serializeGroupedOptions(options: RegistryOption[]): string {
  const ungrouped = options.filter((option) => !option.when?.length);
  const groups = new Map<string, RegistryOption[]>();

  for (const option of options) {
    for (const value of option.when ?? []) {
      groups.set(value, [...(groups.get(value) ?? []), option]);
    }
  }

  const blocks = [
    ...(ungrouped.length > 0 ? [ungrouped.map(optionLine).join('\n')] : []),
    ...[...groups.entries()].map(
      ([value, items]) => `[${value}]\n${items.map(optionLine).join('\n')}`,
    ),
  ];

  return blocks.join('\n\n');
}

// "Jul 8, 2026". Timestamps arrive as UTC (AGENTS.md, Dates); `parseISO`
// converts to the viewer's zone, which is the only place that happens.
export function formatFieldDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}

// "Used by 3 services" / "Not used yet" — the blast-radius line.
export function formatUsage(count: number): string {
  if (count === 0) return 'Not used yet';
  return `Used by ${count} service${count === 1 ? '' : 's'}`;
}

/*
 * Group fields under their category for the pickers and the management lists. An
 * uncategorised field lands in a trailing "Other" group rather than being
 * hidden, so nothing in either registry is ever unreachable.
 */
export const UNCATEGORIZED = 'Other';

export function groupByCategory<T extends { category?: string }>(
  fields: T[],
): { category: string; fields: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const field of fields) {
    const key = field.category?.trim() || UNCATEGORIZED;
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }

  return [...groups.entries()]
    .map(([category, items]) => ({ category, fields: items }))
    .sort((a, b) => {
      if (a.category === UNCATEGORIZED) return 1;
      if (b.category === UNCATEGORIZED) return -1;
      return a.category.localeCompare(b.category);
    });
}
