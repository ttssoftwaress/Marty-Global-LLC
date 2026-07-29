import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Sparkline } from './Sparkline';
import type { ReportKpi, TrendDirection } from '../../types/reports';

/*
 * The four headline figures. Desktop lays them 4-up, tablet and mobile fall
 * back to a 2×2 grid, matching their links.
 *
 * Every figure is resolved by the backend — `value` arrives as the string to
 * print, so no money arithmetic happens here (AGENTS.md, Money rules). The
 * trend's direction, its wording, and whether it reads as good news are all the
 * backend's call: the design's red "-2.1%" on conversion rate is a negative
 * tone, not a rule about the fourth card.
 *
 * The design puts a "more" affordance in each card's top-right corner with no
 * behaviour attached to it. It is dropped here rather than shipped as a control
 * that does nothing — see the summary's deviations.
 */

const TREND_ICON: Record<TrendDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_TONE = {
  positive: 'text-success',
  negative: 'text-error',
  neutral: 'text-gray-500',
} as const;

function KpiCard({ kpi }: { kpi: ReportKpi }) {
  const TrendIcon = TREND_ICON[kpi.trend.direction];
  const toneClass = TREND_TONE[kpi.trend.tone];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-4 md:p-5 lg:p-card">
      <p className="text-[0.8125rem] font-medium leading-5 text-[var(--color-text-secondary)] md:text-body">
        {kpi.label}
      </p>

      {/*
       * Figure and sparkline share a baseline from `md` up, as the desktop and
       * tablet links show. Mobile's card is too narrow for a 120px sparkline
       * beside a 28px figure, so the spark drops below — matching its link,
       * where the card is a stacked block.
       */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[1.5rem] font-bold leading-8 text-[var(--color-gray-900)] md:text-[1.625rem] md:leading-9 lg:text-[1.75rem] lg:leading-10">
            {kpi.value}
          </p>

          {/*
           * The trend reads as one line — icon, movement, and the window it is
           * measured against — so the caption is truncated rather than wrapped
           * when the card is narrow. Wrapping pushes the card taller than its
           * neighbours and squeezes the sparkline beside it.
           */}
          <div className="flex min-w-0 items-center gap-1.5">
            <TrendIcon className={`size-3.5 shrink-0 ${toneClass}`} aria-hidden="true" />
            <span
              className={`shrink-0 text-[0.8125rem] font-semibold leading-5 ${toneClass}`}
            >
              {kpi.trend.label}
            </span>
            <span className="truncate text-[0.8125rem] leading-5 text-gray-400">
              {kpi.trend.caption}
            </span>
          </div>
        </div>

        {kpi.sparkline.length > 1 ? (
          <Sparkline
            points={kpi.sparkline}
            tone={kpi.trend.tone}
            className="h-8 w-full shrink-0 md:w-[5.25rem] lg:w-[6.5rem]"
          />
        ) : null}
      </div>
    </div>
  );
}

export function ReportsKpiCards({ kpis }: { kpis: ReportKpi[] }) {
  if (kpis.length === 0) return null;

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-6">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  );
}
