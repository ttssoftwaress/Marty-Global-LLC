import { Mail, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { MailRoom } from '../../types/mailroom';
import { MailRoomCard } from './MailRoomCard';

/*
 * "Your mail rooms" — the section heading, the Add-new-room action, and the
 * room grid. One tree covers all three viewports:
 *   - the heading + button share a row from tablet up (button right-aligned);
 *     on mobile the button lifts above the heading and goes full-width
 *     (flex-col-reverse), matching the mobile link's stacking
 *   - the grid is one column on mobile, two on tablet, three on desktop
 *
 * The design shows a populated grid; the empty state is added so a customer
 * with no rooms yet gets a clear next step instead of a bare gap.
 */

// A mail room is bought like any other service, so there is no wizard of its
// own: both Add-new-room actions drop the customer into the order flow.
const NEW_ROOM_ROUTE = '/app/order';

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-primary-light">
        <Mail className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">No mail rooms yet</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
        Add a virtual mail room to start receiving and managing scanned mail.
      </p>
      <Link
        to={NEW_ROOM_ROUTE}
        className="btn btn-primary mt-1 h-11 rounded-input px-5 text-body"
      >
        <Plus className="mr-2 size-[1.125rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Add new room
      </Link>
    </div>
  );
}

export function MailRoomSection({ rooms }: { rooms: MailRoom[] }) {
  const isEmpty = rooms.length === 0;

  return (
    <section className="flex w-full flex-col gap-4 md:gap-6 lg:gap-8">
      <div className="flex flex-col-reverse gap-6 md:flex-row md:items-center md:justify-between md:gap-4">
        <h2 className="text-h6 font-semibold text-text md:text-h4">Your mail rooms</h2>
        <Link
          to={NEW_ROOM_ROUTE}
          className="btn btn-primary w-full md:h-10 md:w-auto md:px-4 md:text-[0.875rem] lg:h-input lg:px-6 lg:text-button"
        >
          <Plus
            className="mr-2 size-5 shrink-0 md:size-4 lg:size-5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          Add new room
        </Link>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {rooms.map((room) => (
            <MailRoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </section>
  );
}
