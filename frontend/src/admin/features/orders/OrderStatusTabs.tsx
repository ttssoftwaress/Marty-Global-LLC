import { formatCount } from '../../lib/format';
import type { OrderStatusFilter, OrderStatusTab } from '../../types/orders';

/*
 * The status tab strip — one pill per status, each carrying its own count. The
 * shape is the same at every width; only the scale changes (0.875rem labels with a
 * badge pill on desktop and tablet, 12px with a bare count on mobile, matching
 * the links).
 *
 * The strip scrolls horizontally rather than wrapping, so a narrow screen keeps
 * the tabs on one line and the row height stays predictable. The scrollbar is
 * hidden but the strip still scrolls by touch, wheel, and keyboard.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type OrderStatusTabsProps = {
  tabs: OrderStatusTab[];
  value: OrderStatusFilter;
  onChange: (value: OrderStatusFilter) => void;
};

export function OrderStatusTabs({ tabs, value, onChange }: OrderStatusTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter orders by status"
      className="-mx-4 flex w-[calc(100%+2rem)] shrink-0 items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:w-full md:px-0 [&::-webkit-scrollbar]:hidden"
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
            className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-2 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:gap-2 md:px-4 md:text-body ${
              isActive
                ? 'bg-primary font-semibold text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 md:bg-gray-100'
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>

            {/*
             * Desktop and tablet set the count in its own badge pill; mobile
             * prints it bare beside the label. One element covers both — the
             * badge's padding and background only switch on at `md`.
             */}
            <span
              className={`rounded-pill text-[0.6875rem] font-semibold leading-4 md:px-1.5 md:py-0.5 md:text-small ${
                isActive
                  ? 'text-white/80 md:bg-white/15 md:text-white'
                  : 'text-gray-500 md:bg-gray-200 md:text-gray-600'
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
