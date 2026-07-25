import { useMemo, useState } from 'react';

import { AdminLayout } from '../components/AdminLayout';
import {
  MailLogPanel,
  MailOpsComingSoonPanel,
  MailOpsFindCustomer,
  MailOpsHeader,
  MailOpsKpiCards,
  MailOpsRecentUploads,
  MailOpsTabs,
  MailRequestDetailOverlay,
  MailRequestsPanel,
  MailScanDetailsForm,
  useAdminMailOpsCustomerSearch,
  useAdminMailOpsRecentUploads,
  useAdminMailOpsSummary,
  useUploadMailScan,
} from '../features/mailroom';
import { useAdminShell } from '../hooks/useAdminShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type {
  MailOpsCustomer,
  MailOpsTab,
  MailScanAttachment,
} from '../types/mailroom';

/*
 * Virtual mail room — operations. The admin screen for filing scanned mail into
 * customer inboxes and working the forwarding / shredding queues.
 *
 * The section order is the same at every width — header, KPI cards, tabs, then
 * the section itself — so one tree covers all three links. What changes is the
 * body:
 *   - desktop (lg): the form column and the "Recently uploaded" rail sit side by
 *     side, the rail fixed at 380px; the first form row pairs Sender name and
 *     Date received
 *   - tablet (md):  the rail drops beneath the form as a full-width card, and
 *     the tab pills stretch to share the row
 *   - mobile:       the same stack at a tighter scale, and the submit button
 *     leaves the form card for a sticky bottom bar
 *
 * Every figure and row comes from the API; nothing on this page is hardcoded
 * business data. Three queries back it (endpoints land with the `mailroom`
 * module): the summary for the KPI cards and the tab counts, the customer
 * search behind the picker, and an infinite query for the recent feed.
 *
 * "Upload mail" and "Pending requests" are designed. The other two tabs are
 * real — they carry the backlog counts the summary returns — but their screens
 * render a placeholder rather than an invented layout (Design.md).
 */

const SEARCH_DEBOUNCE_MS = 300;
const SCAN_FORM_ID = 'mail-scan-form';

const COMING_SOON: Record<
  Exclude<MailOpsTab, 'upload' | 'pending' | 'log'>,
  { title: string; description: string }
> = {
  settings: {
    title: 'Settings',
    description:
      'Mail room handling rules, retention windows, and forwarding defaults will be configured here.',
  },
};

function MailOpsSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4 lg:flex-row lg:gap-card"
      aria-hidden="true"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-card">
        <div className="h-[132px] w-full animate-pulse rounded-card bg-gray-200" />
        <div className="h-[460px] w-full animate-pulse rounded-card bg-gray-200" />
      </div>
      <div className="h-[360px] w-full animate-pulse rounded-card bg-gray-200 lg:w-[380px] lg:shrink-0" />
    </div>
  );
}

