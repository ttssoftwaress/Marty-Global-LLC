import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '@/services/api';

import { PortalLayout } from '../components/PortalLayout';
import {
  InboxControls,
  InboxPagination,
  MailItemSlideOver,
  MailList,
  MailRoomError,
  MailRoomInboxKpiCards,
  useCreateMailRequest,
  useMailItem,
  useMailItems,
  useMailRoomDetail,
  useRecordMailDownload,
} from '../features/mailroom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  MailItem,
  MailRequestType,
  MailRoomTab,
  MailStatusFilter,
} from '../types/mailroom';

/*
 * Mail room inbox — a single virtual mail room's scanned-mail surface: the
 * header (which room, its address), the three headline figures, the view switch
 * (Inbox / Requests / History), the status filter + search, and the mail list.
 *
 * One tree serves all three viewports; the section components own how each part
 * reshapes between breakpoints (KPI 2-up ⇄ 3-up, table ⇄ card stack, dropdown
 * ⇄ pills). The list is an infinite query over the cursor stream (AGENTS.md):
 * mobile "Load more" appends and the whole loaded set stays on screen, desktop
 * Prev/Next steps a page window; status, search, counts, and pagination are the
 * backend's to resolve. All three views render the same list over three scopes
 * of that one stream — everything, what has an open request against it, and what
 * has been closed out — so the tabs differ by copy and query, not by component.
 *
 * Nothing is hardcoded customer data: the room detail and its items come from
 * the backend (endpoints land later, two-apps sync rule), so the screen renders
 * a skeleton until the detail arrives and an empty state once it does.
 */

// Matches the design's window: "Showing 1–6 of 12 items", "Page 1 of 2".
const PAGE_SIZE = 6;

