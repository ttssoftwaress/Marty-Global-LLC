import { formatCount } from '../../lib/format';
import type { AuditCategoryOption } from '../../types/audit';

/*
 * The category tab strip — All activity / Authentication / Orders / …
 *
 * Labels and values come from the API; the strip renders whatever the backend
 * publishes, so a new audited category needs no change here.
 *
 * It scrolls horizontally rather than wrapping. There are ten categories, which
 * is more than any other tab strip in the admin portal, and wrapping them would
 * cost three rows of vertical space above a list that is already long. The
 * scrollbar is hidden but the strip still scrolls by touch, wheel, and keyboard.
 *
 * A count is rendered only when the backend sends one — it does not for these,
 * because a per-category count would be its own query over a very large table on
 * every page load. The tabs read fine without them, and the list's own total
 * gives the number once a category is picked.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type AuditCategoryTabsProps = {
  tabs: AuditCategoryOption[];
  value: string;
  onChange: (value: string) => void;
};

export function AuditCategoryTabs({
  tabs,
  value,
  onChange,
}: AuditCategoryTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter the audit log by category"
      className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:w-full md:px-0 [&::-webkit-scrollbar]:hidden"
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
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-body transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-10 ${
              isActive
                ? 'bg-primary font-medium text-white'
                : 'bg-gray-100 font-medium text-text-secondary hover:bg-gray-200 lg:text-gray-600'
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>

            {typeof tab.count === 'number' ? (
              <span
                className={`text-[0.6875rem] font-semibold leading-4 ${
                  isActive ? 'text-white/75' : 'text-gray-500'
                }`}
              >
                {formatCount(tab.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
