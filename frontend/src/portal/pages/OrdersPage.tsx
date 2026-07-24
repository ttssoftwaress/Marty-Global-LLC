import { useEffect, useMemo, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  OrderFilterTabs,
  OrdersList,
  OrdersPagination,
  OrderSearch,
} from '../features/orders';
import { useOrdersList } from '../features/orders/queries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  Order,
  OrderFilter,
  OrderFilterCounts,
} from '../types/orders';

/*
 * My orders — the customer's full order history.
 *
 * The page frame (breadcrumb, title + "Order new service" CTA, filter tabs,
 * search) is the same at every width; only the list and its pagination change
 * shape between breakpoints, which each own inside their components. So one
 * tree covers all three viewports and Tailwind swaps the parts that differ.
 *
 * The list is an infinite query over the cursor stream (AGENTS.md): mobile
 * "Load more" fetches the next page and the whole loaded set stays on screen;
 * desktop Prev/Next steps a page window through the loaded orders, fetching the
 * next page when the customer reaches the end. Filter and (debounced) search are
 * client-only UI state; the backend resolves the actual filtering, search,
 * counts, and pagination.
 */

const PAGE_SIZE = 10;

const EMPTY_COUNTS: OrderFilterCounts = {
  all: 0,
  active: 0,
  completed: 0,
  attention: 0,
};

function OrdersSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5" aria-hidden="true">
      <div className="h-10 w-64 animate-pulse rounded-input bg-gray-200" />
      <div className="h-12 w-full animate-pulse rounded-input bg-gray-200" />
      <div className="h-[420px] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

export function OrdersPage() {
  const { user, onLogout } = usePortalShell();

  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useOrdersList({ filter: activeFilter, search: debouncedSearch });

  // Desktop page window into the loaded orders. Reset to the first page whenever
  // the filter or search changes, since the result set is different.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [activeFilter, debouncedSearch]);

  const loadedOrders = useMemo<Order[]>(
    () => data?.pages.flatMap((p) => p.orders) ?? [],
    [data],
  );

  const counts = data?.pages[0]?.counts ?? EMPTY_COUNTS;
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const totalPages = data?.pages[0]?.totalPages ?? 1;

  // Desktop shows one page window; mobile shows the whole loaded set.
  const pageOrders = loadedOrders.slice(
    pageIndex * PAGE_SIZE,
    pageIndex * PAGE_SIZE + PAGE_SIZE,
  );

  const goPrev = () => setPageIndex((index) => Math.max(0, index - 1));
  const goNext = () => {
    const nextIndex = pageIndex + 1;
    // If the next window isn't loaded yet but more remain on the server, fetch it.
    if (nextIndex * PAGE_SIZE >= loadedOrders.length && hasNextPage) {
      void fetchNextPage();
    }
    if (nextIndex < totalPages) setPageIndex(nextIndex);
  };
  const onLoadMore = () => {
    // Mobile "Load more" reveals the next window, fetching it first if needed.
    goNext();
  };

  // More to see beyond the current window — either already loaded further down,
  // or another page waiting on the server.
  const hasMore = pageIndex < totalPages - 1;

  const showSkeleton = isLoading;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 md:gap-6 lg:gap-7">
          <p className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500">
            Dashboard / My orders
          </p>

          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-h4 font-semibold text-text md:text-[28px] md:leading-[36px] lg:text-h3">
                My orders
              </h1>
              <p className="hidden text-body text-text-secondary md:block lg:text-body-lg">
                View and manage all of your current and past orders.
              </p>
            </div>

            <Link
              to="/app/order"
              className="btn btn-accent h-11 w-full rounded-input px-6 text-[15px] md:h-10 md:w-auto md:text-body lg:h-input lg:text-button"
            >
              <PlusCircle className="mr-2 size-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Order new service
            </Link>
          </header>

          {showSkeleton ? (
            <OrdersSkeleton />
          ) : (
            <>
              {/*
               * Tabs and search share a row on desktop (search right-aligned at
               * a fixed width) and stack below `lg` — the tablet and mobile
               * links both give search its own full-width row.
               */}
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <OrderFilterTabs
                  active={activeFilter}
                  counts={counts}
                  onChange={setActiveFilter}
                />
                <OrderSearch
                  value={search}
                  onChange={setSearch}
                  className="w-full lg:w-[320px] lg:shrink-0"
                />
              </div>

              <OrdersList orders={pageOrders} />

              {totalCount > 0 && (
                <OrdersPagination
                  page={pageIndex + 1}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  hasMore={hasMore}
                  onPrev={goPrev}
                  onNext={goNext}
                  onLoadMore={onLoadMore}
                />
              )}
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
