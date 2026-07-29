import { ClipboardList } from 'lucide-react';

import type { CustomerOrderRow } from '../../types/customer-detail';
import { CustomerOrderCardList } from './CustomerOrderCardList';
import { CustomerOrdersTable } from './CustomerOrdersTable';

/*
 * The Orders tab's panel — the customer's orders, drawn as a table at `md` and
 * up and as cards on mobile.
 *
 * The frame differs with the presentation, which is what the links show: the
 * table lives inside a bordered card so its header band and row rules read as one
 * surface, while the mobile cards sit directly on the page background and carry
 * their own borders.
 *
 * The empty and "load more" states are not in the links; they follow the app's
 * own shapes (Design.md, states the design did not cover). The cursor stream is
 * one-way here — "Load more" appends — since a customer's order history is short
 * enough that a numbered pager would be chrome without a job.
 */

type CustomerOrdersPanelProps = {
  orders: CustomerOrderRow[];
  totalResults: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

function EmptyState() {
  return (
    <div className="flex w-full flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <ClipboardList className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-h6 text-text">No orders yet</p>
        <p className="max-w-[23.75rem] text-body text-gray-500">
          Orders this customer submits will appear here.
        </p>
      </div>
    </div>
  );
}

export function CustomerOrdersPanel({
  orders,
  totalResults,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: CustomerOrdersPanelProps) {
  if (orders.length === 0) {
    return (
      <div className="w-full rounded-card border border-gray-200 bg-white shadow-sm-elevation md:rounded-table">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Mobile — cards on the page background, no surrounding frame. */}
      <CustomerOrderCardList orders={orders} />

      {/* Tablet & desktop — the table in its own card. */}
      <div className="hidden w-full overflow-hidden rounded-table border border-gray-200 bg-white shadow-sm-elevation md:block">
        <CustomerOrdersTable orders={orders} />
      </div>

      {hasMore ? (
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="flex h-10 w-full items-center justify-center rounded-input border border-primary bg-white text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:opacity-60 md:w-auto md:px-6"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>

          <p className="text-small text-gray-500">
            Showing {orders.length} of {totalResults} orders
          </p>
        </div>
      ) : null}
    </div>
  );
}
