import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import {
  LedgerCardList,
  LedgerFilterTabs,
  LedgerLoadMore,
  LedgerPagination,
  LedgerTable,
  PaymentsEmptyState,
  PaymentsHeader,
  PaymentsKpiCards,
  RefundLogCardList,
  RefundLogTable,
  RevenueChartCard,
  useAdminBillingLedger,
  useAdminPaymentsSummary,
  useAdminRefundLog,
  useAdminRevenueSeries,
} from '../features/payments';
import { useAdminShell } from '../hooks/useAdminShell';
import type {
  BillingLedgerRow,
  PaymentStatusFilter,
  RevenuePeriod,
} from '../types/payments';

/*
 * Quotes & payments — the staff screen for revenue, the billing ledger, and the
 * refunds log.
 *
 * The section order is the same at every width — header, KPIs, revenue chart,
 * billing ledger, refunds log — so one tree covers all three links. What changes
 * is how each list renders: `md` and up show tables inside bordered cards,
 * mobile shows card stacks on the page background, which is what the mobile link
 * shows.
 *
 * Every figure, row, and chart point comes from the API; nothing on this page is
 * hardcoded business data. Four queries back it (endpoints land later): the
 * summary for the KPI figures and tab counts, the revenue series (re-fetched per
 * period), the ledger as an infinite query, and the refunds log.
 *
 * Ledger pagination is one cursor stream shown two ways (AGENTS.md): mobile's
 * "Load more" appends the next page, while the wider links' numbered pager steps
 * a window over what has loaded, fetching ahead when the window runs past the
 * loaded edge — the same approach the orders queue uses.
 */

