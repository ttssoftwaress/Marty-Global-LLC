import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  BillingOverview,
  PaymentHistoryPage,
  PaymentHistoryRange,
} from '../../types/billing';

/*
 * Billing data layer. The overview (KPIs, quotes, saved methods) is one query;
 * the payment history is an infinite query so the design's two pagination shapes
 * both work over one cursor stream (AGENTS.md, cursor pagination): mobile "Load
 * more payments" appends the next page, desktop Prev/Next steps a window through
 * the loaded pages. The backend scopes everything to the signed-in customer.
 */

export const billingOverviewKey = () => ['billing', 'overview'] as const;

// GET /v1/billing/overview — headline figures, quotes awaiting payment, and the
// customer's saved cards.
export function useBillingOverview() {
  return useQuery({
    queryKey: billingOverviewKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<BillingOverview>>('/billing/overview').then(
        (res) => res.data,
      ),
  });
}

type PaymentHistoryParams = {
  search: string;
  range: PaymentHistoryRange;
};

export const paymentHistoryKey = (params: PaymentHistoryParams) =>
  ['billing', 'payments', params.range, params.search] as const;

// GET /v1/billing/payments?range=&search=&cursor=&limit= — one page of the
// customer's payment history. The backend resolves the range, search, counts,
// and pagination.
function fetchPaymentHistoryPage(
  params: PaymentHistoryParams,
  cursor: string | null,
): Promise<PaymentHistoryPage> {
  const query = new URLSearchParams({ range: params.range });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (cursor) query.set('cursor', cursor);

  return apiFetch<ApiSuccess<PaymentHistoryPage>>(
    `/billing/payments?${query.toString()}`,
  ).then((res) => res.data);
}

export function usePaymentHistory(params: PaymentHistoryParams) {
  return useInfiniteQuery({
    queryKey: paymentHistoryKey(params),
    queryFn: ({ pageParam }) => fetchPaymentHistoryPage(params, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Keep the previous range/search results on screen while the next load
    // resolves, so changing the filter doesn't flash the skeleton.
    placeholderData: (previous) => previous,
  });
}
