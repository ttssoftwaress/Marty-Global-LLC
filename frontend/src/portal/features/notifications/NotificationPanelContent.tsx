import { BellOff, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Notification } from '../../types/notifications';
import { NotificationItem } from './NotificationItem';

/*
 * The shared inner content of the notification surface — header, scrollable
 * list, and footer — rendered inside either the desktop/tablet dropdown or the
 * mobile bottom sheet. The two wrappers differ (a floating panel vs a sheet);
 * the content between them is the same, so it lives here once.
 *
 * `variant` only nudges the header's type scale to match each design (the sheet
 * runs a touch larger). Everything below the header is identical. States the
 * designs don't show are filled in per Design guide.md: a loading skeleton while
 * the feed's query is in flight and an empty state when there's nothing to show.
 */

type NotificationPanelContentProps = {
  notifications: Notification[];
  isLoading?: boolean;
  variant: 'dropdown' | 'sheet';
  settingsHref: string;
  viewAllHref: string;
  onSelect?: (notification: Notification) => void;
  onMarkAllRead?: () => void;
  /** Closes the surface — used by the footer link and row selection. */
  onDismiss?: () => void;
};

function NotificationListSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 last:border-b-transparent"
        >
          <div className="size-8 shrink-0 animate-pulse rounded-pill bg-gray-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="h-3 w-full animate-pulse rounded-pill bg-gray-200" />
            <div className="h-2.5 w-16 animate-pulse rounded-pill bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-gray-100">
        <BellOff className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body font-semibold text-text">You&apos;re all caught up</p>
      <p className="max-w-[240px] text-small text-gray-500">
        New notifications about your applications, quotes, and mail will appear here.
      </p>
    </div>
  );
}

export function NotificationPanelContent({
  notifications,
  isLoading,
  variant,
  settingsHref,
  viewAllHref,
  onSelect,
  onMarkAllRead,
  onDismiss,
}: NotificationPanelContentProps) {
  const hasUnread = notifications.some((notification) => !notification.read);
  const isSheet = variant === 'sheet';

  return (
    <>
      <div
        className={`flex shrink-0 items-center justify-between border-b border-gray-200 px-4 ${
          isSheet ? 'pb-3' : 'py-4'
        }`}
      >
        <p
          className={`font-semibold text-text ${isSheet ? 'text-h6' : 'text-body-lg'}`}
        >
          Notifications
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={!hasUnread}
            className={`font-medium text-primary transition-colors hover:text-primary-hover disabled:text-gray-400 disabled:hover:text-gray-400 focus-visible:outline-none focus-visible:underline ${
              isSheet ? 'text-[13px]' : 'text-small'
            }`}
          >
            Mark all as read
          </button>
          <Link
            to={settingsHref}
            onClick={onDismiss}
            aria-label="Notification settings"
            className="flex shrink-0 items-center justify-center rounded-pill text-gray-500 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Settings
              className={isSheet ? 'size-[18px]' : 'size-4'}
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <NotificationListSkeleton />
        ) : notifications.length === 0 ? (
          <NotificationsEmptyState />
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onSelect={(selected) => {
                  onSelect?.(selected);
                  onDismiss?.();
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 p-3">
        <Link
          to={viewAllHref}
          onClick={onDismiss}
          className="btn btn-secondary h-auto w-full py-2.5 text-body"
        >
          View all notifications
        </Link>
      </div>
    </>
  );
}
