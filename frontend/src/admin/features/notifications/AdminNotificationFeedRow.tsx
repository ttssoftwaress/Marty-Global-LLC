import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatActivityTime } from '../../lib/format';
import type { AdminNotification } from '../../types/notifications';
import { ADMIN_NOTIFICATION_ICONS } from './notificationIcons';

/*
 * One row in the full-page feed. The same category → icon + tint map as the
 * top-bar panel, but the page's roomier layout: a square tinted chip, the
 * message, and a right side that changes with state.
 *
 * The layout reshapes by breakpoint:
 *   - mobile: the time sits under the message; the unread dot is a thin rail on
 *     the far right; a read+actionable row's "Mark as read · ›" follows the time.
 *   - tablet/desktop: message left, time + trailing indicator right on one line.
 *     For a read row that links somewhere, "Mark as read" appears on hover next
 *     to the time (with a chevron on desktop).
 *
 * Unread rows tint their whole background and firm the message to semibold. A
 * linking row is a Link and reports the click up so the feed can mark it read;
 * "Mark as read" fires `onMarkRead` without navigating.
 */

type AdminNotificationFeedRowProps = {
  notification: AdminNotification;
  onSelect?: (notification: AdminNotification) => void;
  onMarkRead?: (notification: AdminNotification) => void;
};

export function AdminNotificationFeedRow({
  notification,
  onSelect,
  onMarkRead,
}: AdminNotificationFeedRowProps) {
  const { category, message, createdAt, read, href } = notification;
  const { Icon, wrapClassName, glyphClassName } =
    ADMIN_NOTIFICATION_ICONS[category];

  // Inline "Mark as read" — surfaced for a read, actionable row. Kept visually
  // quiet until hover/focus reveals it.
  const markReadButton = onMarkRead ? (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        onMarkRead(notification);
      }}
      className="whitespace-nowrap rounded-input px-1 text-[0.75rem] font-medium text-gray-500 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
    >
      Mark as read
    </button>
  ) : null;

  const body = (
    <>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-input ${wrapClassName}`}
      >
        <Icon
          className={`size-4 ${glyphClassName}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>

      {/* Message + (mobile-only) time/actions stacked beneath it */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-0">
        <span
          className={`text-[0.8125rem] leading-[1.125rem] text-text md:text-[0.875rem] md:leading-5 ${
            read ? 'font-normal' : 'font-semibold'
          }`}
        >
          {message}
        </span>

        {/* Mobile metadata line — time, then the read+actionable extras */}
        <span className="flex items-center gap-2 md:hidden">
          <span className="text-[0.75rem] text-gray-500">
            {formatActivityTime(createdAt)}
          </span>
          {read && href ? (
            <span className="flex items-center gap-1 text-gray-400">
              <span aria-hidden="true">·</span>
              {markReadButton}
              <ChevronRight className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            </span>
          ) : null}
        </span>
      </span>

      {/* Tablet right side (md → lg): time, then the trailing bit — an unread
          dot, or a read+actionable row's "· Mark as read" inline. */}
      <span className="hidden items-center gap-3 md:flex lg:hidden">
        <span className="whitespace-nowrap text-right text-[0.8125rem] text-gray-500">
          {formatActivityTime(createdAt)}
        </span>
        {!read ? (
          <span className="size-2 shrink-0 rounded-pill bg-error" aria-label="Unread" />
        ) : href ? (
          <span className="flex items-center gap-3 text-gray-400">
            <span aria-hidden="true">·</span>
            {markReadButton}
          </span>
        ) : null}
      </span>

      {/* Desktop right side (lg+): hover "Mark as read", then time, then the
          trailing indicator — dot for unread, chevron for a read link. */}
      <span className="hidden items-center gap-4 lg:flex">
        {read && href ? (
          <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {markReadButton}
          </span>
        ) : null}

        <span className="whitespace-nowrap text-right text-[0.8125rem] text-gray-500">
          {formatActivityTime(createdAt)}
        </span>

        {!read ? (
          <span className="size-2 shrink-0 rounded-pill bg-error" aria-label="Unread" />
        ) : href ? (
          <ChevronRight
            className="size-4 shrink-0 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : null}
      </span>

      {/* Mobile unread rail — a thin fixed column so read rows keep the same
          left edge as unread ones */}
      <span className="flex w-3 shrink-0 items-center justify-center md:hidden">
        {!read ? (
          <span className="size-2 rounded-pill bg-error" aria-label="Unread" />
        ) : null}
      </span>
    </>
  );

  const rowClassName = `group flex w-full items-start gap-3 border-b border-gray-200 px-4 py-3.5 text-left transition-colors last:border-b-0 focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary md:items-center md:gap-4 md:px-6 md:py-4 ${
    read ? 'bg-white hover:bg-gray-50' : 'bg-primary-light'
  }`;

  if (href) {
    return (
      <Link to={href} onClick={() => onSelect?.(notification)} className={rowClassName}>
        {body}
      </Link>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}
