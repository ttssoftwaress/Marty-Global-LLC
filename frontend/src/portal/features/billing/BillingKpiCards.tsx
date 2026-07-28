import type { ReactNode } from 'react';

import { formatMoney } from '../../lib/format';
import type { BillingKpis } from '../../types/billing';

/*
 * The three headline figures. One tree serves every viewport: mobile lays the
 * first two side by side with pending quotes full-width beneath (a 2-col grid
 * where the last card spans both), tablet and desktop line all three up in a
 * row. Padding and type scale up with the breakpoint, matching the three links.
 *
 * "Amount due" only takes the warning hue when something is actually owed, so a
 * settled account doesn't read as an alert (same rule as the dashboard card).
 */

type KpiCard = {
  label: string;
  value: ReactNode;
  valueClassName: string;
  spanFull?: boolean;
};

export function BillingKpiCards({ kpis }: { kpis: BillingKpis }) {
  const cards: KpiCard[] = [
    {
      label: 'Amount due',
      value: formatMoney(kpis.amountDue),
      valueClassName:
        kpis.amountDue.amount > 0
          ? 'text-[var(--color-status-review-text)]'
          : 'text-text',
    },
    {
      label: 'Total paid',
      value: formatMoney(kpis.totalPaid),
      valueClassName: 'text-primary',
    },
    {
      label: 'Pending quotes',
      value: kpis.pendingQuotes,
      valueClassName: 'text-text',
      spanFull: true,
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 md:gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col gap-1.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:p-5 lg:p-card ${
            card.spanFull ? 'col-span-2 md:col-span-1' : ''
          }`}
        >
          <p className="text-caption font-semibold uppercase tracking-[0.4px] text-gray-500 md:text-small md:font-medium lg:text-body lg:font-normal lg:normal-case lg:tracking-normal">
            {card.label}
          </p>
          <p
            className={`text-[1.25rem] font-bold leading-tight md:text-h4 lg:text-h3 lg:font-semibold ${card.valueClassName}`}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
