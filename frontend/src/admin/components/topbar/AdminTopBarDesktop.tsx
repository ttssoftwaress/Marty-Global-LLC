import { AdminTopBarNotifications } from './AdminTopBarNotifications';
import { AdminTopBarSearchField } from './AdminTopBarSearch';
import { AdminTopBarUserMenu, type AdminTopBarUser } from './AdminTopBarUser';

/*
 * Admin top bar — desktop (lg and up). 72px white bar with a hairline bottom
 * border: the 400px global search field on the left, notifications + the account
 * menu on the right, 32px side padding. No logo — the desktop sidebar carries it.
 */

type AdminTopBarDesktopProps = {
  user: AdminTopBarUser;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu: () => void;
  accountMenuOpen?: boolean;
  className?: string;
};

export function AdminTopBarDesktop({
  user,
  notificationCount,
  onSearch,
  onOpenNotifications,
  onOpenUserMenu,
  accountMenuOpen,
  className,
}: AdminTopBarDesktopProps) {
  return (
    <header
      className={`flex h-navbar w-full items-center justify-between border-b border-gray-200 bg-white px-8 ${className ?? ''}`}
    >
      <AdminTopBarSearchField onSearch={onSearch} />

      <div className="flex shrink-0 items-center gap-5">
        <AdminTopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
        />

        <AdminTopBarUserMenu
          user={user}
          onOpenUserMenu={onOpenUserMenu}
          accountMenuOpen={accountMenuOpen}
        />
      </div>
    </header>
  );
}
