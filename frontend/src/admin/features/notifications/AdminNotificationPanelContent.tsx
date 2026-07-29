import { BellOff, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DataErrorState } from '../../components/DataErrorState';
import type { AdminNotification } from '../../types/notifications';
import { AdminNotificationItem } from './AdminNotificationItem';

/*
 * The shared inner content of the notification surface — header, scrollable
 * list, footer — rendered inside either the tablet/desktop dropdown or the
 * mobile bottom sheet. The wrappers differ; what sits between them does not, so
 * it lives here once.
 *
 * The header's type scale differs between the two chromes (the sheet runs a
 * touch larger). Since the surface is now a single element that changes shape at
 * `md`, those deltas are responsive classes rather than a branch: sheet sizing is
 * the mobile base, dropdown sizing takes over from `md` up. The loading and empty
 * states are owned here.
 */

type AdminNotificationPanelContentProps = {
  notifications: AdminNotification[];
  isLoading?: boolean;
  // A failed feed is not a caught-up one: without this the panel would print
  // "You're all caught up" over a request that never arrived.
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  settingsHref: string;
  viewAllHref: string;
  onSelect?: (notification: AdminNotification) => void;
  onMarkAllRead?: () => void;
  /** Closes the surface — used by the footer link and row selection. */
  onDismiss?: () => void;
};

function PanelSkeleton() {
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

function PanelEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-gray-100">
        <BellOff className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body font-semibold text-text">You&apos;re all caught up</p>
      <p className="max-w-[15rem] text-small text-gray-500">
        New orders, payments, mail requests, and support replies will appear here.
      </p>
    </div>
  );
}

export function AdminNotificationPanelContent({
  notifications,
  isLoading,
  isError,
  isRetrying,
  onRetry,
  settingsHref,
  viewAllHref,
  onSelect,
  onMarkAllRead,
  onDismiss,
}: AdminNotificationPanelContentProps) {
  const hasUnread = notifications.some((notification) => !notification.read);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 pb-3 md:py-4">
        <p className="text-h6 font-semibold text-text md:text-body-lg">
          Notifications
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={!hasUnread}
            className="text-[0.8125rem] font-medium text-primary transition-colors hover:text-primary-hover disabled:text-gray-400 disabled:hover:text-gray-400 focus-visible:outline-none focus-visible:underline md:text-small"
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
              className="size-[1.125rem] md:size-4"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <PanelSkeleton />
        ) : isError ? (
          // `bare` — the surface hosting this content already draws the frame.
          <DataErrorState
            bare
            title="We couldn’t load your notifications"
            description="Something went wrong fetching the feed. Try again."
            onRetry={() => onRetry?.()}
            isRetrying={isRetrying}
          />
        ) : notifications.length === 0 ? (
          <PanelEmptyState />
        ) : (
          <div className="flex flex-col">
            {notifications.map((notification) => (
              <AdminNotificationItem
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
