import { useState, type ReactNode } from 'react';

import { AdminSidebar, type AdminSidebarUser } from './sidebar';
import { AdminTopBar } from './topbar';

/*
 * Admin shell — the frame every `/admin/*` page renders inside: sidebar on the
 * left, top bar above the content, page content in a scrolling workspace.
 *
 * The sidebar is fixed-height and the workspace scrolls on its own so the nav
 * and top bar stay put on long pages. Mobile has no persistent sidebar, so the
 * drawer's open state lives here — the top bar's hamburger toggles it.
 *
 * The search, notification, and account-menu controls are passed straight
 * through, so the shell stays presentational and the panels those controls open
 * can land later without touching this file.
 */

type AdminLayoutProps = {
  user: AdminSidebarUser;
  notificationCount?: number;
  onSearch?: (query: string) => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenUserMenu?: () => void;
  onLogout?: () => void;
  children: ReactNode;
};

export function AdminLayout({
  user,
  notificationCount,
  onSearch,
  onOpenSearch,
  onOpenNotifications,
  onOpenUserMenu,
  onLogout,
  children,
}: AdminLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50">
      <AdminSidebar
        user={user}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar
          user={user}
          notificationCount={notificationCount}
          onSearch={onSearch}
          onOpenMenu={() => setMobileNavOpen(true)}
          onOpenSearch={onOpenSearch}
          onOpenNotifications={onOpenNotifications}
          onOpenUserMenu={onOpenUserMenu}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
