import { AlertTriangle, MessageSquare, Search } from 'lucide-react';

import type { ConversationSummary } from '../../types/support';
import { ConversationListItem } from './ConversationListItem';

/*
 * The conversation list — the master pane. One tree serves every breakpoint:
 * on mobile it is a plain title + search + stacked cards that fill the screen;
 * from tablet up it becomes a fixed-width bordered column (17.5rem tablet, 360px
 * desktop) with a search header and flat divider rows, its list scrolling on
 * its own so the search stays pinned.
 *
 * The page owns the search text (debounced into the query) and which
 * conversation is open; this component only renders. A skeleton covers the
 * first load, an empty state covers a search with no matches or a customer with
 * no conversations yet.
 */

type ConversationListProps = {
  conversations: ConversationSummary[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  activeId?: string;
  className?: string;
};

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 md:gap-0 md:p-0" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-[4.5rem] w-full animate-pulse rounded-card bg-gray-200 md:rounded-none md:border-b md:border-gray-200 md:bg-transparent md:p-4"
        >
          <div className="hidden size-full rounded-lg bg-gray-200 md:block" />
        </div>
      ))}
    </div>
  );
}

function ListErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-[var(--color-status-missing-bg)]">
        <AlertTriangle className="size-6 text-error" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">
        We couldn&apos;t load your conversations
      </p>
      <p className="max-w-[18.75rem] text-body text-gray-500">
        Something went wrong fetching your messages. Please try again.
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary mt-1 h-11 rounded-input px-5 text-body"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

function ListEmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <MessageSquare
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">
        {searching ? 'No matches' : 'No conversations yet'}
      </p>
      <p className="max-w-[18.75rem] text-body text-gray-500">
        {searching
          ? 'No conversations match your search. Try a different term.'
          : 'Messages with our team will appear here. Start one any time.'}
      </p>
    </div>
  );
}

export function ConversationList({
  conversations,
  isLoading,
  isError = false,
  onRetry,
  search,
  onSearchChange,
  activeId,
  className = 'flex',
}: ConversationListProps) {
  // Skeleton means "still loading", not "no data". Folding `!conversations` into
  // it left a rejected query showing a skeleton forever with no way to retry.
  const showSkeleton = isLoading;
  const showError = !isLoading && (isError || !conversations);
  const isEmpty = !showSkeleton && !showError && conversations?.length === 0;

  return (
    <section
      className={`w-full min-h-0 flex-col gap-4 md:w-[17.5rem] md:shrink-0 md:gap-0 md:overflow-hidden md:rounded-card md:border md:border-gray-200 md:bg-white lg:w-[22.5rem] ${className}`}
    >
      <h1 className="shrink-0 text-h4 font-semibold text-text md:hidden">
        Support
      </h1>

      <div className="shrink-0 md:border-b md:border-gray-200 md:p-3 lg:p-4">
        <div className="flex h-12 items-center gap-2 rounded-input border border-gray-300 bg-white px-3.5 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--ring-focus)] md:h-10">
          <Search
            className="size-[1.125rem] shrink-0 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-body text-text outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto md:gap-0">
        {showSkeleton ? (
          <ListSkeleton />
        ) : showError ? (
          <ListErrorState onRetry={onRetry} />
        ) : isEmpty ? (
          <ListEmptyState searching={search.trim().length > 0} />
        ) : (
          (conversations ?? []).map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
            />
          ))
        )}
      </div>
    </section>
  );
}
