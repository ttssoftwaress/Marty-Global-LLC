import { ClipboardList } from 'lucide-react';

/*
 * What the queue shows once a query resolves with nothing to render — a state
 * the links do not cover, so it follows the app's own empty-state shape.
 *
 * The copy distinguishes the two ways it happens: an unfiltered queue that is
 * genuinely clear, versus filters that matched nothing, where the useful next
 * step is clearing them.
 */

type OrdersEmptyStateProps = {
  isFiltered: boolean;
  onClearFilters: () => void;
};

export function OrdersEmptyState({
  isFiltered,
  onClearFilters,
}: OrdersEmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ClipboardList className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">
          {isFiltered ? 'No orders match these filters' : 'No orders in the queue'}
        </p>
        <p className="max-w-[380px] text-body text-gray-500">
          {isFiltered
            ? 'Try a different status, service, region, or date range.'
            : 'New customer orders will appear here as they are submitted.'}
        </p>
      </div>

      {isFiltered ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-1 flex h-10 items-center justify-center rounded-input border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
