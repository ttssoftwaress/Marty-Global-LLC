import { ChevronRight, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { MailRoom } from '../../types/mailroom';
import { RoomStatusChip } from './RoomStatusChip';

/*
 * A single mail room. Two presentations of one card, swapped by breakpoint — a
 * card whose icon sits beside the title on mobile can't reflow into one whose
 * icon sits above it on desktop, so each renders its own markup (the same
 * approach the orders/quotes lists take between table and card):
 *   - mobile:        icon + name/address on one row, status pill top-right, then
 *                    a "New mail • Pending" meta line and a renewal footer
 *   - tablet/desktop: icon and status pill on the top row, name/address stacked
 *                    below, then meta (spread apart) and footer rows
 *
 * The whole card links to the room. "New mail" reads magenta while there's
 * unread mail (navy on desktop, matching that link) beside a red dot; a settled
 * room greys it out. Copy follows the desktop link — "Renews", not the mobile
 * link's "Reviews".
 */

const roomHref = (roomId: string) => `/app/mailroom/${roomId}`;

function MailIconChip() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-input bg-primary-light">
      <Mail className="size-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
    </span>
  );
}

function Divider() {
  return <div className="h-px w-full bg-gray-200" aria-hidden="true" />;
}

export function MailRoomCard({ room }: { room: MailRoom }) {
  const hasNewMail = room.newMail > 0;

  return (
    <Link
      to={roomHref(room.id)}
      className="press-soft group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {/* Mobile — icon + title on one row, meta line below */}
      <div className="flex flex-col gap-4 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation transition-all group-hover:border-gray-300 group-hover:shadow-md-elevation md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <MailIconChip />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="truncate text-body font-semibold text-text">{room.name}</p>
              <p className="truncate text-small text-gray-500">{room.address}</p>
            </div>
          </div>
          <RoomStatusChip status={room.status} />
        </div>

        <Divider />

        <div className="flex items-center gap-2 text-small">
          <span className={`font-semibold ${hasNewMail ? 'text-accent' : 'text-gray-500'}`}>
            New mail: {room.newMail}
          </span>
          <span className="text-gray-400" aria-hidden="true">
            •
          </span>
          <span className="text-gray-500">Pending: {room.pendingRequests}</span>
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <span className="text-small text-gray-400">
            Renews {formatOrderDate(room.renewsAt)}
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-gray-400 transition-colors group-hover:text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Tablet & desktop — icon + status on top, name/address stacked below */}
      <div className="hidden flex-col rounded-card border border-gray-200 bg-white p-5 shadow-sm-elevation transition-all group-hover:border-gray-300 group-hover:shadow-md-elevation md:flex">
        <div className="flex items-start justify-between pb-4">
          <MailIconChip />
          <RoomStatusChip status={room.status} />
        </div>

        <div className="flex flex-col gap-1.5 pb-4">
          <p className="truncate text-h6 font-semibold text-text">{room.name}</p>
          <p className="truncate text-small text-gray-500">{room.address}</p>
        </div>

        <Divider />

        <div className="flex items-center justify-between py-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`text-small font-semibold ${
                hasNewMail ? 'text-accent lg:text-primary' : 'text-gray-500'
              }`}
            >
              New mail: {room.newMail}
            </span>
            {hasNewMail ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-error"
              />
            ) : null}
          </span>
          <span className="text-small text-gray-500">Pending: {room.pendingRequests}</span>
        </div>

        <Divider />

        <div className="flex items-center justify-between pt-3">
          <span className="text-small text-gray-400">
            Renews {formatOrderDate(room.renewsAt)}
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-gray-400 transition-colors group-hover:text-primary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}
