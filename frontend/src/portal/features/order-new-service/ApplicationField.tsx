import { ChevronDown } from 'lucide-react';

import type { ServiceField } from '../../types/order-new-service';
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
};

export function ApplicationField({
  field,
  value,
  onChange,
  idPrefix,
  files,
  onFilesChange,
  askedBy,
}: ApplicationFieldProps) {
  const fieldId = `${idPrefix}-${field.name}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const sharedId = askedBy && askedBy.length > 1 ? `${fieldId}-shared` : undefined;
  const describedBy = [hintId, sharedId].filter(Boolean).join(' ') || undefined;

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
            aria-describedby={describedBy}
            className={`input-field cursor-pointer appearance-none pr-11 ${
              value ? 'text-text' : 'text-gray-400'
            }`}
          >
            {/* Empty first option acts as the placeholder until the user picks. */}
            <option value="" disabled hidden>
              {field.placeholder ?? 'Select an option'}
            </option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value} className="text-text">
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-500"
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
