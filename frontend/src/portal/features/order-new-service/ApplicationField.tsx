import { ChevronDown } from 'lucide-react';

import type {
  ServiceField,
  ServiceSelectOption,
} from '../../types/order-new-service';
import { ApplicationFileField } from './ApplicationFileField';

/*
 * One application-details field, rendered by its schema `type`. The controls
 * share a label row (name + red required asterisk) and the design system's field
 * styling (`.input-field` — 48px tall, 10px radius, gray-300 border, navy focus
 * ring); the textarea opts out of the fixed height for a multi-line box, the
 * select overlays a chevron on a native control, and a document-upload question
 * renders a dropzone instead of an input.
 *
 * A native `<select>` (not a custom popover) is deliberate: it's keyboard- and
 * screen-reader-accessible for free and matches the design's plain chevron
 * dropdown. Everything is controlled — value + onChange come from the page's
 * draft state, keyed by field name — so nothing here holds catalog or answer
 * data.
 *
 * `askedBy` is the master form's one addition: when a question came from more
 * than one selected service, the field says so, which is what makes "asked
 * once" legible rather than looking like a question went missing.
 *
 * A DEPENDENT dropdown — one whose choices are filtered by another answer — is
 * given `options` already narrowed by the page and, while its parent is
 * unanswered, an empty list. It renders disabled with "Choose <parent> first"
 * rather than as an empty dropdown, because a control that opens onto nothing
 * reads as a broken form (Design.md: a control disabled for a reason the user
 * can fix states the reason).
 */

type ApplicationFieldProps = {
  field: ServiceField;
  value: string;
  onChange: (value: string) => void;
  // Namespaced so ids stay unique across screens.
  idPrefix: string;
  // The files a document-upload question has collected, and the setter for them.
  // Ignored by every other field type.
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  // Service names this question serves, when more than one asked it.
  askedBy?: string[];
  /*
   * A dependent dropdown's currently available choices, and the label of the
   * question they depend on. Both come from the page, which is the only place
   * that holds every answer — a field cannot narrow itself.
   */
  options?: ServiceSelectOption[];
  parentLabel?: string;
};

export function ApplicationField({
  field,
  value,
  onChange,
  idPrefix,
  files,
  onFilesChange,
  askedBy,
  options,
  parentLabel,
}: ApplicationFieldProps) {
  const fieldId = `${idPrefix}-${field.name}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const sharedId = askedBy && askedBy.length > 1 ? `${fieldId}-shared` : undefined;

  // A locked dropdown says why in its own line rather than only in its
  // placeholder, so the reason is announced and not just drawn.
  const isLocked =
    field.type === 'select' &&
    Boolean(field.dependsOn) &&
    (options ?? field.options).length === 0;
  const lockedId = isLocked ? `${fieldId}-locked` : undefined;

  const describedBy =
    [hintId, sharedId, lockedId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={fieldId}
        className="flex items-center gap-1 text-form-label text-gray-700"
      >
        {field.label}
        {field.required && (
          <span className="font-semibold text-error" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {field.type === 'file' ? (
        <ApplicationFileField
          field={field}
          files={files ?? []}
          onChange={(next) => {
            onFilesChange?.(next);
            // The answer records what was attached, so an order reads correctly
            // before the objects themselves reach R2 (AGENTS.md, Storage).
            onChange(next.map((file) => file.name).join(', '));
          }}
          fieldId={fieldId}
          {...(describedBy ? { describedBy } : {})}
        />
      ) : field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          className="input-field h-auto resize-y py-3 leading-[1.5]"
        />
      ) : field.type === 'select' ? (
        <div className="relative">
          <select
            id={fieldId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={field.required}
            disabled={isLocked}
            aria-describedby={describedBy}
            className={`input-field appearance-none pr-11 ${
              isLocked
                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                : `cursor-pointer ${value ? 'text-text' : 'text-gray-400'}`
            }`}
          >
            {/* Empty first option acts as the placeholder until the user picks. */}
            <option value="" disabled hidden>
              {isLocked
                ? `Choose ${parentLabel ?? 'the question above'} first`
                : (field.placeholder ?? 'Select an option')}
            </option>
            {(options ?? field.options).map((option) => (
              <option key={option.value} value={option.value} className="text-text">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 ${
              isLocked ? 'text-gray-400' : 'text-gray-500'
            }`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
      ) : (
        <input
          id={fieldId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          className="input-field"
        />
      )}

      {lockedId && (
        <p id={lockedId} className="text-small text-text-secondary">
          Answer {parentLabel ?? 'the question above'} to see the options here.
        </p>
      )}

      {field.hint && (
        <p id={hintId} className="text-small text-text-secondary">
          {field.hint}
        </p>
      )}

      {sharedId && askedBy && (
        <p id={sharedId} className="text-small text-text-secondary">
          Used for {askedBy.join(' · ')}
        </p>
      )}
    </div>
  );
}
