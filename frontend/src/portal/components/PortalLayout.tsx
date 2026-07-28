import { useState, type ReactNode } from 'react';

import { NotificationsPanel } from '../features/notifications';
import { SupportWidget } from '../features/support';
import type { Notification } from '../types/notifications';
import { PortalSidebar, type SidebarUser } from './sidebar';
import { PortalTopBar } from './topbar';

/*
 * Portal shell — the frame every `/app/*` page renders inside: sidebar on the
 * left, top bar above the content, page content in a scrolling workspace.
 *
 * The sidebar is fixed-height and the workspace scrolls on its own so the nav
 * and top bar stay put on long pages. Mobile has no persistent sidebar, so the
 * drawer's open state lives here — the top bar's hamburger toggles it.
 *
 * The notification panel is owned here too: the top bar's bell opens it, and it
 * renders as a dropdown (tablet/desktop) or bottom sheet (mobile). Its feed
 * arrives from the future `notifications` query the same way `notificationCount`
 * does — the shell just presents whatever the page passes in.
 */

type PortalLayoutProps = {
  user: SidebarUser;
  notificationCount?: number;
  notifications?: Notification[];
  notificationsLoading?: boolean;
  onMarkAllNotificationsRead?: () => void;
  onSelectNotification?: (notification: Notification) => void;
  onLogout?: () => void;
  children: ReactNode;
};

export function PortalLayout({
  user,
  notificationCount,
  notifications = [],
  notificationsLoading,
  onMarkAllNotificationsRead,
  onSelectNotification,
  onLogout,
  children,
}: PortalLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
          onOpenNotifications={() => setNotificationsOpen(true)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        isLoading={notificationsLoading}
        onSelect={onSelectNotification}
        onMarkAllRead={onMarkAllNotificationsRead}
      />

      {/* Live chat, on every portal screen. It hides itself on /app/messages,
          where the conversation already fills the page. */}
      <SupportWidget />
    </div>
  );
}
