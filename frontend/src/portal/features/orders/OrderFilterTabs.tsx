import type { OrderFilter, OrderFilterCounts } from '../../types/orders';

/*
 * Filter tabs — one pill per filter with a count badge. Shared by all three
 * viewports; the active pill is navy with a translucent-white badge, the rest
 * are neutral with a white/gray badge.
 *
 * Desktop uses the design's Gray-100 fill for the inactive pills; tablet and
 * mobile use a bordered white pill. The row scrolls horizontally below `lg` so
 * "Needs attention" never wraps or clips on a narrow screen.
 */

const FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All orders' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'attention', label: 'Needs attention' },
];

type OrderFilterTabsProps = {
  active: OrderFilter;
  counts: OrderFilterCounts;
  onChange: (filter: OrderFilter) => void;
};

export function OrderFilterTabs({ active, counts, onChange }: OrderFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter orders"
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {FILTERS.map(({ id, label }) => {
        const isActive = id === active;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`flex shrink-0 items-center gap-2 rounded-pill px-4 py-2 text-body font-medium transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 md:border-transparent md:bg-gray-100'
            }`}
          >
            {label}
            <span
              className={`inline-flex items-center rounded-pill px-2 py-0.5 text-small font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
              }`}
            >
              {counts[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
