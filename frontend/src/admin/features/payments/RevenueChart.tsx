import { useId, useMemo, useState } from 'react';

import { formatMoney, formatMoneyCompact } from '../../lib/format';
import type { RevenuePoint, RevenueSeries } from '../../types/payments';

/*
 * "Revenue over time" — a real chart drawn from the series the backend returns,
 * not the flat picture the Figma links use.
 *
 * The three links draw the chart three different ways (desktop and tablet a bar
 * chart, mobile a line-and-area chart), and all three are static images with
 * hardcoded bar heights. This is one component that renders the actual data at
 * every width: bars from `md` up, a line + area fill below it, so each viewport
 * keeps the shape its own link shows while the values come from the API.
 *
 * Why hand-drawn SVG rather than a chart library: AGENTS.md's stack table is the
 * budget and no charting library is in it, so adding one needs a decision that
 * is not mine to make. The geometry a bar/line chart needs is a handful of
 * ratios, which is cheaper than the dependency. Note this is data visualization,
 * not iconography — the "never hand-draw SVGs" rule in Design.md is about icons,
 * which still come from lucide-react.
 *
 * Everything scales off a fixed viewBox with `preserveAspectRatio="none"` on the
 * plot, so the chart fills whatever width the card gives it without a resize
 * observer. The axis labels live in HTML beside the SVG rather than inside it,
 * so they stay at their real type size instead of being stretched by that same
 * scaling.
 *
 * The y-axis ceiling comes down with the series (`maxValue`) so the ticks hold
 * still across a period switch instead of re-scaling to whatever the current
 * bucket's tallest bar happens to be.
 */

// The plot's internal coordinate space. Only ratios matter — the rendered size
// comes from the card, and `preserveAspectRatio="none"` stretches x to fit.
const VIEW_W = 1000;
const VIEW_H = 200;
const TICK_COUNT = 5; // $0 → max in four steps, as every link shows

type RevenueChartProps = {
  series: RevenueSeries;
};

type Plotted = RevenuePoint & {
  /** 0 at the axis, 1 at the ceiling. */
  ratio: number;
  /** Bar/point center, in viewBox units. */
  x: number;
  y: number;
};

