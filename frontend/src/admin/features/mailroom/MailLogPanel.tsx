import { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';

import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { SelectionBar } from '../../components/SelectionBar';
import { useBulkDelete } from '../trash';
import { useCursorPageWindow } from '../../hooks/useCursorPageWindow';
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

// Matches the endpoint's default `limit`, so a fetched cursor page fills exactly
// one printed page of the footer's strip.
const PAGE_SIZE = 8;

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

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const filters = useMemo(
    () => ({ search: debouncedSearch, range, action }),
    [debouncedSearch, range, action],
  );

  const log = useAdminMailLog(filters);

  const loadedEntries = useMemo<MailLogRow[]>(
    () => log.data?.pages.flatMap((page) => page.entries) ?? [],
    [log.data],
  );

  const totalResults = log.data?.pages[0]?.totalResults ?? 0;
  const totalPages = log.data?.pages[0]?.totalPages ?? 1;

  // The strip prints one window over the loaded stream. A narrower filter has
  // fewer pages — page 4 may not exist under it — so the filters key the window.
  const {
    page,
    rows: entries,
    goToPage,
  } = useCursorPageWindow({
    rows: loadedEntries,
    totalPages,
    totalResults,
    pageSize: PAGE_SIZE,
    hasNextPage: log.hasNextPage,
    isFetchingNextPage: log.isFetchingNextPage,
    fetchNextPage: log.fetchNextPage,
    resetKey: `${search}|${range}|${action}`,
  });

  /*
   * The log is append-only in the mail flow — nothing in it is edited or removed
   * as part of working the queue. The delete is the mis-filed-entry escape
   * hatch, which is exactly the case a restorable Trash is for.
   */
  const bulk = useBulkDelete({
    entityType: 'mail-log',
    visibleIds: entries.map((entry) => entry.id),
    resetKey: `${search}|${range}|${action}|${page}`,
  });

  const clearFilters = () => {
    setSearch('');
    setRange('all');
    setAction('all');
  };

  const isFiltered =
    debouncedSearch.trim().length > 0 || range !== 'all' || action !== 'all';

  const filterStrip = (
    <MailLogFilters
      search={search}
      onSearchChange={setSearch}
      range={range}
      onRangeChange={setRange}
      action={action}
      onActionChange={setAction}
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

        <div
          role="alert"
          className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-center shadow-sm-elevation"
        >
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

  const isEmpty = loadedEntries.length === 0;

  return (
    <div className="flex w-full flex-col gap-4">
      {filterStrip}

      {bulk.canDelete ? (
        <SelectionBar
          count={bulk.selection.count}
          noun="log entries"
          singularNoun="log entry"
          onDelete={bulk.openDialog}
          onClear={bulk.selection.clear}
          isDeleting={bulk.isDeleting}
        />
      ) : null}

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
              <MailLogTable
                entries={entries}
                onView={onView}
                selection={bulk.selection}
                selectable={bulk.canDelete}
              />
            </div>

            {/*
             * The footer sits on the page background beneath the card at every
             * width — the placement all three links draw.
             */}
            <MailLogPagination
              page={page}
              pageSize={PAGE_SIZE}
              totalResults={totalResults}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>

      <ConfirmDeleteDialog
        open={bulk.isDialogOpen}
        count={bulk.selection.count}
        singularNoun="log entry"
        pluralNoun="log entries"
        retentionDays={bulk.retentionDays}
        isDeleting={bulk.isDeleting}
        error={bulk.error}
        onConfirm={bulk.confirm}
        onClose={bulk.closeDialog}
      />
    </div>
  );
}
