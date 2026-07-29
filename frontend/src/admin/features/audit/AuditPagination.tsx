import { formatCount } from '../../lib/format';

/*
 * The list footer — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the rest of the admin portal:
 *   - desktop & tablet: "Showing 1–25 of 1,482 entries" with Previous /
 *                       numbered pages / Next, sitting on the page background
 *                       below the table card rather than inside it
 *   - mobile:           a full-width "Load more entries" button over
 *                       "Showing 25 of 1,482"
 *
 * The page numbers window around the current page rather than printing every
 * one — an audit log runs to hundreds of pages, so this is the screen the
 * windowing actually exists for.
 *
 * A disabled control keeps its muted style instead of disappearing, so the
 * footer's height and alignment stay put.
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

type AuditLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function AuditLoadMore({
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: AuditLoadMoreProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 pt-2 md:hidden">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : 'Load more entries'}
      </button>
      <p className="text-small text-text-secondary">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)}
      </p>
    </div>
  );
}

type AuditPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
};

export function AuditPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: AuditPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const stepButton =
    'flex h-10 items-center justify-center rounded-control border border-gray-200 bg-white px-4 text-body font-semibold transition-colors';

  return (
    <div className="hidden w-full items-center justify-between gap-4 md:flex">
      {/* Arbitrary type utilities, not the `.text-*` tokens — those are
          `@layer components`, so `lg:text-body` would emit no CSS. */}
      <p className="text-[0.75rem] leading-4 text-text-secondary lg:text-[0.875rem] lg:leading-5 lg:text-gray-500">
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} entries
      </p>

      <nav aria-label="Audit log pagination" className="flex items-center gap-2">
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
