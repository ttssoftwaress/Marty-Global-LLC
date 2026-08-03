import { useMemo } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatFileSize, formatOrderDate } from '../../lib/format';
import type { PortalDocument } from '../../types/documents';
import { DocumentSourceChip } from './DocumentSourceChip';
import { fileIconFor } from './fileIcons';

/*
 * The documents list — two presentations of one list, swapped by breakpoint (a
 * table row can't reflow into a card, so each renders its own markup, the same
 * approach the mail and orders lists take):
 *   - desktop (lg): full table — name · belongs to · source · size · added ·
 *                   download
 *   - tablet (md):  the same table, folding "belongs to" under the name and
 *                   dropping the standalone SIZE column
 *   - mobile:       one card per document — icon + name/source, the context and
 *                   meta beneath, and a full-width download button
 *
 * A document we owe the customer but haven't filed yet renders its row with a
 * disabled control and says why, rather than a dead button (Design.md — a
 * control disabled for a reason states the reason near it).
 */

type DocumentListProps = {
  documents: PortalDocument[]; // full loaded set — mobile renders all of it
  page: number; // 1-based desktop window
  pageSize: number;
  totalItems: number;
  isLoading?: boolean;
  isFiltered?: boolean;
  onDownload: (document: PortalDocument) => void;
  downloadingId: string | null;
  downloadError: string | null;
};

function DownloadAction({
  document,
  onDownload,
  isDownloading,
  fullWidth,
}: {
  document: PortalDocument;
  onDownload: (document: PortalDocument) => void;
  isDownloading: boolean;
  fullWidth?: boolean;
}) {
  const width = fullWidth ? 'w-full' : 'w-full lg:w-auto lg:min-w-[6.25rem]';
  const base = `inline-flex items-center justify-center gap-1.5 rounded-[0.5rem] px-4 py-2 text-[0.8125rem] font-semibold transition-colors lg:rounded-[0.625rem] ${width}`;

  if (!document.available) {
    return (
      <span
        className={`${base} cursor-default border border-gray-200 bg-white text-gray-400`}
        title="We'll add this document once it has been filed"
      >
        Awaiting
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onDownload(document)}
      disabled={isDownloading}
      className={`${base} border border-primary bg-white text-primary hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white`}
    >
      {isDownloading ? (
        <>
          <Loader2
            className="size-3.5 shrink-0 animate-spin"
            strokeWidth={2}
            aria-hidden="true"
          />
          Preparing…
        </>
      ) : (
        <>
          <Download
            className="size-3.5 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          Download
        </>
      )}
    </button>
  );
}

function DocumentName({ document }: { document: PortalDocument }) {
  const Icon = fileIconFor(document.contentType);

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-gray-100">
        <Icon
          className="size-4 text-gray-500"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold text-text">
          {document.name}
        </span>
        {/* Tablet folds the context under the name; desktop has its own column. */}
        <Link
          to={document.contextHref}
          className="block truncate text-small text-primary hover:underline lg:hidden"
        >
          {document.contextLabel}
        </Link>
      </span>
    </span>
  );
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <FileText
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {isFiltered ? 'No documents match' : 'No documents yet'}
      </p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
        {isFiltered
          ? 'Nothing matches this view. Try another source, or clear your search.'
          : 'Certificates we file, files you send with an application, and your scanned mail will all appear here.'}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-12 w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

