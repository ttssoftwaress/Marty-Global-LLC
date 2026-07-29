import { TopBarNotifications } from './TopBarNotifications';
import { TopBarUserMenu, type TopBarUser } from './TopBarUser';

/*
 * Portal top bar — desktop (lg and up). 72px tall white bar with a hairline
 * bottom border: the portal title on the left, notifications + a vertical rule
 * + the user menu on the right. No logo here — the desktop sidebar carries it.
 */

type TopBarDesktopProps = {
  user: TopBarUser;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  className?: string;
};

export function TopBarDesktop({
  user,
  notificationCount,
  onOpenNotifications,
  onOpenUserMenu,
  className,
}: TopBarDesktopProps) {
  return (
    <header
      className={`flex h-navbar w-full items-center justify-between border-b border-gray-200 bg-white px-8 ${className ?? ''}`}
    >
      <p className="min-w-0 truncate text-body font-medium text-gray-600">
        Marty Global LLC — Client Portal
      </p>

      <div className="flex shrink-0 items-center gap-5">
        <TopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
        />

        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-gray-200" />

        <TopBarUserMenu
          user={user}
          onOpenUserMenu={onOpenUserMenu}
          chevronSize={16}
        />
      </div>
    </header>
  );
}
