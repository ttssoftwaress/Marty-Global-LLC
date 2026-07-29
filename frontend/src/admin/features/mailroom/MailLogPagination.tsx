import { formatCount } from '../../lib/format';
import { pageWindow } from '../../lib/pagination';

/*
 * The log's footer — the range line and the Previous / numbered pages / Next
 * strip.
 *
 * The three links place it differently, and each is reproduced:
 *   - desktop and tablet: one row, the range left and the strip right, on the
 *     page background beneath the table card
 *   - mobile: stacked and centred, the range above the strip, with "Prev" as
 *     the design's shortened label at that width
 *
 * The design draws a fixed strip of three numbered pages. Real result counts do
 * not stay that small, so the strip windows around the current page with an
 * ellipsis and always keeps the first and last page reachable — the same
 * treatment `MailRequestsPagination` gives the pending queue.
 *
 * Both step buttons carry a real disabled state: the design shows "Previous"
 * greyed on page one, which is that state drawn rather than a separate style.
 */

type MailLogPaginationProps = {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

const STEP_BUTTON =
  'flex h-8 items-center justify-center rounded-[0.5rem] px-3 text-[0.8125rem] font-medium transition-colors disabled:cursor-default disabled:bg-gray-200 disabled:text-gray-400 enabled:border enabled:border-gray-300 enabled:bg-white enabled:text-text enabled:hover:bg-gray-50 lg:h-9 lg:rounded-control';

export function MailLogPagination({
  page,
  pageSize,
  totalResults,
  totalPages,
  onPageChange,
}: MailLogPaginationProps) {
  if (totalPages <= 1) return null;

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalResults);

  return (
    <div className="flex w-full flex-col items-center gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <p className="text-[0.8125rem] text-text-secondary md:text-small lg:text-body">
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} items
      </p>

      <nav
        aria-label="Mail log pagination"
        className="flex items-center gap-2 lg:gap-2"
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={STEP_BUTTON}
        >
          {/* The mobile link shortens the label; the wider links spell it out. */}
          <span className="md:hidden">Prev</span>
          <span className="hidden md:inline">Previous</span>
        </button>

        <div className="flex items-center gap-1 lg:gap-2">
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
                className={`flex size-8 items-center justify-center rounded-[0.5rem] text-[0.8125rem] transition-colors lg:size-9 lg:rounded-control lg:text-body ${
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
          className={STEP_BUTTON}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
