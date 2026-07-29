import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { CustomerOrderRow } from '../../types/customer-detail';
import { OrderStatusChip } from '../orders/OrderStatusChip';
import { ROW_FOCUS_CLASS, stopRowClick, useOrderRowProps } from '../orders/rowNavigation';

/*
 * The customer's orders as a table — the tablet and desktop presentation (mobile
 * renders cards instead; see CustomerOrderCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * values line up under their headings.
 *
 * The two links differ in how much they fit, which the same markup covers:
 *   - desktop (lg): five columns — service, order id, date submitted, status,
 *     and the "View order" action.
 *   - tablet (md):  four — the date folds under the order id as a second line,
 *     and the row grows to 64px to hold it.
 *
 * `table-fixed` holds the column allocation so a long service name truncates
 * instead of pushing the action off the edge.
 *
 * The whole row opens the order, the same as the main queue's — the two tables
 * list the same records, so they must not disagree about whether a row is
 * clickable. The action link stops the click itself so it is not handled twice.
 * The row carries the shared row props, so it is a tab stop that Enter/Space
 * opens as well.
 */

type CustomerOrdersTableProps = {
  orders: CustomerOrderRow[];
};

const HEAD_CELL =
  'px-0 py-0 text-left text-caption font-semibold uppercase tracking-[0.6px] text-gray-400 lg:text-gray-500';

export function CustomerOrdersTable({ orders }: CustomerOrdersTableProps) {
  const rowProps = useOrderRowProps();

  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[38.75rem] table-fixed border-collapse text-left lg:min-w-[51.25rem]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th scope="col" className={`${HEAD_CELL} pl-5 pr-4 lg:pl-card lg:pr-4`}>
              Service
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[8.125rem] pr-4 lg:w-[8.75rem]`}>
              Order ID
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[10rem] pr-4 lg:table-cell`}
            >
              Date submitted
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[9.375rem] pr-4 lg:w-[11.25rem]`}>
              Status
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[6.875rem] pr-5 text-right lg:w-[7.5rem] lg:pr-card`}
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              {...rowProps(order.to)}
              className={`cursor-pointer border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50 ${ROW_FOCUS_CLASS}`}
            >
              <td className="h-16 py-3 pl-5 pr-4 align-middle lg:h-table-row lg:pl-card">
                <span className="block truncate text-body font-medium text-text">
                  {order.service}
                </span>
              </td>

              <td className="py-3 pr-4 align-middle">
                <span className="block truncate text-body font-medium text-text-secondary lg:text-gray-600">
                  {order.reference}
                </span>
                {/* Tablet folds the date under the reference; `lg` has its own
                    column for it. */}
                <span className="block truncate text-caption text-gray-400 lg:hidden">
                  {formatOrderDate(order.submittedAt)}
                </span>
              </td>

              <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                <span className="whitespace-nowrap text-body text-gray-500">
                  {formatOrderDate(order.submittedAt)}
                </span>
              </td>

              <td className="py-3 pr-4 align-middle">
                <OrderStatusChip status={order.status} label={order.statusLabel} />
              </td>

              <td className="py-3 pl-2 pr-5 text-right align-middle lg:pr-card">
                <Link
                  to={order.to}
                  onClick={stopRowClick}
                  className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-input border border-primary bg-white px-3.5 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
                >
                  View order
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