export function RevenueChart({ series }: RevenueChartProps) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { points, ceiling, currency } = useMemo(() => {
    const currencyCode =
      series.maxValue.currency ?? series.points[0]?.collected.currency ?? 'USD';

    // A period with no revenue would divide by zero; fall back to a flat axis so
    // the grid still draws and every bar sits on the baseline.
    const max = Math.max(
      series.maxValue.amount,
      ...series.points.map((point) => point.collected.amount),
      1,
    );

    const count = series.points.length;
    const step = count > 1 ? VIEW_W / (count - 1) : 0;

    const plotted: Plotted[] = series.points.map((point, index) => {
      const ratio = point.collected.amount / max;
      return {
        ...point,
        ratio,
        // A single-point series centers; otherwise points span the full width.
        x: count > 1 ? index * step : VIEW_W / 2,
        y: VIEW_H - ratio * VIEW_H,
      };
    });

    return { points: plotted, ceiling: max, currency: currencyCode };
  }, [series]);

  // The y-axis captions, top tick first — the ceiling down to zero.
  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, index) => {
        const fraction = (TICK_COUNT - 1 - index) / (TICK_COUNT - 1);
        return formatMoneyCompact({
          amount: Math.round(ceiling * fraction),
          currency,
        });
      }),
    [ceiling, currency],
  );

  /*
   * Mobile's link draws a line with a filled area beneath it. Both paths are
   * built from the same plotted points, so the two presentations can never
   * disagree about the data.
   */
  const linePath = useMemo(
    () =>
      points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
        .join(' '),
    [points],
  );

  const areaPath = useMemo(() => {
    const first = points.at(0);
    const last = points.at(-1);
    if (!first || !last) return '';
    return `M${first.x} ${VIEW_H} ${linePath.slice(1)} L${last.x} ${VIEW_H} Z`;
  }, [linePath, points]);

  // Bars keep a constant gap ratio, so a 7-bucket week and a 30-bucket month
  // both read as bars rather than one turning into hairlines.
  const barWidth =
    points.length > 0 ? Math.min(28, (VIEW_W / points.length) * 0.45) : 0;

  const active = activeIndex === null ? null : (points.at(activeIndex) ?? null);

  if (points.length === 0) {
    return (
      <div className="flex h-[9.375rem] w-full items-center justify-center rounded-input bg-gray-50 md:h-[12.5rem] lg:h-[16.25rem]">
        <p className="text-small text-gray-500">
          No revenue recorded for this period yet
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/*
       * The plot sits in a row beside the y-axis captions so the two never
       * overlap — the design's absolute-positioned labels sit on top of the
       * gridlines, which is what makes the "$10,000" tick collide with the plot
       * area there.
       */}
      <div className="flex w-full gap-2 md:gap-3">
        <div
          className="flex h-[7.5rem] shrink-0 flex-col justify-between text-right md:h-[10rem] lg:h-[12.5rem]"
          aria-hidden="true"
        >
          {ticks.map((tick, index) => (
            <span
              key={index}
              className="text-[0.5625rem] leading-none text-gray-400 md:text-[0.625rem] lg:text-caption lg:leading-none"
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="h-[7.5rem] w-full md:h-[10rem] lg:h-[12.5rem]"
            role="img"
            aria-label={`Revenue over time — ${points.length} periods, peaking at ${formatMoney(
              { amount: ceiling, currency },
            )}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
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

            {/* Mobile — the line-and-area shape its link shows. */}
            <g className="md:hidden">
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>

            {/* Tablet & desktop — the bars their links show. */}
            <g className="hidden md:block">
              {points.map((point, index) => {
                const height = Math.max(point.ratio * VIEW_H, point.ratio > 0 ? 2 : 0);
                return (
                  <rect
                    key={index}
                    x={point.x - barWidth / 2}
                    y={VIEW_H - height}
                    width={barWidth}
                    height={height}
                    rx="3"
                    className={`transition-opacity ${
                      activeIndex === null || activeIndex === index
                        ? 'opacity-100'
                        : 'opacity-40'
                    }`}
                    fill="var(--color-primary)"
                  />
                );
              })}
            </g>
          </svg>

          {/*
           * Mobile draws a dot per point on top of the line, as its link does.
           * These are HTML rather than SVG circles so the non-uniform scaling
           * cannot squash them into ellipses.
           */}
          <div className="pointer-events-none absolute inset-0 md:hidden">
            {points.map((point, index) => (
              <span
                key={index}
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                style={{
                  left: `${(point.x / VIEW_W) * 100}%`,
                  top: `${(point.y / VIEW_H) * 100}%`,
                }}
              />
            ))}
          </div>

          {/*
           * One hover/focus target per bucket, laid over the plot. Keyboard
           * users tab through them, which is how the figures are reachable
           * without a pointer — the design has no such affordance at all.
           */}
          <div className="absolute inset-0 flex">
            {points.map((point, index) => (
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
                  {point.label}: {formatMoney(point.collected)}
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
                top: `calc(${(active.y / VIEW_H) * 100}% - 0.5rem)`,
              }}
            >
              <p className="whitespace-nowrap text-caption font-semibold leading-4 text-white">
                {formatMoney(active.collected)}
              </p>
              <p className="whitespace-nowrap text-[0.625rem] leading-3 text-gray-300">
                {active.label}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/*
       * The x-axis sits under the plot and is inset by the y-axis column so the
       * captions line up with their buckets. A dense series prints every other
       * (or every third) label rather than overlapping them, which is the other
       * thing the design's fixed six captions cannot survive.
       */}
      <div className="mt-2 flex w-full gap-2 md:gap-3">
        <div
          className="invisible shrink-0 text-right text-[0.5625rem] md:text-[0.625rem] lg:text-caption"
          aria-hidden="true"
        >
          {ticks[0]}
        </div>
        <div className="flex min-w-0 flex-1 justify-between">
          {points.map((point, index) => (
            <span
              key={index}
              className={`text-[0.5625rem] leading-none text-gray-500 md:text-[0.625rem] lg:text-caption lg:leading-none ${
                shouldPrintLabel(index, points.length) ? '' : 'invisible'
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

/*
 * Thins the x-axis captions so a 30-bucket month does not print 30 overlapping
 * dates: keep roughly six, always including the first and the last.
 */
function shouldPrintLabel(index: number, total: number) {
  if (total <= 7) return true;
  const stride = Math.ceil(total / 6);
  return index === 0 || index === total - 1 || index % stride === 0;
}
