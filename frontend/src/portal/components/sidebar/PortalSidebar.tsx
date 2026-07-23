import { SidebarDesktop } from './SidebarDesktop';
import { SidebarMobileDrawer } from './SidebarMobileDrawer';
import { SidebarTablet } from './SidebarTablet';
import type { SidebarUser } from './SidebarUserBlock';

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
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout?: () => void;
};

export function PortalSidebar({
  user,
  mobileOpen,
  onMobileClose,
  onLogout,
}: PortalSidebarProps) {
  return (
    <>
      <SidebarTablet onLogout={onLogout} className="hidden md:flex lg:hidden" />
      <SidebarDesktop user={user} onLogout={onLogout} className="hidden lg:flex" />
      <SidebarMobileDrawer
        open={mobileOpen}
        onClose={onMobileClose}
        user={user}
        onLogout={onLogout}
      />
    </>
  );
}
