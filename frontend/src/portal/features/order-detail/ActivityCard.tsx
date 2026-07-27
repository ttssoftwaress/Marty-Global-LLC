import { useScrollAfterItems } from '@/hooks/useScrollAfterItems';
import { formatOrderDate } from '../../lib/format';
import type { OrderActivityEntry } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Activity feed — a chronological list of what has happened to the order: status
 * changes, documents filed, updates written by the team. Two author kinds: the
 * Marty Global team (navy "M" monogram + TEAM tag) and the customer (their
 * avatar image).
 *
 * This is the order's record, not a place to talk. The conversation with the
 * assigned specialist is its own card directly below (features/order-conversation)
 * — separating them keeps a two-way thread from being mistaken for the audit
 * trail, and keeps the trail readable once the thread gets long.
 *
 * The trail only ever grows, so past six entries it scrolls inside the card
 * rather than pushing everything below it off the screen.
 */

const VISIBLE_ENTRIES = 6;

function TeamMonogram() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-[12px] bg-primary text-caption font-bold text-white">
      M
    </span>
  );
}

function ActivityItem({ entry }: { entry: OrderActivityEntry }) {
  const isTeam = entry.author === 'team';

  return (
    <li className="flex gap-3">
      {isTeam || !entry.avatarUrl ? (
        <TeamMonogram />
      ) : (
        <img
          src={entry.avatarUrl}
          alt=""
          className="size-6 shrink-0 rounded-[12px] object-cover"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-body font-semibold text-text">
              {entry.authorName}
            </p>
            {isTeam && (
              <span className="rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary">
                TEAM
              </span>
            )}
          </div>
          <p className="shrink-0 text-small text-gray-400">
            {formatOrderDate(entry.occurredAt)}
          </p>
        </div>
        <p className="text-body leading-relaxed text-text-secondary">{entry.message}</p>
      </div>
    </li>
  );
}

type ActivityCardProps = {
  activity: OrderActivityEntry[];
};

export function ActivityCard({ activity }: ActivityCardProps) {
  const { ref, maxHeight } = useScrollAfterItems<HTMLUListElement>(
    activity.length,
    VISIBLE_ENTRIES,
  );

  return (
    <SectionCard title="Activity" className="gap-5 md:gap-6">
      {activity.length === 0 ? (
        <p className="text-body text-gray-500">
          Nothing has happened on this order yet.
        </p>
      ) : (
        <ul
          ref={ref}
          style={{ maxHeight }}
          tabIndex={maxHeight === undefined ? undefined : 0}
          className="relative flex flex-col gap-4 overflow-y-auto pr-1 md:gap-6"
        >
          {activity.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
