import { Check, Inbox, Loader2, RotateCcw } from 'lucide-react';

import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { AdminLead } from './queries';

/*
 * The leads queue — two presentations of one list, the same table ⇄ card split
 * every other admin list uses. There is no detail screen: the whole record
 * (name, email, message) is short enough to read in the row, and working a lead
 * means calling or emailing it outside this system, not replying here.
 */

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <Inbox className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {hasFilter ? 'Nothing matches this view' : 'No open leads'}
      </p>
      <p className="max-w-[23.75rem] text-body text-gray-500">
        {hasFilter
          ? 'Try another status.'
          : 'Submissions from the marketing site’s contact form land here.'}
      </p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3 p-4 md:p-card" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-14 w-full animate-pulse rounded-input bg-gray-200" />
      ))}
    </div>
  );
}

type LeadsTableProps = {
  rows: AdminLead[];
  isLoading?: boolean;
  hasFilter: boolean;
  onToggleHandled: (lead: AdminLead) => void;
  pendingId?: string;
};

function HandledButton({
  lead,
  onToggleHandled,
  pending,
}: {
  lead: AdminLead;
  onToggleHandled: (lead: AdminLead) => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggleHandled(lead)}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-[0.625rem] border px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors disabled:opacity-60 ${
        lead.handled
          ? 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          : 'border-primary bg-white text-primary hover:bg-primary-light'
      }`}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
      ) : lead.handled ? (
        <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
      )}
      {lead.handled ? 'Reopen' : 'Mark handled'}
    </button>
  );
}

export function LeadsTable({
  rows,
  isLoading,
  hasFilter,
  onToggleHandled,
  pendingId,
}: LeadsTableProps) {
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
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[45rem] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {['From', 'Message', 'Received', ''].map((heading, index) => (
                <th
                  key={heading || index}
                  scope="col"
                  className={`px-card py-3 text-caption font-semibold uppercase tracking-[0.4px] text-gray-500 ${
                    index === 3 ? 'text-right' : 'text-left'
                  }`}
                >
                  {heading || <span className="sr-only">Actions</span>}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                <td className="px-card py-4 align-top">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body font-semibold text-text">{row.name}</span>
                    <a
                      href={`mailto:${row.email}`}
                      className="text-caption text-primary underline-offset-2 hover:underline"
                    >
                      {row.email}
                    </a>
                  </span>
                </td>

                <td className="max-w-[24rem] px-card py-4 align-top">
                  <p className="line-clamp-2 text-body text-text">{row.message}</p>
                </td>

                <td className="px-card py-4 align-top">
                  <span className="text-caption text-gray-500">
                    {formatActivityTime(row.createdAt)}
                  </span>
                </td>

                <td className="px-card py-4 text-right align-top">
                  <HandledButton
                    lead={row}
                    onToggleHandled={onToggleHandled}
                    pending={pendingId === row.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- Cards: mobile ------------------------------------------------- */}
      <ul className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-b-0">
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold text-text">{row.name}</span>
                <a
                  href={`mailto:${row.email}`}
                  className="text-caption text-primary underline-offset-2 hover:underline"
                >
                  {row.email}
                </a>
              </span>
              <span className="shrink-0 text-caption text-gray-500">
                {formatOrderDate(row.createdAt)}
              </span>
            </span>

            <p className="line-clamp-3 text-body text-text">{row.message}</p>

            <HandledButton
              lead={row}
              onToggleHandled={onToggleHandled}
              pending={pendingId === row.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
