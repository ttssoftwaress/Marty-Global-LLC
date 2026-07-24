/*
 * Inbox pagination — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the links:
 *   - desktop & tablet: "Page X of Y" with Previous / Next
 *   - mobile:           a "Load more" button over "Showing N of M"
 *
 * A disabled control renders in the design's muted style rather than
 * disappearing, so the layout stays stable.
 */

type InboxPaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  loadedCount: number; // items on screen on mobile
  hasMore: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onLoadMore?: () => void;
};

export function InboxPagination({
  page,
  totalPages,
  totalItems,
  loadedCount,
  hasMore,
  onPrev,
  onNext,
  onLoadMore,
}: InboxPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <>
      {/* Mobile — load more over a count summary */}
      <div className="flex w-full flex-col items-center gap-2 pt-1 md:hidden">
        <button
          type="button"
          onClick={onLoadMore}
          disabled={!hasMore}
          className="flex h-10 items-center justify-center rounded-input border border-primary bg-white px-6 text-[13px] font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
        >
          Load more
        </button>
        <p className="text-small text-gray-500">
          Showing {loadedCount} of {totalItems}
        </p>
      </div>

      {/* Tablet & desktop — page counter with prev / next */}
      <div className="hidden w-full items-center justify-between md:flex">
        <p className="text-body text-text-secondary">
          Page {page} of {totalPages}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            className="flex items-center justify-center rounded-input px-4 py-2 text-body font-medium transition-colors disabled:cursor-default enabled:border enabled:border-gray-300 enabled:bg-white enabled:text-gray-700 enabled:hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="flex items-center justify-center rounded-input px-4 py-2 text-body font-medium transition-colors disabled:cursor-default enabled:border enabled:border-gray-300 enabled:bg-white enabled:text-gray-700 enabled:hover:bg-gray-100 disabled:bg-gray-200 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
