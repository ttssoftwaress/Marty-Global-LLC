import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatActivityTimeShort } from '../../lib/format';
import type { AdminNotification } from '../../types/notifications';
import { ADMIN_NOTIFICATION_ICONS } from './notificationIcons';

/*
 * One compact notification row inside the top-bar panel — the same markup at
 * every breakpoint, since only the chrome around it (a dropdown vs a bottom
 * sheet) changes.
 *
 * Layout: a tinted category chip, message + relative time, and a trailing
 * indicator. Unread rows tint their background and firm the message to
 * semibold; the trailing spot shows the unread dot when unread, a chevron when
 * the row links somewhere and is already read, and nothing when a read row is
 * purely informational.
 *
 * A linking row is a Link; an informational row is a button only while unread
 * (so it can still be marked read on click), otherwise an inert row.
 */

type AdminNotificationItemProps = {
  notification: AdminNotification;
  onSelect?: (notification: AdminNotification) => void;
};

export function AdminNotificationItem({
  notification,
  onSelect,
}: AdminNotificationItemProps) {
  const { category, message, createdAt, read, href } = notification;
  const { Icon, wrapClassName, glyphClassName } =
    ADMIN_NOTIFICATION_ICONS[category];

  const rowClassName = `flex w-full items-center gap-3 border-b border-gray-200 px-4 py-3 text-left transition-colors last:border-b-transparent focus-visible:outline-none focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary ${
    read ? 'bg-white hover:bg-gray-50' : 'bg-primary-light hover:bg-primary-light/70'
  }`;

  const body = (
    <>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-pill ${wrapClassName}`}
      >
        <Icon
          className={`size-4 ${glyphClassName}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`text-[0.8125rem] leading-[1.125rem] text-text ${
            read ? 'font-normal' : 'font-semibold'
          }`}
        >
          {message}
        </span>
        <span className="text-caption font-normal text-gray-400">
          {formatActivityTimeShort(createdAt)}
        </span>
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
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        onClick={() => onSelect?.(notification)}
        className={rowClassName}
      >
        {body}
      </Link>
    );
  }

  if (!read) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(notification)}
        className={rowClassName}
      >
        {body}
      </button>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}
