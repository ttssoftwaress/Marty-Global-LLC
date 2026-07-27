import type {
  ResultFieldConfig,
  ResultFieldDefinition,
  ResultFieldType,
  ResultSelectOption,
  ResultStatusOption,
  StatusTone,
} from '../types/delivery';
import type {
  ResultFieldCreatePayload,
  ResultFieldUpdatePayload,
} from '../features/result-fields/queries';
import { deriveKey } from './fields';

/*
 * The result registry form's plumbing — the draft the dialog edits and the
 * payloads it submits.
 *
 * The mirror of `lib/fields.ts`, and it reuses that file's `deriveKey`: both
 * registries store under the same key format, and two copies of that derivation
 * would be two chances to drift from the backend's `fieldKeySchema`.
 */

export type ResultFieldDraft = {
  key: string;
  label: string;
  type: ResultFieldType;
  hint: string;
  category: string;
  // Choices, one per line, as "value|Label" or just "Label". A status field adds
  // a tone: "value|Label|tone".
  options: string;
  prefix: string;
  suffix: string;
  decimals: string;
  withTime: boolean;
  rows: string;
  maxSizeMb: string;
  isPrimary: boolean;
  showInList: boolean;
  archived: boolean;
};

export type ResultFieldFormErrors = Partial<
  Record<'label' | 'key' | 'options' | 'decimals' | 'maxSizeMb', string>
>;

export const EMPTY_RESULT_FIELD_DRAFT: ResultFieldDraft = {
  key: '',
  label: '',
  type: 'text',
  hint: '',
  category: '',
  options: '',
  prefix: '',
  suffix: '',
  decimals: '',
  withTime: false,
  rows: '',
  maxSizeMb: '',
  isPrimary: false,
  showInList: false,
  archived: false,
};

export function newResultFieldDraft(): ResultFieldDraft {
  return { ...EMPTY_RESULT_FIELD_DRAFT };
}

function optionSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const TONES: readonly StatusTone[] = [
  'neutral',
  'success',
  'warning',
  'error',
  'info',
];

function isTone(value: string): value is StatusTone {
  return (TONES as readonly string[]).includes(value);
}

export function parseResultOptions(value: string): ResultSelectOption[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawValue = '', rawLabel] = line.split('|');
      if (rawLabel !== undefined) {
        return { value: rawValue.trim(), label: rawLabel.trim() };
      }
      const label = rawValue.trim();
      return { value: optionSlug(label), label };
    });
}

/*
 * A status choice carries a tone as its third part. An unrecognised or missing
 * tone falls back to `neutral` rather than rejecting the line — the admin is
 * picking a meaning from a short list, and a typo should not lose the choice
 * they typed.
 */
export function parseStatusOptions(value: string): ResultStatusOption[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim());
      const [first = '', second, third] = parts;

      const label = second !== undefined ? second : first;
      const optionValue = second !== undefined ? first : optionSlug(first);
      const tone = third && isTone(third) ? third : 'neutral';

      return { value: optionValue, label, tone };
    });
}

function serializeOptions(options: ResultSelectOption[]): string {
  return options
    .map((option) =>
      option.value === optionSlug(option.label)
        ? option.label
        : `${option.value}|${option.label}`,
    )
    .join('\n');
}

function serializeStatusOptions(options: ResultStatusOption[]): string {
  return options
    .map((option) => `${option.value}|${option.label}|${option.tone}`)
    .join('\n');
}

export function draftFromResultField(
  field: ResultFieldDefinition,
): ResultFieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    hint: field.hint ?? '',
    category: field.category ?? '',
    options:
      field.type === 'status'
        ? field.config.statusOptions
          ? serializeStatusOptions(field.config.statusOptions)
          : ''
        : field.config.options
          ? serializeOptions(field.config.options)
          : '',
    prefix: field.config.prefix ?? '',
    suffix: field.config.suffix ?? '',
    decimals:
      field.config.decimals !== undefined ? String(field.config.decimals) : '',
    withTime: Boolean(field.config.withTime),
    rows: field.config.rows !== undefined ? String(field.config.rows) : '',
    maxSizeMb:
      field.config.maxSizeMb !== undefined ? String(field.config.maxSizeMb) : '',
    isPrimary: field.isPrimary,
    showInList: field.showInList,
    archived: field.archived,
  };
}

