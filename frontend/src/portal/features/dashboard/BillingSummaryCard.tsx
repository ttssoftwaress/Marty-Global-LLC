import { formatMoney } from '../../lib/format';
import type { BillingSummary } from '../../types/dashboard';
import { SummaryCard } from './SummaryCard';

/*
 * Billing summary — amount due, total paid, and how many quotes are waiting.
 * The amount due switches to the warning hue only when something is owed, so a
 * settled account does not read as an alert.
 */

export function BillingSummaryCard({ billing }: { billing: BillingSummary }) {
  return (
    <SummaryCard
      title="Billing summary"
      linkLabel="Manage"
      to="/app/billing"
      entries={[
        {
          label: 'Amount due',
          value: formatMoney(billing.amountDue),
          valueClassName:
            billing.amountDue.amount > 0
              ? 'text-[var(--color-status-review-text)]'
              : 'text-text',
        },
        {
          label: 'Total paid',
          value: formatMoney(billing.totalPaid),
        },
        {
          label: 'Pending quotes',
          // Tablet drops the pill and shows a plain bold value, so the chip
          // styles are written as utilities rather than the `.status-*` class
          // — a component class cannot be re-applied behind a `lg:` prefix.
          value: (
            <span className="inline-flex items-center rounded-pill bg-[var(--color-status-submitted-bg)] px-2.5 py-1 text-small font-semibold text-primary md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-body-lg md:font-bold lg:rounded-pill lg:bg-[var(--color-status-submitted-bg)] lg:px-2.5 lg:py-1 lg:text-small lg:font-semibold">
              {billing.pendingQuotes} {billing.pendingQuotes === 1 ? 'quote' : 'quotes'}
            </span>
          ),
        },
      ]}
    />
  );
}
