import { Activity, DollarSign, Mail, ShoppingCart, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { formatCount, formatMoneyCompact } from '../../lib/format';
import type { CustomerMetric } from '../../types/customer-detail';

/*
 * The four figures across the top of the customer's record.
 *
 * The grid is the only thing that changes across the links: one row of four on
 * desktop, a 2×2 on tablet and mobile. `grid-cols-2 lg:grid-cols-4` covers all
 * three, so the cards themselves are drawn once.
 *
 * The value arrives pre-resolved from the API as either a count or money, so the
 * card only formats it — money is integer minor units, divided for display only
 * (AGENTS.md, Money rules).
 *
 * The glyph is chosen from the metric id, not its label, so a copy change never
 * silently swaps an icon. An id the frontend does not know yet still renders,
 * with a neutral fallback glyph — the card is never dropped for want of an icon.
 */

const ICONS: Record<string, LucideIcon> = {
  'total-orders': ShoppingCart,
  'total-spent': DollarSign,
  'active-orders': TrendingUp,
  'open-mail-items': Mail,
};

type CustomerMetricCardsProps = {
  metrics: CustomerMetric[];
};

function metricText(metric: CustomerMetric) {
  return metric.value.kind === 'money'
    ? formatMoneyCompact(metric.value.money)
    : formatCount(metric.value.count);
}

export function CustomerMetricCards({ metrics }: CustomerMetricCardsProps) {
  return (
    <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {metrics.map((metric) => {
        const Icon = ICONS[metric.id] ?? Activity;

        return (
          <div
            key={metric.id}
            className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation md:gap-3 md:p-4 lg:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-small font-medium text-gray-500 md:text-text-secondary lg:text-gray-500">
                {metric.label}
              </span>
              <Icon
                className="size-4 shrink-0 text-gray-400 md:size-[1.125rem]"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>

            <p className="text-[1.25rem] font-semibold leading-7 text-text md:text-[1.75rem] md:leading-9 lg:text-[1.5rem] lg:leading-8">
              {metricText(metric)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
