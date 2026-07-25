import { ArrowDown, ArrowUp } from 'lucide-react';

import { formatCount, formatMoneyCompact } from '../../lib/format';
import type {
  DashboardMetric,
  MetricTrendDirection,
} from '../../types/dashboard';

/*
 * KPI row — the headline figures for the selected period. Desktop lays the
 * cards 4-up; tablet and mobile fall back to a 2×2 grid, matching their Figma
 * links.
 *
 * The footer is one line on desktop and tablet (caption then trend) and stacks
 * on mobile, where a quarter-width card cannot hold both side by side — that is
 * exactly what the mobile link shows.
 *
 * Values are whatever the backend resolved: a count or a money amount. Nothing
 * here computes a figure, and money formats from integer minor units at render
 * only (AGENTS.md, Money rules).
 */

const TREND_STYLE: Record<MetricTrendDirection, string> = {
  up: 'text-success',
  down: 'text-error',
  // No arrow — a flat trend is a state ("Awaiting client"), not a movement.
  flat: 'text-[var(--color-status-review-text)]',
};

function TrendIndicator({ trend }: { trend: DashboardMetric['trend'] }) {
  const Icon = trend.direction === 'up' ? ArrowUp : ArrowDown;

  return (
    <span
      className={`flex shrink-0 items-center gap-1 ${TREND_STYLE[trend.direction]}`}
    >
      {trend.direction === 'flat' ? null : (
        <Icon
          className="size-3 shrink-0 md:size-3.5"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
      <span className="whitespace-nowrap text-[11px] font-medium leading-4 md:text-[12px]">
        {trend.label}
      </span>
    </span>
  );
}

function KpiCard({ metric }: { metric: DashboardMetric }) {
  const value =
    metric.value.kind === 'money'
      ? formatMoneyCompact(metric.value.money)
      : formatCount(metric.value.count);

  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-3 md:p-5 lg:p-card">
      <p className="text-[11px] font-medium uppercase leading-4 text-gray-500">
        {metric.label}
      </p>

      <p className="text-[24px] font-bold leading-8 text-text lg:text-[32px] lg:leading-10">
        {value}
      </p>

      {/*
       * Mobile stacks caption over trend; from `md` the two share a line, which
       * is what the tablet and desktop links show.
       */}
      <div className="mt-auto flex flex-col gap-0.5 md:flex-row md:flex-wrap md:items-center md:gap-x-1.5 md:gap-y-1">
        <p className="text-[11px] leading-4 text-gray-500 md:text-[12px]">
          {metric.caption}
        </p>

        <TrendIndicator trend={metric.trend} />
      </div>
    </div>
  );
}

export function KpiCards({ metrics }: { metrics: DashboardMetric[] }) {
  if (metrics.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4 lg:gap-6">
      {metrics.map((metric) => (
        <KpiCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
