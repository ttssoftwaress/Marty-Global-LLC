import { useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  NotificationFeedList,
  NotificationFilterTabs,
  useNotificationFeed,
} from '../features/notifications';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  Notification,
  NotificationFilter,
} from '../types/notifications';

/*
 * Notifications — the customer's full feed: filter tabs across the top, the feed
 * grouped by date (Today / This week / Earlier), and "Load older notifications"
 * paging the cursor stream. It is the full-page counterpart to the top-bar
 * panel; both read the `notifications` module, this one paginated.
 *
 * One tree serves all three viewports. The header is the only page-level
 * responsive piece — a breadcrumb + settings button + "Mark all as read" on
 * tablet/desktop, and a compact title + gear + a separate "Mark all as read"
 * row on mobile — so it lives here; the list and tabs own their own reshaping.
 *
 * Nothing is hardcoded customer data: the feed comes from the backend (endpoints
 * land later, two-apps sync rule), so the screen renders a skeleton until the
 * first page arrives and an empty state once a filter has nothing to show.
 * Marking read wires to the mutation with the module; the handlers are in place.
 */

const SETTINGS_HREF = '/app/settings';

function NotificationsHeader({
  hasUnread,
  onMarkAllRead,
}: {
  hasUnread: boolean;
  onMarkAllRead: () => void;
}) {
  return (
    <header className="flex w-full flex-col gap-4">
      {/* Breadcrumb — tablet & desktop */}
      <p className="hidden items-center gap-1.5 text-caption font-medium uppercase tracking-[0.4px] md:flex">
        <Link to="/app" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-400">Notifications</span>
      </p>

      {/* Title row — the mobile gear + desktop actions share this row */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold leading-8 text-text lg:text-[32px] lg:leading-10">
          Notifications
        </h1>

        {/* Desktop & tablet actions */}
        <div className="hidden items-center gap-4 md:flex">
          <Link
            to={SETTINGS_HREF}
            className="inline-flex h-10 items-center gap-2 rounded-input border border-primary bg-white px-4 text-[14px] font-medium text-primary transition-colors hover:bg-primary-light"
          >
            <Settings className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Notification settings
          </Link>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={!hasUnread}
            className="text-[14px] font-medium text-primary transition-colors hover:text-primary-hover disabled:text-gray-400 disabled:hover:text-gray-400 focus-visible:outline-none focus-visible:underline"
          >
            Mark all as read
          </button>
        </div>

        {/* Mobile settings gear */}
        <Link
          to={SETTINGS_HREF}
          aria-label="Notification settings"
          className="flex size-9 shrink-0 items-center justify-center rounded-input text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary md:hidden"
        >
          <Settings className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>

      {/* Mobile "Mark all as read" — its own row per the design */}
      <button
        type="button"
        onClick={onMarkAllRead}
        disabled={!hasUnread}
        className="self-start text-[12px] font-medium text-primary transition-colors hover:text-primary-hover disabled:text-gray-400 md:hidden"
      >
        Mark all as read
      </button>
    </header>
  );
}

export function NotificationsPage() {
  const { user, onLogout } = usePortalShell();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const feed = useNotificationFeed(filter);

  const notifications = useMemo(
    () => feed.data?.pages.flatMap((page) => page.notifications) ?? [],
    [feed.data],
  );
  // The unread count comes from the feed's first page (a total across the feed,
  // not just what's loaded), so the "Unread" tab's pill is accurate.
  const unreadCount = feed.data?.pages[0]?.unreadCount ?? 0;

  const showSkeleton = feed.isLoading || !feed.data;

  // Opening a linking row marks it read alongside navigating (the panel does the
  // same). The mutation lands with the module; navigation is the visible effect.
  const onSelectNotification = (notification: Notification) => {
    if (notification.href) navigate(notification.href);
  };

  const onMarkRead = (_notification: Notification) => {
    // Wires to the per-row mark-read mutation with the notifications module.
  };

  const onMarkAllRead = () => {
    // Wires to the mark-all-read mutation with the notifications module.
  };

  return (
    <PortalLayout
      user={user}
      onLogout={onLogout}
      notificationCount={unreadCount}
      onSelectNotification={onSelectNotification}
    >
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
          <NotificationsHeader hasUnread={unreadCount > 0} onMarkAllRead={onMarkAllRead} />

          <NotificationFilterTabs
            active={filter}
            unreadCount={unreadCount}
            onChange={setFilter}
          />

          <NotificationFeedList
            notifications={notifications}
            isLoading={showSkeleton}
            onSelect={onSelectNotification}
            onMarkRead={onMarkRead}
          />

          {feed.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="inline-flex h-12 items-center justify-center rounded-input border border-primary bg-white px-6 text-[15px] font-medium text-primary transition-colors hover:bg-primary-light disabled:opacity-60 max-md:h-10 max-md:w-full max-md:text-[14px] max-md:font-semibold"
              >
                {feed.isFetchingNextPage ? 'Loading…' : 'Load older notifications'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </PortalLayout>
  );
}
