import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Send,
  Upload,
  X,
} from 'lucide-react';

import {
  acceptAttr,
  describeTypes,
  DOCUMENT_TYPES,
  isAcceptedType,
  MAX_BYTES,
} from '@/constants/uploads';
import { ApiError } from '@/services/api';
import { uploadFile, type UploadedFile } from '@/services/upload';
import { formatFileSize } from '../../lib/format';
import { openPresignedFile, type FileDisposition } from '../../lib/open-file';
import type {
  AdminResult,
  ResultField,
  ResultValue,
  ResultValueInput,
} from '../../types/delivery';
import { useResultFileLink } from './queries';

/*
 * The result form — what staff fill in to deliver a service.
 *
 * Entirely data-driven: `result.fields` is the service's own result schema,
 * resolved by the backend, so this component renders whatever a service returns
 * without knowing anything about companies or registrations. Adding a fact to a
 * service is a catalog change, not a change here.
 *
 * Two buttons, one form. **Save draft** stores progress and leaves the record
 * invisible to the customer; **Deliver** publishes it and completes the service
 * line. Deliver is disabled while a required field is blank — and the backend
 * refuses it for the same reason, which is the check that actually matters
 * (AGENTS.md: the backend guards are the real boundary).
 *
 * Used by both the order screen and the requests queue, so an amendment made
 * from a follow-up goes through exactly the same validation as the first
 * delivery.
 */

type ResultFormProps = {
  result: AdminResult;
  isSaving: boolean;
  error: unknown;
  onSave: (values: ResultValueInput[], deliver: boolean) => void;
  // The queue's amendment screen has no "deliver" step — the record is already
  // live, so saving IS publishing and a second button would imply otherwise.
  mode?: 'deliver' | 'amend';
};

// The form's editable state: one string per field, seeded from what is stored.
function seedValues(result: AdminResult): Record<string, string> {
  const seeded: Record<string, string> = {};

  for (const field of result.fields) {
    const stored = result.values[field.name];
    // A file field's scalar is its display name; everything else is the value
    // itself. A `date` arrives ISO-8601 and the input wants `yyyy-MM-dd`.
    if (field.type === 'date' && stored?.value) {
      seeded[field.name] = stored.value.slice(0, field.withTime ? 16 : 10);
      continue;
    }
    seeded[field.name] = stored?.value ?? '';
  }

  return seeded;
}

/*
 * The upload half of a `file` result field.
 *
 * Uploaded on selection rather than at submit, so the operator sees the file
 * land — and so a failed upload is reported next to the control that caused it
 * rather than as a whole-form save error.
 */
// Narrowed to the `file` variant of the union — `accept` and `maxSizeMb` exist
// only there, and this control is only ever rendered for that case.
type ResultFileField = Extract<ResultField, { type: 'file' }>;

// Which types a browser tab will actually render; anything else downloads on
// "View" regardless, so the control is not offered for it. A null type is a row
// stored before we captured one — offered, since the upload policy has only ever
// accepted PDFs and images.
function isPreviewable(contentType: string | null): boolean {
  return (
    contentType === null ||
    contentType === 'application/pdf' ||
    contentType.startsWith('image/')
  );
}

/*
 * The document already on the record — what the form previously had no way of
 * showing.
 *
 * Upload and Replace were the only controls here, so an operator amending a
 * delivery, or checking a colleague's, could not read the file they were about to
 * overwrite. Neither button holds a URL: a presigned link is minted per click and
 * the backend audits every one (AGENTS.md, Security & PII).
 *
 * Hidden the moment a replacement is staged in this session — at that point the
 * stored file is on its way out, and offering it beside the new one reads as a
 * choice rather than as history.
 */
