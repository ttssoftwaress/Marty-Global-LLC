import type {
  FieldConfig,
  FieldCreatePayload,
  FieldDefinition,
  FieldDraft,
  FieldFormErrors,
  FieldUpdatePayload,
} from '../types/fields';
import { EMPTY_FIELD_DRAFT } from '../types/fields';
import {
  deriveKey,
  parseOptions,
  serializeOptions,
  validateKey,
} from './field-registry';

/*
 * The request registry form's plumbing: the draft the dialog edits and the
 * payloads it submits.
 *
 * Everything both registries share — key derivation and validation, choice
 * parsing, category grouping, the date and usage formatters — lives in
 * `field-registry`. What stays here is what only a question has: a placeholder,
 * and the accepted types and size limit of a document upload.
 */

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

  const keyError = validateKey(draft.key.trim() || deriveKey(draft.label));
  if (keyError) errors.key = keyError;

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
