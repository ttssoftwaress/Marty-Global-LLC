import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';

import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type {
  MailLogActionFilter,
  MailLogDateRange,
  MailLogRow,
} from '../../types/mailroom';
import { MailLogCardList } from './MailLogCardList';
import { MailLogFilters } from './MailLogFilters';
import { MailLogPagination } from './MailLogPagination';
import { MailLogTable } from './MailLogTable';
import { useAdminMailLog } from './queries';

/*
 * The "Mail log" section — the closed history of every item the mail room has
 * handled.
 *
 * Owns its own filter and page state rather than lifting them to the screen,
 * because neither outlives the tab: switching sections and coming back should
 * land on an unfiltered first page, not on wherever the operator left off. The
 * same call `MailRequestsPanel` makes for the queue beside it.
 *
 * The section is one card from `md` up (filter strip above it, table inside,
 * footer beneath on the page background) and a stack of cards on mobile.
 *
 * States the design does not draw, filled in here (Design.md): the first load's
 * skeleton, an empty log, an empty filter — which offers a way back to the
 * unfiltered list — and the error case. Paging and re-filtering keep the
 * previous rows in place (the query holds them) and dim them, so the table does
 * not collapse to a spinner on every click.
 */

const SEARCH_DEBOUNCE_MS = 300;

type MailLogPanelProps = {
  onView: (entry: MailLogRow) => void;
};

function TableSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4" aria-hidden="true">
      <div className="h-10 w-full animate-pulse rounded-input bg-gray-200 md:h-10" />
      <div className="h-[27.5rem] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

function EmptyState({
  isFiltered,
  onClearFilters,
}: {
  isFiltered: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <Archive className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-body-lg font-semibold text-text">
          {isFiltered ? 'No items match these filters' : 'Nothing in the mail log yet'}
        </p>
        <p className="max-w-sm text-small text-gray-500">
          {isFiltered
            ? 'Nothing in the log falls under these filters right now.'
            : 'Mail appears here once it has been forwarded, shredded, or downloaded.'}
        </p>
      </div>

      {isFiltered ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

export function MailLogPanel({ onView }: MailLogPanelProps) {
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<MailLogDateRange>('all');
  const [action, setAction] = useState<MailLogActionFilter>('all');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const filters = useMemo(
    () => ({ search: debouncedSearch, range, action }),
    [debouncedSearch, range, action],
  );

  const log = useAdminMailLog(filters, page);

  // A narrower filter has fewer pages; page 4 may not exist under it.
  const onSearchChange = (next: string) => {
    setSearch(next);
    setPage(1);
  };

  const onRangeChange = (next: MailLogDateRange) => {
    setRange(next);
    setPage(1);
  };

  const onActionChange = (next: MailLogActionFilter) => {
    setAction(next);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setRange('all');
    setAction('all');
    setPage(1);
  };

  const isFiltered =
    debouncedSearch.trim().length > 0 || range !== 'all' || action !== 'all';

  const filterStrip = (
    <MailLogFilters
      search={search}
      onSearchChange={onSearchChange}
      range={range}
      onRangeChange={onRangeChange}
      action={action}
      onActionChange={onActionChange}
    />
  );

  if (log.isPending) {
    return (
      <div className="flex w-full flex-col gap-4">
        {filterStrip}
        <TableSkeleton />
      </div>
    );
  }

  if (log.isError) {
    return (
      <div className="flex w-full flex-col gap-4">
        {filterStrip}

        <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center shadow-sm-elevation">
          <p className="text-body-lg font-semibold text-text">
            The mail log could not be loaded
          </p>
          <p className="max-w-sm text-small text-gray-500">
            Something went wrong fetching the history. Try again.
          </p>
          <button
            type="button"
            onClick={() => void log.refetch()}
            className="mt-1 flex h-10 items-center justify-center rounded-control border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { entries, pageSize, totalResults, totalPages } = log.data;
  const isEmpty = entries.length === 0;

  return (
    <div className="flex w-full flex-col gap-4">
      {filterStrip}

      {/* Dimmed while the next page or filter resolves over the current rows. */}
      <div
        className={`flex w-full flex-col gap-4 transition-opacity ${
          log.isFetching ? 'opacity-60' : ''
        }`}
      >
        {isEmpty ? (
          <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
            <EmptyState isFiltered={isFiltered} onClearFilters={clearFilters} />
          </div>
        ) : (
          <>
            <MailLogCardList entries={entries} onView={onView} />

            {/*
             * The card wraps the table from `md` up. On mobile the cards above
             * stand on the page background, so no surface is drawn there.
             */}
            <div className="hidden w-full overflow-hidden md:block md:rounded-card md:border md:border-gray-200 md:bg-white md:shadow-sm-elevation">
              <MailLogTable entries={entries} onView={onView} />
            </div>

            {/*
             * The footer sits on the page background beneath the card at every
             * width — the placement all three links draw.
             */}
            <MailLogPagination
              page={page}
              pageSize={pageSize}
              totalResults={totalResults}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
