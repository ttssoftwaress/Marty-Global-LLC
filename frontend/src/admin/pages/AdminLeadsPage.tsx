import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { AdminLayout } from '../components/AdminLayout';
import { ConfirmDeleteDialog } from '../components/ConfirmDeleteDialog';
import { SelectionBar } from '../components/SelectionBar';
import { LeadsTable, useAdminLeads, useSetLeadHandled } from '../features/leads';
import type { AdminLead, AdminLeadStatus } from '../features/leads';
import { useBulkDelete } from '../features/trash';
import { useAdminShell } from '../hooks/useAdminShell';

/*
 * The marketing contact form's queue — read-only submissions the team works
 * outside this system (a call or an email), with `handledAt` as the only state
 * a lead carries. No detail screen: name, email, and message all fit in the row.
 *
 * Rows can be selected and deleted in bulk. A lead is the one record here with
 * no downstream consequence to a delete — nothing references it, and a queue of
 * spam submissions is exactly what a bulk delete is for — so it is the plainest
 * use of the shared machinery: `useBulkDelete` owns the selection, the
 * confirmation, and the mutation, and the rows land in Trash like everything
 * else (`modules/admin/trash`).
 */

const STATUS_TABS: { value: AdminLeadStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'handled', label: 'Handled' },
  { value: 'all', label: 'All' },
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
      <p className="text-body-lg font-semibold text-text">We couldn&apos;t load the leads</p>
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

export function AdminLeadsPage() {
  const shell = useAdminShell();
  const [status, setStatus] = useState<AdminLeadStatus>('open');

  const query = useAdminLeads(status);
  const setHandled = useSetLeadHandled();
  const [pendingId, setPendingId] = useState<string>();

  const rows = useMemo(
    () => query.data?.pages.flatMap((page) => page.leads) ?? [],
    [query.data],
  );

  const openCount = query.data?.pages[0]?.openCount ?? 0;

  // Keyed on the status tab: ticking three open leads and switching to
  // "Handled" must not leave the delete armed with rows nobody can see.
  const bulk = useBulkDelete({
    entityType: 'lead',
    visibleIds: rows.map((row) => row.id),
    resetKey: status,
  });

  const toggleHandled = (lead: AdminLead) => {
    setPendingId(lead.id);
    setHandled.mutate(
      { id: lead.id, handled: !lead.handled },
      { onSettled: () => setPendingId(undefined) },
    );
  };

  return (
    <AdminLayout {...shell}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          <header className="flex flex-col gap-1 md:gap-1.5">
            <h1 className="text-h4 font-semibold text-text md:text-h3">Leads</h1>
            <p className="text-body text-text-secondary">
              Submissions from the marketing site&apos;s contact form.{' '}
              {openCount > 0 ? `${openCount} open.` : ''}
            </p>
          </header>

          <div
            role="tablist"
            aria-label="Filter by status"
            className="flex w-fit items-center gap-1 overflow-x-auto rounded-input bg-gray-100 p-1"
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

          {query.isError ? (
            <QueueError onRetry={() => void query.refetch()} />
          ) : (
            <>
              <SelectionBar
                count={bulk.selection.count}
                noun="leads"
                singularNoun="lead"
                onDelete={bulk.openDialog}
                onClear={bulk.selection.clear}
                isDeleting={bulk.isDeleting}
              />

              <LeadsTable
                rows={rows}
                isLoading={query.isLoading}
                hasFilter={status !== 'open'}
                onToggleHandled={toggleHandled}
                pendingId={pendingId}
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
        singularNoun="lead"
        pluralNoun="leads"
        retentionDays={bulk.retentionDays}
        isDeleting={bulk.isDeleting}
        error={bulk.error}
        onConfirm={bulk.confirm}
        onClose={bulk.closeDialog}
      />
    </AdminLayout>
  );
}
