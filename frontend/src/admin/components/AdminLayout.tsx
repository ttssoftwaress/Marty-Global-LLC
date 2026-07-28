import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  AdminNotificationsPanel,
  useAdminNotificationPanel,
  useMarkAdminNotificationRead,
  useMarkAllAdminNotificationsRead,
} from '@/admin/features/notifications';
import { useAdminMe } from '@/admin/queries/admin-me';
import { useCompactScale } from '@/hooks/useCompactScale';
import type { AdminNotification } from '@/admin/types/notifications';
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
 * Notifications are owned here rather than passed in per page. The bell is in
 * the top bar of every admin screen, so its feed and its unread badge have to
 * resolve on every admin screen; making each page thread that through would
 * mean a page that forgot to gets a dead bell. One query in the shell also means
 * one cache entry shared across navigation instead of a refetch per page. A page
 * that needs the same numbers (the notifications screen itself) reads the same
 * query key and hits that cache.
 *
 * The signed-in member's own record is fetched here for the same reason: the
 * sidebar renders on every admin screen and needs their permission areas to know
 * which sections to list. It comes from the API rather than the session because
 * Better Auth stores only the coarse auth role — the per-area grid an admin sets
 * on the team screen is what actually decides, and the backend's
 * `requirePermission` reads the same row, so the nav and the API agree.
 *
 * Search and the account menu are still passed straight through — those panels
 * can land later without touching this file.
 */

type AdminLayoutProps = {
  user: AdminSidebarUser;
  onSearch?: (query: string) => void;
  onOpenSearch?: () => void;
  onOpenUserMenu?: () => void;
  onLogout?: () => void;
  children: ReactNode;
};

export function AdminLayout({
  user,
  onSearch,
  onOpenSearch,
  onOpenUserMenu,
  onLogout,
  children,
}: AdminLayoutProps) {
  useCompactScale();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navigate = useNavigate();
  const me = useAdminMe();
  const panel = useAdminNotificationPanel();
  const markRead = useMarkAdminNotificationRead();
  const markAllRead = useMarkAllAdminNotificationsRead();

  /*
   * The job role ("Mail Room Operator") is what the sidebar prints once the
   * record lands — the auth role the session carries reads as a permission
   * level, not a job title. Until then the shell's own label stands in, so the
   * user block never renders blank.
   */
  const sidebarUser = useMemo<AdminSidebarUser>(
    () => (me.data ? { ...user, role: me.data.roleLabel } : user),
    [user, me.data],
  );

  const notifications = useMemo(
    () => panel.data?.notifications ?? [],
    [panel.data],
  );
  const unreadCount = panel.data?.unreadCount ?? 0;

  // Opening a row marks it read and then navigates. The row is a Link, so the
  // navigation would happen on its own; doing it here keeps both halves in one
  // place and lets an informational row (no href) still be marked read.
  const onSelectNotification = (notification: AdminNotification) => {
    if (!notification.read) markRead.mutate(notification.id);
    if (notification.href) navigate(notification.href);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50">
      <AdminSidebar
        user={sidebarUser}
        permissions={me.data?.permissions}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar
          user={sidebarUser}
          notificationCount={unreadCount}
          onSearch={onSearch}
          onOpenMenu={() => setMobileNavOpen(true)}
          onOpenSearch={onOpenSearch}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenUserMenu={onOpenUserMenu}
        />

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <AdminNotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        isLoading={panel.isLoading}
        onSelect={onSelectNotification}
        onMarkAllRead={() => markAllRead.mutate()}
      />
    </div>
  );
}
