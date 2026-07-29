import { TopBarDesktop } from './TopBarDesktop';
import { TopBarMobile } from './TopBarMobile';
import { TopBarTablet } from './TopBarTablet';
import type { TopBarUser } from './TopBarUser';

/*
 * Portal top bar — the responsive shell. One design across three breakpoints:
 *   - mobile (<768px): 56px bar, hamburger + logo, avatar only
 *   - tablet (md, 768px): 72px bar, logo (the icon rail has none)
 *   - desktop (lg, 1024px): 72px bar, portal title (the sidebar has the logo)
 *
 * The three render as siblings and swap by breakpoint rather than one component
 * reflowing, because the left side changes identity at every width — title vs
 * logo vs hamburger+logo — and mobile drops the chevron and vertical rule.
 * Matches how PortalSidebar composes its variants.
 */

type PortalTopBarProps = {
  user: TopBarUser;
  notificationCount?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
};

export function PortalTopBar({
  user,
  notificationCount,
  onOpenMenu,
  onOpenNotifications,
  onOpenUserMenu,
}: PortalTopBarProps) {
  return (
    <>
      <TopBarMobile
        className="md:hidden"
        user={user}
        notificationCount={notificationCount}
        onOpenMenu={onOpenMenu}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
      <TopBarTablet
        className="hidden md:flex lg:hidden"
        user={user}
        notificationCount={notificationCount}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
      <TopBarDesktop
        className="hidden lg:flex"
        user={user}
        notificationCount={notificationCount}
        onOpenNotifications={onOpenNotifications}
        onOpenUserMenu={onOpenUserMenu}
      />
    </>
  );
}
