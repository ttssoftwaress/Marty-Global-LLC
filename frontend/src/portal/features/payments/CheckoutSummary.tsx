import { Clock, FileText } from 'lucide-react';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { CheckoutQuote } from '../../types/payments';

/*
 * What the customer is paying for — the quote, its lines, and the total.
 *
 * Every figure comes from the backend as integer minor units and is formatted
 * only here at render (AGENTS.md, Money). The line amounts are signed, so a
 * discount or credit line arrives negative and prints as such rather than being
 * special-cased into a different row type.
 *
 * On desktop this sits in the right rail beside the payment panel; on tablet and
 * mobile it stacks above it, so the customer reads what they owe before how to
 * pay it.
 */

export function CheckoutSummary({ quote }: { quote: CheckoutQuote }) {
  return (
    <section className="w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3.5 md:px-5">
        <h2 className="text-h6 font-semibold text-text">Order summary</h2>
        <span className="flex items-center gap-1.5 text-small font-medium text-gray-500">
          <FileText className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {quote.reference}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4 md:p-5">
        <p className="text-body font-semibold text-text">{quote.serviceName}</p>

        {quote.lineItems.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {quote.lineItems.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-4">
                <span className="min-w-0 text-body text-text-secondary">
                  {line.label}
                </span>
                <span className="shrink-0 text-body font-medium text-text">
                  {formatMoney(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <span className="text-body font-semibold text-text">Total due</span>
          <span className="text-h6 font-bold text-text md:text-h5">
            {formatMoney(quote.total)}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-small font-medium text-[var(--color-status-review-text)]">
          <Clock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Quote valid until {formatOrderDate(quote.validUntil)}
        </p>
      </div>
    </section>
  );
}
