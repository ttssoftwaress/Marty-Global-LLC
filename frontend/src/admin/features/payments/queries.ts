import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiFetch } from '@/services/api';
import type { ApiSuccess } from '@/types/api';
import type {
  BillingLedgerPage,
  PaymentStatusFilter,
  PaymentsSummary,
  RevenuePeriod,
  RevenueSeries,
  UnmatchedTransferFilter,
  UnmatchedTransferPage,
  UnmatchedTransferRow,
} from '../../types/payments';

/*
 * Admin quotes & payments data layer:
 *   - the summary: the KPI figures and the ledger's tab counts
 *   - the revenue series, re-fetched when the period pill changes
 *   - the billing ledger, an infinite query so the design's two pagination
 *     shapes both work over one cursor stream (AGENTS.md, cursor pagination):
 *     mobile's "Load more" appends a page, the wider links' numbered pager
 *     steps a window
 *   - the unattributed-transfer queue and the write that closes one out
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

export const adminUnmatchedTransfersKey = (status: UnmatchedTransferFilter) =>
  ['admin', 'payments', 'unmatched', status] as const;

/*
 * GET /v1/admin/payments/unmatched?status=&cursor=&limit= — USDT that arrived
 * matching no payment.
 *
 * Polled rather than fetched once. A transfer lands here from a background sweep
 * with nothing to invalidate the cache, so a reviewer sitting on this screen
 * would otherwise see a stale queue until they navigated away and back. The
 * interval is well above the poller's own so a refresh always has something new
 * to say, and `openCount` — a whole-queue figure, not a page one — is what the
 * section header prints.
 */
const UNMATCHED_REFRESH_MS = 2 * 60 * 1000;

export function useAdminUnmatchedTransfers(status: UnmatchedTransferFilter) {
  return useInfiniteQuery({
    queryKey: adminUnmatchedTransfersKey(status),
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ status });
      if (pageParam) query.set('cursor', pageParam);

      return apiFetch<ApiSuccess<UnmatchedTransferPage>>(
        `/admin/payments/unmatched?${query.toString()}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: UNMATCHED_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

/*
 * POST /v1/admin/payments/unmatched/:transferId/resolve — close a stray transfer
 * out with a note on what it turned out to be.
 *
 * Admin-only server-side, and it moves no money: resolving is an annotation, not
 * a credit. Money genuinely owed is still collected the one way it ever is —
 * the customer pays the quote and the poller credits the transfer it matches.
 *
 * Every filter's list is invalidated because the row moves between them.
 */
export function useResolveUnmatchedTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transferId, note }: { transferId: string; note: string }) =>
      apiFetch<ApiSuccess<UnmatchedTransferRow>>(
        `/admin/payments/unmatched/${transferId}/resolve`,
        { method: 'POST', body: JSON.stringify({ note }) },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payments', 'unmatched'],
      });
    },
  });
}
