import { Calendar, Clock, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { BillingQuote } from '../../types/billing';
import { QuoteStatusChip } from './chips';

/*
 * Quotes awaiting payment — three presentations of one list, swapped by
 * breakpoint (a table row can't reflow into a card, so each renders its own
 * markup, the same approach the orders list takes):
 *   - desktop (lg): full table — service · amount · date issued · valid until ·
 *     status · action (Pay now)
 *   - tablet (md):  same table, folding away the DATE ISSUED column to fit the
 *     narrower width
 *   - mobile:       one card per quote — title + amount, status, valid-until,
 *     then a full-width Pay now
 *
 * "Pay now" routes into the branded checkout for the quote. The design shows a
 * populated list; the empty state is added so a settled account explains itself
 * instead of showing a bare card.
 */

// The branded checkout for a quote lives under billing (AGENTS.md,
// portal/features/payments owns it); the wizard route lands as it's built.
const payHref = (quoteId: string) => `/app/billing/pay/${quoteId}`;

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-approved-bg)]">
        <FileCheck2 className="size-6 text-success" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">You're all caught up</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
        No quotes are awaiting payment right now. New quotes will appear here.
      </p>
    </div>
  );
}

export function QuotesAwaitingPayment({ quotes }: { quotes: BillingQuote[] }) {
  const isEmpty = quotes.length === 0;

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-h6 font-semibold text-text lg:text-h4">
        Quotes awaiting payment
      </h2>

      {/* Mobile — one card per quote */}
      <ul className="flex w-full flex-col gap-3 md:hidden">
        {isEmpty ? (
          <li className="rounded-card border border-gray-200 bg-white">
            <EmptyState />
          </li>
        ) : (
          quotes.map((quote) => (
            <li
              key={quote.id}
              className="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-body font-semibold text-text">{quote.serviceName}</p>
                  <p className="text-body-lg font-bold text-text">
                    {formatMoney(quote.amount)}
                  </p>
                </div>
                <QuoteStatusChip status={quote.status} />
              </div>

              <p className="flex items-center gap-1.5 text-small font-medium text-[var(--color-status-review-text)]">
                <Calendar className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Valid until {formatOrderDate(quote.validUntil)}
              </p>

              <div className="flex items-center gap-2">
                <Link
                  to={payHref(quote.id)}
                  className="btn btn-accent h-12 flex-1 rounded-input text-body"
                >
                  Pay now
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Tablet & desktop — card-wrapped table */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)] text-left align-middle">
              <th
                scope="col"
                className="px-4 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:px-6"
              >
                Service / order
              </th>
              <th
                scope="col"
                className="w-[6.25rem] text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[8.75rem]"
              >
                Quote amount
              </th>
              <th
                scope="col"
                className="hidden text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:table-cell lg:w-[8.75rem]"
              >
                Date issued
              </th>
              <th
                scope="col"
                className="w-[7.5rem] text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[10rem]"
              >
                Valid until
              </th>
              <th
                scope="col"
                className="w-[6.875rem] text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[9.375rem]"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-[8.125rem] px-4 text-right text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[11.25rem] lg:px-6"
              >
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr
                  key={quote.id}
                  className="h-14 border-b border-gray-200 last:border-b-0"
                >
                  <td className="min-w-0 px-4 lg:px-6">
                    <Link
                      to={payHref(quote.id)}
                      className="block truncate text-[0.8125rem] font-semibold text-primary hover:underline lg:text-body"
                    >
                      {quote.serviceName}
                    </Link>
                  </td>

                  <td className="text-[0.8125rem] font-semibold text-text lg:text-body">
                    {formatMoney(quote.amount)}
                  </td>

                  <td className="hidden text-body text-gray-600 lg:table-cell">
                    {formatOrderDate(quote.issuedAt)}
                  </td>

                  <td>
                    <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-[var(--color-status-review-text)] lg:text-body">
                      <Clock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      {formatOrderDate(quote.validUntil)}
                    </span>
                  </td>

                  <td>
                    <QuoteStatusChip status={quote.status} />
                  </td>

                  <td className="px-4 lg:px-6">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={payHref(quote.id)}
                        className="btn btn-accent h-9 whitespace-nowrap rounded-input px-4 text-[0.8125rem] lg:h-10 lg:text-body"
                      >
                        Pay now
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
