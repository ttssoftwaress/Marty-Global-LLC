import { useState, type ReactNode } from 'react';

import { PortalSidebar, type SidebarUser } from './sidebar';
import { PortalTopBar } from './topbar';

/*
 * Portal shell — the frame every `/app/*` page renders inside: sidebar on the
 * left, top bar above the content, page content in a scrolling workspace.
 *
 * The sidebar is fixed-height and the workspace scrolls on its own so the nav
 * and top bar stay put on long pages. Mobile has no persistent sidebar, so the
 * drawer's open state lives here — the top bar's hamburger toggles it.
 */

type PortalLayoutProps = {
  user: SidebarUser;
  notificationCount?: number;
  onLogout?: () => void;
  children: ReactNode;
};

export function PortalLayout({
  user,
  notificationCount,
  onLogout,
  children,
}: PortalLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50">
      <PortalSidebar
        user={user}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopBar
          user={user}
          notificationCount={notificationCount}
          onOpenMenu={() => setMobileNavOpen(true)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
