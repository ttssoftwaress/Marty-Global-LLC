import { AdminTopBarNotifications } from './AdminTopBarNotifications';
import { AdminTopBarSearchButton } from './AdminTopBarSearch';
import { AdminTopBarUserMenu, type AdminTopBarUser } from './AdminTopBarUser';

/*
 * Admin top bar — tablet (md up to lg). Same 72px bar as desktop with 24px side
 * padding, but the search field collapses to a 40px icon button: the tablet
 * sidebar is an icon rail, so the bar keeps its controls compact and the full
 * field would crowd the width.
 */

type AdminTopBarTabletProps = {
  user: AdminTopBarUser;
  notificationCount?: number;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu: () => void;
  accountMenuOpen?: boolean;
  className?: string;
};

export function AdminTopBarTablet({
  user,
  notificationCount,
  onOpenSearch,
  onOpenNotifications,
  onOpenUserMenu,
  accountMenuOpen,
  className,
}: AdminTopBarTabletProps) {
  return (
    <header
      className={`flex h-navbar w-full items-center justify-between border-b border-gray-200 bg-white px-6 ${className ?? ''}`}
    >
      <AdminTopBarSearchButton onOpenSearch={onOpenSearch} variant="framed" />

      <div className="flex shrink-0 items-center gap-4">
        <AdminTopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
        />

        <AdminTopBarUserMenu
          user={user}
          onOpenUserMenu={onOpenUserMenu}
          accountMenuOpen={accountMenuOpen}
          compact
        />
      </div>
    </header>
  );
}
