import type { MailRoomTab } from '../../types/mailroom';

/*
 * The room's view switch — Inbox / Requests / History. Rendered from tablet up
 * (the mobile link surfaces these through the filter sheet instead). One
 * element, two looks by breakpoint, matching the links:
 *   - tablet (md):  full-width segmented control on a gray-200 track; the active
 *                   tab is a white card with navy text
 *   - desktop (lg): a compact left-aligned control on a gray-100 track; the
 *                   active tab is a solid navy pill
 */

const TABS: { id: MailRoomTab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'requests', label: 'Requests' },
  { id: 'history', label: 'History' },
];

type InboxViewTabsProps = {
  active: MailRoomTab;
  onChange: (tab: MailRoomTab) => void;
  className?: string;
};

export function InboxViewTabs({ active, onChange, className }: InboxViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Mail room view"
      className={`hidden w-full gap-1 rounded-input bg-gray-200 p-1 md:flex lg:w-auto lg:rounded-[12px] lg:bg-gray-100 ${className ?? ''}`}
    >
      {TABS.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={`flex-1 rounded-[8px] py-2 text-center text-body transition-colors lg:flex-none lg:rounded-[10px] lg:px-4 ${
              isActive
                ? 'bg-white font-semibold text-primary shadow-sm-elevation lg:bg-primary lg:text-white lg:shadow-none'
                : 'font-medium text-gray-500 hover:text-text lg:text-gray-700'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
