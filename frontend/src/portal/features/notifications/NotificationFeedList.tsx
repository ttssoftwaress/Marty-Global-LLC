import { BellOff } from 'lucide-react';

import { differenceInDays, differenceInHours, parseISO } from 'date-fns';

import type {
  Notification,
  NotificationGroup,
} from '../../types/notifications';
import { NotificationFeedRow } from './NotificationFeedRow';

/*
 * The card that holds the feed: date-group dividers (Today / This week /
 * Earlier) with their rows beneath, matching the design. Grouping is driven by
 * each notification's server-stamped bucket so it stays stable across the
 * paginated loads and reflects the server's clock, not the browser's.
 *
 * The card owns the design's states the pathway didn't draw (Design guide.md):
 * a skeleton while the first page loads and an empty state when a filter has
 * nothing to show.
 */

// Fixed display order + labels for the three buckets. A bucket with no rows is
// skipped so the list never shows an empty divider.
const GROUP_ORDER: { key: NotificationGroup; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'earlier', label: 'Earlier' },
];

// Which bucket a notification falls in — from the server field when present,
// otherwise derived from its age so the list still groups sensibly if the
// backend hasn't stamped it yet: within 24h → today, within the week → this
// week, older → earlier.
function groupOf(notification: Notification): NotificationGroup {
  if (notification.group) return notification.group;
  const date = parseISO(notification.createdAt);
  const now = new Date();
  if (differenceInHours(now, date) < 24) return 'today';
  if (differenceInDays(now, date) < 7) return 'this_week';
  return 'earlier';
}

function GroupDivider({ label }: { label: string }) {
  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 md:px-6">
      <p className="text-caption font-medium uppercase tracking-[0.4px] text-gray-500">
        {label}
      </p>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      <GroupDivider label="Today" />
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-gray-200 px-4 py-4 last:border-b-0 md:gap-4 md:px-6"
        >
          <div className="size-8 shrink-0 animate-pulse rounded-input bg-gray-200" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-3/4 animate-pulse rounded-pill bg-gray-200" />
            <div className="h-2.5 w-16 animate-pulse rounded-pill bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-gray-100">
        <BellOff className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">You&apos;re all caught up</p>
      <p className="max-w-[20rem] text-body text-gray-500">
        New notifications about your applications, quotes, and mail will appear here.
      </p>
    </div>
  );
}

type NotificationFeedListProps = {
  notifications: Notification[];
  isLoading?: boolean;
  onSelect?: (notification: Notification) => void;
  onMarkRead?: (notification: Notification) => void;
};

export function NotificationFeedList({
  notifications,
  isLoading,
  onSelect,
  onMarkRead,
}: NotificationFeedListProps) {
  const grouped = GROUP_ORDER.map((group) => ({
    ...group,
    items: notifications.filter((n) => groupOf(n) === group.key),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      {isLoading ? (
        <FeedSkeleton />
      ) : notifications.length === 0 ? (
        <FeedEmptyState />
      ) : (
        grouped.map((group) => (
          <div key={group.key} className="flex flex-col">
            <GroupDivider label={group.label} />
            {group.items.map((notification) => (
              <NotificationFeedRow
                key={notification.id}
                notification={notification}
                onSelect={onSelect}
                onMarkRead={
                  // The inline action is for read, actionable rows only — an
                  // unread row already shows its dot and marks read on open.
                  notification.read && notification.href ? onMarkRead : undefined
                }
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
