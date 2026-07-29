import { format, parseISO } from 'date-fns';

import type {
  FieldConfig,
  FieldCreatePayload,
  FieldDefinition,
  FieldDraft,
  FieldFormErrors,
  FieldUpdatePayload,
  SelectOption,
} from '../types/fields';
import { EMPTY_FIELD_DRAFT } from '../types/fields';

/*
 * The registry form's plumbing: the draft the dialog edits, the payloads it
 * submits, and the key derivation that makes registering a field a one-field
 * action for the admin.
 */

/*
 * "Company name" → "company_name". The admin types a label; the key is derived
 * so they never have to invent a machine identifier, which is precisely the
 * inconsistency the registry exists to eliminate.
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
 * A dropdown choice is typed as either "value|Label" or just "Label", the second
 * deriving a slug value — the admin shouldn't have to invent a machine key for
 * every option, but can when the stored answer needs a specific one.
 */
export function parseOptions(value: string): SelectOption[] {
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

function optionSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function serializeOptions(options: SelectOption[]): string {
  return options
    .map((option) =>
      option.value === optionSlug(option.label)
        ? option.label
        : `${option.value}|${option.label}`,
    )
    .join('\n');
}

export function newFieldDraft(): FieldDraft {
  return { ...EMPTY_FIELD_DRAFT, accept: [] };
}

// Seed the form from a registered field, for editing.
export function draftFromField(field: FieldDefinition): FieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    placeholder: field.placeholder ?? '',
    hint: field.hint ?? '',
    category: field.category ?? '',
    options: field.config.options ? serializeOptions(field.config.options) : '',
    accept: field.config.accept ?? [],
    maxSizeMb:
      field.config.maxSizeMb !== undefined ? String(field.config.maxSizeMb) : '',
    multiple: Boolean(field.config.multiple),
    archived: field.archived,
  };
}

/*
 * Client-side validation. The backend's Zod schema is the real contract
 * (AGENTS.md — validation is server-side and authoritative); this only spares
 * the admin a round trip and points at the control that needs attention.
 */
export function validateFieldDraft(draft: FieldDraft): FieldFormErrors {
  const errors: FieldFormErrors = {};

  if (!draft.label.trim()) errors.label = 'Name this field.';

  const key = draft.key.trim() || deriveKey(draft.label);
  if (!key) {
    errors.key = 'A field key is required.';
  } else if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    errors.key =
      'Use lowercase letters, numbers, and underscores, starting with a letter.';
  }

  if (draft.type === 'select' && parseOptions(draft.options).length === 0) {
    errors.options = 'Add at least one choice.';
  }

  const size = draft.maxSizeMb.trim();
  if (draft.type === 'file' && size) {
    const value = Number(size);
    if (!/^\d+$/.test(size) || !Number.isSafeInteger(value) || value < 1 || value > 50) {
      errors.maxSizeMb = 'Enter a whole number of MB between 1 and 50.';
    }
  }

  return errors;
}

// Only the keys that belong to the draft's own type — the backend strips the
// rest anyway, and sending them would misrepresent what the field is.
function configFromDraft(draft: FieldDraft): FieldConfig | undefined {
  switch (draft.type) {
    case 'select':
      return { options: parseOptions(draft.options) };
    case 'file': {
      const size = Number(draft.maxSizeMb.trim());
      return {
        ...(draft.accept.length > 0 ? { accept: [...draft.accept] } : {}),
        ...(draft.maxSizeMb.trim() && Number.isSafeInteger(size) && size > 0
          ? { maxSizeMb: size }
          : {}),
        ...(draft.multiple ? { multiple: true } : {}),
      };
    }
    default:
      return undefined;
  }
}

// Called only after `validateFieldDraft` passes.
export function createPayloadFromDraft(draft: FieldDraft): FieldCreatePayload {
  const config = configFromDraft(draft);

  return {
    key: draft.key.trim() || deriveKey(draft.label),
    label: draft.label.trim(),
    type: draft.type,
    ...(draft.placeholder.trim() ? { placeholder: draft.placeholder.trim() } : {}),
    ...(draft.hint.trim() ? { hint: draft.hint.trim() } : {}),
    ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
    ...(config ? { config } : {}),
  };
}

/*
 * The update payload. No `key` — an answer key is immutable, so the edit form
 * shows it read-only and never sends it.
 */
export function updatePayloadFromDraft(draft: FieldDraft): FieldUpdatePayload {
  const config = configFromDraft(draft);

  return {
    label: draft.label.trim(),
    type: draft.type,
    // Sent as empty strings rather than omitted, so clearing a hint actually
    // clears it (the backend maps '' to null).
    placeholder: draft.placeholder.trim(),
    hint: draft.hint.trim(),
    category: draft.category.trim(),
    ...(config ? { config } : {}),
    archived: draft.archived,
  };
}

// "Jul 8, 2026". Timestamps arrive as UTC (AGENTS.md, Dates); `parseISO`
// converts to the viewer's zone, which is the only place that happens.
export function formatFieldDate(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy');
}

// "Used by 3 services" / "Not used yet" — the blast-radius line.
export function formatUsage(count: number): string {
  if (count === 0) return 'Not used yet';
  return `Used by ${count} service${count === 1 ? '' : 's'}`;
}

/*
 * Group fields under their category for the picker and the management list. An
 * uncategorised field lands in a trailing "Other" group rather than being
 * hidden, so nothing in the registry is ever unreachable.
 */
export const UNCATEGORIZED = 'Other';

export function groupByCategory(
  fields: FieldDefinition[],
): { category: string; fields: FieldDefinition[] }[] {
  const groups = new Map<string, FieldDefinition[]>();

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
