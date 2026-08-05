import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  AdminNotificationsPanel,
  adminNotificationsRootKey,
  useAdminNotificationPanel,
  useMarkAdminNotificationRead,
  useMarkAllAdminNotificationsRead,
} from '@/admin/features/notifications';
import { useAdminUnattendedSupport } from '@/admin/features/support';
import { useAdminMe } from '@/admin/queries/admin-me';
import { useCompactScale } from '@/hooks/useCompactScale';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import type { AdminNotification } from '@/admin/types/notifications';
import { AdminAccountMenu, type AdminAccountMenuAnchor } from './account-menu';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
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
 * Because the workspace — not the document — is the scroller, the browser never
 * offers its own pull-to-refresh on any admin screen. `usePullToRefresh` puts
 * the gesture back on the element that actually scrolls; releasing it refetches
 * every query the current screen has mounted, which is what a queue screen
 * wants on a phone.
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
 * The account menu is owned here too, and kept as one overlay rather than one per
 * trigger: the avatar appears in the top bar at every width, in the sidebar's
 * user block, and again on the tablet rail, and mounted copies would drift.
 * `accountMenu` holds which control opened it, because the panel anchors under
 * the bar for one and beside the sidebar for the others.
 *
 * Search is still passed straight through — that panel can land later without
 * touching this file.
 */

type AdminLayoutProps = {
  user: AdminSidebarUser;
  onSearch?: (query: string) => void;
  onOpenSearch?: () => void;
  onLogout?: () => void;
  children: ReactNode;
};

export function AdminLayout({
  user,
  onSearch,
  onOpenSearch,
  onLogout,
  children,
}: AdminLayoutProps) {
  useCompactScale();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenu, setAccountMenu] = useState<AdminAccountMenuAnchor | null>(
    null,
  );

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const me = useAdminMe();
  const panel = useAdminNotificationPanel();
  const markRead = useMarkAdminNotificationRead();
  const markAllRead = useMarkAllAdminNotificationsRead();

  /*
   * The job role ("Mail Room Operator") is what the sidebar prints once the
   * record lands — the auth role the session carries reads as a permission
   * level, not a job title. Until then the shell's own label stands in, so the
   * user block never renders blank.
   *
   * The profile picture rides on the same record: it is a short-TTL presigned
   * URL, so it cannot come off the session and has to be read from `/admin/me`.
   * Both the sidebar and the top bar render this one object, so the photo is
   * identical in each.
   */
  const sidebarUser = useMemo<AdminSidebarUser>(
    () =>
      me.data
        ? {
            ...user,
            role: me.data.roleLabel,
            email: me.data.email,
            avatarUrl: me.data.avatarUrl,
          }
        : user,
    [user, me.data],
  );

  const notifications = useMemo(
    () => panel.data?.notifications ?? [],
    [panel.data],
  );

  // Only the queries the current screen has mounted — refetching the whole cache
  // would pull data for screens nobody is looking at.
  const pullToRefresh = usePullToRefresh({
    onRefresh: useCallback(
      () => queryClient.refetchQueries({ type: 'active' }),
      [queryClient],
    ),
  });

  // The fetched count seeds the badge; the socket keeps it right afterwards, so
  // a notification arriving while a member sits on a screen moves it without a
  // refetch. Same hook the portal shell uses — the counters are per-user, and a
  // staff member is a user like any other.
  const unread = useUnreadCounts(
    panel.data?.unreadCount ?? 0,
    adminNotificationsRootKey,
  );
  const unreadCount = unread.notifications;

  /*
   * The Support-inbox bubble. A different question from the bell's counter beside
   * it — that one is "rows addressed to me", this one is "chats addressed to
   * nobody" — so it is its own number rather than the `messages` half of
   * `useUnreadCounts`, which counts the conversations a user owns as a CUSTOMER
   * and is therefore zero for a staff member on every screen.
   *
   * Asked only of a member who holds the `support` area: the nav item is hidden
   * without it and the endpoint would refuse them.
   */
  const unattendedSupport = useAdminUnattendedSupport(
    me.data?.permissions?.includes('support') ?? false,
  );

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
        badges={{ notifications: unreadCount, support: unattendedSupport }}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        /* On mobile the user block lives inside the drawer, which is itself a
         * modal overlay — so the drawer closes as the menu opens rather than the
         * two stacking. On tablet and desktop there is no drawer to close. */
        onOpenAccountMenu={() => {
          setMobileNavOpen(false);
          setAccountMenu('sidebar');
        }}
        accountMenuOpen={accountMenu === 'sidebar'}
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
          onOpenUserMenu={() => setAccountMenu('topbar')}
          accountMenuOpen={accountMenu === 'topbar'}
        />

        {/*
         * The workspace fades in on arrival at a new section. Keyed on the
         * section, not the full path: `/admin/support/:id` and the request
         * slide-overs keep the screen behind them mounted, and remounting there
         * would reset a queue to its first page mid-triage. Fade only — an
         * entrance transform would leave a permanent `translate` here, which is
         * a containing block for the `position: fixed` panels pages render.
         */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <PullToRefreshIndicator
            offset={pullToRefresh.offset}
            progress={pullToRefresh.progress}
            refreshing={pullToRefresh.refreshing}
            dragging={pullToRefresh.dragging}
          />

          <main
            key={pathname.split('/').slice(0, 3).join('/')}
            ref={pullToRefresh.setScroller}
            className="min-h-0 flex-1 animate-fade-in overflow-y-auto overscroll-y-contain motion-reduce:animate-none"
          >
            {children}
          </main>
        </div>
      </div>

      <AdminNotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        isLoading={panel.isLoading}
        isError={panel.isError}
        isRetrying={panel.isFetching}
        onRetry={() => void panel.refetch()}
        onSelect={onSelectNotification}
        onMarkAllRead={() => markAllRead.mutate()}
      />

      <AdminAccountMenu
        open={accountMenu !== null}
        onClose={() => setAccountMenu(null)}
        anchor={accountMenu ?? 'topbar'}
        user={sidebarUser}
        permissions={me.data?.permissions}
        onLogout={onLogout}
      />
    </div>
  );
}
