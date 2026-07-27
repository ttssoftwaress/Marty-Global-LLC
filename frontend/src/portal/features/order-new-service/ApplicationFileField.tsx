import { useRef, useState } from 'react';
import { CloudUpload, FileText, X } from 'lucide-react';

import { formatFileSize } from '../../lib/format';
import type { ServiceFileField } from '../../types/order-new-service';

/*
 * A document-upload question on the master form — the customer side of the
 * admin's "Document upload" field type.
 *
 * It is the same dropzone language as the application-wide Supporting documents
 * card, scaled down to sit inside the field grid: the whole dashed area is one
 * button that opens the picker, drag-and-drop works, and each attached file gets
 * a removable row. Reusing that visual language is deliberate — a customer
 * should not have to learn two upload controls on one screen.
 *
 * What the admin configures drives it: `accept` filters the picker and rejects
 * mistyped drops, `maxSizeMb` caps each file, and `multiple` decides whether the
 * question collects a set or replaces its single file. The defaults below apply
 * only when the admin left those blank.
 *
 * Files stay in the page's draft as `File` objects; the upload to R2 happens on
 * submit via a presigned URL (AGENTS.md, Storage), which is a backend step this
 * control deliberately does not take. The answer value the form records is the
 * list of attached filenames, so the order reads correctly even before the
 * objects themselves are transferred.
 */

const DEFAULT_ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'];
const DEFAULT_MAX_MB = 10;

// What the file picker's `accept` attribute gets. Browsers take MIME types
// directly, so the admin's list passes through unchanged.
function acceptAttr(types: string[]): string {
  return types.join(',');
}

// "PDF, JPG or PNG" from a MIME list — the human half of the helper line. The
// subtype is the recognisable part of every type we accept, so it is what the
// customer is shown rather than the full "application/pdf".
function describeTypes(types: string[]): string {
  const labels = [
    ...new Set(
      types.map((type) => (type.split('/')[1] ?? type).toUpperCase()),
    ),
  ];

  if (labels.length === 0) return 'Any file';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
}

type ApplicationFileFieldProps = {
  field: ServiceFileField;
  files: File[];
  onChange: (files: File[]) => void;
  fieldId: string;
  describedBy?: string;
};

export function ApplicationFileField({
  field,
  files,
  onChange,
  fieldId,
  describedBy,
}: ApplicationFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const accepted = field.accept?.length ? field.accept : DEFAULT_ACCEPT;
  const maxMb = field.maxSizeMb ?? DEFAULT_MAX_MB;
  const maxBytes = maxMb * 1024 * 1024;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;

    const kept: File[] = [];
    const skipped: string[] = [];

    for (const file of Array.from(incoming)) {
      // An empty `accept` means the admin placed no restriction, so anything is
      // allowed; otherwise the type must be one they listed.
      const typeOk = accepted.length === 0 || accepted.includes(file.type);
      if (typeOk && file.size <= maxBytes) kept.push(file);
      else skipped.push(file.name);
    }

    if (kept.length > 0) {
      // A single-file question replaces rather than appends — otherwise picking
      // again would silently stack files the admin only wanted one of.
      const next = field.multiple
        ? mergeUnique(files, kept)
        : [kept[0]!];
      onChange(next);
    }

    setRejected(
      skipped.length > 0
        ? `Skipped ${skipped.length} file${skipped.length > 1 ? 's' : ''} — use ${describeTypes(accepted)} up to ${maxMb} MB.`
        : null,
    );
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
    setRejected(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        id={fieldId}
        aria-describedby={describedBy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-input border border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isDragging
            ? 'border-primary bg-primary-light'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <CloudUpload
          className="size-5 text-gray-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="text-body font-medium text-gray-700">
          {field.placeholder?.trim()
            ? field.placeholder
            : field.multiple
              ? 'Drag files here or browse'
              : 'Drag a file here or browse'}
        </span>
        <span className="text-small text-gray-400">
          {describeTypes(accepted)} · max {maxMb} MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        {...(field.multiple ? { multiple: true } : {})}
        {...(accepted.length > 0 ? { accept: acceptAttr(accepted) } : {})}
        onChange={(event) => {
          addFiles(event.target.files);
          // Reset so re-selecting the same file still fires onChange.
          event.target.value = '';
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {rejected && <p className="text-small text-error">{rejected}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}:${file.size}`}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-gray-200 bg-gray-100 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText
                  className="size-4 shrink-0 text-gray-500"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-body text-gray-800">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-small text-gray-400">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// De-dupe by name + size so re-picking the same file doesn't stack it twice.
function mergeUnique(existing: File[], incoming: File[]): File[] {
  const seen = new Set(existing.map((file) => `${file.name}:${file.size}`));
  const merged = [...existing];

  for (const file of incoming) {
    const id = `${file.name}:${file.size}`;
    if (!seen.has(id)) {
      merged.push(file);
      seen.add(id);
    }
  }

  return merged;
}
