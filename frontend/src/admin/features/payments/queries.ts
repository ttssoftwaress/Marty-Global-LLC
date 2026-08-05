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
  BillingLedgerRow,
  LedgerRowDetail,
  SettlementDetail,
  UnmatchedTransferDetail,
  PaymentStatusFilter,
  PaymentsSummary,
  RevenuePeriod,
  RevenueSeries,
  SettlementFilter,
  SettlementPage,
  UnmatchedTransferFilter,
  UnmatchedTransferPage,
} from '../../types/payments';

/*
 * Admin quotes & payments data layer:
 *   - the summary: the KPI figures and the ledger's tab counts
 *   - the revenue series, re-fetched when the period pill changes
 *   - the billing ledger, an infinite query so the design's two pagination
 *     shapes both work over one cursor stream (AGENTS.md, cursor pagination):
 *     mobile's "Load more" appends a page, the wider links' numbered pager
 *     steps a window
 *   - the reminder a row's "Send reminder" sends
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

/*
 * POST /v1/admin/payments/ledger/:quoteId/remind — chase an unpaid invoice.
 *
 * It moves no money and decides no amount: the customer is told again about a
 * price already quoted. The backend enforces a 24-hour cooldown by claiming it
 * before anything is queued, so a double-click sends one email — there is no
 * client-side guard standing in for that.
 *
 * Every filter's ledger is invalidated: the row that was just chased comes back
 * with its action spent, and it appears under `all` as well as its own tab.
 */
export function useSendPaymentReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quoteId: string) =>
      apiFetch<ApiSuccess<BillingLedgerRow>>(
        `/admin/payments/ledger/${quoteId}/remind`,
        { method: 'POST' },
      ).then((res) => res.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payments', 'ledger'],
      });
    },
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
      apiFetch<ApiSuccess<UnmatchedTransferDetail>>(
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

/*
 * --- Manual settlement queue ---------------------------------------------
 *
 * Payments only a person can close: every bank transfer, plus USDT while an
 * admin has automatic verification switched off. The backend decides which
 * providers qualify, so this app never filters by provider itself — the queue
 * and the write it feeds cannot disagree about what a settler may touch.
 */
export const adminSettlementsKey = (status: SettlementFilter) =>
  ['admin', 'payments', 'settlements', status] as const;

/*
 * Refreshed on a timer, like the unattributed queue: a customer pressing "I've
 * sent it" is the signal a settler is waiting for, and a queue that only moved
 * on reload would be checked by reloading.
 */
const SETTLEMENT_REFRESH_MS = 2 * 60 * 1000;

export function useAdminSettlements(status: SettlementFilter) {
  return useInfiniteQuery({
    queryKey: adminSettlementsKey(status),
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ status });
      if (pageParam) query.set('cursor', pageParam);

      return apiFetch<ApiSuccess<SettlementPage>>(
        `/admin/payments/settlements?${query.toString()}`,
      ).then((res) => res.data);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    refetchInterval: SETTLEMENT_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
}

/*
 * The caches a settlement decision reaches. Marking a payment received credits
 * the quote and carries its order to PAID, so the ledger, the KPI figures, and
 * the orders queue are all stale the moment it lands — not just this queue.
 */
function invalidateAfterSettlement(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: ['admin', 'payments', 'settlements'],
  });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'ledger'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'summary'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'payments', 'revenue'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
}

/*
 * POST /v1/admin/payments/settlements/:paymentId/settle — confirm the money
 * arrived.
 *
 * Gated on `payments.settle` server-side, its own grantable permission: nothing
 * downstream will ever contradict this, because there is no bank feed to
 * disagree with the person who clicked.
 *
 * No amount in the payload, deliberately. The figure is the quote's, resolved
 * server-side — the client never names what is owed (AGENTS.md, Money).
 */
export function useSettlePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      paymentId,
      ...body
    }: {
      paymentId: string;
      reference?: string;
      note?: string;
      paidAt?: string;
    }) =>
      apiFetch<ApiSuccess<SettlementDetail>>(
        `/admin/payments/settlements/${paymentId}/settle`,
        { method: 'POST', body: JSON.stringify(body) },
      ).then((res) => res.data),
    onSuccess: () => invalidateAfterSettlement(queryClient),
  });
}

/*
 * POST /v1/admin/payments/settlements/:paymentId/reject — close a payment out
 * without settling it. The quote goes back to unpaid, which is the point: the
 * customer is usually about to try again.
 */
export function useRejectSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) =>
      apiFetch<ApiSuccess<SettlementDetail>>(
        `/admin/payments/settlements/${paymentId}/reject`,
        { method: 'POST', body: JSON.stringify({ reason }) },
      ).then((res) => res.data),
    onSuccess: () => invalidateAfterSettlement(queryClient),
  });
}

/* --- Expanded rows -------------------------------------------------------
 *
 * Three reads, one per table on this screen, each called from inside a detail
 * panel that is only mounted while its row is open. That is what makes them
 * lazy: a page of the ledger fetches the breakdown of the one quote somebody
 * opened, not of all twenty.
 */

export const adminLedgerRowKey = (quoteId: string) =>
  ['admin', 'payments', 'ledger', 'row', quoteId] as const;

// GET /v1/admin/payments/ledger/:quoteId
export function useAdminLedgerRow(quoteId: string) {
  return useQuery({
    queryKey: adminLedgerRowKey(quoteId),
    queryFn: () =>
      apiFetch<ApiSuccess<LedgerRowDetail>>(
        `/admin/payments/ledger/${quoteId}`,
      ).then((res) => res.data),
  });
}

export const adminSettlementKey = (paymentId: string) =>
  ['admin', 'payments', 'settlement', paymentId] as const;

// GET /v1/admin/payments/settlements/:paymentId
export function useAdminSettlement(paymentId: string) {
  return useQuery({
    queryKey: adminSettlementKey(paymentId),
    queryFn: () =>
      apiFetch<ApiSuccess<SettlementDetail>>(
        `/admin/payments/settlements/${paymentId}`,
      ).then((res) => res.data),
  });
}

export const adminUnmatchedTransferKey = (transferId: string) =>
  ['admin', 'payments', 'unmatched', 'row', transferId] as const;

// GET /v1/admin/payments/unmatched/:transferId
export function useAdminUnmatchedTransfer(transferId: string) {
  return useQuery({
    queryKey: adminUnmatchedTransferKey(transferId),
    queryFn: () =>
      apiFetch<ApiSuccess<UnmatchedTransferDetail>>(
        `/admin/payments/unmatched/${transferId}`,
      ).then((res) => res.data),
  });
}