function StoredDocument({
  file,
  fieldKey,
  resultId,
}: {
  file: NonNullable<ResultValue['file']>;
  fieldKey: string;
  resultId: string;
}) {
  const link = useResultFileLink(resultId);

  const open = (disposition: FileDisposition) => {
    link.mutate(
      { fieldKey, disposition },
      { onSuccess: ({ url }) => openPresignedFile(url, disposition, file.name) },
    );
  };

  const action =
    'flex size-8 shrink-0 items-center justify-center rounded-input border border-gray-200 bg-white text-text transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 rounded-input border border-gray-200 bg-gray-50 px-3 py-2">
        <FileText
          className="size-4 shrink-0 text-primary"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-small text-gray-700">
          {file.name}
          {file.sizeBytes === null ? null : (
            <span className="text-gray-400">
              <span aria-hidden="true"> · </span>
              {formatFileSize(file.sizeBytes)}
            </span>
          )}
        </span>

        {isPreviewable(file.contentType) ? (
          <button
            type="button"
            disabled={link.isPending}
            onClick={() => open('inline')}
            className={action}
            aria-label={`View ${file.name}`}
            title="View"
          >
            <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          disabled={link.isPending}
          onClick={() => open('attachment')}
          className={action}
          aria-label={`Download ${file.name}`}
          title="Download"
        >
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {link.isError ? (
        <p role="alert" className="text-small text-error">
          {link.error instanceof ApiError
            ? link.error.message
            : 'That document could not be opened. Please try again.'}
        </p>
      ) : null}
    </div>
  );
}

function ResultFileControl({
  field,
  value,
  onChange,
  upload,
  stored,
  resultId,
  invalid,
  base,
}: {
  field: ResultFileField;
  value: string;
  onChange: (value: string) => void;
  upload: {
    attached: UploadedFile | undefined;
    onUploaded: (file: UploadedFile) => void;
    onClear: () => void;
  };
  // The document currently on the record, if any — distinct from `upload.attached`,
  // which is one staged in this editing session and not yet saved.
  stored: ResultValue['file'];
  resultId: string;
  invalid: boolean;
  base: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defaults come from the backend's `result-file` policy when the service's
  // result schema left them unset (constants/uploads.ts).
  const accepted: readonly string[] = field.accept?.length
    ? field.accept
    : DOCUMENT_TYPES;
  const maxMb = field.maxSizeMb ?? MAX_BYTES.resultFile / (1024 * 1024);
  const maxBytes = maxMb * 1024 * 1024;

  const onPick = async (file: File | undefined) => {
    if (!file) return;

    if (!isAcceptedType(file, accepted)) {
      setError(`Upload a ${describeTypes(accepted)} file.`);
      return;
    }

    if (file.size > maxBytes) {
      setError(`That file is larger than ${maxMb} MB.`);
      return;
    }

    setError(null);
    setProgress(0);

    try {
      const uploaded = await uploadFile(file, 'result-file', {
        onProgress: setProgress,
      });

      upload.onUploaded(uploaded);
      // Seed the customer-facing label from the filename only when the operator
      // has not already written one, so re-uploading never overwrites their copy.
      if (!value.trim()) onChange(file.name);
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'That file could not be uploaded. Try again.',
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        id={field.name}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        placeholder="Document name"
        className={`${base} h-11`}
      />

      {stored && !upload.attached ? (
        <StoredDocument file={stored} fieldKey={field.name} resultId={resultId} />
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="inline-flex items-center gap-2 rounded-input border border-gray-200 bg-white px-3 py-2 text-small font-medium text-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {upload.attached ? 'Replace file' : 'Upload file'}
        </button>

        {upload.attached ? (
          <span className="flex min-w-0 items-center gap-2 text-small text-gray-500">
            <span className="truncate">{upload.attached.name}</span>
            <button
              type="button"
              onClick={upload.onClear}
              className="shrink-0 text-gray-400 transition-colors hover:text-text"
              aria-label={`Remove ${upload.attached.name}`}
            >
              <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      {progress !== null ? (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Upload progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        {...(accepted.length > 0 ? { accept: acceptAttr(accepted) } : {})}
        className="sr-only"
        aria-label={`Upload ${field.label}`}
        onChange={(event) => {
          void onPick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {error ? (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  upload,
  stored,
  resultId,
  invalid,
}: {
  field: ResultField;
  value: string;
  onChange: (value: string) => void;
  upload: {
    attached: UploadedFile | undefined;
    onUploaded: (file: UploadedFile) => void;
    onClear: () => void;
  };
  stored: ResultValue['file'];
  resultId: string;
  invalid: boolean;
}) {
  const base = `w-full rounded-input border bg-white px-3 text-body text-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
    invalid ? 'border-error focus:border-error' : 'border-gray-200 focus:border-primary'
  }`;

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          id={field.name}
          value={value}
          rows={field.rows ?? 3}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={`${base} py-2.5`}
        />
      );

    case 'select':
      return (
        <select
          id={field.name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={`${base} h-11`}
        >
          <option value="">Not set</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'status':
      return (
        <select
          id={field.name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={`${base} h-11`}
        >
          <option value="">Not set</option>
          {field.statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'date':
      return (
        <input
          id={field.name}
          type={field.withTime ? 'datetime-local' : 'date'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={`${base} h-11`}
        />
      );

    case 'number':
      return (
        <input
          id={field.name}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          placeholder={field.prefix || field.suffix ? `${field.prefix ?? ''}0${field.suffix ?? ''}` : undefined}
          className={`${base} h-11`}
        />
      );

    case 'url':
      return (
        <input
          id={field.name}
          type="url"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          placeholder="https://"
          className={`${base} h-11`}
        />
      );

    /*
     * A document uploads straight to R2 and the record keeps only the resulting
     * object key (AGENTS.md, Storage). The name beside the picker is the label
     * the customer sees on their download, so it stays editable after the file
     * lands — a scan called `IMG_4821.pdf` should not reach them that way.
     */
    case 'file':
      return (
        <ResultFileControl
          field={field}
          value={value}
          onChange={onChange}
          upload={upload}
          stored={stored}
          resultId={resultId}
          invalid={invalid}
          base={base}
        />
      );

    case 'text':
    default:
      return (
        <input
          id={field.name}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid}
          className={`${base} h-11`}
        />
      );
  }
}

export function ResultForm({
  result,
  isSaving,
  error,
  onSave,
  mode = 'deliver',
}: ResultFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    seedValues(result),
  );

  /*
   * Files uploaded in THIS editing session, keyed by field. A field whose
   * document was uploaded on a previous visit is not here — the record already
   * holds its key, and re-sending nothing leaves that key untouched.
   */
  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({});

  // Re-seed when the record changes underneath — a save returns the stored
  // shape, and a `date` round-trips through ISO so the input needs the trim.
  useEffect(() => {
    setValues(seedValues(result));
    setUploads({});
  }, [result]);

  /*
   * A file field is satisfied by an object, not by a name: a document with a
   * label and nothing behind it is not delivered. So it counts as missing until
   * something was uploaded now or is already stored — which is the same rule the
   * backend applies when it gates the delivery.
   */
  const missing = useMemo(
    () =>
      result.fields
        .filter((field) =>
          field.type === 'file'
            ? field.required &&
              !uploads[field.name] &&
              !result.values[field.name]?.file
            : field.required && !values[field.name]?.trim(),
        )
        .map((field) => field.name),
    [result.fields, result.values, uploads, values],
  );

  const submit = (deliver: boolean) => {
    const payload: ResultValueInput[] = result.fields.flatMap((field) => {
      const raw = values[field.name]?.trim() ?? '';

      if (field.type === 'file') {
        const uploaded = uploads[field.name];

        // Uploaded in this session: the key is what makes it a delivered
        // document, and the scalar carries the label the customer downloads it as.
        if (uploaded) {
          return [
            {
              fieldKey: field.name,
              value: raw || uploaded.name,
              objectKey: uploaded.objectKey,
              contentType: uploaded.contentType,
              sizeBytes: uploaded.sizeBytes,
            },
          ];
        }

        // Cleared: send it as blank so the backend deletes the stored value.
        if (!raw) return [{ fieldKey: field.name, value: null }];

        /*
         * Untouched with a document already stored. Omitted entirely rather than
         * re-sent: the backend treats a file value with no `objectKey` as
         * cleared, so sending the name alone would delete the very document this
         * save was meant to leave alone.
         */
        return [];
      }

      return [{ fieldKey: field.name, value: raw || null }];
    });

    onSave(payload, deliver);
  };

  const message =
    error instanceof ApiError
      ? error.message
      : error
        ? 'Something went wrong saving this record.'
        : null;

  const grouped = useMemo(() => {
    const sections = new Map<string, ResultField[]>();
    for (const field of result.fields) {
      const title = field.category?.trim() || 'Details';
      const existing = sections.get(title);
      if (existing) existing.push(field);
      else sections.set(title, [field]);
    }
    return [...sections];
  }, [result.fields]);

  const delivered = result.status !== 'draft';

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(mode === 'amend' ? true : missing.length === 0);
      }}
      className="flex w-full flex-col gap-5"
    >
      {delivered ? (
        <p className="flex items-start gap-2 rounded-input bg-[var(--color-status-completed-bg)] px-3 py-2.5 text-body text-[color:var(--color-status-completed-text)]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This record is live — the customer can see it. Saving publishes your
          changes immediately.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-input bg-gray-50 px-3 py-2.5 text-body text-gray-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          This is a draft. The customer sees nothing until you deliver it.
        </p>
      )}

      {grouped.map(([title, fields]) => (
        <fieldset key={title} className="flex flex-col gap-4">
          <legend className="text-body font-semibold text-text">{title}</legend>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5">
            {fields.map((field) => {
              const fullWidth = field.type === 'textarea' || field.type === 'url';
              const invalid = missing.includes(field.name);

              return (
                <div
                  key={field.name}
                  className={`flex flex-col gap-1.5 ${fullWidth ? 'md:col-span-2' : ''}`}
                >
                  <label htmlFor={field.name} className="text-body font-medium text-text">
                    {field.label}
                    {field.required ? (
                      <span className="text-error" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    ) : null}
                    {field.isPrimary ? (
                      <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-caption font-medium text-primary">
                        Title
                      </span>
                    ) : null}
                  </label>

                  <FieldControl
                    field={field}
                    value={values[field.name] ?? ''}
                    stored={result.values[field.name]?.file}
                    resultId={result.id}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, [field.name]: value }))
                    }
                    upload={{
                      attached: uploads[field.name],
                      onUploaded: (file) =>
                        setUploads((current) => ({
                          ...current,
                          [field.name]: file,
                        })),
                      onClear: () => {
                        setUploads((current) => {
                          const next = { ...current };
                          delete next[field.name];
                          return next;
                        });
                        // Clearing the name is what tells the backend to drop the
                        // stored document; without it an untouched key survives.
                        setValues((current) => ({ ...current, [field.name]: '' }));
                      },
                    }}
                    invalid={invalid}
                  />

                  {field.hint ? (
                    <p className="text-caption text-gray-500">{field.hint}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}

      {message ? (
        <p role="alert" className="text-body text-error">
          {message}
        </p>
      ) : null}

      <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 md:flex-row md:items-center md:justify-between">
        {missing.length > 0 && mode === 'deliver' ? (
          <p className="text-caption text-gray-500">
            {missing.length} required field{missing.length === 1 ? '' : 's'} still
            to fill in before this can be delivered.
          </p>
        ) : (
          <span />
        )}

        <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center">
          {mode === 'deliver' ? (
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={isSaving}
              className="btn btn-secondary h-11 rounded-input px-5 text-body disabled:opacity-60"
            >
              Save draft
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => submit(true)}
            disabled={isSaving || (mode === 'deliver' && missing.length > 0)}
            className="btn btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-input px-5 text-body disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Send className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            {mode === 'amend'
              ? 'Save changes'
              : delivered
                ? 'Update the customer'
                : 'Deliver to customer'}
          </button>
        </div>
      </footer>
    </form>
  );
}
