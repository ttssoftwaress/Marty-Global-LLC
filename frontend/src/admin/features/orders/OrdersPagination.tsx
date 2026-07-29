import { formatCount } from '../../lib/format';

/*
 * The queue footer — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the links:
 *   - desktop & tablet: "Showing 1–8 of 42 results" with Previous / numbered
 *                       pages / Next
 *   - mobile:           a "Load more orders" button over "Showing 8 of 42
 *                       results"
 *
 * The page numbers window around the current page rather than printing every
 * one, so a queue hundreds of pages deep keeps the footer a fixed width. The
 * design shows four consecutive numbers, which is what a short queue renders
 * here too; longer ones slide the window and mark the gap with an ellipsis.
 *
 * A disabled control keeps the design's muted style instead of disappearing, so
 * the footer's height and alignment stay put.
 */

const WINDOW_SIZE = 4;

// The page numbers to print: a sliding window of `WINDOW_SIZE`, always including
// the first and last page, with `null` marking an elided run.
function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= WINDOW_SIZE + 2) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const half = Math.floor(WINDOW_SIZE / 2);
  let start = Math.max(2, page - half);
  const end = Math.min(totalPages - 1, start + WINDOW_SIZE - 1);
  start = Math.max(2, end - WINDOW_SIZE + 1);

  const pages: (number | null)[] = [1];
  if (start > 2) pages.push(null);
  for (let current = start; current <= end; current += 1) pages.push(current);
  if (end < totalPages - 1) pages.push(null);
  pages.push(totalPages);

  return pages;
}

/*
 * The two footers are separate exports rather than one component with internal
 * breakpoints, because the page places them in different parents: the pager
 * belongs inside the table card, while "Load more" sits on the page background
 * under the mobile card stack.
 */

type LoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function OrdersLoadMore({
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: LoadMoreProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 py-4 md:hidden">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 items-center justify-center rounded-input border border-primary bg-white px-5 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : 'Load more orders'}
      </button>
      <p className="text-small text-gray-500">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)} results
      </p>
    </div>
  );
}

type OrdersPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function OrdersPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: OrdersPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="hidden w-full items-center justify-between gap-4 px-card py-5 md:flex">
        <p className="text-small text-gray-500">
          Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
          {formatCount(totalResults)} results
        </p>

        <nav aria-label="Orders pagination" className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!canPrev}
            className="flex h-10 items-center justify-center rounded-input px-4 text-body font-semibold transition-colors disabled:cursor-default enabled:border enabled:border-primary enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {pageWindow(page, totalPages).map((entry, index) =>
              entry === null ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="px-1 text-body text-gray-400"
                >
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  type="button"
                  onClick={() => onPageChange(entry)}
                  aria-current={entry === page ? 'page' : undefined}
                  className={`flex h-10 min-w-10 items-center justify-center rounded-input px-3.5 text-body transition-colors ${
                    entry === page
                      ? 'bg-primary font-semibold text-white'
                      : 'font-medium text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {entry}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!canNext}
            className="flex h-10 items-center justify-center rounded-input px-4 text-body font-semibold transition-colors disabled:cursor-default enabled:border enabled:border-primary enabled:text-primary enabled:hover:bg-primary-light disabled:bg-gray-200 disabled:text-gray-400"
          >
            Next
          </button>
      </nav>
    </div>
  );
}