/*
 * Client-side validation. The backend's Zod schema is the real contract; this
 * only spares the admin a round trip and points at the control that needs
 * attention.
 */
export function validateResultFieldDraft(
  draft: ResultFieldDraft,
): ResultFieldFormErrors {
  const errors: ResultFieldFormErrors = {};

  if (!draft.label.trim()) errors.label = 'Name this field.';

  const key = draft.key.trim() || deriveKey(draft.label);
  if (!key) {
    errors.key = 'A field key is required.';
  } else if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    errors.key =
      'Use lowercase letters, numbers, and underscores, starting with a letter.';
  }

  if (draft.type === 'select' && parseResultOptions(draft.options).length === 0) {
    errors.options = 'Add at least one choice.';
  }

  if (draft.type === 'status' && parseStatusOptions(draft.options).length === 0) {
    errors.options = 'Add at least one state.';
  }

  const decimals = draft.decimals.trim();
  if (draft.type === 'number' && decimals) {
    const value = Number(decimals);
    if (!/^\d+$/.test(decimals) || value > 6) {
      errors.decimals = 'Enter a whole number between 0 and 6.';
    }
  }

  const size = draft.maxSizeMb.trim();
  if (draft.type === 'file' && size) {
    const value = Number(size);
    if (!/^\d+$/.test(size) || value < 1 || value > 50) {
      errors.maxSizeMb = 'Enter a whole number of MB between 1 and 50.';
    }
  }

  return errors;
}

// Only the keys that belong to the draft's own type — the backend strips the
// rest anyway, and sending them would misrepresent what the field is.
function configFromDraft(draft: ResultFieldDraft): ResultFieldConfig | undefined {
  switch (draft.type) {
    case 'select':
      return { options: parseResultOptions(draft.options) };
    case 'status':
      return { statusOptions: parseStatusOptions(draft.options) };
    case 'textarea': {
      const rows = Number(draft.rows.trim());
      return draft.rows.trim() && rows >= 2 && rows <= 12 ? { rows } : {};
    }
    case 'number': {
      const decimals = Number(draft.decimals.trim());
      return {
        ...(draft.prefix.trim() ? { prefix: draft.prefix.trim() } : {}),
        ...(draft.suffix.trim() ? { suffix: draft.suffix.trim() } : {}),
        ...(draft.decimals.trim() && Number.isSafeInteger(decimals)
          ? { decimals }
          : {}),
      };
    }
    case 'date':
      return draft.withTime ? { withTime: true } : {};
    case 'file': {
      const size = Number(draft.maxSizeMb.trim());
      return draft.maxSizeMb.trim() && Number.isSafeInteger(size) && size > 0
        ? { maxSizeMb: size }
        : {};
    }
    default:
      return undefined;
  }
}

export function createResultPayloadFromDraft(
  draft: ResultFieldDraft,
): ResultFieldCreatePayload {
  const config = configFromDraft(draft);

  return {
    key: draft.key.trim() || deriveKey(draft.label),
    label: draft.label.trim(),
    type: draft.type,
    ...(draft.hint.trim() ? { hint: draft.hint.trim() } : {}),
    ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
    ...(config ? { config } : {}),
    isPrimary: draft.isPrimary,
    showInList: draft.showInList,
  };
}

// No `key` — a value key is immutable, so the edit form shows it read-only and
// never sends it.
export function updateResultPayloadFromDraft(
  draft: ResultFieldDraft,
): ResultFieldUpdatePayload {
  const config = configFromDraft(draft);

  return {
    label: draft.label.trim(),
    type: draft.type,
    // Sent as empty strings rather than omitted, so clearing a hint actually
    // clears it (the backend maps '' to null).
    hint: draft.hint.trim(),
    category: draft.category.trim(),
    ...(config ? { config } : {}),
    isPrimary: draft.isPrimary,
    showInList: draft.showInList,
    archived: draft.archived,
  };
}
