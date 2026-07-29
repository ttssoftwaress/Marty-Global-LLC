import { useId, useMemo, useState } from 'react';

import { ChartCard } from './ChartCard';
import {
  formatAxisValue,
  formatSeriesValue,
  shouldPrintAxisLabel,
} from '../../lib/reports';
import type { ReportSeries } from '../../types/reports';

/*
 * "Revenue over time" — the line chart drawn from the series the backend
 * returns.
 *
 * All three links draw the same shape here (a line with an area fill beneath
 * it), so unlike the payments screen this is one presentation at every width.
 * What changes across breakpoints is the plot's height and the type size of the
 * axis captions.
 *
 * Why hand-drawn SVG rather than a chart library: AGENTS.md's stack table is the
 * budget and no charting library is in it, so adding one is a decision that is
 * not mine to make. The geometry a line chart needs is a handful of ratios.
 * Note this is data visualization, not iconography — Design.md's "never
 * hand-draw SVGs" rule is about icons, which still come from lucide-react.
 *
 * Everything scales off a fixed viewBox with `preserveAspectRatio="none"` on the
 * plot, so the chart fills whatever width the card gives it without a resize
 * observer. The axis captions live in HTML beside and beneath the SVG rather
 * than inside it, so they keep their real type size instead of being stretched
 * by that same scaling — which is also what stops the design's "$150k" tick
 * from colliding with the top gridline.
 *
 * The y-axis ceiling comes down with the series (`maxValue`) so the ticks hold
 * still across a period switch instead of re-scaling to whatever the current
 * bucket's tallest point happens to be.
 */

const VIEW_W = 1000;
const VIEW_H = 220;
const TICK_COUNT = 4; // the four captions every link prints: max → 0

type RevenueOverTimeCardProps = {
  series: ReportSeries | undefined;
  isLoading: boolean;
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function RevenueOverTimeCard({
  series,
  isLoading,
  isError,
  isRetrying,
  onRetry,
}: RevenueOverTimeCardProps) {
  return (
    <ChartCard
      title="Revenue over time"
      description="Monthly accumulated revenue"
      legend={[{ label: 'Revenue ($)', color: 'var(--color-primary)' }]}
      isLoading={isLoading}
      isError={isError}
      isRetrying={isRetrying}
      onRetry={onRetry}
      errorTitle="Couldn't load revenue over time"
      skeletonClassName="h-[12.5rem] md:h-[15rem] lg:h-[17.5rem]"
    >
      {series && series.points.length > 0 ? (
        <RevenuePlot series={series} />
      ) : (
        <EmptyPlot />
      )}
    </ChartCard>
  );
}

function EmptyPlot() {
  return (
    <div className="flex h-[11.25rem] w-full items-center justify-center rounded-input bg-gray-50 md:h-[13.75rem] lg:h-[16.25rem]">
      <p className="text-small text-gray-500">
        No revenue recorded for this period yet
      </p>
    </div>
  );
}

function RevenuePlot({ series }: { series: ReportSeries }) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { plotted, ceiling } = useMemo(() => {
    // A period with no revenue would divide by zero; falling back to 1 keeps the
    // grid drawing with every point on the baseline.
    const max = Math.max(
      series.maxValue,
      ...series.points.map((point) => point.value),
      1,
    );

    const count = series.points.length;
    const step = count > 1 ? VIEW_W / (count - 1) : 0;

    return {
      ceiling: max,
      plotted: series.points.map((point, index) => ({
        ...point,
        // A single-point series centers; otherwise points span the full width.
        x: count > 1 ? index * step : VIEW_W / 2,
        y: VIEW_H - (point.value / max) * VIEW_H,
      })),
    };
  }, [series]);

  // The y captions, top tick first — the ceiling down to zero.
  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const fraction = (TICK_COUNT - 1 - index) / (TICK_COUNT - 1);
        return formatAxisValue(Math.round(ceiling * fraction), series);
      }),
    [ceiling, series],
  );

  const linePath = useMemo(
    () =>
      plotted
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
        .join(' '),
    [plotted],
  );

  const areaPath = useMemo(() => {
    const first = plotted.at(0);
    const last = plotted.at(-1);
    if (!first || !last) return '';
    return `M${first.x} ${VIEW_H} ${linePath.slice(1)} L${last.x} ${VIEW_H} Z`;
  }, [linePath, plotted]);

  const active = activeIndex === null ? null : (plotted.at(activeIndex) ?? null);

  return (
    <div className="w-full">
      {/*
       * The plot sits in a row beside the y captions so the two never overlap.
       */}
      <div className="flex w-full gap-3 md:gap-4">
        <div
          className="flex h-[11.25rem] shrink-0 flex-col justify-between text-right md:h-[13.75rem] lg:h-[16.25rem]"
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
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="h-[11.25rem] w-full md:h-[13.75rem] lg:h-[16.25rem]"
            role="img"
            aria-label={`Revenue over time — ${plotted.length} periods, peaking at ${formatSeriesValue(
              ceiling,
              series,
            )}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-primary)"
                  stopOpacity="0.18"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-primary)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            {/* Gridlines — one per y tick, matching the captions beside them. */}
            {Array.from({ length: TICK_COUNT }, (_, index) => {
              const y = (index / (TICK_COUNT - 1)) * VIEW_H;
              return (
                <line
                  key={index}
                  x1="0"
                  y1={y}
                  x2={VIEW_W}
                  y2={y}
                  stroke="var(--color-gray-200)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} />
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
           * The hovered point's marker. HTML rather than an SVG circle so the
           * non-uniform scaling cannot squash it into an ellipse.
           */}
          {active ? (
            <span
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary"
              style={{
                left: `${(active.x / VIEW_W) * 100}%`,
                top: `${(active.y / VIEW_H) * 100}%`,
              }}
            />
          ) : null}

          {/*
           * One hover/focus target per bucket, laid over the plot. Keyboard
           * users tab through them, which is how the figures are reachable
           * without a pointer — the design has no such affordance at all.
           */}
          <div className="absolute inset-0 flex">
            {plotted.map((point, index) => (
              <button
                key={index}
                type="button"
                className="h-full flex-1 cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              >
                <span className="sr-only">
                  {point.label}: {formatSeriesValue(point.value, series)}
                </span>
              </button>
            ))}
          </div>

          {active ? (
            <div
              role="status"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-input bg-text px-2.5 py-1.5 shadow-md-elevation"
              style={{
                left: `${(active.x / VIEW_W) * 100}%`,
                top: `calc(${(active.y / VIEW_H) * 100}% - 0.625rem)`,
              }}
            >
              <p className="whitespace-nowrap text-caption font-semibold leading-4 text-white">
                {formatSeriesValue(active.value, series)}
              </p>
              <p className="whitespace-nowrap text-[0.625rem] leading-3 text-gray-300">
                {active.label}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/*
       * The x-axis sits under the plot, inset by an invisible copy of the widest
       * y caption so the bucket labels line up with their points. A dense series
       * prints every other (or every third) caption rather than overlapping
       * them — the other thing the design's fixed twelve captions cannot survive.
       */}
      <div className="mt-3 flex w-full gap-3 md:gap-4">
        <div
          className="invisible shrink-0 text-right text-[0.625rem] font-medium md:text-small"
          aria-hidden="true"
        >
          {ticks[0]}
        </div>
        <div className="flex min-w-0 flex-1 justify-between">
          {plotted.map((point, index) => (
            <span
              key={index}
              className={`text-[0.625rem] font-medium leading-none text-gray-400 md:text-small md:leading-none ${
                shouldPrintAxisLabel(index, plotted.length) ? '' : 'invisible'
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
