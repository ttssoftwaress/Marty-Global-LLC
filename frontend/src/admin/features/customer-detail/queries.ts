import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminCustomerDetail,
  CustomerOrdersPage,
} from '../../types/customer-detail';

/*
 * Admin customer-detail data layer. Two queries back the screen (endpoints land
 * later, AGENTS.md two-apps sync rule):
 *   - the customer record: the identity block, the four KPI figures, and the
 *     route the Message button opens
 *   - the customer's orders, an infinite query over one cursor stream (AGENTS.md,
 *     cursor pagination) so the table and the mobile cards both append rather
 *     than paging
 *
 * The orders list is server-resolved like every other list in the admin area —
 * the UI never filters, sorts, or counts rows client-side, so what renders always
 * agrees with the total beside it.
 */

export const adminCustomerKey = (customerId: string) =>
  ['admin', 'customers', 'detail', customerId] as const;

// GET /v1/admin/customers/:customerId — the identity block and the KPI figures.
export function useAdminCustomer(customerId: string) {
  return useQuery({
    queryKey: adminCustomerKey(customerId),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminCustomerDetail>>(
        `/admin/customers/${customerId}`,
      ).then((res) => res.data),
    enabled: Boolean(customerId),
  });
}

export const adminCustomerOrdersKey = (customerId: string) =>
  ['admin', 'customers', 'detail', customerId, 'orders'] as const;

// GET /v1/admin/customers/:customerId/orders?cursor=&limit= — one page of this
// customer's orders, newest first. The backend owns the ordering and the total.
function fetchAdminCustomerOrdersPage(
  customerId: string,
  cursor: string | null,
): Promise<CustomerOrdersPage> {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);

  const suffix = query.toString() ? `?${query.toString()}` : '';

  return apiFetch<ApiSuccess<CustomerOrdersPage>>(
    `/admin/customers/${customerId}/orders${suffix}`,
  ).then((res) => res.data);
}

export function useAdminCustomerOrders(customerId: string) {
  return useInfiniteQuery({
    queryKey: adminCustomerOrdersKey(customerId),
    queryFn: ({ pageParam }) =>
      fetchAdminCustomerOrdersPage(customerId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(customerId),
  });
}