function InboxHeader({ roomName, address }: { roomName: string; address: string }) {
  return (
    <header className="flex w-full flex-col gap-2 md:gap-3">
      {/* Mobile back link — the mobile design opens straight to the title; a
       * back affordance is added to match the rest of the portal. */}
      <Link
        to="/app/mailroom"
        className="flex items-center gap-2 text-body font-medium text-primary md:hidden"
      >
        <ArrowLeft className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Back to mail rooms
      </Link>

      {/* Breadcrumb — tablet & desktop */}
      <p className="hidden items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.6px] md:flex">
        <Link to="/app" className="text-primary hover:underline">
          Dashboard
        </Link>
        <span className="text-gray-400">/</span>
        <Link to="/app/mailroom" className="text-primary hover:underline">
          Virtual mail rooms
        </Link>
        <span className="text-gray-400">/</span>
        <span className="truncate text-gray-500">{roomName}</span>
      </p>

      <div className="flex flex-col gap-1">
        <h1 className="text-h4 font-semibold text-text md:text-h3">{roomName}</h1>
        <p className="text-small text-gray-500 md:text-body md:text-text-secondary">
          {address}
        </p>
      </div>
    </header>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:gap-6">
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="h-24 animate-pulse rounded-card bg-gray-200" />
        <div className="col-span-2 h-24 animate-pulse rounded-card bg-gray-200 md:col-span-1" />
      </div>
      <div className="h-11 w-full animate-pulse rounded-input bg-gray-200" />
      <div className="h-[26.25rem] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

/*
 * What "nothing here" means per tab. The three tabs are one list over three
 * scopes of the same stream, so they share the list component — but an empty
 * Requests tab means nothing is outstanding, which is the opposite of what an
 * empty Inbox means.
 */
const EMPTY_COPY: Record<MailRoomTab, { title: string; body: string }> = {
  inbox: {
    title: 'No mail here yet',
    body: 'Nothing matches this view. Try another status, clear your search, or check back once new mail arrives.',
  },
  requests: {
    title: 'Nothing outstanding',
    body: 'Scanning, forwarding, and shredding requests you have made appear here until we settle them.',
  },
  history: {
    title: 'No history yet',
    body: 'Mail we have forwarded, shredded, or that you have downloaded appears here once it is closed out.',
  },
};

export function MailRoomInboxPage() {
  const { user, onLogout } = usePortalShell();
  const { roomId = '', itemId } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<MailRoomTab>('inbox');
  const [status, setStatus] = useState<MailStatusFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const detail = useMailRoomDetail(roomId);
  const items = useMailItems({ roomId, tab, status, search: debouncedSearch });

  // Desktop page window into the loaded items. Reset to the first page whenever
  // the filters change, since the result set is different.
  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    setPageIndex(0);
  }, [tab, status, debouncedSearch]);

  const loadedItems = useMemo<MailItem[]>(
    () => items.data?.pages.flatMap((page) => page.items) ?? [],
    [items.data],
  );

  const totalItems = items.data?.pages[0]?.totalItems ?? 0;
  const totalPages = items.data?.pages[0]?.totalPages ?? 1;

  const goPrev = () => setPageIndex((index) => Math.max(0, index - 1));
  const goNext = () => {
    const nextIndex = pageIndex + 1;
    // Fetch the next page if the window isn't loaded yet but more remain.
    if (nextIndex * PAGE_SIZE >= loadedItems.length && items.hasNextPage) {
      void items.fetchNextPage();
    }
    if (nextIndex < totalPages) setPageIndex(nextIndex);
  };
  const onLoadMore = () => {
    if (items.hasNextPage) void items.fetchNextPage();
  };

  // Mobile appends the whole loaded set, so its "Load more" tracks the cursor
  // stream; desktop's Prev/Next tracks the page window (page vs totalPages).
  const canLoadMore = Boolean(items.hasNextPage);
  // Split loading from failure: folding `!room` into the skeleton left an errored
  // fetch (isLoading false, data undefined) showing a skeleton forever with no
  // retry, the same trap MailRoomPage already avoids.
  const room = detail.data;
  const showSkeleton = detail.isLoading;
  const showError = !detail.isLoading && (detail.isError || !room);

  // The item slide-over is route-driven (/app/mailroom/:roomId/:itemId), so an
  // open item deep-links and Back returns to the list. The detail fetch brings
  // the scan pages; the list copy fills the header while it resolves.
  const openedItem = useMailItem(roomId, itemId ?? '');
  const listItem = itemId
    ? loadedItems.find((candidate) => candidate.id === itemId)
    : undefined;
  // The list copy carries no scan pages by design, so it fills the header while
  // the detail resolves — but merging it under the detail would leave the list's
  // stale status/scanReady masking the fresh ones once they land.
  const slideOverItem = openedItem.data ?? listItem;
  const scanError = openedItem.isError;
  const openIndex = itemId
    ? loadedItems.findIndex((candidate) => candidate.id === itemId)
    : -1;

  /*
   * Asking us to scan, forward, or shred a piece of mail. The backend resolves
   * the forwarding address from the customer's own company record, so the
   * payload carries only the intent — and a customer with no address on file
   * gets a business-rule message back, which belongs beside the button rather
   * than in a toast that scrolls away.
   */
  const createRequest = useCreateMailRequest(roomId);
  const recordDownload = useRecordMailDownload(roomId);

  const requestError =
    createRequest.error instanceof ApiError ? createRequest.error.message : null;

  const requestHandling = (type: MailRequestType) => {
    if (!itemId) return;
    createRequest.mutate({ itemId, type });
  };

  /*
   * The list's own Scan button, for an item that is not open in the viewer. It
   * is the same mutation the viewer submits — one path, one set of
   * invalidations — and the pending item id is tracked so only the row that was
   * pressed shows as in flight.
   */
  const [scanningItemId, setScanningItemId] = useState<string | null>(null);

  const requestScanFromList = (id: string) => {
    setScanningItemId(id);
    createRequest.mutate(
      { itemId: id, type: 'scan' },
      { onSettled: () => setScanningItemId(null) },
    );
  };

  const itemPath = (id: string) => `/app/mailroom/${roomId}/${id}`;
  const closeItem = () => {
    createRequest.reset();
    navigate(`/app/mailroom/${roomId}`);
  };
  // Prev/Next replace the history entry so Back always returns to the inbox
  // rather than replaying every viewed item.
  const goPrevItem = () => {
    const previous = openIndex > 0 ? loadedItems[openIndex - 1] : undefined;
    if (previous) navigate(itemPath(previous.id), { replace: true });
  };
  const goNextItem = () => {
    const next = openIndex >= 0 ? loadedItems[openIndex + 1] : undefined;
    if (next) {
      navigate(itemPath(next.id), { replace: true });
    } else if (items.hasNextPage) {
      // At the loaded edge with more on the server: pull the next cursor page
      // in; the chevron advances once it lands.
      void items.fetchNextPage();
    }
  };

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-6 lg:gap-8">
          {showSkeleton ? (
            <>
              <div className="flex flex-col gap-2" aria-hidden="true">
                <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
                <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
              </div>
              <InboxSkeleton />
            </>
          ) : showError || !room ? (
            <MailRoomError
              onRetry={() => void detail.refetch()}
              title="We couldn't load this mail room"
              body="Something went wrong fetching this mail room. Please try again."
            />
          ) : (
            <>
              <InboxHeader roomName={room.name} address={room.address} />

              <MailRoomInboxKpiCards stats={room.stats} />

              <div className="flex w-full flex-col gap-6 lg:gap-7">
                <InboxControls
                  tab={tab}
                  onTabChange={setTab}
                  status={status}
                  onStatusChange={setStatus}
                  search={search}
                  onSearchChange={setSearch}
                />

                <MailList
                  items={loadedItems}
                  roomId={roomId}
                  page={pageIndex + 1}
                  pageSize={PAGE_SIZE}
                  totalItems={totalItems}
                  isLoading={items.isLoading}
                  onRequestScan={requestScanFromList}
                  scanningItemId={scanningItemId}
                  empty={EMPTY_COPY[tab]}
                />

                {totalItems > 0 && (
                  <InboxPagination
                    page={pageIndex + 1}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    loadedCount={loadedItems.length}
                    hasMore={canLoadMore}
                    onPrev={goPrev}
                    onNext={goNext}
                    onLoadMore={onLoadMore}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {itemId && slideOverItem && detail.data ? (
        <MailItemSlideOver
          item={slideOverItem}
          roomName={detail.data.name}
          position={openIndex >= 0 ? openIndex + 1 : null}
          total={totalItems}
          hasPrev={openIndex > 0}
          hasNext={
            (openIndex >= 0 && openIndex < loadedItems.length - 1) ||
            Boolean(items.hasNextPage)
          }
          onClose={closeItem}
          onPrev={goPrevItem}
          onNext={goNextItem}
          onRequestForwarding={() => requestHandling('forwarding')}
          onRequestShredding={() => requestHandling('shredding')}
          onRequestScan={() => requestHandling('scan')}
          onDownload={() => recordDownload.mutate(slideOverItem.id)}
          isRequesting={createRequest.isPending}
          requestError={requestError}
          isScanLoading={openedItem.isPending}
          scanError={scanError}
          onRetryScan={() => void openedItem.refetch()}
        />
      ) : null}
    </PortalLayout>
  );
}
