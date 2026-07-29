import { formatCount } from '../lib/format';

/*
 * The pill-strip filter tabs the admin lists share — segments on the customers
 * list, statuses on the team screen, categories on the audit trail.
 *
 * The strip scrolls horizontally rather than wrapping, so a narrow screen keeps
 * the tabs on one line and the row height stays predictable. The scrollbar is
 * hidden but the strip still scrolls by touch, wheel, and keyboard.
 *
 * Rendered as a real tablist so the tabs announce as one mutually exclusive
 * choice and the selected one is exposed to assistive tech — the part that was
 * being retyped per screen and is the easiest to get subtly wrong.
 *
 * A count is rendered only when the backend sends one; several of these strips
 * deliberately do not, because a per-tab count would be its own query.
 *
 * `className` and `tabClassName` carry the per-screen scale each design draws
 * (a fixed 2.25rem pill on the audit trail, a type scale that steps up across
 * breakpoints on the customers list). The colours are not a knob: one selected
 * pill should look the same on every screen.
 */

export type TabStripItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type TabStripProps<T extends string> = {
  tabs: TabStripItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
};

export function TabStrip<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = '',
  tabClassName = '',
  activeTabClassName = '',
}: TabStripProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden ${className}`}
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
            className={`flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tabClassName} ${
              isActive
                ? `bg-primary font-medium text-white ${activeTabClassName}`
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
