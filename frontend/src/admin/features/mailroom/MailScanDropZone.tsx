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
 * The links draw the empty state only. The attached state, the drag-over
 * highlight, and the rejection message are filled in here (Design.md — states
 * the design did not cover); an upload control that gives no feedback once a
 * file is chosen is not a usable one.
 *
 * Type and size are checked before the file is accepted so the operator learns
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
  file: MailScanAttachment | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

export function MailScanDropZone({
  file,
  onSelect,
  onRemove,
}: MailScanDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (candidate: File) => {
    if (!SCAN_ACCEPTED_TYPES.includes(candidate.type)) {
      setError('That file type is not supported. Upload a PDF, JPG, or PNG.');
      return;
    }
    if (candidate.size > SCAN_MAX_BYTES) {
      setError('That scan is larger than 10 MB.');
      return;
    }
    setError(null);
    onSelect(candidate);
  };

  if (file) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center gap-3 rounded-input border border-gray-300 bg-gray-50 px-4 py-3">
          <FileText
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body font-medium text-text">
              {file.name}
            </span>
            <span className="text-small text-gray-400">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) accept(dropped);
        }}
        className={`flex h-[120px] w-full flex-col items-center justify-center gap-2 rounded-input border border-dashed p-5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-[140px] lg:p-card ${
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
          Drag &amp; drop or click to upload scan
        </span>
        <span className="text-small text-gray-400">PDF, JPG or PNG · max 10 MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="Upload scanned mail"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) accept(chosen);
          // Reset so re-picking the same file after a removal still fires.
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
