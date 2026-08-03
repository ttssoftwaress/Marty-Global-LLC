import { SidebarDesktop } from './SidebarDesktop';
import { SidebarMobileDrawer } from './SidebarMobileDrawer';
import { SidebarTablet } from './SidebarTablet';
import type { SidebarUser } from './SidebarUserBlock';
import type { PortalNavBadges } from './nav-items';

/*
 * Portal sidebar — the responsive shell. One design across three breakpoints:
 *   - mobile (<768px): drawer, opened by the layout's menu button
 *   - tablet (md, 768px): 72px icon rail, always visible
 *   - desktop (lg, 1024px): 280px full sidebar, always visible
 *
 * Rail and sidebar render as siblings and swap by breakpoint rather than one
 * component reflowing, because the rail drops the logo, labels and user block
 * entirely — a single tree would carry markup that is hidden at every width.
 */

type PortalSidebarProps = {
  user: SidebarUser;
  // The live unread counters the shell holds, resolved per item by `badge` key.
  badges?: PortalNavBadges;
  mobileOpen: boolean;
  onMobileClose: () => void;
  /* Opens the shell's account menu from the user block (desktop + drawer). */
  onOpenAccountMenu?: () => void;
  accountMenuOpen?: boolean;
  onLogout?: () => void;
};

export function PortalSidebar({
  user,
  badges,
  mobileOpen,
  onMobileClose,
  onOpenAccountMenu,
  accountMenuOpen,
  onLogout,
}: PortalSidebarProps) {
  return (
    <>
      <SidebarTablet
        badges={badges}
        onLogout={onLogout}
        className="hidden md:flex lg:hidden"
      />
      <SidebarDesktop
        user={user}
        badges={badges}
        onOpenAccountMenu={onOpenAccountMenu}
        accountMenuOpen={accountMenuOpen}
        onLogout={onLogout}
        className="hidden lg:flex"
      />
      <SidebarMobileDrawer
        open={mobileOpen}
        onClose={onMobileClose}
        user={user}
        badges={badges}
        onOpenAccountMenu={onOpenAccountMenu}
        onLogout={onLogout}
      />
    </>
  );
}
