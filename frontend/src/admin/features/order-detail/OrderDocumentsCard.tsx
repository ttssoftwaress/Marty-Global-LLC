import { Download, Eye, FileText } from 'lucide-react';

import { ApiError } from '@/services/api';
import { formatFileSize, formatOrderDate } from '../../lib/format';
import { openPresignedFile } from '../../lib/open-file';
import type {
  AdminDocumentDisposition,
  AdminOrderDocument,
  AdminOrderDocumentStatus,
} from '../../types/order-detail';
import { useAdminOrderDocumentLink } from './queries';
import { SectionCard } from './SectionCard';

/*
 * Documents on the order — what the team owes the customer and what the customer
 * sent in, with the two controls that open each one.
 *
 * Neither control holds a URL. Files live in private R2 buckets and are served
 * only as short-TTL presigned links the backend mints per click, after checking
 * that this reviewer holds the order (AGENTS.md, Security & PII) — so a link is
 * never in the cached record and never outlives the tab it was opened in. The
 * backend also audits every one of these: a staff member opening a customer's
 * passport is exactly the access a trail exists to record.
 *
 * View and Download are a real distinction, not two names for the same thing. The
 * disposition is signed into the URL, so `inline` previews the file in a new tab
 * and `attachment` saves it under its own name — a "Download" button that merely
 * opened a PDF in a tab would be lying about what it does.
 *
 * A `pending` row is a placeholder — a document we have promised — which is why
 * it renders greyed rather than being hidden: the promise is the useful part. Its
 * controls are disabled, because the endpoint refuses it too.
 */

const STATUS_CLASS: Record<AdminOrderDocumentStatus, string> = {
  pending: 'status-draft',
  available: 'status-approved',
  rejected: 'status-missing',
};

// Which types a browser tab will actually render. Anything else would download on
// "View" regardless, so the control is not offered for it. A null type is a row
// filed before we captured one — offered, since the upload policy has only ever
// accepted PDFs and images.
function isPreviewable(contentType: string | null): boolean {
  return (
    contentType === null ||
    contentType === 'application/pdf' ||
    contentType.startsWith('image/')
  );
}

const ACTION_CLASS =
  'flex size-8 shrink-0 items-center justify-center rounded-input border border-gray-200 bg-gray-50 text-text transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400';

export function OrderDocumentsCard({
  documents,
  orderId,
}: {
  documents: AdminOrderDocument[];
  orderId: string;
}) {
  const link = useAdminOrderDocumentLink(orderId);

  const open = (
    document: AdminOrderDocument,
    disposition: AdminDocumentDisposition,
  ) => {
    link.mutate(
      { documentId: document.id, disposition },
      {
        onSuccess: ({ url }) => openPresignedFile(url, disposition, document.name),
      },
    );
  };

  // Which row is waiting on a link — so only that row's controls go busy rather
  // than the whole card.
  const busyId = link.isPending ? link.variables?.documentId : undefined;

  return (
    <SectionCard title="Documents">
      {documents.length === 0 ? (
        <p className="text-body text-gray-500">
          No documents on this order yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => {
            const busy = busyId === document.id;
            const size =
              document.sizeBytes === null ? null : formatFileSize(document.sizeBytes);

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
                  <FileText className="size-[1.125rem]" strokeWidth={1.75} aria-hidden="true" />
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

                {/*
                  * "Available" is what the two live controls beside it already
                  * say, so on a narrow row it gives its width back to the
                  * filename. A pending or rejected row keeps its chip at every
                  * width — there it is the only thing explaining why the controls
                  * are dead.
                  */}
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold leading-4 ${
                    document.downloadable ? 'hidden sm:inline' : ''
                  } ${STATUS_CLASS[document.status]}`}
                >
                  {document.statusLabel}
                </span>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isPreviewable(document.contentType) ? (
                    <button
                      type="button"
                      disabled={!document.downloadable || busy}
                      onClick={() => open(document, 'inline')}
                      className={ACTION_CLASS}
                      aria-label={
                        document.downloadable
                          ? `View ${document.name}`
                          : `View ${document.name} (${document.statusLabel.toLowerCase()} — no file yet)`
                      }
                      title="View"
                    >
                      <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={!document.downloadable || busy}
                    onClick={() => open(document, 'attachment')}
                    className={ACTION_CLASS}
                    aria-label={
                      document.downloadable
                        ? `Download ${document.name}`
                        : `Download ${document.name} (${document.statusLabel.toLowerCase()} — no file yet)`
                    }
                    title="Download"
                  >
                    <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {link.isError ? (
        <p role="alert" className="text-small text-error">
          {link.error instanceof ApiError
            ? link.error.message
            : 'That document could not be opened. Please try again.'}
        </p>
      ) : null}
    </SectionCard>
  );
}
