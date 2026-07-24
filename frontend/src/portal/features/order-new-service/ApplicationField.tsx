import { ChevronDown } from 'lucide-react';

import type { ServiceField } from '../../types/order-new-service';

/*
 * One application-details field, rendered by its schema `type`. The three
 * controls the design uses share a label row (name + red required asterisk) and
 * the design system's field styling (`.input-field` — 48px tall, 10px radius,
 * gray-300 border, navy focus ring); the textarea opts out of the fixed height
 * for a multi-line box, and the select overlays a chevron on a native control.
 *
 * A native `<select>` (not a custom popover) is deliberate: it's keyboard- and
 * screen-reader-accessible for free and matches the design's plain chevron
 * dropdown. Everything is controlled — value + onChange come from the page's
 * draft state, keyed per service — so nothing here holds catalog or answer data.
 */

type ApplicationFieldProps = {
  field: ServiceField;
  value: string;
  onChange: (value: string) => void;
  // Namespaced so ids stay unique when the same field name appears under two
  // services (e.g. two "country" fields on one screen).
  idPrefix: string;
};

export function ApplicationField({
  field,
  value,
  onChange,
  idPrefix,
}: ApplicationFieldProps) {
  const fieldId = `${idPrefix}-${field.name}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;

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

      {field.type === 'textarea' ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={field.required}
          rows={field.rows ?? 4}
          placeholder={field.placeholder}
          aria-describedby={hintId}
          className="input-field h-auto resize-y py-3 leading-[1.5]"
        />
      ) : field.type === 'select' ? (
        <div className="relative">
          <select
            id={fieldId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required={field.required}
            aria-describedby={hintId}
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
          aria-describedby={hintId}
          className="input-field"
        />
      )}

      {field.hint && (
        <p id={hintId} className="text-small text-text-secondary">
          {field.hint}
        </p>
      )}
    </div>
  );
}
