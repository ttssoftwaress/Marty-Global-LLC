import { useMemo } from 'react';

import { AdminSidebarDesktop } from './AdminSidebarDesktop';
import { AdminSidebarMobileDrawer } from './AdminSidebarMobileDrawer';
import { AdminSidebarTablet } from './AdminSidebarTablet';
import type { AdminSidebarUser } from './AdminSidebarUserBlock';
import { visibleAdminNavItems, type AdminNavBadges } from './nav-items';

/*
 * Admin sidebar — the responsive shell shared by every `/admin/*` page. One
 * design across three breakpoints:
 *   - mobile (<768px): drawer, opened by the layout's menu button
 *   - tablet (md, 768px): 72px icon rail, always visible
 *   - desktop (lg, 1024px): 280px full sidebar, always visible
 *
 * Rail and sidebar render as siblings and swap by breakpoint rather than one
 * component reflowing, because the rail trades the wordmark for an "M" tile and
 * drops every label — a single tree would carry markup hidden at every width.
 *
 * All three render at once, so the nav list is resolved here and handed down
 * rather than filtered three times. Their markup differs; which sections a
 * member may open does not.
 *
 * The drawer's open state is owned by the caller (the admin layout), so the menu
 * button that toggles it can live in a sibling component.
 */

type AdminSidebarProps = {
  user: AdminSidebarUser;
  permissions: readonly string[] | undefined;
  // The live unread counters the shell holds, resolved per item by `badge` key.
  badges?: AdminNavBadges;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout?: () => void;
};

export function AdminSidebar({
  user,
  permissions,
  badges,
  mobileOpen,
  onMobileClose,
  onLogout,
}: AdminSidebarProps) {
  const items = useMemo(() => visibleAdminNavItems(permissions), [permissions]);

  return (
    <>
      <AdminSidebarTablet
        user={user}
        items={items}
        badges={badges}
        onLogout={onLogout}
        className="hidden md:flex lg:hidden"
      />
      <AdminSidebarDesktop
        user={user}
        items={items}
        badges={badges}
        onLogout={onLogout}
        className="hidden lg:flex"
      />
      <AdminSidebarMobileDrawer
        open={mobileOpen}
        onClose={onMobileClose}
        user={user}
        items={items}
        badges={badges}
        onLogout={onLogout}
      />
    </>
  );
}
