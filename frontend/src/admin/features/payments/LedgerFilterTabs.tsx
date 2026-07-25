import { formatCount } from '../../lib/format';
import type { PaymentStatusFilter, PaymentStatusTab } from '../../types/payments';

/*
 * The ledger's filter pills. All three links draw the same strip; mobile and
 * tablet let it scroll sideways rather than wrap, which is what keeps the row
 * one line at 375px.
 *
 * Counts come from the summary, so a tab's figure is the backend's count for
 * that status and not a tally of the rows currently loaded. A tab whose count
 * the backend omits simply renders its label.
 *
 * Copy is the desktop link's (Design.md): the pending tab reads "Pending
 * payment" at every width rather than mobile's shortened "Pending", and the
 * "Refunded" tab that tablet drops is kept — the tab set should not change with
 * the viewport.
 */

type LedgerFilterTabsProps = {
  tabs: PaymentStatusTab[];
  value: PaymentStatusFilter;
  onChange: (value: PaymentStatusFilter) => void;
};

export function LedgerFilterTabs({ tabs, value, onChange }: LedgerFilterTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Filter billing ledger by payment status"
      className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-full md:flex-wrap md:overflow-visible md:px-0 md:pb-0 lg:justify-end [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-small transition-colors md:px-4 md:py-2 lg:text-body ${
              isActive
                ? 'bg-primary font-semibold text-white'
                : 'border border-gray-300 bg-white font-medium text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            <span
              className={`text-caption font-semibold ${
                isActive ? 'text-white/70' : 'text-gray-400'
              }`}
            >
              {formatCount(tab.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
