/*
 * Orders pagination — two presentations of one paged list:
 *   - desktop & tablet: "Page X of Y" with Previous / Next buttons
 *   - mobile:           a "Load more" button over "Showing all N orders"
 *
 * The list uses cursor pagination server-side (AGENTS.md); these controls are
 * the two ways the design surfaces it. A disabled control (no previous/next
 * page, or nothing left to load) renders in the design's muted style rather
 * than disappearing, so the layout stays stable.
 */

type OrdersPaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  /*
   * How many orders the mobile list is actually showing. Deriving it from
   * `page * 10` was wrong the moment mobile stopped sharing the desktop window.
   */
  loadedCount: number;
  hasMore: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onLoadMore?: () => void;
};

export function OrdersPagination({
  page,
  totalPages,
  totalCount,
  loadedCount,
  hasMore,
  onPrev,
  onNext,
  onLoadMore,
}: OrdersPaginationProps) {
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
          className="flex items-center justify-center rounded-input border border-gray-300 bg-white px-6 py-2.5 text-[0.8125rem] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
        >
          Load more
        </button>
        <p className="text-small text-gray-500">
          {hasMore
            ? `Showing ${totalCount === 0 ? 0 : 1}–${Math.min(totalCount, loadedCount)} of ${totalCount} orders`
            : `Showing all ${totalCount} orders`}
        </p>
      </div>

      {/* Tablet & desktop — page counter with prev / next */}
      <div className="hidden w-full items-center justify-between pt-2 md:flex lg:pt-0">
        <p className="text-small font-medium text-gray-500">
          Page {page} of {totalPages}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            className="flex h-9 items-center justify-center rounded-lg px-4 text-[0.8125rem] font-semibold transition-colors disabled:cursor-default enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="flex h-9 items-center justify-center rounded-lg px-4 text-[0.8125rem] font-semibold transition-colors disabled:cursor-default enabled:bg-white enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