export function AdminVirtualMailOpsPage() {
  const { user, onLogout } = useAdminShell();

  const [tab, setTab] = useState<MailOpsTab>('upload');

  /*
   * The request open in the slide-over, held as an id rather than the row: the
   * overlay fetches the full detail itself, so the page never carries a stale
   * copy of a request the queue has since refetched.
   */
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  // The customer picker. `selected` is what the form files against; `search` is
  // what the operator has typed, debounced into the server-side query.
  const [selected, setSelected] = useState<MailOpsCustomer | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // The scan form.
  const [sender, setSender] = useState('');
  const [receivedOn, setReceivedOn] = useState('');
  const [notes, setNotes] = useState('');
  const [scan, setScan] = useState<{ file: File; meta: MailScanAttachment } | null>(
    null,
  );

  const summary = useAdminMailOpsSummary();
  const customerSearch = useAdminMailOpsCustomerSearch(debouncedSearch);
  const recent = useAdminMailOpsRecentUploads();
  const uploadScan = useUploadMailScan();

  const uploads = useMemo(
    () => recent.data?.pages.flatMap((page) => page.uploads) ?? [],
    [recent.data],
  );

  const onSelectCustomer = (customer: MailOpsCustomer) => {
    setSelected(customer);
    setSearch('');
  };

  const onClearCustomer = () => {
    setSelected(null);
    setSearch('');
  };

  const resetForm = () => {
    setSender('');
    setReceivedOn('');
    setNotes('');
    setScan(null);
  };

  // The submit is only meaningful once every required part is in hand; the
  // backend re-validates all of it (AGENTS.md — the guard is server-side).
  const canSubmit = Boolean(
    selected && sender.trim() && receivedOn && scan && !uploadScan.isPending,
  );

  /*
   * Filing a scan is two steps: the file goes to R2 through the storage service
   * and the resulting object key is what the API is sent (AGENTS.md, Storage —
   * the bytes never round-trip through the API process). `services/upload.ts`
   * lands with that module, so the key is threaded through here and the upload
   * call slots in ahead of the mutation without the form changing.
   */
  const onSubmit = () => {
    if (!selected || !scan) return;

    uploadScan.mutate(
      {
        customerId: selected.id,
        sender: sender.trim(),
        receivedOn,
        scanKey: scan.meta.name,
        notes: notes.trim() || undefined,
      },
      { onSuccess: resetForm },
    );
  };

  const isLoading = summary.isPending || recent.isPending;

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      {/*
       * Mobile's extra bottom padding clears the fixed submit bar below, so it
       * is only applied on the section that renders that bar.
       */}
      <div
        className={`w-full p-4 md:p-6 md:pb-8 lg:p-content ${
          tab === 'upload' ? 'pb-[120px]' : 'pb-8'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 md:gap-card">
          <MailOpsHeader />

          {summary.data ? <MailOpsKpiCards kpis={summary.data.kpis} /> : null}

          <MailOpsTabs value={tab} onChange={setTab} tabs={summary.data?.tabs} />

          {tab === 'upload' ? (
            <div
              role="tabpanel"
              id="mail-ops-panel-upload"
              aria-labelledby="mail-ops-tab-upload"
              className="w-full"
            >
              {isLoading ? (
                <MailOpsSkeleton />
              ) : (
                /*
                 * Desktop sets the form column against a fixed 380px rail; the
                 * narrower links stack the rail beneath the form as a card.
                 */
                <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-card">
                  <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-card">
                    <MailOpsFindCustomer
                      selected={selected}
                      search={search}
                      onSearchChange={setSearch}
                      results={customerSearch.data ?? []}
                      isSearching={customerSearch.isFetching}
                      hasSearched={debouncedSearch.trim().length > 1}
                      onSelect={onSelectCustomer}
                      onClear={onClearCustomer}
                    />

                    <MailScanDetailsForm
                      sender={sender}
                      onSenderChange={setSender}
                      receivedOn={receivedOn}
                      onReceivedOnChange={setReceivedOn}
                      notes={notes}
                      onNotesChange={setNotes}
                      file={scan?.meta ?? null}
                      onFileSelect={(file) =>
                        setScan({
                          file,
                          meta: { name: file.name, size: file.size },
                        })
                      }
                      onFileRemove={() => setScan(null)}
                      formId={SCAN_FORM_ID}
                      canSubmit={canSubmit}
                      isSubmitting={uploadScan.isPending}
                      errorMessage={
                        uploadScan.isError
                          ? 'That scan could not be filed. Try again.'
                          : null
                      }
                      onSubmit={onSubmit}
                    />
                  </div>

                  <div className="w-full lg:w-[380px] lg:shrink-0">
                    <MailOpsRecentUploads
                      uploads={uploads}
                      isLoading={recent.isPending}
                      hasMore={Boolean(recent.hasNextPage)}
                      isLoadingMore={recent.isFetchingNextPage}
                      onLoadMore={() => {
                        if (recent.hasNextPage) void recent.fetchNextPage();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'pending' ? (
            <div
              role="tabpanel"
              id="mail-ops-panel-pending"
              aria-labelledby="mail-ops-tab-pending"
              className="w-full"
            >
              <MailRequestsPanel
                onView={(request) => setOpenRequestId(request.id)}
              />
            </div>
          ) : tab === 'log' ? (
            <div
              role="tabpanel"
              id="mail-ops-panel-log"
              aria-labelledby="mail-ops-tab-log"
              className="w-full"
            >
              {/*
               * Opening a logged item's detail view lands with the same module;
               * the row's "View" is wired to it here so the log does not have to
               * change when that screen exists.
               */}
              <MailLogPanel onView={() => undefined} />
            </div>
          ) : (
            <div
              role="tabpanel"
              id={`mail-ops-panel-${tab}`}
              aria-labelledby={`mail-ops-tab-${tab}`}
              className="w-full"
            >
              <MailOpsComingSoonPanel {...COMING_SOON[tab]} />
            </div>
          )}
        </div>
      </div>

      {/*
       * Mobile's submit, in the sticky bar its link draws. Fixed over the
       * workspace — the same treatment the catalog detail screen's footer uses
       * — so it stays reachable down a long form. It submits the form by id
       * rather than duplicating the handler, so the button outside the form and
       * the one inside it run exactly the same path.
       */}
      {tab === 'upload' && !isLoading ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white p-4 shadow-footer-raised md:hidden">
          <button
            type="submit"
            form={SCAN_FORM_ID}
            disabled={!canSubmit}
            className="btn btn-primary w-full disabled:cursor-default disabled:bg-gray-300 disabled:hover:bg-gray-300"
          >
            {uploadScan.isPending ? 'Adding…' : 'Add to customer inbox'}
          </button>
        </div>
      ) : null}

      {/*
       * The pending queue's detail panel — a slide-over from the right from `md`
       * up, a bottom sheet on mobile. Rendered at the layout's level rather than
       * inside the tab panel so it overlays the whole workspace.
       */}
      <MailRequestDetailOverlay
        requestId={openRequestId}
        onClose={() => setOpenRequestId(null)}
      />
    </AdminLayout>
  );
}
