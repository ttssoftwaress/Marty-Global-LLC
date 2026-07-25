import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
  SupportConversationList,
  SupportEmptyThread,
  SupportInboxHeader,
  SupportThreadPane,
  useAdminSupportConversations,
  useAdminSupportThread,
} from '../features/support';
import { useAdminShell } from '../hooks/useAdminShell';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  DEFAULT_SUPPORT_FILTER,
  isSupportFilter,
  type ComposerMode,
  type SupportConversationSummary,
  type SupportFilter,
  type SupportStatus,
} from '../types/support';

/*
 * Support inbox — the staff screen for every customer conversation: a master
 * list of threads and the open thread's messages, notes, and composer. It is the
 * admin face of the live-chat / support module (AGENTS.md, Live Chat), the
 * counterpart to the portal's Messages screen.
 *
 * One tree, one route (/admin/support/:conversationId?), drives every viewport.
 * From tablet up both panes show side by side; on mobile only one shows at a
 * time — the list, or the thread once one is opened — so the open conversation
 * lives in the URL and deep-links, and the mobile thread header's back control
 * returns to the list. The active filter rides in `?filter=` for the same
 * reason: a filtered inbox is a view worth linking to and surviving a reload.
 *
 * The screen fills the workspace height and each pane scrolls on its own, so the
 * filters, thread header, and composer stay pinned the way an inbox should.
 *
 * Nothing here is hardcoded business data: the header counts, every
 * conversation, message, note, and the assignable staff all come from the
 * backend (endpoints land later, two-apps sync rule). The screen renders
 * skeletons until they arrive and empty states once they do with nothing to
 * show. Sending, assigning, and status changes are owned by the `support`
 * module over `services/socket.ts`; the controls are interactive in the
 * meantime.
 */

const SEARCH_DEBOUNCE_MS = 300;

export function AdminSupportInboxPage() {
  const { user, onLogout } = useAdminShell();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const filter: SupportFilter = isSupportFilter(filterParam)
    ? filterParam
    : DEFAULT_SUPPORT_FILTER;

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const conversationsQuery = useAdminSupportConversations(filter, debouncedSearch);
  const threadQuery = useAdminSupportThread(conversationId ?? '');

  const conversations = useMemo<SupportConversationSummary[]>(
    () => conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? [],
    [conversationsQuery.data],
  );

  const firstPage = conversationsQuery.data?.pages[0];

  const setFilter = (next: SupportFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === DEFAULT_SUPPORT_FILTER) params.delete('filter');
    else params.set('filter', next);
    setSearchParams(params, { replace: true });
  };

  // Selecting a conversation keeps the current filter in the URL, so Back from a
  // thread returns to the same filtered list rather than the default one.
  const hrefFor = (id: string) => {
    const query = searchParams.toString();
    return `/admin/support/${id}${query ? `?${query}` : ''}`;
  };

  const backToList = () => {
    const query = searchParams.toString();
    navigate(`/admin/support${query ? `?${query}` : ''}`);
  };

  const onLoadMore = () => {
    if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage) {
      void conversationsQuery.fetchNextPage();
    }
  };

  /*
   * Delivery, assignment, and status changes are owned by the `support` module
   * (AGENTS.md, Live Chat) — every one of them persists through the service
   * layer, so none is wired to a local mutation here.
   */
  const onSend = (_mode: ComposerMode, _body: string) => {};
  const onAssign = (_agentId: string | null) => {};
  const onStatusChange = (_status: SupportStatus) => {};

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="h-full w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-4 md:gap-6">
          {/* On mobile the header belongs to the list; an open thread is the whole screen. */}
          <div className={conversationId ? 'hidden md:block' : 'block'}>
            <SupportInboxHeader
              totalOpen={firstPage?.totalOpen}
              totalUnassigned={firstPage?.totalUnassigned}
            />
          </div>

          <div className="flex min-h-0 flex-1 gap-4 md:gap-4 lg:gap-6">
            <SupportConversationList
              conversations={conversations}
              isLoading={conversationsQuery.isPending}
              filter={filter}
              onFilterChange={setFilter}
              search={search}
              onSearchChange={setSearch}
              activeId={conversationId}
              hrefFor={hrefFor}
              hasNextPage={Boolean(conversationsQuery.hasNextPage)}
              isFetchingNextPage={conversationsQuery.isFetchingNextPage}
              onLoadMore={onLoadMore}
              className={conversationId ? 'hidden md:flex' : 'flex'}
            />

            {conversationId ? (
              <SupportThreadPane
                // Remount per conversation so the scroll position and composer
                // draft reset on switch (and the pin-to-newest re-runs even
                // between two threads of equal message count).
                key={conversationId}
                thread={threadQuery.data}
                isLoading={threadQuery.isPending}
                onBack={backToList}
                onSend={onSend}
                onAssign={onAssign}
                onStatusChange={onStatusChange}
              />
            ) : (
              <SupportEmptyThread className="hidden md:flex" />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
