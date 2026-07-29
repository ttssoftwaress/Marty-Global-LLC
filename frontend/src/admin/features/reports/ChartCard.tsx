import type { ReactNode } from 'react';

import { DataErrorState } from '../../components/DataErrorState';

/*
 * The frame every chart on this screen sits in: the white card, its title and
 * description, an optional legend on the right, and the plot beneath.
 *
 * All five cards on the page share this shell in all three links — same padding,
 * radius, border, and header rhythm — so it lives in one place rather than being
 * restated per card. The loading state lives here too, which is what keeps the
 * card's height from collapsing to a skeleton of a different shape.
 *
 * So does the failure state, for a sharper reason: every card on this screen has
 * an empty state reading "No … recorded for this period yet", and a card that
 * fell through to it on a failed fetch would report a quiet quarter rather than a
 * broken request. Each card fails on its own, so one dead series doesn't take the
 * other four charts with it.
 *
 * The header is a row on desktop (titles left, legend right) and stacks below
 * `lg`, matching the links: tablet and mobile put the legend under the
 * description where there is no room beside it.
 */

export type ChartLegendItem = {
  label: string;
  color: string;
};

type ChartCardProps = {
  title: string;
  description: string;
  legend?: ChartLegendItem[];
  isLoading?: boolean;
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  /** What did not load, in plain words — "Revenue over time didn't load". */
  errorTitle?: string;
  /** Sizes the loading block so the card does not jump when the plot lands. */
  skeletonClassName?: string;
  children: ReactNode;
};

export function ChartCard({
  title,
  description,
  legend,
  isLoading = false,
  isError = false,
  isRetrying = false,
  onRetry,
  errorTitle,
  skeletonClassName = 'h-[13.75rem]',
  children,
}: ChartCardProps) {
  return (
    <section className="flex w-full min-w-0 flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-5 md:p-5 lg:p-card">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-body-lg font-semibold leading-[1.4] text-[var(--color-gray-900)]">
            {title}
          </h2>
          <p className="text-[0.8125rem] font-medium leading-5 text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>

        {legend && legend.length > 0 ? (
          <ul className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            {legend.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span className="text-[0.8125rem] font-medium leading-5 text-[var(--color-text-secondary)]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isLoading ? (
        <div
          className={`w-full animate-pulse rounded-input bg-gray-100 ${skeletonClassName}`}
          aria-hidden="true"
        />
      ) : isError && onRetry ? (
        <DataErrorState
          bare
          title={errorTitle ?? `Couldn't load ${title.toLowerCase()}`}
          description="This chart didn't load, so it isn't showing a quiet period — it's showing a failed request. Try again in a moment."
          onRetry={onRetry}
          isRetrying={isRetrying}
          className="justify-center rounded-input bg-gray-50"
        />
      ) : (
        children
      )}
    </section>
  );
}
