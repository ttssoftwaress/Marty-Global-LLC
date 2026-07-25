import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  AdminCustomersPage,
  AdminCustomersSummary,
  CustomerSegment,
} from '../../types/customers';
import { ALL_REGIONS } from '../../types/customers';

/*
 * Admin customers list data layer. Two queries back the screen (endpoints land
 * later, AGENTS.md two-apps sync rule):
 *   - the summary: the header's total, the segment tabs, and the region options
 *   - the list itself, an infinite query so the design's two pagination shapes
 *     both work over one cursor stream (AGENTS.md, cursor pagination): mobile's
 *     "Load more" appends a page, the wider links' numbered pager steps a window
 *
 * Segment, region, and search are all query params the backend resolves — the UI
 * never filters, sorts, or counts rows client-side, so a page always agrees with
 * the total printed beside it.
 */

export const adminCustomersSummaryKey = () =>
  ['admin', 'customers', 'summary'] as const;

// GET /v1/admin/customers/summary — the header total, the segment tabs, and the
// region options the dropdown offers.
export function useAdminCustomersSummary() {
  return useQuery({
    queryKey: adminCustomersSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<AdminCustomersSummary>>(
        '/admin/customers/summary',
      ).then((res) => res.data),
  });
}

export type AdminCustomersParams = {
  segment: CustomerSegment;
  region: string;
  search: string;
};

export const adminCustomersKey = (params: AdminCustomersParams) =>
  [
    'admin',
    'customers',
    'list',
    params.segment,
    params.region,
    params.search,
  ] as const;

// GET /v1/admin/customers?segment=&region=&search=&cursor=&limit= — one page of
// the list. The backend owns the filtering and the pagination figures the footer
// prints.
function fetchAdminCustomersPage(
  params: AdminCustomersParams,
  cursor: string | null,
): Promise<AdminCustomersPage> {
  const query = new URLSearchParams({ segment: params.segment });

  const search = params.search.trim();
  if (search) query.set('search', search);
  if (params.region !== ALL_REGIONS) query.set('region', params.region);
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<AdminCustomersPage>>(
    `/admin/customers?${query.toString()}`,
  ).then((res) => res.data);
}

export function useAdminCustomers(params: AdminCustomersParams) {
  return useInfiniteQuery({
    queryKey: adminCustomersKey(params),
    queryFn: ({ pageParam }) => fetchAdminCustomersPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keeps the current rows on screen while a tab or region change loads, so
    // the list does not flash a skeleton on every press.
    placeholderData: (previous) => previous,
  });
}
