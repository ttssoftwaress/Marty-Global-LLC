import { formatCount } from '../../lib/format';

/*
 * The ledger footer — two presentations of one cursor-paginated stream
 * (AGENTS.md), matching the links:
 *   - desktop & tablet: "Showing 1–7 of 148 orders" with Prev / numbered pages
 *                       / Next inside the table card
 *   - mobile:           a "Load more" button under the card stack
 *
 * The page numbers window around the current page rather than printing every
 * one, so a ledger hundreds of pages deep keeps the footer a fixed width — the
 * design's three fixed buttons cannot survive a real result count.
 *
 * Both are separate exports rather than one component with breakpoints, because
 * the page puts them in different parents: the pager belongs inside the table
 * card, "Load more" sits on the page background under the mobile stack.
 */

const WINDOW_SIZE = 3;

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

type LedgerLoadMoreProps = {
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

export function LedgerLoadMore({
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: LedgerLoadMoreProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2 md:hidden">
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : 'Load more'}
      </button>
      <p className="text-caption text-gray-500">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)} orders
      </p>
    </div>
  );
}

type LedgerPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
};

export function LedgerPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
}: LedgerPaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="hidden w-full items-center justify-between gap-4 border-t border-gray-200 px-4 py-4 md:flex lg:px-5 lg:py-5">
      <p className="text-small text-gray-500 lg:text-body">
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} orders
      </p>

      <nav aria-label="Billing ledger pagination" className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="flex h-9 items-center justify-center rounded-control border px-3 text-[13px] font-medium transition-colors disabled:cursor-default enabled:border-gray-300 enabled:text-gray-700 enabled:hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400"
        >
          Prev
        </button>

        {pageWindow(page, totalPages).map((entry, index) =>
          entry === null ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="px-1 text-small text-gray-400"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={`flex h-9 min-w-9 items-center justify-center rounded-control px-2.5 text-[13px] transition-colors ${
                entry === page
                  ? 'bg-primary font-semibold text-white'
                  : 'border border-gray-300 font-medium text-gray-700 hover:bg-gray-50'
              }`}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="flex h-9 items-center justify-center rounded-control border px-3 text-[13px] font-medium transition-colors disabled:cursor-default enabled:border-gray-300 enabled:text-gray-700 enabled:hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-400"
        >
          Next
        </button>
      </nav>
    </div>
  );
}
