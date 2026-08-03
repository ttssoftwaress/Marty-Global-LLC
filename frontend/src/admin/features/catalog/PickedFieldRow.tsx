import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  List,
  Type,
  X,
} from 'lucide-react';

import type { ServiceFieldDraft } from '../../types/catalog';
import type { FieldDefinition } from '../../types/fields';
import { fieldTypeLabel } from '../../types/fields';

/*
 * One question on a service's form — a picked registry entry.
 *
 * The row is read-only about the QUESTION and editable only about this
 * service's use of it: whether it is required here, where it sits in the order,
 * and whether it stays on the form at all. Everything printed (label, type,
 * key) is read live from the registry, so re-labelling a field on the Form
 * fields screen updates every service that asks it without a second edit.
 *
 * That is the difference from the old editor this replaces: there is nothing to
 * type here, so there is nothing to type inconsistently.
 */

const TYPE_ICON = {
  text: Type,
  textarea: AlignLeft,
  select: List,
  file: FileText,
} as const;

type PickedFieldRowProps = {
  field: ServiceFieldDraft;
  // The registry entry it points at. Undefined when the referenced field has
  // been removed from the registry — the row says so rather than rendering blank.
  definition: FieldDefinition | undefined;
  index: number;
  fieldCount: number;
  error?: string;
  /*
   * Why this dependent dropdown can't work where it sits — its parent is missing
   * from the form, or below it. Shown here rather than only as a save error,
   * because the fix is one of the arrows in this very row.
   */
  dependencyIssue?: string;
  onChange: (patch: Partial<ServiceFieldDraft>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
};

export function PickedFieldRow({
  field,
  definition,
  index,
  fieldCount,
  error,
  dependencyIssue,
  onChange,
  onRemove,
  onMove,
}: PickedFieldRowProps) {
  const Icon = definition
    ? (TYPE_ICON[definition.type as keyof typeof TYPE_ICON] ?? Type)
    : Type;

  return (
    <div
      className={`flex items-center gap-3 rounded-card border bg-white p-3 ${
        error || dependencyIssue || !definition ? 'border-error' : 'border-gray-200'
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[0.5rem] bg-gray-100">
        <Icon className="size-4 text-gray-600" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-text">
          {definition?.label ?? field.fieldKey}
        </span>
        <span className="truncate text-caption text-gray-500">
          {definition
            ? `${fieldTypeLabel(definition.type)} · ${definition.key}${
                definition.config.dependsOn
                  ? ` · filtered by ${definition.config.dependsOn}`
                  : ''
              }`
            : 'This field is no longer in the registry — remove it.'}
        </span>
        {error && <span className="text-caption text-error">{error}</span>}
        {dependencyIssue && (
          <span className="text-caption text-error">{dependencyIssue}</span>
        )}
      </div>

      {/* Required is the one per-service override: the same question can be
          optional on one service and mandatory on another. */}
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-caption text-gray-600">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => onChange({ required: event.target.checked })}
          className="size-4 cursor-pointer rounded border-gray-300 accent-[var(--color-primary)]"
        />
        Required
      </label>

      <div className="flex shrink-0 items-center">
        {/* Reordering is keyboard-driven: no DnD library in the stack budget. */}
        <button
          type="button"
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
          aria-label={`Move ${definition?.label ?? field.fieldKey} up`}
          className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronUp className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index + 1)}
          disabled={index === fieldCount - 1}
          aria-label={`Move ${definition?.label ?? field.fieldKey} down`}
          className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ChevronDown className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${definition?.label ?? field.fieldKey}`}
          className="flex size-7 items-center justify-center rounded text-gray-400 transition-colors hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
