import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useCompactScale } from '@/hooks/useCompactScale';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
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
import { AccountMenu, type AccountMenuAnchor } from './account-menu';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';
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
 * Because the workspace — not the document — is the scroller, the browser never
 * offers its own pull-to-refresh on any portal screen. `usePullToRefresh` puts
 * the gesture back on the element that actually scrolls; releasing it refetches
 * every query the current screen has mounted.
 *
 * Notifications are owned here rather than passed in per page, for the reason
 * the admin shell already records: the bell is in the top bar of every portal
 * screen, so its feed and its badge have to resolve on every portal screen.
 * Threading them through each page meant a page that forgot got a dead bell —
 * and fifteen of the seventeen did, which is what this fixes. One query in the
 * shell is also one cache entry shared across navigation rather than a refetch
 * per page; the notifications screen reads the same key and hits that cache.
 *
 * The account menu is owned here for the same reason and kept as one overlay
 * rather than one per trigger: the avatar appears in the top bar at every width
 * and again in the sidebar's user block, and two mounted copies would drift.
 * `accountMenu` holds which control opened it, because the panel anchors under
 * the bar for one and beside the sidebar for the other.
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
  const [accountMenu, setAccountMenu] = useState<AccountMenuAnchor | null>(null);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
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

  // Only the queries the current screen has mounted — refetching the whole cache
  // would pull data for screens the customer is not looking at.
  const pullToRefresh = usePullToRefresh({
    onRefresh: useCallback(
      () => queryClient.refetchQueries({ type: 'active' }),
      [queryClient],
    ),
  });

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
        /* On mobile the user block lives inside the drawer, which is itself a
         * modal overlay — so the drawer closes as the menu opens rather than the
         * two stacking. On desktop there is no drawer to close. */
        onOpenAccountMenu={() => {
          setMobileNavOpen(false);
          setAccountMenu('sidebar');
        }}
        accountMenuOpen={accountMenu === 'sidebar'}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalTopBar
          user={user}
          notificationCount={unread.notifications}
          onOpenMenu={() => setMobileNavOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenUserMenu={() => setAccountMenu('topbar')}
          accountMenuOpen={accountMenu === 'topbar'}
        />

        {/*
         * The workspace fades in when the customer arrives somewhere new. Keyed
         * on the section rather than the whole path on purpose: a route-driven
         * overlay (`/app/mailroom/:roomId/:itemId`) and a conversation switch
         * (`/app/support/:id`) both leave the screen behind them mounted, and
         * remounting there would reset an infinite list to its first page mid-
         * read. Fade only — an entrance transform would leave a permanent
         * `translate` on this element, which is a containing block for the
         * `position: fixed` slide-overs the pages inside render.
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

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        isLoading={panel.isLoading}
        onSelect={onSelectNotification}
        onMarkAllRead={() => markAllRead.mutate()}
      />

      <AccountMenu
        open={accountMenu !== null}
        onClose={() => setAccountMenu(null)}
        anchor={accountMenu ?? 'topbar'}
        user={user}
        onLogout={onLogout}
      />

      {/* Live chat, on every portal screen. It hides itself on /app/support,
          where the conversation already fills the page. */}
      <SupportWidget />
    </div>
  );
}
