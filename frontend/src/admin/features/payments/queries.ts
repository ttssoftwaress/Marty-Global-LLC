import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  BillingLedgerPage,
  PaymentStatusFilter,
  PaymentsSummary,
  RefundLogPage,
  RevenuePeriod,
  RevenueSeries,
} from '../../types/payments';

/*
 * Admin quotes & payments data layer. Four queries back the screen (endpoints
 * land later, AGENTS.md two-apps sync rule):
 *   - the summary: the four KPI figures and the ledger's tab counts
 *   - the revenue series, re-fetched when the period pill changes
 *   - the billing ledger, an infinite query so the design's two pagination
 *     shapes both work over one cursor stream (AGENTS.md, cursor pagination):
 *     mobile's "Load more" appends a page, the wider links' numbered pager
 *     steps a window
 *   - the refunds & adjustments log, also cursor-paginated
 *
 * The status filter is a query param the backend resolves — the UI never
 * filters or counts rows client-side, so a page always agrees with the tab
 * counts beside it.
 */

export const adminPaymentsSummaryKey = () =>
  ['admin', 'payments', 'summary'] as const;

// GET /v1/admin/payments/summary — the KPI figures and the ledger tab counts.
export function useAdminPaymentsSummary() {
  return useQuery({
    queryKey: adminPaymentsSummaryKey(),
    queryFn: () =>
      apiFetch<ApiSuccess<PaymentsSummary>>('/admin/payments/summary').then(
        (res) => res.data,
      ),
  });
}

export const adminRevenueSeriesKey = (period: RevenuePeriod) =>
  ['admin', 'payments', 'revenue', period] as const;

/*
 * GET /v1/admin/payments/revenue?period= — the bucketed series plus the axis
 * ceiling. The backend owns the bucketing and the timezone the bucket
 * boundaries fall in (AGENTS.md, Dates), so the chart only draws what it gets.
 */
export function useAdminRevenueSeries(period: RevenuePeriod) {
  return useQuery({
    queryKey: adminRevenueSeriesKey(period),
    queryFn: () =>
      apiFetch<ApiSuccess<RevenueSeries>>(
        `/admin/payments/revenue?period=${period}`,
      ).then((res) => res.data),
    // Keeps the previous series on screen while the next period loads, so the
    // card does not collapse to a skeleton on every pill press.
    placeholderData: (previous) => previous,
  });
}

export const adminBillingLedgerKey = (status: PaymentStatusFilter) =>
  ['admin', 'payments', 'ledger', status] as const;

// GET /v1/admin/payments/ledger?status=&cursor=&limit= — one page of the
// ledger. The backend owns the filtering and the figures the footer prints.
function fetchLedgerPage(
  status: PaymentStatusFilter,
  cursor: string | null,
): Promise<BillingLedgerPage> {
  const query = new URLSearchParams();
  if (status !== 'all') query.set('status', status);
  if (cursor) query.set('cursor', cursor);

  const search = query.toString();

  return apiFetch<ApiSuccess<BillingLedgerPage>>(
    `/admin/payments/ledger${search ? `?${search}` : ''}`,
  ).then((res) => res.data);
}

export function useAdminBillingLedger(status: PaymentStatusFilter) {
  return useInfiniteQuery({
    queryKey: adminBillingLedgerKey(status),
    queryFn: ({ pageParam }) => fetchLedgerPage(status, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: (previous) => previous,
  });
}

export const adminRefundLogKey = () => ['admin', 'payments', 'refunds'] as const;

// GET /v1/admin/payments/refunds?cursor=&limit= — the refunds & adjustments
// log. Cursor-paginated like every other list (AGENTS.md).
export function useAdminRefundLog() {
  return useInfiniteQuery({
    queryKey: adminRefundLogKey(),
    queryFn: ({ pageParam }) => {
      const query = pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : '';
      return apiFetch<ApiSuccess<RefundLogPage>>(
        `/admin/payments/refunds${query}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
