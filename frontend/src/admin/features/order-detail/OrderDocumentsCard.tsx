import { FileText } from 'lucide-react';

import { formatOrderDate } from '../../lib/format';
import type {
  AdminOrderDocument,
  AdminOrderDocumentStatus,
} from '../../types/order-detail';
import { SectionCard } from './SectionCard';

/*
 * Documents on the order — what the team owes the customer and what the customer
 * sent in.
 *
 * Read-only for now. Files live in Cloudflare R2 and are served as short-TTL
 * presigned URLs issued after an ownership check in the service layer
 * (AGENTS.md, Security & PII); that wiring is not built, so this card lists what
 * exists and states each row's status rather than offering a download link that
 * would have nothing behind it. Upload lands with the documents feature.
 *
 * A `pending` row is a placeholder — a document we have promised — which is why
 * it renders greyed rather than being hidden: the promise is the useful part.
 */

const STATUS_CLASS: Record<AdminOrderDocumentStatus, string> = {
  pending: 'status-draft',
  available: 'status-approved',
  rejected: 'status-missing',
};

// Sizes are bytes on the wire. Binary units, because that is what a file browser
// reports beside the same file.
function formatSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function OrderDocumentsCard({ documents }: { documents: AdminOrderDocument[] }) {
  return (
    <SectionCard title="Documents">
      {documents.length === 0 ? (
        <p className="text-body text-gray-500">
          No documents on this order yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => {
            const size = formatSize(document.sizeBytes);

            return (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-input border border-gray-200 p-3"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-input ${
                    document.status === 'available'
                      ? 'bg-primary-light text-primary'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <FileText className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="truncate text-body font-medium text-text">{document.name}</p>
                  <p className="truncate text-small text-gray-400">
                    {document.source === 'customer' ? 'Uploaded by customer' : 'From the team'}
                    <span aria-hidden="true"> · </span>
                    {formatOrderDate(document.createdAt)}
                    {size ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        {size}
                      </>
                    ) : null}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold leading-4 ${STATUS_CLASS[document.status]}`}
                >
                  {document.statusLabel}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
