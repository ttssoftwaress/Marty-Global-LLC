import type { DashboardPeriod } from '../../types/dashboard';

/*
 * The period switch — a segmented pill scoping the whole screen to today, this
 * week, or this month. Desktop and tablet size it to its labels; mobile spreads
 * the three options across the full width so each is an easy tap target.
 *
 * Rendered as radios in a group rather than buttons: the three are one mutually
 * exclusive choice, so arrow keys move between them and the selection is
 * announced. The visible pill is the label; the input itself is visually hidden.
 */

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

type PeriodFilterProps = {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
};

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard period"
      className="flex w-full gap-1 rounded-pill bg-gray-100 p-1 md:w-auto"
    >
      {PERIODS.map((period) => {
        const active = period.value === value;

        return (
          <label
            key={period.value}
            className={`flex flex-1 cursor-pointer items-center justify-center rounded-pill px-4 py-1.5 text-[0.75rem] leading-5 transition-colors md:flex-none md:py-2 md:text-[0.875rem] ${
              active
                ? 'bg-primary font-semibold text-white'
                : 'font-medium text-gray-600 hover:text-text md:text-gray-500'
            } focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary`}
          >
            <input
              type="radio"
              name="dashboard-period"
              value={period.value}
              checked={active}
              onChange={() => onChange(period.value)}
              className="sr-only"
            />
            <span className="whitespace-nowrap">{period.label}</span>
          </label>
        );
      })}
    </div>
  );
}
