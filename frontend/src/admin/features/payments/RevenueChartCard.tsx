import { REVENUE_PERIODS } from '../../types/payments';
import type { RevenuePeriod, RevenueSeries } from '../../types/payments';
import { RevenueChart } from './RevenueChart';

/*
 * The chart's card — titles, the period switch, and the plot.
 *
 * The header is a row on desktop (titles left, pill right) and stacks on tablet
 * and mobile, matching the links. Mobile's pill stretches full width with its
 * three segments sharing it equally; from `md` it shrinks to its content.
 *
 * The pill is a real radiogroup rather than three styled divs, so the period is
 * keyboard-reachable and announced — the design draws only the selected state.
 */

type RevenueChartCardProps = {
  series: RevenueSeries | undefined;
  period: RevenuePeriod;
  onPeriodChange: (period: RevenuePeriod) => void;
  isLoading: boolean;
};

export function RevenueChartCard({
  series,
  period,
  onPeriodChange,
  isLoading,
}: RevenueChartCardProps) {
  return (
    <section className="flex w-full flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-5 md:p-5 lg:p-card">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-body-lg font-semibold text-text md:text-h6">
            Revenue over time
          </h2>
          <p className="text-caption leading-4 text-gray-500 md:text-small">
            Daily collected payments and billing volume
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Revenue period"
          className="flex w-full shrink-0 items-center gap-1 rounded-pill bg-gray-100 p-1 md:w-auto"
        >
          {REVENUE_PERIODS.map(({ value, label }) => {
            const isActive = value === period;

            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => onPeriodChange(value)}
                className={`flex flex-1 items-center justify-center whitespace-nowrap rounded-pill px-3 py-1.5 text-caption transition-colors md:flex-none md:text-small ${
                  isActive
                    ? 'bg-white font-semibold text-text shadow-sm-elevation'
                    : 'font-medium text-gray-600 hover:text-text'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading || !series ? (
        <div
          className="h-[9.375rem] w-full animate-pulse rounded-input bg-gray-100 md:h-[12.5rem] lg:h-[15rem]"
          aria-hidden="true"
        />
      ) : (
        <RevenueChart series={series} />
      )}
    </section>
  );
}
