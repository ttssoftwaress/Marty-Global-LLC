import { formatCount } from '../../lib/format';

/*
 * The list footer — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the links:
 *   - desktop & tablet: "Showing 1-10 of 128 customers" with Previous /
 *                       numbered pages / Next, sitting on the page background
 *                       below the table card rather than inside it
 *   - mobile:           a full-width "Load more customers" button over
 *                       "Showing 10 of 128"
 *
 * The page numbers window around the current page rather than printing every
 * one, so a list hundreds of pages deep keeps the footer a fixed width. The
 * links show three consecutive numbers, which is what a short list renders here
 * too; longer ones slide the window and mark the gap with an ellipsis.
 *
 * A disabled control keeps the links' muted style instead of disappearing, so
 * the footer's height and alignment stay put.
 */

const WINDOW_SIZE = 3;

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
 * breakpoints, because the page places them differently: the pager is a row
 * under the table card, while "Load more" sits under the mobile card stack with
 * its own top spacing.
 */

type CustomersLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function CustomersLoadMore({
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: CustomersLoadMoreProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 pt-6 md:hidden">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 w-full items-center justify-center rounded-input border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : 'Load more customers'}
      </button>
      <p className="text-small text-text-secondary">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)}
      </p>
    </div>
  );
}

type CustomersPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function CustomersPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: CustomersPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const stepButton =
    'flex h-10 items-center justify-center rounded-input border border-gray-200 bg-white px-3.5 text-[0.8125rem] font-medium transition-colors lg:px-4 lg:text-body';

  return (
    <div className="hidden w-full items-center justify-between gap-4 md:flex">
      <p className="text-[0.8125rem] text-gray-500 lg:text-body">
        Showing {formatCount(rangeStart)}-{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} customers
      </p>

      <nav aria-label="Customers pagination" className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className={`${stepButton} disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-500`}
        >
          Previous
        </button>

        <div className="flex items-center gap-1">
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-[0.8125rem] text-gray-400 lg:text-body"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={`flex h-10 min-w-10 items-center justify-center rounded-input px-3 text-[0.8125rem] transition-colors lg:px-3.5 lg:text-body ${
                  entry === page
                    ? 'bg-primary font-semibold text-white'
                    : 'border border-gray-200 bg-white font-medium text-text hover:bg-gray-50'
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
          className={`${stepButton} disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-500`}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
