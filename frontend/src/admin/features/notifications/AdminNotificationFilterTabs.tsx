import type { AdminNotificationFilter } from '../../types/notifications';

/*
 * The filter pills across the top of the feed. The active pill is solid primary;
 * the rest are quiet. "Unread" carries a count pill when there's anything to
 * count. The row scrolls horizontally on mobile and wraps from tablet up.
 *
 * The tabs are the admin work queues — a staff member filters by the queue they
 * own, not by the customer-facing document types the portal's feed uses. The
 * last two are marked `mobileHidden` and dropped by CSS below `md` so the
 * narrow row doesn't overflow: one source of truth, no divergent label lists.
 */

type FilterTab = {
  value: AdminNotificationFilter;
  label: string;
  mobileHidden?: boolean;
};

const FILTER_TABS: FilterTab[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'orders', label: 'Orders' },
  { value: 'payments', label: 'Payments' },
  { value: 'support', label: 'Support', mobileHidden: true },
  { value: 'mailroom', label: 'Mail room', mobileHidden: true },
];

type AdminNotificationFilterTabsProps = {
  active: AdminNotificationFilter;
  unreadCount: number;
  onChange: (filter: AdminNotificationFilter) => void;
};

export function AdminNotificationFilterTabs({
  active,
  unreadCount,
  onChange,
}: AdminNotificationFilterTabsProps) {
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
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill px-4 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:text-[14px] ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 md:bg-transparent md:hover:bg-gray-100'
            } ${tab.mobileHidden ? 'hidden md:inline-flex' : ''}`}
          >
            {tab.label}
            {showCount ? (
              <span
                className={`inline-flex items-center rounded-pill px-1.5 py-0.5 text-[10px] font-semibold md:text-[12px] ${
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
