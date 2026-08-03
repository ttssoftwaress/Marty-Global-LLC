import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { ToggleSwitch } from '../features/catalog/detail/ToggleSwitch';

/*
 * The admin form's control primitives — one label/error wrapper plus the three
 * inputs, so every field gets the same height, radius, focus ring, and error
 * treatment without repeating the class strings.
 *
 * They were written for the service form and lived in `features/catalog`, but
 * four other features had already reached across to import them (fields,
 * settings' location and carrier dialogs) and one — the result registry's dialog
 * — hand-rolled its own `inputClass` string instead, which is how its inputs
 * ended up a different height with a different focus treatment. A primitive
 * every feature uses belongs beside `FormDialog` and `RowActions` rather than
 * inside one feature.
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
 * A switch with the sentence that says what its two positions actually do.
 *
 * The label alone is never enough on a settings screen: "Accept USDT" off and
 * "Verify automatically" off are very different kinds of off, and so is "Send
 * customer emails" off. Written for the payments panel and extracted here when
 * the email-delivery panel needed the same row — the second copy is where a
 * duplicated pattern inside one area gets extracted (Design.md).
 *
 * It reaches into `features/catalog` for the switch itself, which every other
 * admin feature already does: `ToggleSwitch` is the admin area's one switch, and
 * moving it is a bigger change than this row is worth.
 */
export function SwitchRow({
  checked,
  onChange,
  disabled,
  label,
  on,
  off,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  label: string;
  on: string;
  off: string;
}) {
  return (
    <div className="flex items-center gap-3 text-body text-text">
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        label={label}
        disabled={disabled}
      />
      <span>{checked ? on : off}</span>
    </div>
  );
}

/*
 * The consequence of a setting, said next to it. `warning` is for a state that
 * is costing something right now (a method switched on with nowhere to send to,
 * a background job standing idle); `info` for a rule of the system the admin
 * cannot change from here.
 */
export function Callout({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'warning' | 'info';
  icon: LucideIcon;
  children: ReactNode;
}) {
  const styles =
    tone === 'warning'
      ? 'border-[var(--color-status-review-text)]/25 bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]'
      : 'border-gray-200 bg-gray-50 text-text-secondary';

  return (
    <p
      className={`flex items-start gap-2 rounded-card border p-3.5 text-body leading-6 ${styles}`}
    >
      <Icon className="mt-1 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{children}</span>
    </p>
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
