import { useMemo, useState } from 'react';

import { ChartCard } from './ChartCard';
import { shouldPrintAxisLabel } from '../../lib/reports';
import { formatCount } from '../../lib/format';
import type { GrowthSeries } from '../../types/reports';

/*
 * "Customer growth" — new customers per bucket as bars, with the running total
 * drawn over them as a line.
 *
 * The two series share an x-axis but not a y-axis: the cumulative total dwarfs
 * the per-bucket count, so plotting both against one ceiling would flatten the
 * bars into the baseline. Each is normalized against its own ceiling from the
 * backend, and the legend names both so the reader knows the line is not on the
 * printed scale. The design's single unlabelled axis leaves that ambiguous —
 * see the summary's deviations.
 *
 * The y captions belong to the bars, since those are the series the axis is
 * drawn for.
 *
 * Why hand-drawn SVG rather than a chart library: AGENTS.md's stack table is the
 * budget and no charting library is in it. This is data visualization, not
 * iconography — Design.md's icon rule still sends every glyph to lucide-react.
 *
 * Bars are HTML rather than SVG rects so they keep their radius and their gap
 * without fighting the plot's non-uniform scaling; the line is an SVG overlay in
 * the same box, so the two always agree about where a bucket sits.
 */

const VIEW_W = 1000;
const VIEW_H = 260;
const TICK_COUNT = 4;

type CustomerGrowthCardProps = {
  growth: GrowthSeries | undefined;
  isLoading: boolean;
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function CustomerGrowthCard({
  growth,
  isLoading,
  isError,
  isRetrying,
  onRetry,
}: CustomerGrowthCardProps) {
  return (
    <ChartCard
      title="Customer growth"
      description="New customers vs cumulative total"
      legend={[
        { label: 'New customers', color: 'var(--color-primary-light)' },
        { label: 'Cumulative total', color: 'var(--color-primary)' },
      ]}
      isLoading={isLoading}
      isError={isError}
      isRetrying={isRetrying}
      onRetry={onRetry}
      errorTitle="Couldn't load customer growth"
      skeletonClassName="h-[15rem] md:h-[17.5rem] lg:h-[18.75rem]"
    >
      {growth && growth.points.length > 0 ? (
        <GrowthPlot growth={growth} />
      ) : (
        <div className="flex h-[12.5rem] w-full items-center justify-center rounded-input bg-gray-50 md:h-[15rem]">
          <p className="text-small text-gray-500">
            No customer growth recorded for this period yet
          </p>
        </div>
      )}
    </ChartCard>
  );
}

function GrowthPlot({ growth }: { growth: GrowthSeries }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { barCeiling, lineCeiling, linePath } = useMemo(() => {
    // Either series being all-zero would divide by zero; 1 keeps the plot drawn
    // with everything on the baseline.
    const bars = Math.max(
      growth.maxNewCustomers,
      ...growth.points.map((point) => point.newCustomers),
      1,
    );
    const line = Math.max(
      growth.maxCumulative,
      ...growth.points.map((point) => point.cumulative),
      1,
    );

    const count = growth.points.length;
    const step = count > 1 ? VIEW_W / (count - 1) : 0;

    const path = growth.points
      .map((point, index) => {
        const x = count > 1 ? index * step : VIEW_W / 2;
        const y = VIEW_H - (point.cumulative / line) * VIEW_H;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    return { barCeiling: bars, lineCeiling: line, linePath: path };
  }, [growth]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const fraction = (TICK_COUNT - 1 - index) / (TICK_COUNT - 1);
        return formatCount(Math.round(barCeiling * fraction));
      }),
    [barCeiling],
  );

  const active =
    activeIndex === null ? null : (growth.points.at(activeIndex) ?? null);

  return (
    <div className="w-full">
      <div className="flex w-full gap-3 md:gap-4">
        <div
          className="flex h-[12.5rem] shrink-0 flex-col justify-between text-right md:h-[15rem] lg:h-[16.25rem]"
          aria-hidden="true"
        >
          {ticks.map((tick, index) => (
            <span
              key={index}
              className="text-[0.625rem] font-medium leading-none text-gray-400 md:text-small md:leading-none"
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines, behind both series. */}
          <div
            className="absolute inset-0 flex flex-col justify-between"
            aria-hidden="true"
          >
            {Array.from({ length: TICK_COUNT }, (_, index) => (
              <span key={index} className="h-px w-full bg-gray-200" />
            ))}
          </div>

          {/* Bars — new customers per bucket. */}
          <div className="relative flex h-[12.5rem] w-full items-end gap-1 md:h-[15rem] md:gap-2 lg:h-[16.25rem] lg:gap-4">
            {growth.points.map((point, index) => (
              <div
                key={point.label}
                className="flex h-full flex-1 items-end"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <div
                  className="w-full rounded-t-[0.25rem] bg-primary-light transition-opacity"
                  style={{
                    height: `${(point.newCustomers / barCeiling) * 100}%`,
                    opacity:
                      activeIndex === null || activeIndex === index ? 1 : 0.55,
                  }}
                />
              </div>
            ))}
          </div>

          {/* The cumulative line, over the bars in the same box. */}
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
            role="img"
            aria-label={`Customer growth — ${growth.points.length} periods, ${formatCount(
              lineCeiling,
            )} customers cumulative at peak`}
          >
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/*
           * One focus target per bucket so the figures are keyboard-reachable —
           * the design offers no such affordance.
           */}
          <div className="absolute inset-0 flex">
            {growth.points.map((point, index) => (
              <button
                key={point.label}
                type="button"
                className="h-full flex-1 cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                <span className="sr-only">
                  {point.label}: {formatCount(point.newCustomers)} new customers,{' '}
                  {formatCount(point.cumulative)} cumulative
                </span>
              </button>
            ))}
          </div>

          {active ? (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-input bg-text px-2.5 py-1.5 shadow-md-elevation"
            >
              <p className="whitespace-nowrap text-caption font-semibold leading-4 text-white">
                {formatCount(active.newCustomers)} new
              </p>
              <p className="whitespace-nowrap text-[0.625rem] leading-3 text-gray-300">
                {formatCount(active.cumulative)} total · {active.label}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* The x-axis, inset to line its captions up with the bars. */}
      <div className="mt-3 flex w-full gap-3 md:gap-4">
        <div
          className="invisible shrink-0 text-right text-[0.625rem] font-medium md:text-small"
          aria-hidden="true"
        >
          {ticks[0]}
        </div>
        <div className="flex min-w-0 flex-1 gap-1 md:gap-2 lg:gap-4">
          {growth.points.map((point, index) => (
            <span
              key={point.label}
              className={`min-w-0 flex-1 truncate text-center text-[0.625rem] font-medium leading-none text-[var(--color-text-secondary)] md:text-small md:leading-none ${
                shouldPrintAxisLabel(index, growth.points.length)
                  ? ''
                  : 'invisible'
              }`}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
