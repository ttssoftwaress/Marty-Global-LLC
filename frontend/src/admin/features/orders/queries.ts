import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminOrdersPage,
  AdminOrdersSummary,
  OrderFilters,
  OrderStatusFilter,
} from '../../types/orders';

/*
 * Admin orders queue data layer. Two queries back the screen (endpoints land
 * later, AGENTS.md two-apps sync rule):
 *   - the summary: the two header figures, the tab counts, and the option lists
 *     the three dropdown filters offer
 *   - the queue itself, an infinite query so the design's two pagination shapes
 *     both work over one cursor stream (AGENTS.md, cursor pagination): mobile's
 *     "Load more" appends a page, the wider links' numbered pager steps a window
 *
 * Every filter is a query param the backend resolves — the UI never filters,
 * sorts, or counts rows client-side, so a page always agrees with the tab counts
 * beside it.
 */

export const adminOrdersSummaryKey = () =>
  ['admin', 'orders', 'summary'] as const;

// GET /v1/admin/orders/summary — header figures, status tab counts, and the
// service / region / date-range options.
export function useAdminOrdersSummary() {
  return useQuery({
    queryKey: adminOrdersSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminOrdersSummary>>('/admin/orders/summary').then(
        (res) => res.data,
      ),
  });
}

export type AdminOrdersParams = {
  status: OrderStatusFilter;
  search: string;
  filters: OrderFilters;
};

export const adminOrdersKey = (params: AdminOrdersParams) =>
  [
    'admin',
    'orders',
    'list',
    params.status,
    params.search,
    params.filters.service,
    params.filters.region,
    params.filters.dateRange,
  ] as const;

// GET /v1/admin/orders?status=&search=&service=&region=&dateRange=&cursor=&limit=
// — one page of the queue. The backend owns the filtering and the pagination
// figures the footer prints.
function fetchAdminOrdersPage(
  params: AdminOrdersParams,
  cursor: string | null,
): Promise<AdminOrdersPage> {
  const query = new URLSearchParams({ status: params.status });

  const search = params.search.trim();
  if (search) query.set('search', search);

  const { service, region, dateRange } = params.filters;
  if (service !== 'all') query.set('service', service);
  if (region !== 'all') query.set('region', region);
  if (dateRange !== 'all') query.set('dateRange', dateRange);

  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<AdminOrdersPage>>(
    `/admin/orders?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminOrders(params: AdminOrdersParams) {
  return useInfiniteQuery({
    queryKey: adminOrdersKey(params),
    queryFn: ({ pageParam }) => fetchAdminOrdersPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keeps the current rows on screen while a tab or filter change loads, so
    // the queue does not flash a skeleton on every press.
    placeholderData: (previous) => previous,
  });
}
