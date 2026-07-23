import { Link } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { TopBarNotifications } from './TopBarNotifications';
import { TopBarUserMenu, type TopBarUser } from './TopBarUser';

/*
 * Portal top bar — tablet (md up to lg). Same 72px bar as desktop, but the
 * title is replaced by the colour logo: the tablet sidebar collapses to an icon
 * rail that drops its logo, so the top bar carries the brand mark instead.
 */

type TopBarTabletProps = {
  user: TopBarUser;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  className?: string;
};

export function TopBarTablet({
  user,
  notificationCount,
  onOpenNotifications,
  onOpenUserMenu,
  className,
}: TopBarTabletProps) {
  return (
    <header
      className={`flex h-navbar w-full items-center justify-between border-b border-gray-200 bg-white px-6 ${className ?? ''}`}
    >
      <Link to="/app" aria-label="Marty Global LLC — Dashboard" className="shrink-0">
        <img
          src={logoColor}
          alt="Marty Global LLC"
          className="h-[37px] w-[105px] object-contain"
        />
      </Link>

      <div className="flex shrink-0 items-center gap-4">
        <TopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
        />

        <span aria-hidden="true" className="h-6 w-px shrink-0 bg-gray-200" />

        <TopBarUserMenu
          user={user}
          onOpenUserMenu={onOpenUserMenu}
          chevronSize={20}
        />
      </div>
    </header>
  );
}
