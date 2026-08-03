import { ChevronRight, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { AdminRequestRow } from '../../types/delivery';
import { RequestStatusChip } from './RequestStatusChip';

/*
 * The follow-up queue — two presentations of one list, swapped by breakpoint
 * (the same table ⇄ card split every other admin list uses).
 *
 * Ordered oldest-first by the backend, because this is a backlog: newest-first
 * would let the oldest ticket sink out of sight forever, which is exactly the
 * failure a request queue exists to prevent.
 */

const requestHref = (requestId: string) => `/admin/requests/${requestId}`;

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-caption font-semibold text-primary"
    >
      {initials}
    </span>
  );
}

function Unassigned() {
  return (
    <span className="whitespace-nowrap text-[color:var(--color-status-review-text)]">
      Unassigned
    </span>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <Inbox
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {hasFilter ? 'Nothing matches this view' : 'No open requests'}
      </p>
      <p className="max-w-[23.75rem] text-body text-gray-500">
        {hasFilter
          ? 'Try another status or assignee, or clear your search.'
          : 'Follow-up requests customers raise against a delivered service land here.'}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-12 w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

type RequestQueueTableProps = {
  rows: AdminRequestRow[];
  isLoading?: boolean;
  hasFilter: boolean;
};

export function RequestQueueTable({
  rows,
  isLoading,
  hasFilter,
}: RequestQueueTableProps) {
  if (isLoading) {
    return (
      <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
        <SkeletonRows />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
        <EmptyState hasFilter={hasFilter} />
      </div>
    );
  }

  return (
    <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation">
      {/* --- Table: tablet and up ------------------------------------------ */}
      <div className="table-scroll hidden md:block">
        <table className="data-table min-w-[45rem]">
          <thead>
            <tr>
              {['Request', 'Record', 'Customer', 'Assignee', 'Status', ''].map(
                (heading, index) => (
                  <th
                    key={heading || index}
                    scope="col"
                    className={`px-card ${index === 5 ? 'text-right' : ''} ${
                      index === 3 ? 'hidden lg:table-cell' : ''
                    }`}
                  >
                    {heading || <span className="sr-only">Open</span>}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-card py-4 align-top">
                  <Link
                    to={requestHref(row.id)}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="font-semibold">{row.typeLabel}</span>
                    <span className="text-caption text-gray-500">
                      {row.reference} · {formatActivityTime(row.createdAt)}
                    </span>
                  </Link>
                </td>

                <td className="px-card py-4 align-top">
                  <span className="flex flex-col gap-0.5">
                    <span>{row.resultTitle}</span>
                    <span className="text-caption text-gray-500">
                      {row.serviceName}
                    </span>
                  </span>
                </td>

                <td className="px-card py-4 align-top">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar initials={row.customer.initials} />
                    <span className="min-w-0 truncate">
                      {row.customer.name}
                    </span>
                  </span>
                </td>

                <td className="hidden px-card py-4 align-top lg:table-cell">
                  {row.assignee ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar initials={row.assignee.initials} />
                      <span className="min-w-0 truncate">
                        {row.assignee.name}
                      </span>
                    </span>
                  ) : (
                    <Unassigned />
                  )}
                </td>

                <td className="px-card py-4 align-top">
                  <RequestStatusChip status={row.status} />
                </td>

                <td className="px-card py-4 text-right align-top">
                  <Link
                    to={requestHref(row.id)}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-[0.625rem] border border-primary bg-white px-4 py-2 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Cards: mobile ------------------------------------------------- */}
      <ul className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="border-b border-gray-100 last:border-b-0">
            <Link
              to={requestHref(row.id)}
              className="flex flex-col gap-3 p-4 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body font-semibold text-text">
                    {row.typeLabel}
                  </span>
                  <span className="text-caption text-gray-500">
                    {row.reference}
                  </span>
                </span>
                <ChevronRight
                  className="mt-0.5 size-5 shrink-0 text-gray-400"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </span>

              <span className="flex flex-col gap-1">
                <span className="text-body text-text">{row.resultTitle}</span>
                <span className="text-caption text-gray-500">
                  {row.serviceName}
                </span>
              </span>

              <span className="flex flex-wrap items-center justify-between gap-2">
                <RequestStatusChip status={row.status} />
                <span className="flex items-center gap-2">
                  <Avatar initials={row.customer.initials} />
                  <span className="text-caption text-gray-500">
                    {row.customer.name}
                  </span>
                </span>
              </span>

              <span className="flex flex-wrap items-center justify-between gap-2 text-caption text-gray-500">
                <span>{row.assignee ? row.assignee.name : 'Unassigned'}</span>
                <span>{formatOrderDate(row.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
