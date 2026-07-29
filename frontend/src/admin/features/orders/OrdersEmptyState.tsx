import { ClipboardList } from 'lucide-react';

import type { AdminOrdersScope } from '../../types/orders';

/*
 * What the queue shows once a query resolves with nothing to render — a state
 * the links do not cover, so it follows the app's own empty-state shape.
 *
 * The copy distinguishes the ways it happens: filters that matched nothing,
 * where the useful next step is clearing them; an unfiltered queue that is
 * genuinely clear; and — for a member who sees only their own filings — nothing
 * assigned to them yet, which is not the same thing. Telling a reviewer "no
 * orders in the queue" when the business has forty would be plainly wrong, and
 * the next step is a manager's, not theirs.
 */

type OrdersEmptyStateProps = {
  isFiltered: boolean;
  scope: AdminOrdersScope;
  onClearFilters: () => void;
};

export function OrdersEmptyState({
  isFiltered,
  scope,
  onClearFilters,
}: OrdersEmptyStateProps) {
  const assigned = scope === 'assigned';

  const title = isFiltered
    ? 'No orders match these filters'
    : assigned
      ? 'No orders assigned to you'
      : 'No orders in the queue';

  const detail = isFiltered
    ? 'Try a different status, service, region, or date range.'
    : assigned
      ? 'Orders appear here once a manager assigns one to you.'
      : 'New customer orders will appear here as they are submitted.';

  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ClipboardList className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">{title}</p>
        <p className="max-w-[23.75rem] text-body text-gray-500">{detail}</p>
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

