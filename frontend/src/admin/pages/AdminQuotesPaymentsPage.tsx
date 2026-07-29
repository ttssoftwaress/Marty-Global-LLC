import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ScanSearch } from 'lucide-react';

import { Role } from '@/constants/roles';
import { ApiError } from '@/services/api';
import { useAdminMe } from '@/admin/queries/admin-me';
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
  ResolveTransferDialog,
  RevenueChartCard,
  UnmatchedTransferCardList,
  UnmatchedTransferTable,
  useAdminBillingLedger,
  useAdminPaymentsSummary,
  useAdminRevenueSeries,
  useAdminUnmatchedTransfers,
  useResolveUnmatchedTransfer,
  useSendPaymentReminder,
} from '../features/payments';
import { useAdminShell } from '../hooks/useAdminShell';
import { useCursorPageWindow } from '../hooks/useCursorPageWindow';
import type {
  BillingLedgerRow,
  PaymentStatusFilter,
  RevenuePeriod,
  UnmatchedTransferFilter,
  UnmatchedTransferRow,
} from '../types/payments';

/*
 * Quotes & payments — the staff screen for revenue and the billing ledger.
 *
 * The section order is the same at every width — header, KPIs, revenue chart,
 * billing ledger — so one tree covers all three links. What changes is how each
 * list renders: `md` and up show tables inside bordered cards, mobile shows card
 * stacks on the page background, which is what the mobile link shows.
 *
 * Every figure, row, and chart point comes from the API; nothing on this page is
 * hardcoded business data: the summary for the KPI figures and tab counts, the
 * revenue series (re-fetched per period), and the ledger as an infinite query.
 *
 * Ledger pagination is one cursor stream shown two ways (AGENTS.md): mobile's
 * "Load more" appends the next page, while the wider links' numbered pager steps
 * a window over what has loaded, fetching ahead when the window runs past the
 * loaded edge — the same approach the orders queue uses.
 *
 * A last section — unattributed transfers — sits below the ledger. The Figma
 * links do not cover it: it is the screen half of a backend rule, AGENTS.md's
 * "money we cannot attribute is never silently dropped", and until it existed
 * the only record of a stray USDT transfer was a log line nobody outside the
 * server ever read. It is built from this screen's own patterns — table in a
 * card from `md`, card stack below — so it reads as part of the page rather
 * than as a bolted-on panel.
 */

