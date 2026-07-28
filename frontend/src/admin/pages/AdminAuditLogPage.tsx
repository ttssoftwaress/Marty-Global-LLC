import { useEffect, useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import {
  AuditActionFilter,
  AuditCardList,
  AuditCategoryTabs,
  AuditDateRange,
  AuditEmptyState,
  AuditErrorState,
  AuditHeader,
  AuditKpiCards,
  AuditLoadMore,
  AuditPagination,
  AuditSearch,
  AuditTable,
  useAdminAudit,
  useAdminAuditSummary,
} from '../features/audit';
import { useAdminShell } from '../hooks/useAdminShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { AdminAuditRow } from '../types/audit';
import { ALL_ACTIONS, ALL_CATEGORIES } from '../types/audit';

/*
 * Audit log — the admin screen for the trail of who did what.
 *
 * Until this screen existed the `AuditLog` table was write-only: every admin
 * write recorded into it and nothing ever read it back, which makes a trail
 * evidence nobody can examine. This is the one place it is read.
 *
 * Read-only throughout. There is no action button in the header, no row action,
 * and no mutation in the data layer — the trail is written by the backend's
 * recording layer and never edited from a screen, which is what makes it usable
 * as evidence. The header says so outright rather than leaving an admin hunting
 * for a control that does not exist.
 *
 * The section order is the same at every width — header, KPI cards, category
 * tabs, the filter row, then the list. What changes is how the filters lay out
 * and how the list is drawn:
 *   - desktop (lg): search, the action dropdown, and the date range share one
 *     row; the list is a five-column table in a bordered card
 *   - tablet (md):  search takes its own row, with the action dropdown and the
 *     date range sharing the next; the table drops its Record column
 *   - mobile:       every control takes a row, and the list becomes a stack of
 *     cards on the page background with no frame around them
 *
 * Every figure and row comes from the API; nothing here is hardcoded. Two
 * queries back it: the summary for the three KPI cards, the category tabs, and
 * the action options, and an infinite query for the list. Category, action,
 * search, and the date window are all query params the backend resolves, so a
 * page always agrees with the total printed beside it.
 *
 * Pagination is one cursor stream shown two ways (AGENTS.md): mobile's "Load
 * more" appends the next page, while the wider links' numbered pager steps a
 * window over what has loaded, fetching ahead when the window runs past the
 * loaded edge.
 */

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/*
 * A `YYYY-MM-DD` from the date input, as the instant the API filters on.
 *
 * `new Date('2026-07-29')` parses as UTC midnight, which is the wrong instant
 * for anyone not on UTC — an admin in Karachi asking for "today" would get a day
 * running from 5am to 5am. Splitting the parts and handing them to the `Date`
 * constructor builds the instant in the viewer's own zone, which is the day they
 * actually meant (AGENTS.md, Dates: convert at the edge, and never build a date
 * from a zoneless string).
 *
 * `to` is exclusive, so it resolves to the START of the day after the one
 * picked — that is what makes a single-day range include everything up to
 * midnight rather than stopping at 00:00:00 of the day itself.
 */
function dayToInstant(day: string, exclusiveEnd = false): string | null {
  if (!day) return null;

  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;

  const instant = new Date(year, month - 1, date + (exclusiveEnd ? 1 : 0));
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function AuditSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      {/* Mobile — a stack of cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-[9rem] animate-pulse rounded-card bg-gray-200"
          />
        ))}
      </div>

      {/* Tablet & desktop — the table frame */}
      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: 10 }, (_, index) => (
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

export function AdminAuditLogPage() {
  const { user, onLogout } = useAdminShell();

  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [action, setAction] = useState(ALL_ACTIONS);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const from = dayToInstant(range.from);
  const to = dayToInstant(range.to, true);

  const summary = useAdminAuditSummary();
  const audit = useAdminAudit({
    category,
    action,
    search: debouncedSearch,
    from,
    to,
  });

  // The page window the wider links' pager steps over. Any change to the result
  // set returns it to the first page, since the old offset means nothing now.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [category, action, debouncedSearch, from, to]);

  /*
   * Which row is expanded. One at a time, and cleared whenever the result set
   * changes: the id would otherwise point at an entry no longer on screen, and
   * a panel would silently reopen if that same entry came back under a later
   * filter.
   */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  useEffect(() => {
    setExpandedId(null);
  }, [category, action, debouncedSearch, from, to, pageIndex]);

  const toggleExpanded = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  const loadedEntries = useMemo<AdminAuditRow[]>(
    () => audit.data?.pages.flatMap((page) => page.entries) ?? [],
    [audit.data],
  );

  const totalResults = audit.data?.pages[0]?.totalResults ?? 0;
  const totalPages = audit.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const windowEntries = useMemo(
    () => loadedEntries.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [loadedEntries, pageIndex],
  );

  const goToPage = (nextPage: number) => {
    const nextIndex = Math.max(0, Math.min(nextPage - 1, totalPages - 1));
    // Pull the next cursor page in when the window runs past what has loaded.
    if (nextIndex * PAGE_SIZE >= loadedEntries.length && audit.hasNextPage) {
      void audit.fetchNextPage();
    }
    setPageIndex(nextIndex);
  };

  const onLoadMore = () => {
    if (audit.hasNextPage) void audit.fetchNextPage();
  };

  const clearFilters = () => {
    setCategory(ALL_CATEGORIES);
    setAction(ALL_ACTIONS);
    setSearch('');
    setRange({ from: '', to: '' });
  };

  const isFiltered =
    category !== ALL_CATEGORIES ||
    action !== ALL_ACTIONS ||
    Boolean(debouncedSearch.trim()) ||
    Boolean(range.from) ||
    Boolean(range.to);

  /*
   * The four states, each derived from the queries' own flags rather than from
   * "the data is absent" (Design.md) — a loading state that cannot be told apart
   * from a failed one is a bug, and on this screen a failure mistaken for
   * emptiness would read as a false all-clear.
   */
  const isLoading = summary.isPending || audit.isPending;
  const isError = summary.isError || audit.isError;
  const isEmpty = !isLoading && !isError && loadedEntries.length === 0;

  const onRetry = () => {
    void summary.refetch();
    void audit.refetch();
  };

  const rangeStart = totalResults === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + windowEntries.length;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 pb-8 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-4 md:gap-6 lg:gap-8">
          <AuditHeader />

          {summary.data ? <AuditKpiCards summary={summary.data} /> : null}

          {summary.data ? (
            <div className="flex w-full flex-col gap-4">
              <AuditCategoryTabs
                tabs={summary.data.categories}
                value={category}
                onChange={setCategory}
              />

              {/*
                * Desktop puts search, the action dropdown, and the date range on
                * one row; tablet gives search its own full-width row with the
                * other two sharing the next; mobile stacks all three. One tree
                * covers it — the row only forms at `lg`, and the action/date
                * pair splits apart below `md`.
                */}
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                <div className="w-full lg:w-[20rem] lg:shrink-0">
                  <AuditSearch value={search} onChange={setSearch} />
                </div>

                <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:gap-4">
                  <AuditActionFilter
                    options={summary.data.actions}
                    categories={summary.data.categories}
                    value={action}
                    onChange={setAction}
                    className="w-full md:w-[14rem] md:shrink-0 lg:w-[15rem]"
                  />

                  <div className="w-full md:min-w-0 md:flex-1 lg:max-w-[22rem]">
                    <AuditDateRange
                      from={range.from}
                      to={range.to}
                      onChange={setRange}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <AuditSkeleton />
          ) : isError ? (
            <AuditErrorState
              onRetry={onRetry}
              isRetrying={audit.isFetching || summary.isFetching}
            />
          ) : (
            <>
              {/* Mobile — cards on the page background, no surrounding frame. */}
              {isEmpty ? null : (
                <AuditCardList
                  entries={loadedEntries}
                  expandedId={expandedId}
                  onToggle={toggleExpanded}
                />
              )}

              {/* Tablet & desktop — the table in its own card. */}
              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
                {isEmpty ? (
                  <AuditEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                ) : (
                  <AuditTable
                    entries={windowEntries}
                    expandedId={expandedId}
                    onToggle={toggleExpanded}
                  />
                )}
              </div>

              {isEmpty ? (
                <div className="rounded-card border border-gray-200 bg-white md:hidden">
                  <AuditEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                </div>
              ) : (
                <>
                  {/* The pager sits under the table card, not inside it. */}
                  <AuditPagination
                    page={pageIndex + 1}
                    totalPages={totalPages}
                    totalResults={totalResults}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={goToPage}
                  />

                  <AuditLoadMore
                    totalResults={totalResults}
                    loadedCount={loadedEntries.length}
                    hasMore={Boolean(audit.hasNextPage)}
                    isLoadingMore={audit.isFetchingNextPage}
                    onLoadMore={onLoadMore}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
