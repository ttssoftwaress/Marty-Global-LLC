import type { ServiceResultValue } from '@prisma/client';

import { AppError } from '../../lib/app-error.js';
import type { ResultField, ResultValueInput } from './results.validation.js';

/*
 * Turning what staff typed into what gets stored, and back into what the
 * customer sees.
 *
 * Every value arrives as a string (the form is one flat map, exactly like the
 * order's answers), so this file is the single place that knows what a valid
 * `date` or `number` is. Validating here rather than in Zod is deliberate: the
 * schema is resolved at runtime from the registry, so the rules cannot be
 * expressed in a static object schema — but they still have to be enforced in
 * the service layer, which is where all business logic lives (AGENTS.md).
 *
 * MONEY is deliberately not a type this registry offers. An amount owed belongs
 * to `billing`, and a second copy here would be a second source of truth for
 * something AGENTS.md is emphatic about — so a result field never holds one.
 */

export type StoredValue = {
  value: string | null;
  valueJson?: unknown;
  objectKey?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
};

const isBlank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim().length === 0;

/*
 * Validate and normalise one submitted value against its field.
 *
 * Returns null when the field was left blank — the caller decides whether that
 * is allowed, because "required" is a property of the service's reference and
 * of the moment (a draft may be incomplete; a delivery may not).
 */
export function coerceValue(
  field: ResultField,
  input: ResultValueInput,
): StoredValue | null {
  // A file field carries no scalar — its object key IS the value.
  if (field.type === 'file') {
    if (!input.objectKey) return null;
    return {
      value: input.value?.trim() || null,
      objectKey: input.objectKey,
      contentType: input.contentType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      ...(input.valueJson === undefined ? {} : { valueJson: input.valueJson }),
    };
  }

  const raw = input.value;
  if (isBlank(raw)) return null;

  // Narrowed by the blank check above; the `?? ''` keeps the compiler honest
  // without a non-null assertion.
  const text = (raw ?? '').trim();

  switch (field.type) {
    case 'text':
    case 'textarea':
      return { value: text };

    case 'url': {
      let parsed: URL;
      try {
        parsed = new URL(text);
      } catch {
        throw AppError.validation(`"${field.label}" must be a valid URL`, {
          fieldKey: field.name,
        });
      }
      // A stored link is rendered as an anchor the customer clicks, so the
      // scheme has to be one a browser will navigate safely — `javascript:` in
      // an href is the whole reason this is a whitelist and not a format check.
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw AppError.validation(`"${field.label}" must be an http or https link`, {
          fieldKey: field.name,
        });
      }
      return { value: parsed.toString() };
    }

    case 'date': {
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) {
        throw AppError.validation(`"${field.label}" must be a valid date`, {
          fieldKey: field.name,
        });
      }
      // Stored ISO-8601 UTC; the browser converts to the viewer's zone at render
      // (AGENTS.md, Dates).
      return { value: parsed.toISOString() };
    }

    case 'number': {
      // Rejects the things `Number()` quietly accepts — an empty string,
      // whitespace, "0x10", "Infinity".
      if (!/^-?\d+(\.\d+)?$/.test(text)) {
        throw AppError.validation(`"${field.label}" must be a number`, {
          fieldKey: field.name,
        });
      }
      // Kept as the exact text that was typed rather than round-tripped through
      // a float: `decimals` is a RENDER setting, and re-serialising here would
      // silently drop precision the registry never asked us to drop.
      return { value: text };
    }

    case 'select': {
      const match = field.options.find((option) => option.value === text);
      if (!match) {
        throw AppError.validation(
          `"${text}" is not a valid choice for "${field.label}"`,
          { fieldKey: field.name },
        );
      }
      return { value: match.value };
    }

    case 'status': {
      const match = field.statusOptions.find((option) => option.value === text);
      if (!match) {
        throw AppError.validation(
          `"${text}" is not a valid status for "${field.label}"`,
          { fieldKey: field.name },
        );
      }
      return { value: match.value };
    }

    default: {
      // Every case above is exhaustive over the union; this is the guard against
      // a type being added to the registry without a rule being written for it.
      const unreachable: never = field;
      void unreachable;
      throw AppError.validation('Unsupported result field type');
    }
  }
}

/*
 * The value a customer's screen renders, resolved against its field.
 *
 * The stored scalar is returned untouched — formatting a date or grouping a
 * number is the browser's job at render, in the viewer's own locale and zone.
 * What this adds is the things the browser CANNOT derive: the label behind a
 * select's stored value, and the tone behind a status's.
 */
export type ResultValueView = {
  fieldKey: string;
  value: string | null;
  // The human label for a select/status choice, resolved from the definition so
  // a re-worded option updates every record that holds it.
  displayValue?: string;
  tone?: string;
  // Files are served only as short-TTL presigned URLs after an ownership check,
  // so the key never reaches the browser — `download` is minted per request.
  file?: { name: string; sizeBytes: number | null; contentType: string | null };
  valueJson?: unknown;
};

export function toValueView(
  field: ResultField,
  row: Pick<
    ServiceResultValue,
    'fieldKey' | 'value' | 'valueJson' | 'objectKey' | 'contentType' | 'sizeBytes'
  >,
): ResultValueView {
  const base: ResultValueView = { fieldKey: row.fieldKey, value: row.value };

  if (row.valueJson !== null && row.valueJson !== undefined) {
    base.valueJson = row.valueJson;
  }

  switch (field.type) {
    case 'select': {
      const match = field.options.find((option) => option.value === row.value);
      if (match) base.displayValue = match.label;
      return base;
    }
    case 'status': {
      const match = field.statusOptions.find(
        (option) => option.value === row.value,
      );
      if (match) {
        base.displayValue = match.label;
        base.tone = match.tone;
      }
      return base;
    }
    case 'file': {
      if (row.objectKey) {
        base.file = {
          // The stored scalar doubles as the file's display name for a file
          // field, which is why `coerceValue` keeps it.
          name: row.value ?? 'Document',
          sizeBytes: row.sizeBytes,
          contentType: row.contentType,
        };
      }
      return base;
    }
    default:
      return base;
  }
}

/*
 * The record's title, taken from its primary value.
 *
 * Falls back through the display label (a select's wording reads better than its
 * stored key) to the raw value, and finally to a placeholder — a record must
 * always have something to print in a table's first column, and an empty cell
 * would make the row unclickable-looking.
 */
export function titleFrom(
  field: ResultField | undefined,
  view: ResultValueView | undefined,
  fallback: string,
): string {
  if (!field || !view) return fallback;
  return view.displayValue || view.value || fallback;
}
