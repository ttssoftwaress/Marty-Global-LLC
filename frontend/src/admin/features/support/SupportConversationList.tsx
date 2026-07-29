import { useEffect, useRef } from 'react';
import { Inbox } from 'lucide-react';

import { DataErrorState } from '../../components/DataErrorState';
import type {
  SupportConversationSummary,
  SupportFilter,
  SupportFilterOption,
} from '../../types/support';
import { SupportConversationItem } from './SupportConversationItem';
import { SupportFilterTabs } from './SupportFilterTabs';
import { SupportSearch } from './SupportSearch';

/*
 * The left pane — filters and search pinned above a scrolling stack of
 * conversations.
 *
 * The frame differs across the links, so one tree carries both: on mobile the
 * controls sit on the page tint above a stack of standalone cards, while from
 * tablet up the whole pane becomes a bordered white card (18.75rem on tablet, 380px
 * on desktop) with the controls in a hairline-separated header and the rows
 * flush inside it.
 *
 * The stack scrolls on its own so the filters and search stay put — the pane is
 * the full workspace height at every width from tablet up.
 *
 * The next cursor page loads when a sentinel at the end of the stack comes into
 * view (AGENTS.md, cursor pagination), so the list appends as staff scroll
 * rather than making them page.
 */

type SupportConversationListProps = {
  conversations: SupportConversationSummary[];
  isLoading: boolean;
  // A failed list is not an empty inbox: "No conversations" over a dropped fetch
  // tells an agent nobody is waiting when the queue is simply unreadable.
  isError?: boolean;
  isRetrying?: boolean;
  onRetry?: () => void;
  // The cohorts this member is offered, resolved by the backend with the list.
  filters: SupportFilterOption[];
  filter: SupportFilter;
  onFilterChange: (value: SupportFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  activeId?: string;
  hrefFor: (conversationId: string) => string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  className?: string;
};

function ConversationsSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 md:gap-0"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 md:gap-1.5 md:rounded-none md:border-0 md:border-b md:p-3 lg:gap-2 lg:p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-14 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-3.5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-3.5 w-full animate-pulse rounded bg-gray-200 md:hidden lg:block" />
          <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function ConversationsEmptyState({
  isFiltered,
}: {
  isFiltered: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-gray-100">
        <Inbox className="size-5 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body font-semibold text-text">No conversations</p>
      <p className="max-w-[15rem] text-small text-gray-500">
        {isFiltered
          ? 'No conversation matches this filter or search.'
          : 'New customer conversations will appear here.'}
      </p>
    </div>
  );
}

export function SupportConversationList({
  conversations,
  isLoading,
  isError,
  isRetrying,
  onRetry,
  filters,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  activeId,
  hrefFor,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  className,
}: SupportConversationListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '12.5rem' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  const isFiltered = filter !== 'all' || Boolean(search.trim());
  const isEmpty = !isLoading && !isError && conversations.length === 0;

  return (
    <section
      aria-label="Conversations"
      className={`min-h-0 w-full flex-col md:w-[18.75rem] md:shrink-0 md:overflow-hidden md:rounded-card md:border md:border-gray-200 md:bg-white lg:w-[23.75rem] ${
        className ?? 'flex'
      }`}
    >
      <div className="flex shrink-0 flex-col gap-3 md:border-b md:border-gray-200 md:p-3 lg:gap-3 lg:p-4">
        <SupportFilterTabs filters={filters} value={filter} onChange={onFilterChange} />
        <SupportSearch value={search} onChange={onSearchChange} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-4 md:gap-0 md:pt-0">
        {isLoading ? (
          <ConversationsSkeleton />
        ) : isError ? (
          // `bare` — from `md` up the pane is already a card; the alert must not
          // draw a second border inside it.
          <DataErrorState
            bare
            title="We couldn’t load the inbox"
            description="Something went wrong fetching the conversations. Try again."
            onRetry={() => onRetry?.()}
            isRetrying={isRetrying}
          />
        ) : isEmpty ? (
          <ConversationsEmptyState isFiltered={isFiltered} />
        ) : (
          <>
            {conversations.map((conversation) => (
              <SupportConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeId}
                to={hrefFor(conversation.id)}
              />
            ))}

            <div ref={sentinelRef} className="h-px shrink-0" aria-hidden="true" />

            {isFetchingNextPage ? (
              <p className="shrink-0 py-3 text-center text-small text-gray-400">
                Loading more…
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
