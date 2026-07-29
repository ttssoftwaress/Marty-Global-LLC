import { formatCount } from '../../lib/format';
import type { OrderStatus, OrderStatusCount } from '../../types/dashboard';

/*
 * Orders by status — the pipeline at a glance.
 *
 * The Figma links lay six blocks out in a single desktop row (3-across on
 * tablet and mobile). The pipeline now has eight stages, and six-across would
 * strand the last two on a half-empty second row, so the grid is 4-across from
 * tablet up — two even rows — and 2-across on mobile. Deviation logged: the
 * block styling, dots, and typography are unchanged, only the column count.
 *
 * Each block's dot is the status hue from the design system's status tokens, so
 * a status reads the same here as it does on a badge elsewhere in the app.
 *
 * Mobile puts the section title above the card rather than inside it (its link
 * shows a page-level label with the card holding only the grid), so the heading
 * moves out of the card and the card's own title is hidden below `md`.
 */

const STATUS_DOT: Record<OrderStatus, string> = {
  draft: 'bg-gray-400',
  submitted: 'bg-[var(--color-status-submitted-text)]',
  under_review: 'bg-warning',
  missing_info: 'bg-error',
  approved: 'bg-success',
  paid: 'bg-[var(--color-status-paid-text)]',
  processing: 'bg-[var(--color-status-processing-text)]',
  completed: 'bg-primary',
};

export function OrdersByStatus({ statuses }: { statuses: OrderStatusCount[] }) {
  return (
    <section className="flex w-full flex-col gap-2.5 md:gap-0">
      <h2 className="text-[0.875rem] font-semibold leading-5 text-gray-700 md:hidden">
        Orders by status
      </h2>

      <div className="flex w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-4 md:p-card">
        <h2 className="hidden text-[1.125rem] font-semibold leading-6 text-text md:block">
          Orders by status
        </h2>

        {statuses.length === 0 ? (
          <p className="py-2 text-[0.875rem] leading-5 text-gray-500">
            No orders in this period yet.
          </p>
        ) : (
          <ul className="grid w-full grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-4 lg:gap-4">
            {statuses.map((status) => (
              <li
                key={status.status}
                className="flex flex-col gap-1 rounded-[0.625rem] border border-gray-200 bg-white p-3 md:gap-1 lg:gap-2 lg:rounded-lg lg:p-4"
              >
                <div className="flex w-full items-center gap-1.5 md:gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status.status]}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium leading-4 text-gray-500 md:text-[0.75rem] md:font-normal">
                    {status.label}
                  </span>
                </div>

                <p className="text-[1.25rem] font-bold leading-7 text-text md:text-[1rem] md:font-semibold md:leading-6 lg:text-[1.25rem] lg:leading-7">
                  {formatCount(status.count)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