const PAGE_SIZE = 7;

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex w-full flex-col gap-3 md:gap-0" aria-hidden="true">
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[9.375rem] animate-pulse rounded-card bg-gray-200" />
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

  /*
   * Unattributed transfers. The list is readable by anyone holding the
   * `payments` area; closing one out is admin-only, enforced server-side —
   * this check only decides whether to offer a control that would 403.
   */
  const me = useAdminMe();
  const canResolveTransfers = me.data?.role === Role.ADMIN;

  const [transferFilter, setTransferFilter] =
    useState<UnmatchedTransferFilter>('open');
  const [resolving, setResolving] = useState<UnmatchedTransferRow | null>(null);

  const transfers = useAdminUnmatchedTransfers(transferFilter);
  const resolveTransfer = useResolveUnmatchedTransfer();

  const transferRows = useMemo(
    () => transfers.data?.pages.flatMap((page) => page.rows) ?? [],
    [transfers.data],
  );

  const openTransfers = transfers.data?.pages[0]?.openCount ?? 0;

  const onResolveSubmit = (note: string) => {
    if (!resolving) return;

    resolveTransfer.mutate(
      { transferId: resolving.id, note },
      { onSuccess: () => setResolving(null) },
    );
  };

  const onResolveClose = () => {
    setResolving(null);
    resolveTransfer.reset();
  };

  const loadedRows = useMemo<BillingLedgerRow[]>(
    () => ledger.data?.pages.flatMap((page) => page.rows) ?? [],
    [ledger.data],
  );

  const totalResults = ledger.data?.pages[0]?.totalResults ?? 0;
  const totalPages = ledger.data?.pages[0]?.totalPages ?? 1;

  // The table shows one window; the mobile cards show everything loaded.
  const {
    page,
    rows: windowRows,
    rangeStart,
    rangeEnd,
    goToPage,
  } = useCursorPageWindow({
    rows: loadedRows,
    totalPages,
    totalResults,
    pageSize: PAGE_SIZE,
    hasNextPage: ledger.hasNextPage,
    isFetchingNextPage: ledger.isFetchingNextPage,
    fetchNextPage: ledger.fetchNextPage,
    resetKey: status,
  });

  const onLoadMore = () => {
    if (ledger.hasNextPage) void ledger.fetchNextPage();
  };

  /*
   * "Send reminder" on an unpaid row. A reminder reaches the customer, so it
   * goes through the backend the same way every other message does — queued,
   * preference-gated, and audited (AGENTS.md). The 24-hour cooldown is claimed
   * server-side, so nothing here guards against a double send beyond disabling
   * the control while one is in flight.
   *
   * The outcome is announced in one line under the ledger rather than per row:
   * the row it names has just been invalidated and re-rendered, and a message
   * living inside a row would be replaced along with it.
   */
  const [reminded, setReminded] = useState<string | null>(null);
  const remind = useSendPaymentReminder();

  const onLedgerAction = (row: BillingLedgerRow) => {
    if (remind.isPending) return;

    setReminded(null);
    remind.mutate(row.id, {
      onSuccess: () => setReminded(row.reference),
    });
  };

  const reminderError = remind.isError
    ? remind.error instanceof ApiError
      ? remind.error.message
      : 'Could not send that reminder. Try again.'
    : null;

  const isLedgerLoading = ledger.isPending;
  const isLedgerEmpty = !isLedgerLoading && loadedRows.length === 0;
  const isFiltered = status !== 'all';


  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-6 md:gap-6 lg:gap-8">
          <PaymentsHeader />

          {summary.isPending ? (
            <div className="grid w-full grid-cols-2 gap-2 md:gap-4 lg:grid-cols-4" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-[6.5rem] animate-pulse rounded-card bg-gray-200 lg:h-[8.25rem]"
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
              <h2 className="shrink-0 whitespace-nowrap text-[1.375rem] font-semibold leading-8 text-text md:text-h6 lg:text-h4">
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
                  <LedgerCardList
                    rows={loadedRows}
                    onAction={onLedgerAction}
                    sendingId={remind.isPending ? remind.variables : null}
                  />
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
                      <LedgerTable
                        rows={windowRows}
                        onAction={onLedgerAction}
                        sendingId={remind.isPending ? remind.variables : null}
                      />
                      <LedgerPagination
                        page={page}
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

            {/*
              * What the last reminder did. A refusal is the backend's own
              * sentence — a cooldown, a settled invoice, a customer who muted
              * quote alerts — since each of those is something the reviewer
              * needs to read rather than a code (Design.md, error states).
              */}
            {reminderError ? (
              <p
                role="alert"
                className="flex items-start gap-2 text-small text-error"
              >
                <AlertCircle
                  className="mt-px size-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {reminderError}
              </p>
            ) : reminded ? (
              <p
                role="status"
                className="flex items-start gap-2 text-small text-[var(--color-success)]"
              >
                <CheckCircle2
                  className="mt-px size-4 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Payment reminder sent for {reminded}.
              </p>
            ) : null}
          </section>

          {/*
            * Unattributed transfers — USDT that arrived matching no payment.
            *
            * Rendered only once the queue has ever held something. An operation
            * where every transfer matches should not carry a permanently empty
            * panel explaining a problem it does not have; the section appears
            * the moment stray money does.
            */}
          {transfers.isPending || (transferRows.length === 0 && openTransfers === 0) ? null : (
            <section className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-h5 font-semibold text-text md:text-h6 lg:text-h4">
                    Unattributed transfers
                  </h2>
                  <p className="text-caption text-gray-500 md:text-small">
                    {openTransfers > 0
                      ? `${openTransfers} on-chain ${
                          openTransfers === 1 ? 'payment' : 'payments'
                        } we could not match to an invoice.`
                      : 'Nothing outstanding — every transfer has been reconciled.'}
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Filter unattributed transfers"
                  className="flex shrink-0 items-center gap-2"
                >
                  {(
                    [
                      { value: 'open', label: 'Open' },
                      { value: 'resolved', label: 'Reconciled' },
                      { value: 'all', label: 'All' },
                    ] as const
                  ).map((tab) => {
                    const isActive = tab.value === transferFilter;

                    return (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setTransferFilter(tab.value)}
                        className={`flex shrink-0 items-center whitespace-nowrap rounded-pill px-3 py-1.5 text-small transition-colors md:px-4 md:py-2 lg:text-body ${
                          isActive
                            ? 'bg-primary font-semibold text-white'
                            : 'border border-gray-300 bg-white font-medium text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {transferRows.length === 0 ? null : (
                <UnmatchedTransferCardList
                  rows={transferRows}
                  canResolve={canResolveTransfers}
                  resolvingId={resolveTransfer.isPending ? resolving?.id ?? null : null}
                  onResolve={setResolving}
                />
              )}

              <div className="hidden w-full flex-col overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:flex">
                {transferRows.length === 0 ? (
                  <PaymentsEmptyState
                    icon={ScanSearch}
                    title={
                      transferFilter === 'resolved'
                        ? 'Nothing reconciled yet'
                        : 'No unattributed transfers'
                    }
                    description={
                      transferFilter === 'resolved'
                        ? 'Transfers your team closes out will be logged here with the note that explains them.'
                        : 'Every payment that has landed on the deposit address matched an invoice.'
                    }
                  />
                ) : (
                  <UnmatchedTransferTable
                    rows={transferRows}
                    canResolve={canResolveTransfers}
                    resolvingId={resolveTransfer.isPending ? resolving?.id ?? null : null}
                    onResolve={setResolving}
                  />
                )}
              </div>

              {transferRows.length === 0 ? (
                <div className="rounded-card border border-gray-200 bg-white md:hidden">
                  <PaymentsEmptyState
                    icon={ScanSearch}
                    title={
                      transferFilter === 'resolved'
                        ? 'Nothing reconciled yet'
                        : 'No unattributed transfers'
                    }
                    description={
                      transferFilter === 'resolved'
                        ? 'Transfers your team closes out will be logged here with the note that explains them.'
                        : 'Every payment that has landed on the deposit address matched an invoice.'
                    }
                  />
                </div>
              ) : null}

              {/*
                * Its own "Load more" rather than the ledger's: that one prints
                * "Showing N of M orders", and this list is not orders. Shown at
                * every width — the queue is short enough that a pager would be
                * more chrome than the section is worth.
                */}
              {transfers.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void transfers.fetchNextPage()}
                  disabled={transfers.isFetchingNextPage}
                  className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 md:w-fit md:self-center md:px-6"
                >
                  {transfers.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </section>
          )}
        </div>
      </div>

      <ResolveTransferDialog
        transfer={resolving}
        isSubmitting={resolveTransfer.isPending}
        error={resolveTransfer.error}
        onSubmit={onResolveSubmit}
        onClose={onResolveClose}
      />
    </AdminLayout>
  );
}
