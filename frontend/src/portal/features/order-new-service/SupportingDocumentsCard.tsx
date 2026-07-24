import { useRef, useState } from 'react';
import { CloudUpload, FileText, X } from 'lucide-react';

import { formatFileSize } from '../../lib/format';

/*
 * Supporting documents — an optional dropzone plus the list of attached files.
 * It's a working uploader on the client: a hidden <input type="file"> the whole
 * dashed zone triggers (click or keyboard), drag-and-drop, and a removable row
 * per file. The card holds the selected `File[]` in the page's draft; the actual
 * upload to R2 happens on submit via a presigned URL (AGENTS.md, Storage) —
 * that's a backend step this screen deliberately doesn't do.
 *
 * Same tree every viewport; only card padding changes. Accept and the size cap
 * come from the design's helper line ("PDF, JPG or PNG · max 10 MB"); files over
 * the cap or of another type are skipped with a short inline message rather than
 * silently dropped.
 */

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type SupportingDocumentsCardProps = {
  files: File[];
  onChange: (files: File[]) => void;
};

export function SupportingDocumentsCard({
  files,
  onChange,
}: SupportingDocumentsCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;

    const accepted: File[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(incoming)) {
      const typeOk = ACCEPTED_TYPES.includes(file.type);
      const sizeOk = file.size <= MAX_BYTES;
      if (typeOk && sizeOk) accepted.push(file);
      else skipped.push(file.name);
    }

    if (accepted.length > 0) {
      // De-dupe by name + size so re-picking the same file doesn't stack.
      const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
      const merged = [...files];
      for (const file of accepted) {
        if (!seen.has(`${file.name}:${file.size}`)) merged.push(file);
      }
      onChange(merged);
    }

    setRejected(
      skipped.length > 0
        ? `Skipped ${skipped.length} file${skipped.length > 1 ? 's' : ''} — use PDF, JPG, or PNG up to 10 MB.`
        : null,
    );
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-5 md:p-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <h2 className="text-h6 font-semibold text-text">Supporting documents</h2>
          <span className="text-body text-gray-400">(optional)</span>
        </div>
        <p className="text-small text-text-secondary">
          Uploading incorporation or ID documents now speeds up review.
        </p>
      </div>

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
          addFiles(event.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-input border border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isDragging
            ? 'border-primary bg-primary-light'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <CloudUpload
          className="size-6 text-gray-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="text-body font-medium text-gray-700">
          Drag files here or browse
        </span>
        <span className="text-small text-gray-400">PDF, JPG or PNG · max 10 MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={(event) => {
          addFiles(event.target.files);
          // Reset so re-selecting the same file still fires onChange.
          event.target.value = '';
        }}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {rejected && <p className="text-small text-error">{rejected}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}:${file.size}`}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-gray-200 bg-gray-100 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText
                  className="size-[18px] shrink-0 text-gray-500"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-body text-gray-800">{file.name}</span>
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
    </section>
  );
}
