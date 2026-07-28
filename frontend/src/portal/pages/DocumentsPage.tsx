import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/services/api';

import { PortalLayout } from '../components/PortalLayout';
import {
  DocumentList,
  DocumentsControls,
  DocumentsError,
  DocumentsKpiCards,
  DocumentsPagination,
  useDocumentLink,
  useDocumentStats,
  useDocuments,
} from '../features/documents';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  DocumentSort,
  DocumentSourceFilter,
  PortalDocument,
} from '../types/documents';

/*
 * Documents — every file the customer has, in one place: what we filed for them,
 * what they sent us with an application, and their scanned mail.
 *
 * The backend gathers this from the three sources that already own files rather
 * than from a documents table (there isn't one, deliberately — see
 * documents.service.ts), so a document always links back to the order, record,
 * or mail item it belongs to. That link is the point of the screen: the library
 * is for finding a file, and its context is for understanding it.
 *
 * One tree serves all three viewports; the section components own how each part
 * reshapes between breakpoints (KPI 2-up ⇄ 3-up, table ⇄ card stack). The list
 * is an infinite query over the cursor stream (AGENTS.md): mobile "Load more"
 * appends and the whole loaded set stays on screen, desktop Prev/Next steps a
 * page window.
 */

const PAGE_SIZE = 10;

function DocumentsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:gap-5">
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="col-span-2 h-24 animate-pulse rounded-card bg-gray-200 md:col-span-1" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-input bg-gray-200" />
      <div className="h-[26.25rem] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

export function DocumentsPage() {
  const { user, onLogout } = usePortalShell();

  const [source, setSource] = useState<DocumentSourceFilter>('all');
  const [sort, setSort] = useState<DocumentSort>('newest');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const stats = useDocumentStats();
  const documents = useDocuments({ source, search: debouncedSearch, sort });

  // Desktop page window into the loaded documents. Reset to the first page
  // whenever the filters change, since the result set is different.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [source, sort, debouncedSearch]);

  const loadedDocuments = useMemo<PortalDocument[]>(
    () => documents.data?.pages.flatMap((page) => page.documents) ?? [],
    [documents.data],
  );

  const totalItems = documents.data?.pages[0]?.totalItems ?? 0;
  const totalPages = documents.data?.pages[0]?.totalPages ?? 1;

  const goPrev = () => setPageIndex((index) => Math.max(0, index - 1));
  const goNext = () => {
    const nextIndex = pageIndex + 1;
    // Fetch the next page if the window isn't loaded yet but more remain.
    if (nextIndex * PAGE_SIZE >= loadedDocuments.length && documents.hasNextPage) {
      void documents.fetchNextPage();
    }
    if (nextIndex < totalPages) setPageIndex(nextIndex);
  };
  const onLoadMore = () => {
    if (documents.hasNextPage) void documents.fetchNextPage();
  };

  /*
   * A download is a two-step: ask the backend for a short-TTL link (minted per
   * request after the ownership check), then follow it. The URL is never cached
   * — a second press asks again, because the first link has an expiry.
   *
   * `noopener` on the opened tab: the link points at R2, and a document should
   * never get a handle back on the portal window.
   */
  const link = useDocumentLink();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const onDownload = (document: PortalDocument) => {
    setDownloadingId(document.id);
    link.mutate(
      { source: document.source, documentId: document.id },
      {
        onSuccess: ({ url }) => {
          window.open(url, '_blank', 'noopener,noreferrer');
        },
        onSettled: () => setDownloadingId(null),
      },
    );
  };

  const downloadError =
    link.error instanceof ApiError
      ? link.error.message
      : link.isError
        ? "We couldn't prepare that download. Please try again."
        : null;

  // Split loading from failure: a skeleton that can't be told from an error
  // leaves the customer waiting on something that already failed (Design.md).
  const showSkeleton = stats.isLoading;
  const showError = !stats.isLoading && stats.isError;

  const isFiltered = source !== 'all' || debouncedSearch.trim().length > 0;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          <header className="flex w-full flex-col gap-2 md:gap-3">
            {/* Breadcrumb — tablet & desktop */}
            <p className="hidden items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] md:flex">
              <Link to="/app" className="text-primary hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-500">Documents</span>
            </p>

            <div className="flex flex-col gap-1">
              <h1 className="text-h4 font-semibold text-text md:text-h3">
                Documents
              </h1>
              <p className="text-small text-gray-500 md:text-body md:text-text-secondary">
                Everything we've filed for you, everything you've sent us, and
                your scanned mail — all in one place.
              </p>
            </div>
          </header>

          {showSkeleton ? (
            <DocumentsSkeleton />
          ) : showError ? (
            <DocumentsError
              onRetry={() => {
                void stats.refetch();
                void documents.refetch();
              }}
            />
          ) : (
            <>
              {stats.data ? <DocumentsKpiCards stats={stats.data} /> : null}

              <div className="flex w-full flex-col gap-6 lg:gap-7">
                <DocumentsControls
                  source={source}
                  onSourceChange={setSource}
                  search={search}
                  onSearchChange={setSearch}
                  sort={sort}
                  onSortChange={setSort}
                />

                {documents.isError ? (
                  <DocumentsError onRetry={() => void documents.refetch()} />
                ) : (
                  <>
                    <DocumentList
                      documents={loadedDocuments}
                      page={pageIndex + 1}
                      pageSize={PAGE_SIZE}
                      totalItems={totalItems}
                      isLoading={documents.isLoading}
                      isFiltered={isFiltered}
                      onDownload={onDownload}
                      downloadingId={downloadingId}
                      downloadError={downloadError}
                    />

                    {totalItems > 0 && (
                      <DocumentsPagination
                        page={pageIndex + 1}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        loadedCount={loadedDocuments.length}
                        hasMore={Boolean(documents.hasNextPage)}
                        onPrev={goPrev}
                        onNext={goNext}
                        onLoadMore={onLoadMore}
                      />
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
