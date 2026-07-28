import { formatCount } from '../../lib/format';

/*
 * The queue's footer — the range on the left, Previous / numbered pages / Next
 * on the right, inside the table card.
 *
 * The design draws a fixed strip of page buttons (four on desktop, three on
 * tablet). Real result counts do not stay that small, so the strip windows
 * around the current page with an ellipsis and always keeps the first and last
 * page reachable — the same treatment the billing ledger's pager uses, and the
 * reason both cannot share one component is that this one is a single strip
 * shown at every width rather than a desktop pager plus a mobile "Load more".
 *
 * Mobile has no link for this screen. The strip is kept there rather than
 * swapped for "Load more" because paging is what the queue is filtered and
 * worked through — the numbers just get tighter, and the range line drops to
 * keep the footer one line tall on a 390px screen.
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

type MailRequestsPaginationProps = {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const STEP_BUTTON =
  'flex h-8 items-center justify-center rounded-[0.375rem] px-2.5 text-small font-medium transition-colors disabled:cursor-default enabled:text-text-secondary enabled:hover:bg-gray-50 disabled:opacity-40 lg:h-9 lg:px-3 lg:text-[0.8125rem]';

export function MailRequestsPagination({
  page,
  pageSize,
  totalResults,
  totalPages,
  onPageChange,
}: MailRequestsPaginationProps) {
  if (totalPages <= 1) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalResults);

  return (
    <div className="flex w-full items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 lg:px-6 lg:py-4">
      {/* The range line needs the room on a narrow screen; the pager keeps it. */}
      <p className="hidden text-small text-text-secondary sm:block">
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} requests
      </p>

      <nav
        aria-label="Pending requests pagination"
        className="flex items-center gap-2 max-sm:w-full max-sm:justify-between lg:gap-3"
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={STEP_BUTTON}
        >
          Previous
        </button>

        <div className="flex items-center gap-1">
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === null ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-0.5 text-small text-gray-400"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={`flex size-6 items-center justify-center rounded-full text-small transition-colors lg:size-7 lg:text-[0.8125rem] ${
                  entry === page
                    ? 'bg-primary font-semibold text-white'
                    : 'font-medium text-text-secondary hover:bg-gray-100'
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
          disabled={page >= totalPages}
          className={`${STEP_BUTTON} border border-gray-200`}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
