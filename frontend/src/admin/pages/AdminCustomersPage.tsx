import { useEffect, useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import {
  CustomerCardList,
  CustomerRegionFilter,
  CustomerSegmentTabs,
  CustomersEmptyState,
  CustomersHeader,
  CustomersLoadMore,
  CustomersPagination,
  CustomersSearch,
  CustomersTable,
  useAdminCustomers,
  useAdminCustomersSummary,
} from '../features/customers';
import { useAdminShell } from '../hooks/useAdminShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { AdminCustomerRow, CustomerSegment } from '../types/customers';
import { ALL_REGIONS } from '../types/customers';

/*
 * Customers list — the staff screen for every customer account.
 *
 * The section order is the same at every width — header, controls, then the
 * list — so one tree covers all three links. What changes is how the controls
 * lay out and how the list is drawn:
 *   - desktop (lg): search, region, and the segment tabs share one row; the list
 *     is a seven-column table in a bordered card
 *   - tablet (md):  search takes its own row, with region and the tabs on the
 *     next; the table narrows to five columns
 *   - mobile:       search, region, and the tabs each take a row, and the list
 *     becomes a stack of cards on the page background with no frame around them
 *
 * Every figure and row comes from the API; nothing on this page is hardcoded
 * business data. Two queries back it (endpoints land later): the summary for the
 * header total, the tabs, and the region options, and an infinite query for the
 * list. Segment, region, and search are all query params the backend resolves,
 * so a page always agrees with the total printed beside it.
 *
 * Pagination is one cursor stream shown two ways (AGENTS.md): mobile's "Load
 * more" appends the next page, while the wider links' numbered pager steps a
 * window over what has loaded, fetching ahead when the window runs past the
 * loaded edge.
 */

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

function CustomersSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      {/* Mobile — a stack of cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-[188px] animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>

      {/* Tablet & desktop — the table frame */}
      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-11 w-full border-b border-gray-200 bg-[var(--table-header-bg)] lg:h-12" />
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="flex h-16 items-center border-b border-gray-200 px-4 last:border-b-0 lg:h-table-row lg:px-card"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCustomersPage() {
  const { user, onLogout } = useAdminShell();

  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [region, setRegion] = useState<string>(ALL_REGIONS);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const summary = useAdminCustomersSummary();
  const customers = useAdminCustomers({
    segment,
    region,
    search: debouncedSearch,
  });

  // The page window the wider links' pager steps over. Any change to the result
  // set returns it to the first page, since the old offset means nothing now.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [segment, region, debouncedSearch]);

  const loadedCustomers = useMemo<AdminCustomerRow[]>(
    () => customers.data?.pages.flatMap((page) => page.customers) ?? [],
    [customers.data],
  );

  const totalResults = customers.data?.pages[0]?.totalResults ?? 0;
  const totalPages = customers.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const windowCustomers = useMemo(
    () => loadedCustomers.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [loadedCustomers, pageIndex],
  );

  const goToPage = (nextPage: number) => {
    const nextIndex = Math.max(0, Math.min(nextPage - 1, totalPages - 1));
    // Pull the next cursor page in when the window runs past what has loaded.
    if (nextIndex * PAGE_SIZE >= loadedCustomers.length && customers.hasNextPage) {
      void customers.fetchNextPage();
    }
    setPageIndex(nextIndex);
  };

  const onLoadMore = () => {
    if (customers.hasNextPage) void customers.fetchNextPage();
  };

  const clearFilters = () => {
    setSegment('all');
    setRegion(ALL_REGIONS);
    setSearch('');
  };

  const isFiltered =
    segment !== 'all' || region !== ALL_REGIONS || Boolean(debouncedSearch.trim());

  const isLoading = summary.isPending || customers.isPending;
  const isEmpty = !isLoading && loadedCustomers.length === 0;

  const rangeStart = totalResults === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + windowCustomers.length;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 md:gap-6">
          <CustomersHeader totalCustomers={summary.data?.totalCustomers ?? 0} />

          {summary.data ? (
            /*
             * Desktop puts all three controls on one row; tablet gives search
             * its own row with the region and tabs sharing the next; mobile
             * stacks all three. One tree covers it — the row only forms at `lg`,
             * and the region/tabs pair splits apart below `md`.
             */
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div className="w-full lg:w-[320px] lg:shrink-0">
                <CustomersSearch value={search} onChange={setSearch} />
              </div>

              <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 lg:w-auto lg:flex-1 lg:justify-start">
                <CustomerRegionFilter
                  options={summary.data.regions}
                  value={region}
                  onChange={setRegion}
                  className="w-full md:w-[180px] md:shrink-0 lg:w-[200px]"
                />

                <CustomerSegmentTabs
                  tabs={summary.data.tabs}
                  value={segment}
                  onChange={setSegment}
                />
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <CustomersSkeleton />
          ) : (
            <>
              {/* Mobile — cards on the page background, no surrounding frame. */}
              {isEmpty ? null : <CustomerCardList customers={loadedCustomers} />}

              {/* Tablet & desktop — the table in its own card. */}
              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:flex">
                {isEmpty ? (
                  <CustomersEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                ) : (
                  <CustomersTable customers={windowCustomers} />
                )}
              </div>

              {isEmpty ? (
                <div className="rounded-card border border-gray-200 bg-white md:hidden">
                  <CustomersEmptyState
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                  />
                </div>
              ) : (
                <>
                  {/* The pager sits under the table card, not inside it. */}
                  <CustomersPagination
                    page={pageIndex + 1}
                    totalPages={totalPages}
                    totalResults={totalResults}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    onPageChange={goToPage}
                  />

                  <CustomersLoadMore
                    totalResults={totalResults}
                    loadedCount={loadedCustomers.length}
                    hasMore={Boolean(customers.hasNextPage)}
                    isLoadingMore={customers.isFetchingNextPage}
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
