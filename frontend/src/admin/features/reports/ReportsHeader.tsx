import { Download } from 'lucide-react';

import { REPORT_PERIODS } from '../../types/reports';
import type { ReportPeriod } from '../../types/reports';

/*
 * The screen's header: the breadcrumb, the title block, the period pill strip,
 * and the export control.
 *
 * The three links lay this out differently and the component follows each. On
 * desktop the titles and the actions share one row, with the pills and the
 * export button side by side on the right. Tablet and mobile stack: titles
 * first, then the pills on their own scrolling row, then the export button —
 * full width on mobile, as its link shows.
 *
 * The pill strip is a real radiogroup rather than four styled divs, so the
 * period is keyboard-reachable and announced. The designs draw only the selected
 * state; the hover and focus styling here is added for that reason (Design.md —
 * fill in states the design didn't cover).
 *
 * Copy is the desktop link's throughout: tablet titles its pills "7 days / 30
 * days / 90 days / 12 months" and mobile abbreviates them, but desktop is the
 * source of truth for wording across viewports (Design.md).
 */

type ReportsHeaderProps = {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
  onExport: () => void;
  isExporting?: boolean;
};

export function ReportsHeader({
  period,
  onPeriodChange,
  onExport,
  isExporting = false,
}: ReportsHeaderProps) {
  return (
    <header className="flex w-full flex-col gap-4 lg:gap-6">
      <p className="text-caption font-medium uppercase tracking-[0.22px] text-gray-500">
        Dashboard / Reports &amp; analytics
      </p>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-9 text-[var(--color-gray-900)] md:text-[28px] md:leading-10 lg:text-[32px] lg:leading-[44px]">
            Reports &amp; analytics
          </h1>
          <p className="text-small text-gray-500 md:text-body">
            A complete view of business performance across services, regions, and
            time.
          </p>
        </div>

        {/*
         * Actions. From `lg` the pills sit inline beside the export button; below
         * that they take their own row, and the strip scrolls rather than
         * wrapping so the four options stay on one line at any width.
         */}
        <div className="flex w-full shrink-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
          <div
            role="radiogroup"
            aria-label="Report period"
            className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 md:pb-0 lg:overflow-visible"
          >
            {REPORT_PERIODS.map(({ value, label }) => {
              const isActive = value === period;

              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onPeriodChange(value)}
                  className={`shrink-0 whitespace-nowrap rounded-pill px-3 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-primary font-semibold text-white'
                      : 'border border-gray-200 bg-white font-medium text-[var(--color-text-secondary)] hover:border-gray-300 hover:text-text'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onExport}
            disabled={isExporting}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-gray-200 bg-white px-3.5 text-body font-semibold text-[var(--color-gray-900)] transition-colors hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            <Download className="size-[18px]" aria-hidden="true" />
            {isExporting ? 'Preparing…' : 'Export report'}
          </button>
        </div>
      </div>
    </header>
  );
}
