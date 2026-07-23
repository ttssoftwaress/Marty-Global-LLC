import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { TopBarNotifications } from './TopBarNotifications';
import { TopBarAvatar, type TopBarUser } from './TopBarUser';

/*
 * Portal top bar — mobile (below md). 56px bar: hamburger + logo on the left,
 * notifications + avatar on the right. The hamburger opens the sidebar drawer;
 * there is no chevron because the avatar itself is the account control at this
 * width.
 */

type TopBarMobileProps = {
  user: TopBarUser;
  notificationCount?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  className?: string;
};

export function TopBarMobile({
  user,
  notificationCount,
  onOpenMenu,
  onOpenNotifications,
  onOpenUserMenu,
  className,
}: TopBarMobileProps) {
  return (
    <header
      className={`flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white px-4 ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="flex size-6 shrink-0 items-center justify-center rounded-pill text-gray-700 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <Link to="/app" aria-label="Marty Global LLC — Dashboard" className="shrink-0">
          <img
            src={logoColor}
            alt="Marty Global LLC"
            className="h-[37px] w-[105px] object-contain"
          />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <TopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
          compact
        />

        <button
          type="button"
          onClick={onOpenUserMenu}
          aria-haspopup="menu"
          aria-label={`Account menu — ${user.name}`}
          className="flex shrink-0 rounded-pill transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <TopBarAvatar user={user} />
        </button>
      </div>
    </header>
  );
}
