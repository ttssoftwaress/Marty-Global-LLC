import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import logoColor from '@/assets/Marty-Logo-Color.PNG';
import { AdminTopBarNotifications } from './AdminTopBarNotifications';
import { AdminTopBarSearchButton } from './AdminTopBarSearch';
import { AdminTopBarAvatar, type AdminTopBarUser } from './AdminTopBarUser';

/*
 * Admin top bar — mobile (below md). 56px bar with 16px side padding: hamburger +
 * colour logo on the left, search + notifications + avatar on the right. The
 * hamburger opens the sidebar drawer, and there is no chevron because the avatar
 * itself is the account control at this width.
 *
 * Figma draws this frame with a border on all four sides; that is a frame
 * artifact, so it keeps the hairline bottom border the other two breakpoints use.
 */

type AdminTopBarMobileProps = {
  user: AdminTopBarUser;
  notificationCount?: number;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  className?: string;
};

export function AdminTopBarMobile({
  user,
  notificationCount,
  onOpenMenu,
  onOpenSearch,
  onOpenNotifications,
  onOpenUserMenu,
  className,
}: AdminTopBarMobileProps) {
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

        <Link
          to="/admin"
          aria-label="Marty Global LLC — Admin dashboard"
          className="shrink-0"
        >
          <img
            src={logoColor}
            alt="Marty Global LLC"
            className="h-8 w-[5.6875rem] object-contain"
          />
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-3.5">
        <AdminTopBarSearchButton onOpenSearch={onOpenSearch} variant="bare" />

        <AdminTopBarNotifications
          count={notificationCount}
          onOpenNotifications={onOpenNotifications}
          compact
        />

        {/* Inert until a user menu exists — see AdminTopBarUserMenu. */}
        {onOpenUserMenu ? (
          <button
            type="button"
            onClick={onOpenUserMenu}
            aria-haspopup="menu"
            aria-label={`Account menu — ${user.name}`}
            className="flex shrink-0 rounded-pill transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <AdminTopBarAvatar user={user} />
          </button>
        ) : (
          <span className="flex shrink-0">
            <AdminTopBarAvatar user={user} />
            <span className="sr-only">{user.name}</span>
          </span>
        )}
      </div>
    </header>
  );
}
