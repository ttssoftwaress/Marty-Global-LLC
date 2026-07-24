import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { OrderActivityEntry } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Activity feed — a chronological list of updates on the order. Two author
 * kinds: the Marty Global team (navy "M" monogram + TEAM tag) and the customer
 * (their avatar image). The message text sits under the header, aligned with
 * the name rather than the avatar, matching the desktop link.
 *
 * "Open conversation" routes into the order's support thread — live chat lives
 * in portal/features/support (AGENTS.md), so this is the entry point to it.
 */

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
  conversationHref: string;
};

export function ActivityCard({ activity, conversationHref }: ActivityCardProps) {
  return (
    <SectionCard title="Activity" className="gap-5 md:gap-6">
      <ul className="flex flex-col gap-4 md:gap-6">
        {activity.map((entry) => (
          <ActivityItem key={entry.id} entry={entry} />
        ))}
      </ul>

      <Link
        to={conversationHref}
        className="btn btn-secondary h-input w-full rounded-input text-button"
      >
        Open conversation
      </Link>
    </SectionCard>
  );
}
