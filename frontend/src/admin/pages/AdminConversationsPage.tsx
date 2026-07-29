import { Link } from 'react-router-dom';
import { Inbox, MessagesSquare } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import { useMyConversations } from '../features/conversations/queries';
import { useAdminShell } from '../hooks/useAdminShell';
import { formatActivityTime } from '../lib/format';
import type { StaffConversationRow } from '../types/conversations';

/*
 * "My conversations" — the order threads this staff member is responsible for.
 *
 * This screen exists because of the assignee lock. A support thread is found by
 * opening the shared inbox and claiming from it; an order conversation cannot be,
 * because only its assignee may see it. Without a list scoped to "orders assigned
 * to me", a customer's message would sit unread until its assignee happened to
 * reopen the order — so the work has to be handed to them.
 *
 * Sorted with the threads waiting on a reply first: the list is a work queue, and
 * a customer we have not answered outranks one we have. Each row opens the order,
 * not a standalone thread page, because the conversation only means anything
 * beside the filing it is about.
 *
 * No design source for this screen — it is built to match the support inbox and
 * the orders queue, which is logged as a deviation in the task summary.
 */

function ConversationRow({ row }: { row: StaffConversationRow }) {
  return (
    <li>
      <Link
        to={row.to}
        className="flex w-full items-start gap-3 rounded-input border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 md:items-center"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-small font-semibold text-gray-600"
        >
          {row.customerInitials}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-body font-semibold text-text">
              {row.customerName}
            </p>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase leading-none text-gray-500">
              {row.orderReference}
            </span>
            {row.awaitingReply ? (
              <span className="shrink-0 rounded bg-[#fef3c7] px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase leading-none text-[#b45309]">
                Awaiting reply
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-small text-gray-400">
              {formatActivityTime(row.lastMessageAt)}
            </span>
          </div>

          <p className="truncate text-small text-gray-500">{row.preview}</p>
        </div>
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-gray-200 bg-white py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100">
        <MessagesSquare
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body font-medium text-text">No conversations yet</p>
      <p className="max-w-[23.75rem] text-small text-gray-500">
        When a customer messages you about an order assigned to you, the thread
        appears here.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="h-[4.75rem] w-full animate-pulse rounded-input bg-gray-200"
        />
      ))}
    </div>
  );
}

export function AdminConversationsPage() {
  const { user, onLogout } = useAdminShell();
  const { data, isLoading } = useMyConversations();

  const rows = data?.conversations ?? [];
  const awaiting = data?.awaitingCount ?? 0;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[62.5rem] flex-col gap-5 md:gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-h4 font-semibold text-text">My conversations</h1>
              {awaiting > 0 ? (
                <span className="rounded-full bg-[#fef3c7] px-2.5 py-1 text-small font-semibold text-[#b45309]">
                  {awaiting} awaiting reply
                </span>
              ) : null}
            </div>
            <p className="text-body text-text-secondary">
              Threads on orders assigned to you. General help requests live in the{' '}
              <Link to="/admin/support" className="font-medium text-primary hover:underline">
                <Inbox className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                Support inbox
              </Link>
              .
            </p>
          </header>

          {isLoading ? (
            <ListSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <ConversationRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
