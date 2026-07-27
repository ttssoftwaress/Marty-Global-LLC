import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { ApiError } from '@/services/api';
import type { RequestFormField, RequestType } from '../../types/my-services';
import { useCreateServiceRequest } from './queries';

/*
 * Raising a follow-up request — the modal behind each admin-defined button on a
 * record.
 *
 * The form is the request type's own intake schema, resolved by the backend from
 * the REQUEST field registry (the same vocabulary the order form uses). Nothing
 * about it is declared here: a type with no fields submits immediately on
 * confirm, and one with four renders four.
 *
 * The backend validates the answers again on arrival and is the real boundary —
 * the required marks here are a courtesy that saves a round trip, not the rule.
 */

type RequestDialogProps = {
  resultId: string;
  requestType: RequestType;
  onClose: () => void;
};

function FieldControl({
  field,
  value,
  onChange,
  invalid,
}: {
  field: RequestFormField;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const base = `w-full rounded-input border bg-white px-3 text-body text-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
    invalid ? 'border-error focus:border-error' : 'border-gray-200 focus:border-primary'
  }`;

  if (field.type === 'textarea') {
    return (
      <textarea
        id={field.name}
        value={value}
        rows={field.rows ?? 3}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className={`${base} py-2.5`}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        id={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className={`${base} h-11`}
      >
        <option value="">Select an option</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  /*
   * A `file` question renders as text here rather than as an upload control.
   * Uploads go to R2 through a presigned PUT, and that pipeline is not wired yet
   * (lib/storage.ts presigns to undefined) — so asking for a reference the team
   * can act on is honest, where a file picker that silently dropped the file
   * would not be.
   */
  return (
    <input
      id={field.name}
      type={field.type === 'file' ? 'text' : 'text'}
      value={value}
      placeholder={field.placeholder ?? (field.type === 'file' ? 'Describe the document' : undefined)}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={invalid}
      className={`${base} h-11`}
    />
  );
}

export function RequestDialog({ resultId, requestType, onClose }: RequestDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const createRequest = useCreateServiceRequest(resultId);

  // Escape closes, and focus moves into the panel on open — the same handling
  // the mail-item slide-over uses.
  useEffect(() => {
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const missing = requestType.fields
    .filter((field) => field.required && !answers[field.name]?.trim())
    .map((field) => field.name);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (missing.length > 0) return;

    createRequest.mutate(
      {
        requestTypeId: requestType.id,
        ...(Object.keys(answers).length > 0 ? { answers } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: onClose },
    );
  };

  const error =
    createRequest.error instanceof ApiError
      ? createRequest.error.message
      : createRequest.isError
        ? 'Something went wrong. Please try again.'
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-gray-900/50 transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-dialog-title"
        tabIndex={-1}
        className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-modal bg-white shadow-slide-over outline-none transition-transform duration-300 ease-out starting:translate-y-8 motion-reduce:transition-none md:max-w-[520px] md:rounded-modal"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="request-dialog-title"
              className="text-body-lg font-semibold text-text"
            >
              {requestType.label}
            </h2>
            {requestType.description ? (
              <p className="text-body text-gray-500">{requestType.description}</p>
            ) : null}
            {requestType.turnaround ? (
              <p className="text-caption text-gray-500">{requestType.turnaround}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-input p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-text"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {requestType.fields.map((field) => {
              const invalid = touched && missing.includes(field.name);

              return (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={field.name}
                    className="text-body font-medium text-text"
                  >
                    {field.label}
                    {field.required ? (
                      <span className="text-error" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    ) : null}
                  </label>

                  <FieldControl
                    field={field}
                    value={answers[field.name] ?? ''}
                    onChange={(value) =>
                      setAnswers((current) => ({ ...current, [field.name]: value }))
                    }
                    invalid={invalid}
                  />

                  {invalid ? (
                    <p className="text-caption text-error">{field.label} is required</p>
                  ) : field.hint ? (
                    <p className="text-caption text-gray-500">{field.hint}</p>
                  ) : null}
                </div>
              );
            })}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="request-note" className="text-body font-medium text-text">
                Anything else we should know?
              </label>
              <textarea
                id="request-note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-input border border-gray-200 bg-white px-3 py-2.5 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error ? (
              <p role="alert" className="text-body text-error">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-200 p-5 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary h-11 rounded-input px-5 text-body"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRequest.isPending}
              className="btn btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-input px-5 text-body disabled:opacity-60"
            >
              {createRequest.isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : null}
              Submit request
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
