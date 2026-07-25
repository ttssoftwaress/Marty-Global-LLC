import { formatCount } from '../../lib/format';
import type { OrderStatus, OrderStatusCount } from '../../types/dashboard';

/*
 * Orders by status — the pipeline at a glance. Desktop lays the six blocks in
 * one row inside the card; tablet and mobile wrap to 3-across over two rows,
 * matching their Figma links.
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
  completed: 'bg-primary',
};

export function OrdersByStatus({ statuses }: { statuses: OrderStatusCount[] }) {
  return (
    <section className="flex w-full flex-col gap-2.5 md:gap-0">
      <h2 className="text-[14px] font-semibold leading-5 text-gray-700 md:hidden">
        Orders by status
      </h2>

      <div className="flex w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-4 md:p-card">
        <h2 className="hidden text-[18px] font-semibold leading-6 text-text md:block">
          Orders by status
        </h2>

        {statuses.length === 0 ? (
          <p className="py-2 text-[14px] leading-5 text-gray-500">
            No orders in this period yet.
          </p>
        ) : (
          <ul className="grid w-full grid-cols-3 gap-2.5 md:gap-3 lg:grid-cols-6 lg:gap-4">
            {statuses.map((status) => (
              <li
                key={status.status}
                className="flex flex-col gap-1 rounded-[10px] border border-gray-200 bg-white p-3 md:gap-1 lg:gap-2 lg:rounded-lg lg:p-4"
              >
                <div className="flex w-full items-center gap-1.5 md:gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${STATUS_DOT[status.status]}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-4 text-gray-500 md:text-[12px] md:font-normal">
                    {status.label}
                  </span>
                </div>

                <p className="text-[20px] font-bold leading-7 text-text md:text-[16px] md:font-semibold md:leading-6 lg:text-[20px] lg:leading-7">
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
