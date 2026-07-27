import type { ReactNode } from 'react';

/*
 * The form's control primitives — one label/error wrapper plus the three inputs
 * the service form uses. They live here so every field in the form (and every
 * nested tier and detail-field row) gets the same height, radius, focus ring,
 * and error treatment without repeating the class strings.
 *
 * An invalid control is marked with `aria-invalid` and points at its message
 * with `aria-describedby`, so the error is announced rather than only colored.
 */

const CONTROL_BASE =
  'w-full rounded-input border bg-white px-3 text-body text-text transition-colors placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-primary disabled:bg-gray-50 disabled:text-gray-400';

function controlClass(invalid?: boolean) {
  return `${CONTROL_BASE} ${invalid ? 'border-error' : 'border-gray-300'}`;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-form-label text-text">
        {label}
        {required ? <span className="text-error"> *</span> : null}
      </label>

      {children}

      {error ? (
        <p id={`${htmlFor}-error`} className="text-caption text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-caption text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type BaseProps = {
  id: string;
  error?: string;
  hint?: string;
};

export function TextInput({
  id,
  error,
  hint,
  ...props
}: BaseProps & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={`h-input ${controlClass(Boolean(error))}`}
      {...props}
    />
  );
}

export function TextArea({
  id,
  error,
  hint,
  rows = 3,
  ...props
}: BaseProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      id={id}
      rows={rows}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={`resize-y py-2.5 leading-6 ${controlClass(Boolean(error))}`}
      {...props}
    />
  );
}

export function SelectInput({
  id,
  error,
  hint,
  children,
  ...props
}: BaseProps & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={`h-input cursor-pointer ${controlClass(Boolean(error))}`}
      {...props}
    >
      {children}
    </select>
  );
}

/*
 * A section divider inside the form. The form is long enough that grouping it
 * (Details / Regions / Pricing / Application questions) is what keeps it
 * readable in a sheet.
 */
export function FormSection({
  id,
  title,
  description,
  action,
  children,
}: {
  // An anchor for the form to scroll to when this section holds the first
  // error blocking a submit.
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex flex-col gap-3 border-t border-gray-200 pt-5 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-body-lg font-semibold text-text">{title}</h3>
          {description ? (
            <p className="text-caption text-gray-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>

      {children}
    </section>
  );
}
