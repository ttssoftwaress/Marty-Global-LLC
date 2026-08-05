import { useMemo, useState } from 'react';
import { CheckCircle2, Search, Trash2 } from 'lucide-react';

import { ApiError } from '@/services/api';
import { useAdminMe } from '@/admin/queries/admin-me';
import { AdminLayout } from '../components/AdminLayout';
import { DataErrorState } from '../components/DataErrorState';
import { EmptyState } from '../components/EmptyState';
import { ListLoadMore, ListPagination } from '../components/ListPagination';
import { TabStrip } from '../components/TabStrip';
import {
  ConfirmPurgeDialog,
  TrashActionBar,
  TrashCardList,
  TrashHeader,
  TrashKpiCards,
  TrashRetentionDialog,
  TrashTable,
  useAdminTrash,
  useAdminTrashSummary,
  usePurgeEntries,
  useRestoreEntries,
  useTrashSettings,
} from '../features/trash';
import { useAdminShell } from '../hooks/useAdminShell';
import { useCursorPageWindow } from '../hooks/useCursorPageWindow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useRowSelection } from '../hooks/useRowSelection';
import { ALL_TRASH_TYPES, type TrashEntry } from '../types/trash';

/*
 * Trash — everything deleted across the admin portal, and the way back.
 *
 * Every admin table's Delete now sends rows here rather than destroying them:
 * the record is stamped `deletedAt` (which every read in both apps already
 * filters, so it leaves every screen at once), anything that would be left
 * pointing at it goes too, and an entry is filed recording exactly what was
 * taken. Restoring replays that set — no more, no less — so a restored record is
 * as it was.
 *
 * THIS SCREEN IS ONE LIST OVER MANY TABLES, which shapes three things:
 *
 *   · A row never links anywhere. The record is soft-deleted, so its own screen
 *     would 404 on it; the snapshot label and sublabel taken at delete time are
 *     the record until it comes back.
 *   · The type tabs come from the API and list only the types that actually have
 *     something in them — a strip of twenty-five kinds with zero against
 *     twenty-three is a filter nobody reads.
 *   · What is on the list is scoped by the reader's own areas, server-side. A
 *     mail operator sees deleted mail, not deleted customers, and that decision
 *     is a `where` clause rather than a filter over results — so the total in
 *     the footer agrees with the rows above it.
 *
 * Two actions, weighted very differently. Restore is the primary and is why
 * anyone is here. "Delete permanently" is administrator-only, absent rather than
 * disabled otherwise, and the only control in the feature with nothing behind
 * it.
 *
 * The section order is the same at every width — header, KPI cards, type tabs,
 * search, then the list. What changes is the list: a five-column table in a
 * bordered card from `md`, and a stack of cards on the page background below it.
 *
 * No Figma link for this screen. It is built to the audit log's layout language
 * (header / KPI trio / tab strip / search / table card / pager), which is the
 * closest existing screen in shape and purpose — a cross-cutting, read-mostly
 * list over every other section. Logged as a deviation.
 */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function TrashSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[8rem] animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>

      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-table-row items-center border-b border-gray-200 px-5 last:border-b-0 lg:px-card"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTrashPage() {
  const { user, onLogout } = useAdminShell();
  const me = useAdminMe();

  const [entityType, setEntityType] = useState<string>(ALL_TRASH_TYPES);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [isRetentionOpen, setRetentionOpen] = useState(false);
  const [isPurgeOpen, setPurgeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const summary = useAdminTrashSummary();
  const settings = useTrashSettings();
  const trash = useAdminTrash({ entityType, search: debouncedSearch });

  const restore = useRestoreEntries();
  const purge = usePurgeEntries();

  const loadedEntries = useMemo<TrashEntry[]>(
    () => trash.data?.pages.flatMap((page) => page.entries) ?? [],
    [trash.data],
  );

  const totalResults = trash.data?.pages[0]?.totalResults ?? 0;
  const totalPages = trash.data?.pages[0]?.totalPages ?? 1;

  const filterKey = `${entityType}|${debouncedSearch}`;

  // The table shows one window; the mobile cards show everything loaded.
  const {
    page,
    rows: windowEntries,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useCursorPageWindow({
    rows: loadedEntries,
    totalPages,
    totalResults,
    pageSize: PAGE_SIZE,
    hasNextPage: trash.hasNextPage,
    isFetchingNextPage: trash.isFetchingNextPage,
    fetchNextPage: trash.fetchNextPage,
    resetKey: filterKey,
  });

  /*
   * Selection spans both presentations: the table ticks a window, the cards tick
   * everything loaded. Feeding the hook the union means a tick survives a page
   * step, and the hook still intersects with what is on screen so the count can
   * never describe a row that has gone.
   */
  const selectableIds = useMemo(
    () => loadedEntries.map((entry) => entry.id),
    [loadedEntries],
  );
  const selection = useRowSelection(selectableIds, filterKey);

  const selectedEntries = useMemo(
    () => loadedEntries.filter((entry) => selection.isSelected(entry.id)),
    [loadedEntries, selection],
  );

  const relatedCount = selectedEntries.reduce(
    (total, entry) => total + entry.cascadeCount,
    0,
  );

  // Courtesy only — the route and the service both enforce it (AGENTS.md, Auth).
  // A control nobody may press is worse than no control.
  const isAdmin = me.data?.role === 'admin';

  const onRestore = () => {
    const ids = selection.selected;
    if (ids.length === 0) return;

    setActionError(null);

    restore.mutate(ids, {
      onSuccess: (result) => {
        selection.clear();
        setNotice(
          `Restored ${result.restored} record${result.restored === 1 ? '' : 's'}${
            result.cascaded > 0
              ? ` and ${result.cascaded} related record${result.cascaded === 1 ? '' : 's'}`
              : ''
          }.`,
        );
      },
      onError: (cause: unknown) => {
        setActionError(
          cause instanceof ApiError ? cause.message : 'Could not restore. Try again.',
        );
      },
    });
  };

  const onPurge = () => {
    const ids = selection.selected;
    if (ids.length === 0) return;

    setActionError(null);

    purge.mutate(ids, {
      onSuccess: (result) => {
        selection.clear();
        setPurgeOpen(false);
        setNotice(
          `Permanently deleted ${result.purged} record${result.purged === 1 ? '' : 's'}${
            // Not a failure — a rule says those rows must be kept, and the reason
            // is now printed on each of them.
            result.kept > 0
              ? `. ${result.kept} could not be removed and stayed in the Trash.`
              : '.'
          }`,
        );
      },
      onError: (cause: unknown) => {
        setActionError(
          cause instanceof ApiError
            ? cause.message
            : 'Could not delete these. Try again.',
        );
      },
    });
  };

  const typeTabs = useMemo(
    () => [
      { value: ALL_TRASH_TYPES, label: 'Everything', count: summary.data?.totalEntries },
      ...(summary.data?.types ?? []).map((type) => ({
        value: type.value,
        label: type.label,
        count: type.count,
      })),
    ],
    [summary.data],
  );

  const isFiltered = entityType !== ALL_TRASH_TYPES || Boolean(debouncedSearch.trim());

  /*
   * The four states, each derived from the queries' own flags rather than from
   * "the data is absent" (Design.md) — a loading state that cannot be told apart
   * from a failed one is a bug, and here a failure mistaken for emptiness would
   * read as "nothing was deleted", which is the worst possible false all-clear.
   */
  const isLoading = summary.isPending || trash.isPending;
  const isError = summary.isError || trash.isError;
  const isEmpty = !isLoading && !isError && loadedEntries.length === 0;

  const onRetry = () => {
    void summary.refetch();
    void trash.refetch();
  };

  const clearFilters = () => {
    setEntityType(ALL_TRASH_TYPES);
    setSearch('');
  };

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 pb-8 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 md:gap-6 lg:gap-8">
          <TrashHeader
            retentionDays={settings.data?.retentionDays ?? null}
            purgeEnabled={settings.data?.purgeEnabled ?? true}
            {...(isAdmin ? { onEditRetention: () => setRetentionOpen(true) } : {})}
          />

          {summary.data ? <TrashKpiCards summary={summary.data} /> : null}

          {summary.data ? (
            <div className="flex w-full flex-col gap-4">
              <TabStrip
                tabs={typeTabs}
                value={entityType}
                onChange={setEntityType}
                ariaLabel="Filter the Trash by record type"
              />

              <div className="flex h-input w-full items-center gap-2 rounded-control border border-gray-300 bg-white px-4 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] lg:w-[24rem]">
                <Search
                  className="size-5 shrink-0 text-gray-400 md:size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search deleted records…"
                  aria-label="Search the Trash by record name"
                  className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
          ) : null}

          {/* The outcome of the last restore or permanent delete, and any refusal
              of one. Both sit above the list, where the selection was. */}
          {notice ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-card border border-success/30 bg-success/5 px-4 py-3 text-body text-success"
            >
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              {notice}
            </p>
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-body text-error"
            >
              {actionError}
            </p>
          ) : null}

          <TrashActionBar
            count={selection.count}
            onRestore={onRestore}
            {...(isAdmin
              ? {
                  onPurge: () => {
                    setActionError(null);
                    setPurgeOpen(true);
                  },
                }
              : {})}
            onClear={selection.clear}
            isRestoring={restore.isPending}
            isPurging={purge.isPending}
          />

          {isLoading ? (
            <TrashSkeleton />
          ) : isError ? (
            <DataErrorState
              title="Couldn’t load the Trash"
              description="Something went wrong fetching deleted records. Nothing has been lost — try again."
              onRetry={onRetry}
              isRetrying={trash.isFetching || summary.isFetching}
            />
          ) : (
            <>
              {isEmpty ? null : (
                <TrashCardList
                  entries={loadedEntries}
                  selection={selection}
                  selectable
                />
              )}

              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
                {isEmpty ? (
                  <EmptyState
                    icon={Trash2}
                    title={isFiltered ? 'Nothing matches this view' : 'The Trash is empty'}
                    description={
                      isFiltered
                        ? 'No deleted records match this type or search.'
                        : 'Records deleted from any admin screen land here, and can be restored until their retention window closes.'
                    }
                    {...(isFiltered
                      ? { action: { label: 'Clear filters', onClick: clearFilters } }
                      : {})}
                  />
                ) : (
                  <TrashTable
                    entries={windowEntries}
                    selection={selection}
                    selectable
                  />
                )}
              </div>

              {isEmpty ? (
                <div className="rounded-card border border-gray-200 bg-white md:hidden">
                  <EmptyState
                    icon={Trash2}
                    title={isFiltered ? 'Nothing matches this view' : 'The Trash is empty'}
                    description={
                      isFiltered
                        ? 'No deleted records match this type or search.'
                        : 'Records deleted from any admin screen land here.'
                    }
                    {...(isFiltered
                      ? { action: { label: 'Clear filters', onClick: clearFilters } }
                      : {})}
                  />
                </div>
              ) : (
                <>
                  <ListPagination
                    page={page}
                    totalPages={totalPages}
                    totalResults={totalResults}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={goToPage}
                    noun="records"
                    ariaLabel="Trash pagination"
                  />

                  <ListLoadMore
                    label="Load more records"
                    totalResults={totalResults}
                    loadedCount={loadedEntries.length}
                    hasMore={Boolean(trash.hasNextPage)}
                    isLoadingMore={trash.isFetchingNextPage}
                    onLoadMore={() => {
                      if (trash.hasNextPage) void trash.fetchNextPage();
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmPurgeDialog
        open={isPurgeOpen}
        count={selection.count}
        relatedCount={relatedCount}
        isPurging={purge.isPending}
        error={actionError}
        onConfirm={onPurge}
        onClose={() => setPurgeOpen(false)}
      />

      <TrashRetentionDialog
        open={isRetentionOpen}
        settings={settings.data}
        onClose={() => setRetentionOpen(false)}
      />
    </AdminLayout>
  );
}
