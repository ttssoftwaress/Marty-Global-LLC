import { Fragment } from 'react';
import { Receipt, Wallet } from 'lucide-react';

import {
  DetailRow,
  ExpandChevron,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatMoney, formatOrderDate } from '../../lib/format';
import type { PaymentHistoryRange, PaymentRecord } from '../../types/billing';
import { PaymentStatusChip } from './chips';
import { PaymentDetails } from './PaymentDetails';
import { PaymentHistoryControls } from './PaymentHistoryControls';

/*
 * Payment history — the settled-payments record. Section title and controls sit
 * on one row from desktop and stack below it on tablet/mobile. The list itself
 * has two presentations swapped by breakpoint:
 *   - desktop (lg): full table — date · service · amount · method · status ·
 *     invoice, with a page counter + Prev/Next footer inside the card
 *   - tablet (md):  same table, folding away the PAYMENT METHOD column
 *   - mobile:       one card per payment (service + date·method meta + amount,
 *     status chip beside an Invoice download), over a "Load more" button
 *
 * Desktop/tablet page a fixed window through the loaded history; mobile appends.
 * Both drive one cursor stream (AGENTS.md, cursor pagination).
 *
 * The invoice moved OFF the row and into the panel it opens. The link is a
 * short-TTL presigned URL (AGENTS.md, Security & PII), so a column of them
 * meant signing one per payment on the page to serve at most one — and every
 * clock started at page load, so the button on a row read twenty minutes later
 * was already expired. Clicking a row now opens what was billed, the
 * transaction reference, and a link minted at that moment. One row is open at a
 * time.
 */

