import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCompactScale } from '@/hooks/useCompactScale';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import {
  NotificationsPanel,
  notificationsRootKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPanel,
} from '../features/notifications';
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
 * Notifications are owned here rather than passed in per page, for the reason
 * the admin shell already records: the bell is in the top bar of every portal
 * screen, so its feed and its badge have to resolve on every portal screen.
 * Threading them through each page meant a page that forgot got a dead bell —
 * and fifteen of the seventeen did, which is what this fixes. One query in the
 * shell is also one cache entry shared across navigation rather than a refetch
 * per page; the notifications screen reads the same key and hits that cache.
 */

type PortalLayoutProps = {
  user: SidebarUser;
  onLogout?: () => void;
  children: ReactNode;
};

export function PortalLayout({ user, onLogout, children }: PortalLayoutProps) {
  useCompactScale();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigate = useNavigate();
  const panel = useNotificationPanel();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Live counters off the shared socket, so a notification that arrives while
  // the customer sits on a page moves the badge without a refetch.
  const unread = useUnreadCounts(
    panel.data?.unreadCount ?? 0,
    notificationsRootKey,
  );

  const notifications = useMemo(
    () => panel.data?.notifications ?? [],
    [panel.data],
  );

  // Opening a row marks it read and then navigates. The row is a Link, so the
  // navigation would happen on its own; doing it here keeps both halves in one
  // place and lets an informational row (no href) still be marked read.
  const onSelectNotification = (notification: Notification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.href) navigate(notification.href);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50">
      <PortalSidebar
        user={user}
        badges={{ notifications: unread.notifications, support: unread.messages }}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopBar
          user={user}
          notificationCount={unread.notifications}
          onOpenMenu={() => setMobileNavOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        isLoading={panel.isLoading}
        onSelect={onSelectNotification}
        onMarkAllRead={() => markAllRead.mutate()}
      />

      {/* Live chat, on every portal screen. It hides itself on /app/support,
          where the conversation already fills the page. */}
      <SupportWidget />
    </div>
  );
}
