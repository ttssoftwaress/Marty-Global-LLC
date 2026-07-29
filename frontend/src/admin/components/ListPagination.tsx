import { formatCount } from '../lib/format';
import { pageWindow } from '../lib/pagination';

/*
 * The list footer shared by the admin's full-page lists — two presentations of
 * one cursor-paginated stream (AGENTS.md):
 *   - desktop & tablet: "Showing 1–25 of 1,482 entries" with Previous /
 *                       numbered pages / Next, sitting on the page background
 *                       below the table card rather than inside it
 *   - mobile:           a full-width "Load more …" button over "Showing 25 of
 *                       1,482"
 *
 * They are separate exports rather than one component with internal breakpoints,
 * because the pages place them differently: the pager is a row under the table
 * card, while "Load more" sits under the mobile card stack with its own top
 * spacing.
 *
 * A disabled control keeps its muted style instead of disappearing, so the
 * footer's height and alignment stay put.
 *
 * Three screens had drawn this footer independently — customers, team, and the
 * audit trail — and two of the three had become byte-identical. The structure,
 * the labels, and the accessibility wiring live here; the two visual treatments
 * the screens' designs actually differ on survive as `variant`:
 *
 *   - `pill`   circular page buttons on a plain row (team, audit trail)
 *   - `square` rounded-rectangle page buttons at the customers list's tighter
 *              type scale, which is what that screen's design draws
 *
 * Anything beyond those two — the pagers that live *inside* a table card, with
 * their own padding and step-button treatment — stays in its feature and shares
 * only `pageWindow`. Four variants would cost more than the duplication saves.
 */

type PaginationVariant = 'pill' | 'square';

const VARIANTS: Record<
  PaginationVariant,
  {
    range: string;
    step: string;
    numbers: string;
    gap: string;
    page: string;
    pageActive: string;
    pageIdle: string;
  }
> = {
  /* Arbitrary type utilities, not the `.text-*` tokens — those are
     `@layer components`, so `lg:text-body` would emit no CSS. */
  pill: {
    range:
      'text-[0.75rem] leading-4 text-text-secondary lg:text-[0.875rem] lg:leading-5 lg:text-gray-500',
    step: 'flex h-10 items-center justify-center rounded-control border border-gray-200 bg-white px-4 text-body font-semibold transition-colors disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-400',
    numbers: 'flex items-center gap-2',
    gap: 'px-1 text-body text-gray-400',
    page: 'flex size-10 items-center justify-center rounded-pill text-body font-semibold transition-colors',
    pageActive: 'bg-primary text-white',
    pageIdle: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  },
  square: {
    range: 'text-[0.8125rem] text-gray-500 lg:text-[0.875rem] lg:leading-5',
    step: 'flex h-10 items-center justify-center rounded-control border border-gray-200 bg-white px-3.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-default disabled:opacity-50 enabled:text-text enabled:hover:bg-gray-50 disabled:text-gray-500 lg:px-4 lg:text-[0.875rem]',
    numbers: 'flex items-center gap-1',
    gap: 'px-1 text-[0.8125rem] text-gray-400 lg:text-[0.875rem]',
    page: 'flex h-10 min-w-10 items-center justify-center rounded-control px-3 text-[0.8125rem] transition-colors lg:px-3.5 lg:text-[0.875rem]',
    pageActive: 'bg-primary font-semibold text-white',
    pageIdle:
      'border border-gray-200 bg-white font-medium text-text hover:bg-gray-50',
  },
};

type ListLoadMoreProps = {
  label: string; // e.g. "Load more customers"
  totalResults: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  className?: string; // the page's own top spacing
};

export function ListLoadMore({
  label,
  totalResults,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  className = 'pt-2',
}: ListLoadMoreProps) {
  return (
    <div
      className={`flex w-full flex-col items-center gap-2 md:hidden ${className}`}
    >
      <button
        type="button"
        onClick={onLoadMore}
        disabled={!hasMore || isLoadingMore}
        className="flex h-10 w-full items-center justify-center rounded-control border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-default disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white"
      >
        {isLoadingMore ? 'Loading…' : label}
      </button>
      <p className="text-small text-text-secondary">
        Showing {formatCount(loadedCount)} of {formatCount(totalResults)}
      </p>
    </div>
  );
}

type ListPaginationProps = {
  page: number;
  totalPages: number;
  totalResults: number;
  rangeStart: number; // first result index on screen (1-based)
  rangeEnd: number; // last result index on screen
  onPageChange: (page: number) => void;
  noun: string; // what is being counted, e.g. "customers"
  ariaLabel: string; // e.g. "Customers pagination"
  variant?: PaginationVariant;
};

export function ListPagination({
  page,
  totalPages,
  totalResults,
  rangeStart,
  rangeEnd,
  onPageChange,
  noun,
  ariaLabel,
  variant = 'pill',
}: ListPaginationProps) {
  const styles = VARIANTS[variant];
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="hidden w-full items-center justify-between gap-4 md:flex">
      <p className={styles.range}>
        Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{' '}
        {formatCount(totalResults)} {noun}
      </p>

      <nav aria-label={ariaLabel} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className={styles.step}
        >
          Previous
        </button>

        <div className={styles.numbers}>
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === null ? (
              <span key={`gap-${index}`} aria-hidden="true" className={styles.gap}>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onPageChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={`${styles.page} ${
                  entry === page ? styles.pageActive : styles.pageIdle
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
          className={styles.step}
        >
          Next
        </button>
      </nav>
    </div>
  );
}
