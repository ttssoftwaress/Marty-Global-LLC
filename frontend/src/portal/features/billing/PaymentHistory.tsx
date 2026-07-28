import { Download, Receipt, Wallet } from 'lucide-react';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { PaymentHistoryRange, PaymentRecord } from '../../types/billing';
import { PaymentStatusChip } from './chips';
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
 * Both drive one cursor stream (AGENTS.md, cursor pagination). The invoice
 * download is a short-TTL presigned URL, disabled until the backend has it.
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

function InvoiceIconButton({ payment }: { payment: PaymentRecord }) {
  const label = `Download invoice for ${payment.serviceName}`;
  const base =
    'flex size-9 items-center justify-center rounded-input text-gray-500 transition-colors lg:size-10';

  if (!payment.invoiceHref) {
    return (
      <button
        type="button"
        disabled
        aria-label="Invoice not ready yet"
        className={`${base} cursor-default opacity-40`}
      >
        <Download className="size-[18px] shrink-0 lg:size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  }

  return (
    <a
      href={payment.invoiceHref}
      download
      aria-label={label}
      className={`${base} hover:bg-gray-100`}
    >
      <Download className="size-[18px] shrink-0 lg:size-5" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}

function InvoiceTextLink({ payment }: { payment: PaymentRecord }) {
  if (!payment.invoiceHref) {
    return (
      <span className="flex items-center gap-1.5 text-small font-semibold text-gray-400">
        <Download className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Invoice
      </span>
    );
  }

  return (
    <a
      href={payment.invoiceHref}
      download
      aria-label={`Download invoice for ${payment.serviceName}`}
      className="flex items-center gap-1.5 text-small font-semibold text-primary hover:underline"
    >
      <Download className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      Invoice
    </a>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-gray-100">
        <Receipt className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">No payments yet</p>
      <p className="max-w-[360px] text-body text-gray-500">
        Your paid invoices will show up here. Try a different range or search.
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-10 w-full animate-pulse rounded-input bg-gray-200" />
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
        <h2 className="text-h6 font-semibold text-text lg:text-h4">Payment history</h2>
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
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-body font-semibold text-text">
                        {payment.serviceName}
                      </p>
                      <p className="text-small text-text-secondary">
                        {formatOrderDate(payment.paidAt)} · {payment.method}
                      </p>
                    </div>
                    <p className="shrink-0 text-body font-semibold text-text">
                      {formatMoney(payment.amount)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <PaymentStatusChip status={payment.status} />
                    <InvoiceTextLink payment={payment} />
                  </div>
                </li>
              ))}
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
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)] text-left align-middle">
              <th
                scope="col"
                className="w-[100px] px-4 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[140px] lg:px-6"
              >
                Date
              </th>
              <th
                scope="col"
                className="text-caption font-semibold uppercase tracking-[0.6px] text-gray-500"
              >
                Service / order
              </th>
              <th
                scope="col"
                className="w-[100px] text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[140px]"
              >
                Amount
              </th>
              <th
                scope="col"
                className="hidden text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:table-cell lg:w-[220px]"
              >
                Payment method
              </th>
              <th
                scope="col"
                className="w-[110px] text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[160px]"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-[80px] px-4 text-right text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[110px] lg:px-6"
              >
                Invoice
              </th>
            </tr>
          </thead>

          {!showSkeleton && !isEmpty && (
            <tbody>
              {windowPayments.map((payment) => (
                <tr
                  key={payment.id}
                  className="h-14 border-b border-gray-200 last:border-b-0"
                >
                  <td className="px-4 text-[13px] text-gray-600 lg:px-6 lg:text-body">
                    {formatOrderDate(payment.paidAt)}
                  </td>

                  <td className="min-w-0 pr-4">
                    <p className="truncate text-[13px] font-medium text-text lg:text-body">
                      {payment.serviceName}
                    </p>
                  </td>

                  <td className="text-[13px] font-semibold text-text lg:text-body">
                    {formatMoney(payment.amount)}
                  </td>

                  <td className="hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-body text-gray-700">
                      <Wallet className="size-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
                      {payment.method}
                    </span>
                  </td>

                  <td>
                    <PaymentStatusChip status={payment.status} />
                  </td>

                  <td className="px-4 lg:px-6">
                    <div className="flex justify-end">
                      <InvoiceIconButton payment={payment} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>

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
                className="flex h-9 items-center justify-center rounded-input px-4 text-[13px] font-semibold transition-colors disabled:cursor-default enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!canNext}
                className="flex h-9 items-center justify-center rounded-input border px-4 text-[13px] font-semibold transition-colors disabled:cursor-default enabled:border-primary enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-400"
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
