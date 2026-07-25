import { SUPPORT_FILTERS, type SupportFilter } from '../../types/support';

/*
 * The filter strip above the conversation list — one pill per cohort.
 *
 * The links differ in scale and in the active pill's treatment: mobile fills it
 * navy with white text, while tablet and desktop use the soft brand tint with
 * navy text. Both are reproduced.
 *
 * The desktop link shows four tabs and the tablet link three; desktop is the
 * source of truth for content (Design.md), so Resolved is present at every width
 * and the strip scrolls horizontally rather than wrapping — which keeps the row
 * height predictable in a 300px pane. The scrollbar is hidden but the strip
 * still scrolls by touch, wheel, and keyboard.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech.
 */

type SupportFilterTabsProps = {
  value: SupportFilter;
  onChange: (value: SupportFilter) => void;
};

export function SupportFilterTabs({ value, onChange }: SupportFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter conversations"
      className="flex w-full shrink-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] md:gap-1 lg:gap-2 [&::-webkit-scrollbar]:hidden"
    >
      {SUPPORT_FILTERS.map((filter) => {
        const isActive = filter.value === value;

        return (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.value)}
            className={`shrink-0 whitespace-nowrap rounded-pill px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:px-2.5 md:py-1.5 md:text-small lg:px-3.5 lg:py-2 ${
              isActive
                ? 'bg-primary text-white md:bg-primary-light md:text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 md:text-gray-500'
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
