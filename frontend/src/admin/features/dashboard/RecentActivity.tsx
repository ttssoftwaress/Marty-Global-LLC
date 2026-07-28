import {
  Check,
  DollarSign,
  FilePlus,
  Send,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatActivityTime, formatActivityTimeShort } from '../../lib/format';
import type { ActivityKind, DashboardActivity } from '../../types/dashboard';

/*
 * Recent activity — what has happened across the business, newest first. Each
 * row is a tinted icon chip, the event sentence, and a relative timestamp.
 *
 * Desktop and tablet keep the timestamp on the row's trailing edge; mobile
 * stacks it under the message, which is what its link shows — the copy wraps to
 * two lines at that width and a trailing stamp would squeeze it further.
 *
 * A row links to the record it describes when the backend supplies one, so the
 * feed is a way into the work rather than a read-only log; rows without a target
 * render as plain list items.
 */

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  application: FilePlus,
  payment: Check,
  document: Upload,
  approval: Check,
  quote: DollarSign,
  mail: Send,
};

const KIND_CHIP: Record<ActivityKind, string> = {
  application: 'bg-[#e0f2fe] text-info',
  payment: 'bg-[var(--color-status-approved-bg)] text-success',
  document: 'bg-primary-light text-primary',
  approval: 'bg-[var(--color-status-approved-bg)] text-success',
  quote: 'bg-[var(--color-status-review-bg)] text-[var(--color-status-review-text)]',
  mail: 'bg-primary-light text-primary',
};

function ActivityRow({ item }: { item: DashboardActivity }) {
  const Icon = KIND_ICON[item.kind];

  const body = (
    <>
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-pill ${KIND_CHIP[item.kind]}`}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5 md:flex-row md:items-center md:gap-4">
        <span className="min-w-0 flex-1 text-[0.8125rem] leading-[1.3] text-text md:text-[0.875rem] md:leading-5">
          {item.message}
        </span>

        {/* One timestamp element per row — the wording is what changes by width. */}
        <span className="shrink-0 text-[0.6875rem] leading-4 text-gray-400 md:text-[0.75rem]">
          <span className="lg:hidden">{formatActivityTimeShort(item.occurredAt)}</span>
          <span className="hidden lg:inline">{formatActivityTime(item.occurredAt)}</span>
        </span>
      </span>
    </>
  );

  return (
    <li className="border-b border-gray-200 last:border-b-0">
      {item.to ? (
        <Link
          to={item.to}
          className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50 md:gap-4 md:px-0 md:py-3 lg:p-4"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 p-3 md:gap-4 md:px-0 md:py-3 lg:p-4">
          {body}
        </div>
      )}
    </li>
  );
}

export function RecentActivity({ activity }: { activity: DashboardActivity[] }) {
  return (
    <section className="flex w-full min-w-0 flex-col gap-2.5 md:gap-0">
      <h2 className="text-[0.875rem] font-semibold leading-5 text-gray-700 md:hidden">
        Recent activity
      </h2>

      <div className="flex w-full min-w-0 flex-col gap-2 rounded-card border border-gray-200 bg-white p-2 shadow-sm-elevation md:gap-4 md:p-card">
        <h2 className="hidden text-[1.125rem] font-semibold leading-6 text-text md:block">
          Recent activity
        </h2>

        {activity.length === 0 ? (
          <p className="p-3 text-[0.875rem] leading-5 text-gray-500 md:p-0">
            No activity in this period yet.
          </p>
        ) : (
          <>
            <ul className="flex w-full flex-col">
              {activity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </ul>

            <div className="flex w-full justify-center py-3 md:pt-2">
              <Link
                to="/admin/reports"
                className="text-[0.875rem] font-semibold leading-5 text-primary transition-colors hover:text-primary-hover md:font-medium"
              >
                View all activity
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
