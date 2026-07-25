import { useEffect, useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
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
          <div key={index} className="h-[168px] animate-pulse rounded-card bg-gray-200" />
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

  // The page window the wider links' pager steps over. Any change to the result
  // set returns it to the first page, since the old offset means nothing now.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [status, debouncedSearch, filters]);

  // Selection is per result set too — a row selected under one filter should not
  // survive into a different list.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds([]);
  }, [status, debouncedSearch, filters]);

  const loadedOrders = useMemo<AdminOrderRow[]>(
    () => orders.data?.pages.flatMap((page) => page.orders) ?? [],
    [orders.data],
  );

  const totalResults = orders.data?.pages[0]?.totalResults ?? 0;
  const totalPages = orders.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const windowOrders = useMemo(
    () => loadedOrders.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [loadedOrders, pageIndex],
  );

  const goToPage = (nextPage: number) => {
    const nextIndex = Math.max(0, Math.min(nextPage - 1, totalPages - 1));
    // Pull the next cursor page in when the window runs past what has loaded.
    if (nextIndex * PAGE_SIZE >= loadedOrders.length && orders.hasNextPage) {
      void orders.fetchNextPage();
    }
    setPageIndex(nextIndex);
  };

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

  const isLoading = summary.isPending || orders.isPending;
  const isEmpty = !isLoading && loadedOrders.length === 0;

  const rangeStart = totalResults === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + windowOrders.length;

  return (
    <AdminLayout
      user={user}
      notificationCount={summary.data?.awaitingReview}
      onLogout={onLogout}
    >
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 md:gap-5 lg:gap-6">
          <OrdersQueueHeader
            totalOrders={summary.data?.totalOrders ?? 0}
            awaitingReview={summary.data?.awaitingReview ?? 0}
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
                      page={pageIndex + 1}
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
                    onClearFilters={clearFilters}
                  />
                ) : null}
              </div>

              {/* Mobile keeps its own footer and empty state outside the frame. */}
              {isEmpty ? (
                <div className="rounded-card bg-white md:hidden">
                  <OrdersEmptyState
                    isFiltered={isFiltered}
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
