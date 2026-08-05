import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { SelectionBar } from '../components/SelectionBar';
import {
  RequestQueueTable,
  useAdminRequests,
  type RequestQueueFilters,
} from '../features/delivery';
import { useBulkDelete } from '../features/trash';
import { useAdminShell } from '../hooks/useAdminShell';
import { REQUEST_STATUS_OPTIONS } from '../types/delivery';

/*
 * The service-requests queue — the follow-ups customers raise against a
 * delivered record.
 *
 * A section of its own rather than a tab on the orders queue, because it is a
 * different job: an order is worked once, priced, and filed, while a request is
 * small after-sales work against something already delivered. The backend gates
 * it on its own `requests` area for the same reason, so a support agent can work
 * this queue without ever touching the filing pipeline.
 *
 * Scoping is the backend's: a member without `requests.all` sees their own plus
 * the unclaimed backlog, which is what makes the queue something they can
 * actually pick work up from.
 */

const STATUS_TABS: { value: RequestQueueFilters['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  ...REQUEST_STATUS_OPTIONS.map((option) => ({
    value: option.value as RequestQueueFilters['status'],
    label: option.label,
  })),
];

const ASSIGNEE_TABS: { value: RequestQueueFilters['assignee']; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'me', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
];

function QueueError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-14 text-center shadow-sm-elevation"
    >
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t load the queue</p>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-secondary mt-1 h-11 rounded-input px-5 text-body"
      >
        Try again
      </button>
    </div>
  );
}

export function AdminRequestsPage() {
  const shell = useAdminShell();

  const [status, setStatus] = useState<RequestQueueFilters['status']>('all');
  const [assignee, setAssignee] = useState<RequestQueueFilters['assignee']>('all');
  const [search, setSearch] = useState('');

  const query = useAdminRequests({ status, assignee, search });

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.rows) ?? [],
    [query.data],
  );

  const total = query.data?.pages[0]?.totalResults ?? 0;
  const hasFilter = status !== 'all' || assignee !== 'all' || search.trim().length > 0;

  const bulk = useBulkDelete({
    entityType: 'service-request',
    visibleIds: rows.map((row) => row.id),
    resetKey: `${status}|${assignee}|${search}`,
  });

  return (
    <AdminLayout {...shell}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          <header className="flex flex-col gap-1 md:gap-1.5">
            <h1 className="text-h4 font-semibold text-text md:text-h3">
              Service requests
            </h1>
            <p className="text-body text-text-secondary">
              Follow-ups customers have raised against a delivered service.
            </p>
          </header>

          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div
                role="tablist"
                aria-label="Filter by status"
                className="flex items-center gap-1 overflow-x-auto rounded-input bg-gray-100 p-1"
              >
                {STATUS_TABS.map((tab) => {
                  const active = tab.value === status;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatus(tab.value)}
                      className={`whitespace-nowrap rounded-[0.5rem] px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors ${
                        active
                          ? 'bg-white text-text shadow-sm-elevation'
                          : 'text-gray-500 hover:text-text'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <label className="relative flex w-full items-center lg:w-[17.5rem]">
                <span className="sr-only">Search requests</span>
                <Search
                  className="pointer-events-none absolute left-3 size-4 text-gray-400"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by reference or record"
                  className="h-11 w-full rounded-input border border-gray-200 bg-white pl-9 pr-3 text-body text-text placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ASSIGNEE_TABS.map((tab) => {
                const active = tab.value === assignee;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setAssignee(tab.value)}
                    className={`rounded-pill border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-gray-200 bg-white text-gray-500 hover:text-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}

              <span className="ml-auto text-body text-gray-500">
                {total} request{total === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {query.isError ? (
            <QueueError onRetry={() => void query.refetch()} />
          ) : (
            <>
              <SelectionBar
                count={bulk.selection.count}
                noun="requests"
                singularNoun="request"
                onDelete={bulk.openDialog}
                onClear={bulk.selection.clear}
                isDeleting={bulk.isDeleting}
              />

              <RequestQueueTable
                rows={rows}
                isLoading={query.isLoading}
                hasFilter={hasFilter}
                selection={bulk.selection}
                selectable={bulk.canDelete}
              />

              {query.hasNextPage ? (
                <button
                  type="button"
                  onClick={() => void query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  className="btn btn-secondary mx-auto inline-flex h-11 items-center gap-2 rounded-input px-6 text-body disabled:opacity-60"
                >
                  {query.isFetchingNextPage ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  Load more
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={bulk.isDialogOpen}
        count={bulk.selection.count}
        singularNoun="request"
        pluralNoun="requests"
        retentionDays={bulk.retentionDays}
        isDeleting={bulk.isDeleting}
        error={bulk.error}
        onConfirm={bulk.confirm}
        onClose={bulk.closeDialog}
      />
    </AdminLayout>
  );
}
