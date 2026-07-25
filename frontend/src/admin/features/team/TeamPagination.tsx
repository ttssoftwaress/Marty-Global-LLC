import { formatCount } from '../../lib/format';

/*
 * The list footer — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the links:
 *   - desktop & tablet: "Showing 1–7 of 14 results" with Previous / numbered
 *                       pages / Next, sitting on the page background below the
 *                       table card rather than inside it
 *   - mobile:           the mobile link ends the card stack with no footer at
 *                       all, which leaves anything past the first page
 *                       unreachable on a phone — so a full-width "Load more team
 *                       members" button over "Showing 7 of 14" is added there
 *                       (Design.md, filling in a gap; logged as a deviation).
 *                       Same shape the customers list uses.
 *
 * The page numbers window around the current page rather than printing every
 * one, so a list hundreds of pages deep keeps the footer a fixed width. The
 * links show two consecutive numbers, which is what a short list renders here
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

type TeamLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function TeamLoadMore({
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: TeamLoadMoreProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 pt-2 md:hidden">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : 'Load more team members'}
      </button>
      <p className="text-small text-text-secondary">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)}
      </p>
    </div>
  );
}

type TeamPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function TeamPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: TeamPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const stepButton =
    'flex h-10 items-center justify-center rounded-control border border-gray-200 bg-white px-4 text-body font-semibold transition-colors';

  return (
    <div className="hidden w-full items-center justify-between gap-4 md:flex">
      {/* Arbitrary type utilities, not the `.text-*` tokens — those are
          `@layer components`, so `lg:text-body` would emit no CSS. */}
      <p className="text-[12px] leading-4 text-text-secondary lg:text-[14px] lg:leading-5 lg:text-gray-500">
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} results
      </p>

      <nav aria-label="Team pagination" className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className={`${stepButton} disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-400`}
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
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
                className={`flex size-10 items-center justify-center rounded-pill text-body font-semibold transition-colors ${
                  entry === page
                    ? 'bg-primary text-white'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
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
          className={`${stepButton} disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-400`}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
