import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type { OrderFilter, OrdersPage } from '../../types/orders';
import type { OrderDetail } from '../../types/orders';

/*
 * My-orders data layer. The list uses an infinite query so the design's two
 * pagination shapes both work over one cursor stream (AGENTS.md, cursor
 * pagination): mobile "Load more" fetches the next page and appends; desktop
 * Prev/Next steps through the loaded pages. The detail query is keyed by order
 * id off the route param.
 */

type OrdersListParams = {
  filter: OrderFilter;
  search: string;
};

export const ordersListKey = (params: OrdersListParams) =>
  ['orders', 'list', params.filter, params.search] as const;

// GET /v1/orders?filter=&search=&cursor=&limit= — one page of the customer's
// orders. The backend scopes to the signed-in user and resolves filtering,
// search, counts, and pagination.
function fetchOrdersPage(
  params: OrdersListParams,
  cursor: string | null,
): Promise<OrdersPage> {
  const query = new URLSearchParams({ filter: params.filter });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<OrdersPage>>(`/orders?${query.toString()}`).then(
    (res) => res.data,
  );
}

export function useOrdersList(params: OrdersListParams) {
  return useInfiniteQuery({
    queryKey: ordersListKey(params),
    queryFn: ({ pageParam }) => fetchOrdersPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous filter/search results on screen while the next load
    // resolves, so switching tabs doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}

export const orderDetailKey = (orderId: string) =>
  ['orders', 'detail', orderId] as const;

// GET /v1/orders/:id — the full order record. A customer can only load their own
// (the backend returns 404 otherwise).
export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: orderDetailKey(orderId ?? ''),
    queryFn: () =>
      apiFetch<ApiSuccess<OrderDetail>>(`/orders/${orderId}`).then(
        (res) => res.data,
      ),
    enabled: Boolean(orderId),
  });
}
