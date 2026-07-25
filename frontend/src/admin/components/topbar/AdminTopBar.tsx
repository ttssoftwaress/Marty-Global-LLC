import { AdminTopBarDesktop } from './AdminTopBarDesktop';
import { AdminTopBarMobile } from './AdminTopBarMobile';
import { AdminTopBarTablet } from './AdminTopBarTablet';
import type { AdminTopBarUser } from './AdminTopBarUser';

/*
 * Admin top bar — the responsive shell shared by every `/admin/*` page. One
 * design across three breakpoints:
 *   - mobile (<768px): 56px bar, hamburger + logo, search icon, avatar only
 *   - tablet (md, 768px): 72px bar, search collapsed to a 40px icon button
 *   - desktop (lg, 1024px): 72px bar, the full 400px global search field
 *
 * The three render as siblings and swap by breakpoint rather than one component
 * reflowing, because the left side changes identity at every width — search field
 * vs search button vs hamburger+logo — and mobile moves search to the right and
 * drops the chevron. Matches how AdminSidebar composes its variants.
 *
 * Every control is a callback, so the shell stays presentational: the admin
 * layout owns the drawer, the search overlay, the notification panel, and the
 * account menu.
 */

type AdminTopBarProps = {
  user: AdminTopBarUser;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onOpenMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
};

export function AdminTopBar({
  user,
  notificationCount,
  onSearch,
  onOpenMenu,
  onOpenSearch,
  onOpenNotifications,
  onOpenUserMenu,
}: AdminTopBarProps) {
  return (
    <>
      <AdminTopBarMobile
        className="md:hidden"
        user={user}
        notificationCount={notificationCount}
        onOpenMenu={onOpenMenu}
        onOpenSearch={onOpenSearch}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
      <AdminTopBarTablet
        className="hidden md:flex lg:hidden"
        user={user}
        notificationCount={notificationCount}
        onOpenSearch={onOpenSearch}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
      <AdminTopBarDesktop
        className="hidden lg:flex"
        user={user}
        notificationCount={notificationCount}
        onSearch={onSearch}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
    </>
  );
}
