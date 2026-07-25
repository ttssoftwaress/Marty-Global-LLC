import { formatCount } from '../../lib/format';
import type { CustomerSegment, CustomerSegmentTab } from '../../types/customers';

/*
 * The segment tab strip — one pill per cohort. The shape is the same at every
 * width; only the scale changes (14px labels on desktop, 13px on tablet, 12px on
 * mobile, matching the links).
 *
 * The strip scrolls horizontally rather than wrapping, so a narrow screen keeps
 * the tabs on one line and the row height stays predictable. The scrollbar is
 * hidden but the strip still scrolls by touch, wheel, and keyboard — which is
 * what the mobile link's clipped fourth pill implies.
 *
 * Labels come from the API. A count is rendered only when the backend sends one:
 * the links print bare labels here, unlike the orders queue's counted tabs.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type CustomerSegmentTabsProps = {
  tabs: CustomerSegmentTab[];
  value: CustomerSegment;
  onChange: (value: CustomerSegment) => void;
};

export function CustomerSegmentTabs({
  tabs,
  value,
  onChange,
}: CustomerSegmentTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter customers by segment"
      className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:w-full md:gap-1.5 md:px-0 lg:gap-2 [&::-webkit-scrollbar]:hidden"
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
            className={`flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-small transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:px-3.5 md:text-[13px] lg:px-4 lg:text-body ${
              isActive
                ? 'bg-primary font-medium text-white md:font-semibold'
                : 'bg-gray-100 font-medium text-text-secondary hover:bg-gray-200 lg:text-gray-600'
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>

            {typeof tab.count === 'number' ? (
              <span
                className={`text-[11px] font-semibold leading-4 ${
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
