import { useState } from 'react';
import { Inbox } from 'lucide-react';

import type { MailRequestFilter, MailRequestRow } from '../../types/mailroom';
import { MailRequestCardList } from './MailRequestCardList';
import { MailRequestFilters } from './MailRequestFilters';
import { MailRequestsPagination } from './MailRequestsPagination';
import { MailRequestsTable } from './MailRequestsTable';
import { useAdminMailRequests, useProcessMailRequest } from './queries';

/*
 * The "Pending requests" section — the forwarding / shredding queue.
 *
 * Owns its own filter and page state rather than lifting them to the screen,
 * because neither outlives the tab: switching sections and coming back should
 * land on an unfiltered first page, not on wherever the operator left off.
 *
 * The section is one card at every width from `md` up (filter strip above,
 * table inside the card, footer beneath the rows) and a stack of cards on
 * mobile with the footer on the page background under them.
 *
 * States the design does not draw, filled in here (Design.md): the first load's
 * skeleton, an empty queue, an empty filter — which offers a way back to "All"
 * — and the error case. Paging and re-filtering keep the previous rows in place
 * (the query holds them) and dim them, so the table does not collapse to a
 * spinner on every click.
 */

type MailRequestsPanelProps = {
  onView: (request: MailRequestRow) => void;
};

function TableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3" aria-hidden="true">
      <div className="h-9 w-[280px] animate-pulse rounded-pill bg-gray-200" />
      <div className="h-[420px] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

function EmptyState({
  filter,
  onClearFilter,
}: {
  filter: MailRequestFilter;
  onClearFilter: () => void;
}) {
  const isFiltered = filter !== 'all';

  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <Inbox className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-body-lg font-semibold text-text">
          {isFiltered ? 'No requests match this filter' : 'No requests to work'}
        </p>
        <p className="max-w-sm text-small text-gray-500">
          {isFiltered
            ? 'Nothing in the queue falls under this filter right now.'
            : 'Forwarding and shredding requests appear here as customers raise them.'}
        </p>
      </div>

      {isFiltered ? (
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Show all requests
        </button>
      ) : null}
    </div>
  );
}

export function MailRequestsPanel({ onView }: MailRequestsPanelProps) {
  const [filter, setFilter] = useState<MailRequestFilter>('all');
  const [page, setPage] = useState(1);

  const requests = useAdminMailRequests(filter, page);
  const processRequest = useProcessMailRequest();

  const onFilterChange = (next: MailRequestFilter) => {
    setFilter(next);
    setPage(1); // A narrower filter has fewer pages; page 4 may not exist in it.
  };

  const clearFilter = () => onFilterChange('all');

  // Tracked per row so working one request does not disable every other button.
  const processingId = processRequest.isPending
    ? (processRequest.variables ?? null)
    : null;

  const onProcess = (request: MailRequestRow) => processRequest.mutate(request.id);

  if (requests.isPending) return <TableSkeleton />;

  if (requests.isError) {
    return (
      <div className="flex w-full flex-col gap-4">
        <MailRequestFilters value={filter} onChange={onFilterChange} />

        <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center shadow-sm-elevation">
          <p className="text-body-lg font-semibold text-text">
            That queue could not be loaded
          </p>
          <p className="max-w-sm text-small text-gray-500">
            Something went wrong fetching the requests. Try again.
          </p>
          <button
            type="button"
            onClick={() => void requests.refetch()}
            className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { requests: rows, pageSize, totalResults, totalPages } = requests.data;
  const isEmpty = rows.length === 0;

  return (
    <div className="flex w-full flex-col gap-4">
      <MailRequestFilters value={filter} onChange={onFilterChange} />

      {processRequest.isError ? (
        <p role="alert" className="text-small text-error">
          That request could not be processed. Try again.
        </p>
      ) : null}

      {/* Dimmed while the next page or filter resolves over the current rows. */}
      <div
        className={`flex w-full flex-col gap-4 transition-opacity ${
          requests.isFetching ? 'opacity-60' : ''
        }`}
      >
        {isEmpty ? (
          <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
            <EmptyState filter={filter} onClearFilter={clearFilter} />
          </div>
        ) : (
          <>
            <MailRequestCardList
              requests={rows}
              processingId={processingId}
              onProcess={onProcess}
              onView={onView}
            />

            {/*
             * The card wraps the table and its footer from `md` up. On mobile
             * the cards above stand on the page background and only the footer
             * keeps a surface, so the border is dropped below `md`.
             */}
            <div className="w-full overflow-hidden md:rounded-card md:border md:border-gray-200 md:bg-white md:shadow-sm-elevation">
              <MailRequestsTable
                requests={rows}
                processingId={processingId}
                onProcess={onProcess}
                onView={onView}
              />

              <MailRequestsPagination
                page={page}
                pageSize={pageSize}
                totalResults={totalResults}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
