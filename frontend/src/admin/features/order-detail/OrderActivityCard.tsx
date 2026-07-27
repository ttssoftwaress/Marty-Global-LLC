import { Lock } from 'lucide-react';

import { useScrollAfterItems } from '@/hooks/useScrollAfterItems';
import { formatActivityTime } from '../../lib/format';
import type { AdminOrderActivityEntry } from '../../types/order-detail';
import { CustomerAvatar } from '../customers/CustomerAvatar';
import { SectionCard } from './SectionCard';

/*
 * Activity — the order's history, and only that. It is a read-only record: what
 * the system and the team did to this order, in the order it happened. Talking
 * to the customer happens in the conversation card directly below, which is the
 * one two-way thread on this screen; a second composer here would have split the
 * same exchange across two places.
 *
 * Two kinds of entry share the feed, and telling them apart is the point of the
 * card. A customer-visible entry is drawn plainly; an internal note is tinted,
 * badged, and carries a lock — so a reviewer can see at a glance which of these
 * the customer has read.
 *
 * The feed only ever grows, so past six entries it scrolls inside the card
 * rather than pushing everything below it off the screen.
 */

const VISIBLE_ENTRIES = 6;

function TeamMonogram() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-small font-bold text-white"
    >
      M
    </span>
  );
}

function ActivityItem({ entry }: { entry: AdminOrderActivityEntry }) {
  const isCustomer = entry.author === 'customer';

  return (
    <li
      className={`flex gap-3 ${
        entry.internal
          ? 'rounded-input border border-[#fde68a] bg-[#fffbeb] p-3'
          : ''
      }`}
    >
      {isCustomer ? (
        <CustomerAvatar id={entry.authorName} initials={entry.initials} />
      ) : (
        <TeamMonogram />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-body font-semibold text-text">{entry.authorName}</p>

          {entry.internal ? (
            <span className="flex items-center gap-1 rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-[#b45309]">
              <Lock className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
              Internal note
            </span>
          ) : isCustomer ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-gray-500">
              Customer
            </span>
          ) : (
            <span className="rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-primary">
              Team
            </span>
          )}

          <span className="ml-auto shrink-0 text-small text-gray-400">
            {formatActivityTime(entry.occurredAt)}
          </span>
        </div>

        <p className="whitespace-pre-line break-words text-body leading-relaxed text-text-secondary">
          {entry.message}
        </p>
      </div>
    </li>
  );
}

type OrderActivityCardProps = {
  activity: AdminOrderActivityEntry[];
};

export function OrderActivityCard({ activity }: OrderActivityCardProps) {
  const { ref, maxHeight } = useScrollAfterItems<HTMLUListElement>(
    activity.length,
    VISIBLE_ENTRIES,
  );

  return (
    <SectionCard title="Activity" className="gap-5">
      {activity.length === 0 ? (
        <p className="text-body text-gray-500">
          Nothing has happened on this order yet.
        </p>
      ) : (
        <ul
          ref={ref}
          style={{ maxHeight }}
          tabIndex={maxHeight === undefined ? undefined : 0}
          className="relative flex flex-col gap-4 overflow-y-auto pr-1"
        >
          {activity.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
