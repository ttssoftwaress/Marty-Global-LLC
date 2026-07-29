import { formatCount } from '../../lib/format';
import type { TeamStatusFilter, TeamStatusTab } from '../../types/team';

/*
 * The status tab strip — All / Active / Deactivated.
 *
 * The shape is the same at every width; only the pill height changes (2.5rem on
 * desktop, 36px from tablet down, matching the links).
 *
 * The strip scrolls horizontally rather than wrapping, so a narrow screen keeps
 * the tabs on one line and the row height stays predictable — which is what the
 * mobile link's four pills running to the edge imply. The scrollbar is hidden
 * but the strip still scrolls by touch, wheel, and keyboard.
 *
 * Labels come from the API. A count is rendered only when the backend sends one:
 * the links print bare labels here.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type TeamStatusTabsProps = {
  tabs: TeamStatusTab[];
  value: TeamStatusFilter;
  onChange: (value: TeamStatusFilter) => void;
};

export function TeamStatusTabs({ tabs, value, onChange }: TeamStatusTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter team members by status"
      className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:w-auto md:px-0 [&::-webkit-scrollbar]:hidden"
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