type PaymentHistoryProps = {
  search: string;
  onSearchChange: (value: string) => void;
  range: PaymentHistoryRange;
  onRangeChange: (range: PaymentHistoryRange) => void;
  onExport?: () => void;

  payments: PaymentRecord[]; // full loaded set — mobile shows all of it
  page: number; // 1-based desktop window
  pageSize: number;
  totalPages: number;
  isLoading?: boolean;

  canLoadMore: boolean; // more to append on mobile
  onLoadMore: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/*
 * Whether an invoice exists, said in words on the row. The download itself is
 * in the panel: the link is presigned and short-lived, so it is minted when the
 * customer opens the row rather than for every row on the page.
 */
function InvoiceHint({ payment }: { payment: PaymentRecord }) {
  return (
    <span
      className={`text-small ${payment.hasInvoice ? 'text-primary' : 'text-gray-400'}`}
    >
      {payment.hasInvoice ? 'Invoice ready' : 'Not ready'}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <Receipt
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">No payments yet</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
        Your paid invoices will show up here. Try a different range or search.
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-10 w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

export function PaymentHistory({
  search,
  onSearchChange,
  range,
  onRangeChange,
  onExport,
  payments,
  page,
  pageSize,
  totalPages,
  isLoading,
  canLoadMore,
  onLoadMore,
  onPrev,
  onNext,
}: PaymentHistoryProps) {
  const { expandedId, toggle } = useExpandedRow();

  const isEmpty = !isLoading && payments.length === 0;
  const showSkeleton = isLoading && payments.length === 0;

  // Desktop/tablet show one page window into the loaded history.
  const windowStart = (page - 1) * pageSize;
  const windowPayments = payments.slice(windowStart, windowStart + pageSize);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-h6 font-semibold text-text lg:text-h4">
          Payment history
        </h2>
        <PaymentHistoryControls
          search={search}
          onSearchChange={onSearchChange}
          range={range}
          onRangeChange={onRangeChange}
          onExport={onExport}
        />
      </div>

      {/* Mobile — one card per payment, over a Load more button */}
      <div className="flex w-full flex-col gap-3 md:hidden">
        {showSkeleton ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <SkeletonRows />
          </div>
        ) : isEmpty ? (
          <div className="rounded-card border border-gray-200 bg-white">
            <EmptyState />
          </div>
        ) : (
          <>
            <ul className="flex w-full flex-col gap-3">
              {payments.map((payment) => {
                const isExpanded = payment.id === expandedId;
                const panelId = detailPanelId('payment-card', payment.id);

                return (
                  <li
                    key={payment.id}
                    className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(payment.id)}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      className="flex flex-col gap-3 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-body font-semibold text-text">
                            {payment.serviceName}
                          </span>
                          <span className="text-small text-text-secondary">
                            {formatOrderDate(payment.paidAt)} · {payment.method}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-body font-semibold text-text">
                            {formatMoney(payment.amount)}
                          </span>
                          <ExpandChevron isExpanded={isExpanded} />
                        </span>
                      </span>

                      <span className="flex items-center justify-between gap-3">
                        <PaymentStatusChip status={payment.status} />
                        <InvoiceHint payment={payment} />
                      </span>
                    </button>

                    {isExpanded ? (
                      <div id={panelId} onClick={stopRowToggle}>
                        <PaymentDetails payment={payment} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={onLoadMore}
              disabled={!canLoadMore}
              className="flex h-12 w-full items-center justify-center rounded-input border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
            >
              Load more payments
            </button>
          </>
        )}
      </div>

      {/* Tablet & desktop — card-wrapped table with a paging footer */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <div className="table-scroll">
          <table className="data-table min-w-[38rem] table-fixed lg:min-w-[56.5rem]">
            <thead>
              <tr className="h-12">
                <th
                  scope="col"
                  className="w-[6.25rem] px-4 lg:w-[8rem] lg:px-6"
                >
                  Date
                </th>
                <th scope="col" className="pr-4">
                  Service / order
                </th>
                <th scope="col" className="w-[6.25rem] pr-3 lg:w-[8rem]">
                  Amount
                </th>
                <th
                  scope="col"
                  className="hidden pr-3 lg:table-cell lg:w-[11rem]"
                >
                  Payment method
                </th>
                <th scope="col" className="w-[6.875rem] pr-3 lg:w-[9.5rem]">
                  Status
                </th>
                <th scope="col" className="w-[6rem] pr-3 lg:w-[7rem]">
                  Invoice
                </th>
                <th scope="col" className="w-[4rem] pr-4 lg:pr-6">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>

            {!showSkeleton && !isEmpty && (
              <tbody>
                {windowPayments.map((payment) => {
                  const isExpanded = payment.id === expandedId;
                  const panelId = detailPanelId('payment', payment.id);

                  return (
                  <Fragment key={payment.id}>
                  <tr
                    {...expandRowProps({
                      isExpanded,
                      panelId,
                      onToggle: () => toggle(payment.id),
                      label: `${isExpanded ? 'Hide' : 'Show'} details for the ${payment.serviceName} payment`,
                    })}
                    className={`h-14 ${expandedRowClass(isExpanded)}`}
                  >
                    <td className="px-4 text-[0.8125rem] text-gray-600 lg:px-6 lg:text-body">
                      <span className="block truncate">
                        {formatOrderDate(payment.paidAt)}
                      </span>
                    </td>

                    <td className="min-w-0 pr-4">
                      <p
                        className="truncate text-[0.8125rem] font-medium lg:text-body"
                        title={payment.serviceName}
                      >
                        {payment.serviceName}
                      </p>
                    </td>

                    <td className="pr-3 text-[0.8125rem] font-semibold lg:text-body">
                      <span className="block truncate">
                        {formatMoney(payment.amount)}
                      </span>
                    </td>

                    <td className="hidden pr-3 lg:table-cell">
                      <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
                        <Wallet
                          className="size-4 shrink-0 text-gray-400"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        <span className="truncate" title={payment.method}>
                          {payment.method}
                        </span>
                      </span>
                    </td>

                    <td className="pr-3">
                      <PaymentStatusChip status={payment.status} />
                    </td>

                    <td className="pr-3">
                      <InvoiceHint payment={payment} />
                    </td>

                    <ExpandChevronCell isExpanded={isExpanded} />
                  </tr>

                  {isExpanded ? (
                    <DetailRow panelId={panelId} colSpan={7}>
                      <PaymentDetails payment={payment} />
                    </DetailRow>
                  ) : null}
                  </Fragment>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {showSkeleton && <SkeletonRows />}
        {isEmpty && <EmptyState />}

        {!showSkeleton && !isEmpty && (
          <div className="flex h-16 items-center justify-between border-t border-gray-200 bg-[var(--table-header-bg)] px-4 lg:px-6">
            <p className="text-small font-medium text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2 lg:gap-3">
              <button
                type="button"
                onClick={onPrev}
                disabled={!canPrev}
                className="flex h-9 items-center justify-center rounded-input px-4 text-[0.8125rem] font-semibold transition-colors disabled:cursor-default enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className="flex h-9 items-center justify-center rounded-input border px-4 text-[0.8125rem] font-semibold transition-colors disabled:cursor-default enabled:border-primary enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
