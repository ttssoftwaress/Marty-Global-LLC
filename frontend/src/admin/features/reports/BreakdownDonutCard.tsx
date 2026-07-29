import { useMemo, useState } from 'react';

import { ChartCard } from './ChartCard';
import { donutSegmentPath, seriesColor } from '../../lib/reports';
import { formatCount } from '../../lib/format';
import type { ReportBreakdown } from '../../types/reports';

/*
 * A donut breakdown card — "Orders by service" and "Orders by region" are the
 * same component against a different dimension.
 *
 * All three links draw this identically: a 160px ring with the total in the
 * hole, and a legend beneath listing each slice with its count and share. Only
 * the card's width changes across breakpoints — desktop pairs the two cards in a
 * row, tablet and mobile stack them.
 *
 * The ring is drawn from the slices the backend returns rather than the four
 * fixed arcs the design exports, so a fifth service or a dimension with two
 * entries both render correctly. Slice hues come from the shared categorical
 * palette, and the legend swatch reads the same index — one list, so a slice and
 * its label can never disagree about color.
 *
 * Hovering a slice or its legend row highlights both. The design has no hover
 * state at all; this was added so a thin slice is identifiable at a glance
 * (Design.md — fill in states the design didn't cover).
 */

// The donut's coordinate space. 160×160 with a 28-unit ring, which is the
// proportion every link draws.
const SIZE = 160;
const OUTER_R = 80;
const INNER_R = 52;

type BreakdownDonutCardProps = {
  title: string;
  description: string;
  breakdown: ReportBreakdown | undefined;
  isLoading: boolean;
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
};

export function BreakdownDonutCard({
  title,
  description,
  breakdown,
  isLoading,
  isError,
  isRetrying,
  onRetry,
}: BreakdownDonutCardProps) {
  return (
    <ChartCard
      title={title}
      description={description}
      isLoading={isLoading}
      isError={isError}
      isRetrying={isRetrying}
      onRetry={onRetry}
      skeletonClassName="h-[18.75rem]"
    >
      {breakdown && breakdown.slices.length > 0 ? (
        <Donut breakdown={breakdown} />
      ) : (
        <div className="flex h-[16.25rem] w-full items-center justify-center rounded-input bg-gray-50">
          <p className="text-small text-gray-500">
            No orders recorded for this period yet
          </p>
        </div>
      )}
    </ChartCard>
  );
}

function Donut({ breakdown }: { breakdown: ReportBreakdown }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  /*
   * Arcs are laid out against the summed percentages rather than each slice's
   * own share, so rounding in the backend's figures cannot leave a wedge of
   * blank ring at the end. A breakdown whose shares do not total 100 still
   * closes the circle.
   */
  const arcs = useMemo(() => {
    const total =
      breakdown.slices.reduce((sum, slice) => sum + slice.percentage, 0) || 1;

    let cursor = 0;
    return breakdown.slices.map((slice, index) => {
      const sweep = (slice.percentage / total) * 360;
      const arc = {
        slice,
        color: seriesColor(index),
        d: donutSegmentPath(
          cursor,
          cursor + sweep,
          OUTER_R,
          INNER_R,
          SIZE / 2,
          SIZE / 2,
        ),
      };
      cursor += sweep;
      return arc;
    });
  }, [breakdown.slices]);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="relative mx-auto py-3">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="size-[10rem]"
          role="img"
          aria-label={`${breakdown.totalLabel}: ${formatCount(breakdown.total)} total across ${breakdown.slices.length} categories`}
        >
          {arcs.map(({ slice, color, d }) => (
            <path
              key={slice.id}
              d={d}
              fill={color}
              className="transition-opacity"
              opacity={activeId === null || activeId === slice.id ? 1 : 0.35}
              onMouseEnter={() => setActiveId(slice.id)}
              onMouseLeave={() => setActiveId(null)}
            />
          ))}
        </svg>

        {/* The figure in the hole. HTML so it keeps its real type size. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <p className="text-[1.375rem] font-bold leading-7 text-[var(--color-gray-900)]">
            {formatCount(breakdown.total)} total
          </p>
          <p className="text-caption font-semibold uppercase leading-none text-gray-400">
            {breakdown.totalLabel}
          </p>
        </div>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {arcs.map(({ slice, color }) => (
          <li
            key={slice.id}
            className={`flex items-center justify-between gap-3 rounded-sm transition-opacity ${
              activeId === null || activeId === slice.id
                ? 'opacity-100'
                : 'opacity-50'
            }`}
            onMouseEnter={() => setActiveId(slice.id)}
            onMouseLeave={() => setActiveId(null)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[0.125rem]"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="truncate text-body leading-6 text-[var(--color-text-secondary)]">
                {slice.label}
              </span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-body font-semibold leading-6 text-[var(--color-gray-900)]">
              {formatCount(slice.count)} ({slice.percentage}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