export function DocumentList({
  documents,
  page,
  pageSize,
  totalItems,
  isLoading,
  isFiltered = false,
  onDownload,
  downloadingId,
  downloadError,
}: DocumentListProps) {
  const isEmpty = !isLoading && documents.length === 0;
  const showSkeleton = Boolean(isLoading) && documents.length === 0;

  // Desktop/tablet show one page window into the loaded set; mobile shows all.
  const windowStart = (page - 1) * pageSize;
  const windowDocuments = useMemo(
    () => documents.slice(windowStart, windowStart + pageSize),
    [documents, windowStart, pageSize],
  );

  const shownFrom = totalItems === 0 ? 0 : windowStart + 1;
  const shownTo = Math.min(totalItems, windowStart + windowDocuments.length);

  return (
    <section className="flex w-full flex-col gap-4">
      {/* Meta bar — tablet & desktop */}
      <div className="hidden min-h-5 items-center justify-between md:flex">
        <p className="text-small text-gray-500">
          Showing {shownFrom}–{shownTo} of {totalItems} documents
        </p>
      </div>

      {/*
       * A failed link request belongs beside the list it was triggered from, not
       * in a toast that scrolls away (Design.md — an inline submit error sits by
       * the control that failed).
       */}
      {downloadError ? (
        <p
          role="alert"
          className="rounded-input bg-[var(--color-status-missing-bg)] px-3 py-2 text-small font-medium text-error"
        >
          {downloadError}
        </p>
      ) : null}

      {/* Mobile — one card per document */}
      <div className="flex w-full flex-col gap-3 md:hidden">
        {showSkeleton ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <SkeletonRows />
          </div>
        ) : isEmpty ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <EmptyState isFiltered={isFiltered} />
          </div>
        ) : (
          documents.map((document) => (
            <div
              key={`${document.source}-${document.id}`}
              className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
            >
              <div className="flex items-start justify-between gap-2">
                <DocumentName document={document} />
                <DocumentSourceChip source={document.source} />
              </div>

              <p className="text-small text-gray-500">
                Added {formatOrderDate(document.createdAt)}
                {document.sizeBytes !== null
                  ? ` · ${formatFileSize(document.sizeBytes)}`
                  : ''}
              </p>

              <div className="h-px w-full bg-gray-200" />
              <DownloadAction
                document={document}
                onDownload={onDownload}
                isDownloading={downloadingId === document.id}
                fullWidth
              />
            </div>
          ))
        )}
      </div>

      {/* Tablet & desktop — card-wrapped table */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <div className="table-scroll">
          <table className="data-table min-w-[38rem] table-fixed lg:min-w-[54rem]">
            <thead>
              <tr className="h-12">
                <th scope="col" className="pl-4 pr-3 lg:pl-6">
                  Document
                </th>
                <th scope="col" className="hidden w-[11rem] pr-3 lg:table-cell">
                  Belongs to
                </th>
                <th scope="col" className="w-[6.25rem] pr-3">
                  Source
                </th>
                <th
                  scope="col"
                  className="hidden w-[6.25rem] pr-3 lg:table-cell"
                >
                  Size
                </th>
                <th scope="col" className="w-[8.75rem] pr-3">
                  Added
                </th>
                <th
                  scope="col"
                  className="w-[7.5rem] pr-4 text-right lg:w-[9.375rem] lg:pr-6"
                >
                  Action
                </th>
              </tr>
            </thead>

            {!showSkeleton && !isEmpty && (
              <tbody>
                {windowDocuments.map((document) => (
                  <tr
                    key={`${document.source}-${document.id}`}
                    className="h-16 bg-white lg:h-[4.5rem]"
                  >
                    <td className="min-w-0 py-2 pl-4 pr-3 lg:pl-6">
                      <DocumentName document={document} />
                    </td>

                    <td className="hidden min-w-0 pr-3 lg:table-cell">
                      <Link
                        to={document.contextHref}
                        title={document.contextLabel}
                        className="block truncate text-primary hover:underline"
                      >
                        {document.contextLabel}
                      </Link>
                    </td>

                    <td className="pr-3">
                      <DocumentSourceChip source={document.source} />
                    </td>

                    <td className="hidden whitespace-nowrap pr-3 text-gray-600 lg:table-cell">
                      {document.sizeBytes !== null
                        ? formatFileSize(document.sizeBytes)
                        : '—'}
                    </td>

                    <td className="whitespace-nowrap pr-3 text-gray-600">
                      {formatOrderDate(document.createdAt)}
                    </td>

                    <td className="pr-4 text-right lg:pr-6">
                      <div className="flex justify-end">
                        <DownloadAction
                          document={document}
                          onDownload={onDownload}
                          isDownloading={downloadingId === document.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {showSkeleton && <SkeletonRows />}
        {isEmpty && <EmptyState isFiltered={isFiltered} />}
      </div>
    </section>
  );
}
