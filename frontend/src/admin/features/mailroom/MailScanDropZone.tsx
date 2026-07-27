import { useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';

import {
  SCAN_ACCEPTED_TYPES,
  SCAN_MAX_BYTES,
  type MailScanAttachment,
} from '../../types/mailroom';

/*
 * The scan drop zone — drag-and-drop or click-to-browse for the scanned mail.
 *
 * An envelope is rarely one file: an operator scans several sheets, or attaches a
 * multi-page PDF alongside them. So this takes a LIST — files append rather than
 * replace, they can be removed individually, and their order is the order the
 * pages are filed in.
 *
 * The links draw the empty state only. The attached list, the drag-over
 * highlight, the per-file progress, and the rejection message are filled in here
 * (Design.md — states the design did not cover); an upload control that gives no
 * feedback once a file is chosen is not a usable one.
 *
 * Type and size are checked before a file is accepted so the operator learns
 * about a bad scan here rather than after submitting. The backend re-validates
 * both — this is convenience, not the boundary (AGENTS.md).
 *
 * Rendered as a button rather than a div-with-onClick so it is reachable and
 * operable by keyboard, with the file input hidden behind it.
 */

const ACCEPT = SCAN_ACCEPTED_TYPES.join(',');

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type MailScanDropZoneProps = {
  files: MailScanAttachment[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  // 0–1 while the set is uploading; null when idle. The zone locks during an
  // upload so the list cannot change under the request in flight.
  progress?: number | null;
  disabled?: boolean;
};

export function MailScanDropZone({
  files,
  onAdd,
  onRemove,
  progress = null,
  disabled = false,
}: MailScanDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUploading = progress !== null;
  const locked = disabled || isUploading;

  // Each rejection reason is reported once for the whole batch rather than per
  // file, so dropping ten files with two bad ones is one message, not two.
  const accept = (candidates: File[]) => {
    const accepted: File[] = [];
    let wrongType = false;
    let tooLarge = false;

    for (const candidate of candidates) {
      if (!SCAN_ACCEPTED_TYPES.includes(candidate.type)) {
        wrongType = true;
        continue;
      }
      if (candidate.size > SCAN_MAX_BYTES) {
        tooLarge = true;
        continue;
      }
      accepted.push(candidate);
    }

    setError(
      wrongType && tooLarge
        ? 'Some files were skipped — only PDF, JPG, or PNG under 10 MB are accepted.'
        : wrongType
          ? 'Some files were skipped. Upload a PDF, JPG, or PNG.'
          : tooLarge
            ? 'Some files were skipped — each scan must be under 10 MB.'
            : null,
    );

    if (accepted.length > 0) onAdd(accepted);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {files.length > 0 ? (
        <ul className="flex w-full flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex w-full items-center gap-3 rounded-input border border-gray-300 bg-gray-50 px-4 py-3"
            >
              <FileText
                className="size-5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium text-text">
                  {file.name}
                </span>
                <span className="text-small text-gray-400">
                  Page {index + 1} · {formatSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={locked}
                aria-label={`Remove ${file.name}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={locked}
        onDragOver={(event) => {
          if (locked) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (locked) return;
          event.preventDefault();
          setIsDragging(false);
          accept(Array.from(event.dataTransfer.files));
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-input border border-dashed p-5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
          files.length > 0 ? 'h-[92px]' : 'h-[120px] lg:h-[140px] lg:p-card'
        } ${
          isDragging
            ? 'border-primary bg-primary-light'
            : 'border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary-light'
        }`}
      >
        <UploadCloud
          className="size-6 shrink-0 text-gray-400 lg:size-7"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="text-body font-medium text-text-secondary">
          {files.length > 0
            ? 'Add another page'
            : 'Drag & drop or click to upload scan'}
        </span>
        <span className="text-small text-gray-400">
          PDF, JPG or PNG · max 10 MB each
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label="Upload scanned mail"
        onChange={(event) => {
          accept(Array.from(event.target.files ?? []));
          // Reset so re-picking the same file after a removal still fires.
          event.target.value = '';
        }}
      />

      {isUploading ? (
        <div className="flex w-full flex-col gap-1">
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
          <p className="text-small text-gray-500">
            Uploading… {Math.round(progress * 100)}%
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
