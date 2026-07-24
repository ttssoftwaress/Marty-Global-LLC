import { Check, CloudUpload, Download, FileText } from 'lucide-react';

import type { OrderDocument } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Documents card — each generated document as a row: file icon, name, a status
 * chip (Available / Pending), and a download control. The download is a real
 * anchor to the presigned URL when the document is available, and a disabled
 * button when it is still pending (nothing to fetch yet), so the affordance
 * always reflects the data.
 *
 * The dropzone below is the upload affordance from the design. Wiring the file
 * picker is a later step (the upload endpoint isn't built); it renders as the
 * labelled drop target so the card matches the design and the interaction slots
 * in without layout change.
 */

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

function DownloadControl({ document }: { document: OrderDocument }) {
  if (document.available && document.href) {
    return (
      <a
        href={document.href}
        download
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-text transition-colors hover:bg-gray-100"
        aria-label={`Download ${document.name}`}
      >
        <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </a>
    );
  }
  return (
    <button
      type="button"
      disabled
      className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-gray-100 text-gray-400"
      aria-label={`Download ${document.name} (not available yet)`}
    >
      <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

export function DocumentsCard({ documents }: { documents: OrderDocument[] }) {
  return (
    <SectionCard title="Documents" className="gap-5">
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
              <DownloadControl document={document} />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center justify-center gap-2 rounded-input border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <CloudUpload className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-body font-medium text-text">Drag files here or browse</p>
        <p className="text-small text-gray-400">PDF, JPG or PNG · max 10 MB</p>
      </div>
    </SectionCard>
  );
}
