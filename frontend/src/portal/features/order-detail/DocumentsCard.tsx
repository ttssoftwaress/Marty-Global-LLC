import { useRef, useState } from 'react';
import { Check, CloudUpload, Download, FileText } from 'lucide-react';

import {
  acceptAttr,
  describeTypes,
  DOCUMENT_TYPES,
  isAcceptedType,
  MAX_BYTES as MAX,
} from '@/constants/uploads';
import { ApiError } from '@/services/api';
import { uploadFiles } from '@/services/upload';
import type { OrderDocument } from '../../types/orders';
import { useAttachOrderDocuments, useOrderDocumentLink } from './queries';
import { SectionCard } from './SectionCard';

/*
 * Documents card — each document as a row: file icon, name, a status chip
 * (Available / Pending), and a download control.
 *
 * The download is NOT a stored link. A presigned URL is a bearer token for the
 * customer's own paperwork, so it is minted per click, after an ownership check
 * (AGENTS.md, Security & PII) — the row asks for one and opens it, rather than
 * holding a URL that would still be live in a shared screenshot.
 *
 * The dropzone uploads straight to R2 and then attaches the resulting keys to the
 * order; the bytes never round-trip through the API.
 */

// Mirrors the backend's `order-document` policy — see constants/uploads.ts.
const TYPE_LABEL = describeTypes(DOCUMENT_TYPES);
const MAX_BYTES = MAX.orderDocument;
const MAX_MB = MAX_BYTES / (1024 * 1024);

function DocStatusChip({ available }: { available: boolean }) {
  if (available) {
    return (
      <span className="status-badge status-approved gap-1.5 px-2.5 text-small font-medium">
        <Check className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        Available
      </span>
    );
  }
  return (
    <span className="status-badge status-draft px-2.5 text-small font-medium">
      Pending
    </span>
  );
}

function DownloadControl({
  orderId,
  document: row,
}: {
  orderId: string;
  document: OrderDocument;
}) {
  const link = useOrderDocumentLink(orderId);

  if (!row.available) {
    return (
      <button
        type="button"
        disabled
        className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-gray-100 text-gray-400"
        aria-label={`Download ${row.name} (not available yet)`}
      >
        <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={link.isPending}
      onClick={() => {
        link.mutate(row.id, {
          onSuccess: ({ url }) => {
            // A new tab rather than a same-tab navigation: the customer stays on
            // their order, and the browser handles the file however it prefers.
            window.open(url, '_blank', 'noopener,noreferrer');
          },
        });
      }}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-text transition-colors hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60"
      aria-label={`Download ${row.name}`}
    >
      <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function DocumentsCard({
  documents,
  orderId,
}: {
  documents: OrderDocument[];
  orderId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const attach = useAttachOrderDocuments(orderId);
  const isBusy = progress !== null || attach.isPending;

  /*
   * Upload first, then attach the keys. Checked here for type and size so the
   * customer learns about a bad file before anything is sent; the backend
   * re-validates both — this is convenience, not the boundary (AGENTS.md).
   */
  const onFiles = async (candidates: File[]) => {
    const accepted = candidates.filter(
      (file) => isAcceptedType(file, DOCUMENT_TYPES) && file.size <= MAX_BYTES,
    );

    if (accepted.length === 0) {
      setError(`Upload a ${TYPE_LABEL} file under ${MAX_MB} MB.`);
      return;
    }

    setError(
      accepted.length < candidates.length
        ? `Some files were skipped — only ${TYPE_LABEL} under ${MAX_MB} MB are accepted.`
        : null,
    );
    setProgress(0);

    try {
      const uploaded = await uploadFiles(accepted, 'order-document', {
        onProgress: setProgress,
      });

      attach.mutate({ documents: uploaded });
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'Those files could not be uploaded. Please try again.',
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <SectionCard title="Documents" className="gap-5">
      {documents.length > 0 ? (
        <ul className="flex flex-col">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center justify-between gap-3 border-b border-gray-200 py-3.5 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileText
                  className="size-5 shrink-0 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <p className="min-w-0 truncate text-body font-medium text-text">
                  {document.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 md:gap-4">
                <DocStatusChip available={document.available} />
                <DownloadControl orderId={orderId} document={document} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-small text-gray-500">
          No documents yet. Anything you upload here goes straight to your
          specialist.
        </p>
      )}

      <button
        type="button"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          if (isBusy) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (isBusy) return;
          event.preventDefault();
          setIsDragging(false);
          void onFiles(Array.from(event.dataTransfer.files));
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-input border border-dashed p-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
          isDragging
            ? 'border-primary bg-primary-light'
            : 'border-gray-300 bg-gray-50 hover:border-primary hover:bg-primary-light'
        }`}
      >
        <CloudUpload className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-body font-medium text-text">Drag files here or browse</p>
        <p className="text-small text-gray-400">
          {TYPE_LABEL} · max {MAX_MB} MB
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr(DOCUMENT_TYPES)}
        multiple
        className="sr-only"
        aria-label="Upload documents for this order"
        onChange={(event) => {
          void onFiles(Array.from(event.target.files ?? []));
          // Reset so re-picking the same file still fires.
          event.target.value = '';
        }}
      />

      {progress !== null ? (
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

      {error || attach.isError ? (
        <p role="alert" className="text-small text-error">
          {error ?? 'Those documents could not be attached. Please try again.'}
        </p>
      ) : null}
    </SectionCard>
  );
}
