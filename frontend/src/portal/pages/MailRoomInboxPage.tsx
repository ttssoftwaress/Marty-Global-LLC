import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, Inbox } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  InboxControls,
  InboxPagination,
  MailItemSlideOver,
  MailList,
  MailRoomInboxKpiCards,
  useMailItem,
  useMailItems,
  useMailRoomDetail,
} from '../features/mailroom';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePortalShell } from '../hooks/usePortalShell';
import type {
  MailItem,
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
 * backend's to resolve. Requests and History are placeholder views until their
 * data and design land.
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
      <div className="h-[420px] w-full animate-pulse rounded-card bg-gray-200" />
    </div>
  );
}

function ComingSoonPanel({ tab }: { tab: Exclude<MailRoomTab, 'inbox'> }) {
  const copy =
    tab === 'requests'
      ? {
          title: 'No requests yet',
          body: 'Forwarding, scanning, and shredding requests for this room will appear here.',
          icon: Clock,
        }
      : {
          title: 'No history yet',
          body: 'A record of everything that has happened in this room will appear here.',
          icon: Inbox,
        };
  const Icon = copy.icon;

  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center shadow-sm-elevation">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-primary-light">
        <Icon className="size-6 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">{copy.title}</p>
      <p className="max-w-[360px] text-body text-gray-500">{copy.body}</p>
    </div>
  );
}

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
  const showSkeleton = detail.isLoading || !detail.data;

  // The item slide-over is route-driven (/app/mailroom/:roomId/:itemId), so an
  // open item deep-links and Back returns to the list. The detail fetch brings
  // the scan pages; the list copy fills the header while it resolves.
  const openedItem = useMailItem(roomId, itemId ?? '');
  const listItem = itemId
    ? loadedItems.find((candidate) => candidate.id === itemId)
    : undefined;
  const slideOverItem = openedItem.data ?? listItem;
  const openIndex = itemId
    ? loadedItems.findIndex((candidate) => candidate.id === itemId)
    : -1;

  const itemPath = (id: string) => `/app/mailroom/${roomId}/${id}`;
  const closeItem = () => navigate(`/app/mailroom/${roomId}`);
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
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          {showSkeleton ? (
            <>
              <div className="flex flex-col gap-2" aria-hidden="true">
                <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
                <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
              </div>
              <InboxSkeleton />
            </>
          ) : (
            <>
              <InboxHeader roomName={detail.data.name} address={detail.data.address} />

              <MailRoomInboxKpiCards stats={detail.data.stats} />

              <div className="flex w-full flex-col gap-6 lg:gap-7">
                <InboxControls
                  tab={tab}
                  onTabChange={setTab}
                  status={status}
                  onStatusChange={setStatus}
                  search={search}
                  onSearchChange={setSearch}
                />

                {tab === 'inbox' ? (
                  <>
                    <MailList
                      items={loadedItems}
                      roomId={roomId}
                      page={pageIndex + 1}
                      pageSize={PAGE_SIZE}
                      totalItems={totalItems}
                      isLoading={items.isLoading}
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
                  </>
                ) : (
                  <ComingSoonPanel tab={tab} />
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
        />
      ) : null}
    </PortalLayout>
  );
}