const PAGE_SIZE = 7;

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[150px] animate-pulse rounded-card bg-gray-200" />
        ))}
      </div>

      <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white md:flex">
        <div className="h-12 w-full border-b border-gray-200 bg-[var(--table-header-bg)]" />
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className="flex h-16 items-center border-b border-gray-200 px-4 last:border-b-0 lg:px-6"
          >
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminQuotesPaymentsPage() {
  const { user, onLogout } = useAdminShell();

  const [status, setStatus] = useState<PaymentStatusFilter>('all');
  const [period, setPeriod] = useState<RevenuePeriod>('30d');

  const summary = useAdminPaymentsSummary();
  const revenue = useAdminRevenueSeries(period);
  const ledger = useAdminBillingLedger(status);
  const refunds = useAdminRefundLog();

  // The page window the wider links' pager steps over. Changing the filter
  // returns it to the first page, since the old offset means nothing now.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [status]);

  const loadedRows = useMemo<BillingLedgerRow[]>(
    () => ledger.data?.pages.flatMap((page) => page.rows) ?? [],
    [ledger.data],
  );

  const refundRows = useMemo(
    () => refunds.data?.pages.flatMap((page) => page.rows) ?? [],
    [refunds.data],
  );

  const totalResults = ledger.data?.pages[0]?.totalResults ?? 0;
  const totalPages = ledger.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const windowRows = useMemo(
    () => loadedRows.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [loadedRows, pageIndex],
  );

  const goToPage = (nextPage: number) => {
    const nextIndex = Math.max(0, Math.min(nextPage - 1, totalPages - 1));
    // Pull the next cursor page in when the window runs past what has loaded.
    if (nextIndex * PAGE_SIZE >= loadedRows.length && ledger.hasNextPage) {
      void ledger.fetchNextPage();
    }
    setPageIndex(nextIndex);
  };

  const onLoadMore = () => {
    if (ledger.hasNextPage) void ledger.fetchNextPage();
  };

  /*
   * Refunds and reminders both move money or reach the customer, so neither
   * fires from here — the mutations land with the `billing` / `payments`
   * endpoints, and every one of them is audited server-side (AGENTS.md).
   */
  const onLedgerAction = (_row: BillingLedgerRow) => {};

  const isLedgerLoading = ledger.isPending;
  const isLedgerEmpty = !isLedgerLoading && loadedRows.length === 0;
  const isFiltered = status !== 'all';

  const rangeStart = totalResults === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const rangeEnd = pageIndex * PAGE_SIZE + windowRows.length;

  const isRefundsLoading = refunds.isPending;
  const isRefundsEmpty = !isRefundsLoading && refundRows.length === 0;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 md:gap-6 lg:gap-8">
          <PaymentsHeader />

          {summary.isPending ? (
            <div className="grid w-full grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-[104px] animate-pulse rounded-card bg-gray-200 lg:h-[132px]"
                />
              ))}
            </div>
          ) : (
            <PaymentsKpiCards kpis={summary.data?.kpis ?? []} />
          )}

          <RevenueChartCard
            series={revenue.data}
            period={period}
            onPeriodChange={setPeriod}
            isLoading={revenue.isPending}
          />

          {/* Billing ledger */}
          <section className="flex w-full flex-col gap-4">
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
              <h2 className="shrink-0 whitespace-nowrap text-[22px] font-semibold leading-8 text-text md:text-h6 lg:text-h4">
                Billing ledger
              </h2>

              {summary.data ? (
                <LedgerFilterTabs
                  tabs={summary.data.tabs}
                  value={status}
                  onChange={setStatus}
                />
              ) : null}
            </div>

            {isLedgerLoading ? (
              <TableSkeleton rows={7} />
            ) : (
              <>
                {/* Mobile — cards on the page background, no surrounding frame. */}
                {isLedgerEmpty ? null : (
                  <LedgerCardList rows={loadedRows} onAction={onLedgerAction} />
                )}

                {/* Tablet & desktop — the table in its own card. */}
                <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:flex">
                  {isLedgerEmpty ? (
                    <PaymentsEmptyState
                      title={isFiltered ? 'No quotes match this filter' : 'No quotes yet'}
                      description={
                        isFiltered
                          ? 'Nothing in the ledger has this payment status right now.'
                          : 'Quotes and payments will appear here as customers place orders.'
                      }
                      onClearFilter={isFiltered ? () => setStatus('all') : undefined}
                    />
                  ) : (
                    <>
                      <LedgerTable rows={windowRows} onAction={onLedgerAction} />
                      <LedgerPagination
                        page={pageIndex + 1}
                        totalPages={totalPages}
                        totalResults={totalResults}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        onPageChange={goToPage}
                      />
                    </>
                  )}
                </div>

                {/* Mobile keeps its own footer and empty state outside the frame. */}
                {isLedgerEmpty ? (
                  <div className="rounded-card border border-gray-200 bg-white md:hidden">
                    <PaymentsEmptyState
                      title={isFiltered ? 'No quotes match this filter' : 'No quotes yet'}
                      description={
                        isFiltered
                          ? 'Nothing in the ledger has this payment status right now.'
                          : 'Quotes and payments will appear here as customers place orders.'
                      }
                      onClearFilter={isFiltered ? () => setStatus('all') : undefined}
                    />
                  </div>
                ) : (
                  <LedgerLoadMore
                    totalResults={totalResults}
                    loadedCount={loadedRows.length}
                    hasMore={Boolean(ledger.hasNextPage)}
                    isLoadingMore={ledger.isFetchingNextPage}
                    onLoadMore={onLoadMore}
                  />
                )}
              </>
            )}
          </section>

          {/* Refunds & adjustments log */}
          <section className="flex w-full flex-col gap-4">
            <h2 className="text-h5 font-semibold text-text md:text-h6 lg:text-h4">
              Refunds &amp; adjustments log
            </h2>

            {isRefundsLoading ? (
              <TableSkeleton rows={4} />
            ) : (
              <>
                {isRefundsEmpty ? null : <RefundLogCardList rows={refundRows} />}

                <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:flex">
                  {isRefundsEmpty ? (
                    <PaymentsEmptyState
                      icon={RotateCcw}
                      title="No refunds issued"
                      description="Refunds and manual adjustments will be logged here once any are processed."
                    />
                  ) : (
                    <RefundLogTable rows={refundRows} />
                  )}
                </div>

                {isRefundsEmpty ? (
                  <div className="rounded-card border border-gray-200 bg-white md:hidden">
                    <PaymentsEmptyState
                      icon={RotateCcw}
                      title="No refunds issued"
                      description="Refunds and manual adjustments will be logged here once any are processed."
                    />
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
