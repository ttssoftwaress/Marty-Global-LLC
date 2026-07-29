import { useEffect, useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import { DataErrorState } from '../components/DataErrorState';
import {
  OrderCardList,
  OrderStatusTabs,
  OrdersEmptyState,
  OrdersLoadMore,
  OrdersPagination,
  OrdersQueueHeader,
  OrdersTable,
  OrdersToolbar,
  useAdminOrders,
  useAdminOrdersSummary,
} from '../features/orders';
import { useAdminShell } from '../hooks/useAdminShell';
import { useCursorPageWindow } from '../hooks/useCursorPageWindow';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type {
  AdminOrderRow,
  OrderFilters,
  OrderStatusFilter,
} from '../types/orders';
import { DEFAULT_ORDER_FILTERS } from '../types/orders';

/*
 * Orders queue — the staff screen for working every customer order.
 *
 * The section order is the same at every width — header, status tabs, toolbar,
 * then the list — so one tree covers all three links. What changes is the list
 * itself: `md` and up render the table inside a bordered card, mobile renders a
 * stack of cards on the page background with no card frame around them, which is
 * what the mobile link shows.
 *
 * Every figure and row comes from the API; nothing on this page is hardcoded
 * business data. Two queries back it (endpoints land later): the summary for the
 * header figures, tab counts, and filter options, and an infinite query for the
 * queue itself. Status, search, and the three filters are all query params the
 * backend resolves, so a page always agrees with the counts beside it.
 *
 * Pagination is one cursor stream shown two ways (AGENTS.md): mobile's "Load
 * more" appends the next page, while the wider links' numbered pager steps a
 * window over what has loaded, fetching ahead when the window runs past the
 * loaded edge.
 */

const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 300;

function QueueSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      {/* Mobile — a stack of cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[10.5rem] animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>

      {/* Tablet & desktop — the table frame */}
      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-table-row items-center border-b border-gray-200 px-card last:border-b-0"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminOrdersQueuePage() {
  const { user, onLogout } = useAdminShell();

  const [status, setStatus] = useState<OrderStatusFilter>('all');
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const summary = useAdminOrdersSummary();
  const orders = useAdminOrders({ status, search: debouncedSearch, filters });

  const filterKey = `${status}|${debouncedSearch}|${filters.service}|${filters.region}|${filters.dateRange}`;

  // Selection is per result set — a row selected under one filter should not
  // survive into a different list.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds([]);
  }, [filterKey]);

  const loadedOrders = useMemo<AdminOrderRow[]>(
    () => orders.data?.pages.flatMap((page) => page.orders) ?? [],
    [orders.data],
  );

  const totalResults = orders.data?.pages[0]?.totalResults ?? 0;
  const totalPages = orders.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const {
    page,
    rows: windowOrders,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useCursorPageWindow({
    rows: loadedOrders,
    totalPages,
    totalResults,
    pageSize: PAGE_SIZE,
    hasNextPage: orders.hasNextPage,
    isFetchingNextPage: orders.isFetchingNextPage,
    fetchNextPage: orders.fetchNextPage,
    resetKey: filterKey,
  });

  const onLoadMore = () => {
    if (orders.hasNextPage) void orders.fetchNextPage();
  };

  const toggleRow = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );

  const toggleAll = () =>
    setSelectedIds((current) =>
      current.length === windowOrders.length
        ? []
        : windowOrders.map((order) => order.id),
    );

  const clearFilters = () => {
    setStatus('all');
    setFilters(DEFAULT_ORDER_FILTERS);
    setSearch('');
  };

  const isFiltered =
    status !== 'all' ||
    Boolean(debouncedSearch.trim()) ||
    filters.service !== DEFAULT_ORDER_FILTERS.service ||
    filters.region !== DEFAULT_ORDER_FILTERS.region ||
    filters.dateRange !== DEFAULT_ORDER_FILTERS.dateRange;

  /*
   * A failed query is neither pending nor empty. Without this branch a dropped
   * queue fetch fell through to the empty state — "You're all caught up" over a
   * network fault tells a filing agent the pipeline is clear while orders wait
   * in it.
   */
  const isError = summary.isError || orders.isError;
  const isLoading = !isError && (summary.isPending || orders.isPending);
  const isEmpty = !isLoading && !isError && loadedOrders.length === 0;

  const retry = () => {
    if (summary.isError) void summary.refetch();
    if (orders.isError) void orders.refetch();
  };

  /*
   * Whether this member is looking at the whole pipeline or only the filings
   * assigned to them. The backend scopes the rows and sends the answer down with
   * the summary; the page only prints it. Until the summary lands, assume the
   * unscoped copy — it is the one the header already reads as.
   */
  const scope = summary.data?.scope ?? 'all';

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-4 md:gap-5 lg:gap-6">
          <OrdersQueueHeader
            totalOrders={summary.data?.totalOrders ?? 0}
            awaitingReview={summary.data?.awaitingReview ?? 0}
            scope={scope}
          />

          {summary.data ? (
            // Mobile puts search above the tabs; the wider links put the tabs
            // first. One tree, reordered — the two swap places at `md`.
            <div className="flex w-full flex-col gap-4 md:gap-5">
              <div className="order-1 md:order-2">
                <OrdersToolbar
                  search={search}
                  onSearchChange={setSearch}
                  filters={filters}
                  onFiltersChange={setFilters}
                  options={summary.data.filterOptions}
                />
              </div>

              <div className="order-2 md:order-1">
                <OrderStatusTabs
                  tabs={summary.data.tabs}
                  value={status}
                  onChange={setStatus}
                />
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <QueueSkeleton />
          ) : isError ? (
            <DataErrorState
              title="We couldn’t load the orders queue"
              description="Something went wrong fetching the filings. Try again."
              onRetry={retry}
              isRetrying={summary.isFetching || orders.isFetching}
            />
          ) : (
            <>
              {/* Mobile — cards on the page background, no surrounding frame. */}
              {isEmpty ? null : <OrderCardList orders={loadedOrders} />}

              {/* Tablet & desktop — the table in its own card. */}
              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:flex">
                {isEmpty ? null : (
                  <>
                    <OrdersTable
                      orders={windowOrders}
                      selectedIds={selectedIds}
                      onToggleRow={toggleRow}
                      onToggleAll={toggleAll}
                    />
                    <OrdersPagination
                      page={page}
                      totalPages={totalPages}
                      totalResults={totalResults}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      onPageChange={goToPage}
                    />
                  </>
                )}

                {isEmpty ? (
                  <OrdersEmptyState
                    isFiltered={isFiltered}
                    scope={scope}
                    onClearFilters={clearFilters}
                  />
                ) : null}
              </div>

              {/* Mobile keeps its own footer and empty state outside the frame. */}
              {isEmpty ? (
                <div className="rounded-card bg-white md:hidden">
                  <OrdersEmptyState
                    isFiltered={isFiltered}
                    scope={scope}
                    onClearFilters={clearFilters}
                  />
                </div>
              ) : (
                <OrdersLoadMore
                  totalResults={totalResults}
                  loadedCount={loadedOrders.length}
                  hasMore={Boolean(orders.hasNextPage)}
                  isLoadingMore={orders.isFetchingNextPage}
                  onLoadMore={onLoadMore}
                />
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
