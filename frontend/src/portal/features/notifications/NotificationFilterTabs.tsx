import type { NotificationFilter } from '../../types/notifications';

/*
 * The filter pills across the top of the feed. The active pill is solid primary;
 * the rest are quiet. "Unread" carries a count pill when there's anything to
 * count. The row scrolls horizontally on mobile (the design clips the last tab,
 * so a swipe reveals it) and wraps naturally from tablet up.
 *
 * Which tabs show is breakpoint-dependent in the design: mobile shows the first
 * four, tablet and desktop show all six. Rather than render different lists, we
 * mark the last two `mobileHidden` and let CSS drop them below `md` — one source
 * of truth, no divergence in the labels.
 */

type FilterTab = {
  value: NotificationFilter;
  label: string;
  mobileHidden?: boolean;
};

const FILTER_TABS: FilterTab[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'status', label: 'Status updates' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'documents', label: 'Documents', mobileHidden: true },
  { value: 'messages', label: 'Messages', mobileHidden: true },
];

type NotificationFilterTabsProps = {
  active: NotificationFilter;
  unreadCount: number;
  onChange: (filter: NotificationFilter) => void;
};

export function NotificationFilterTabs({
  active,
  unreadCount,
  onChange,
}: NotificationFilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter notifications"
      className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      {FILTER_TABS.map((tab) => {
        const isActive = tab.value === active;
        const showCount = tab.value === 'unread' && unreadCount > 0;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-4 text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:text-[0.875rem] ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 md:bg-transparent md:hover:bg-gray-100'
            } ${tab.mobileHidden ? 'hidden md:inline-flex' : ''}`}
          >
            {tab.label}
            {showCount ? (
              <span
                className={`inline-flex items-center rounded-pill px-1.5 py-0.5 text-[0.625rem] font-semibold md:text-[0.75rem] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-primary-light text-primary'
                }`}
              >
                {unreadCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
