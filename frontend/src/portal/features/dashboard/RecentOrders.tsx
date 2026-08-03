import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { DashboardOrder } from '../../types/dashboard';
import { OrderStatusChip } from './OrderStatusChip';

/*
 * Recent orders — three presentations of one list:
 *   - desktop (lg): table with a SUBMITTED column
 *   - tablet (md): table that folds the date under the service name
 *   - mobile: standalone cards, header lifted out of the card
 *
 * The layouts differ enough (a table row cannot become a card by reflowing)
 * that each renders its own markup and swaps by breakpoint — the same approach
 * the sidebar and top bar take.
 *
 * The design shows a populated list only; the empty state is added here so a
 * new customer sees an explanation instead of a bare card.
 */

type RecentOrdersProps = {
  orders: DashboardOrder[];
};

function EmptyState() {
  return (
    <p className="px-5 py-8 text-center text-body text-gray-500">
      No orders yet — your submitted services will appear here.
    </p>
  );
}

function SectionLink() {
  return (
    <Link
      to="/app/orders"
      className="shrink-0 text-small font-medium text-primary transition-colors hover:text-primary-hover"
    >
      View all orders
    </Link>
  );
}

export function RecentOrders({ orders }: RecentOrdersProps) {
  const isEmpty = orders.length === 0;

  return (
    <>
      {/* Mobile — header outside, one card per order */}
      <section className="flex w-full flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-body-lg font-semibold text-text">
            Recent orders
          </h2>
          <SectionLink />
        </div>

        {isEmpty ? (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState />
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <Link
                  to={`/app/orders/${order.id}`}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-body font-semibold text-text">
                      {order.serviceName}
                    </span>
                    <span className="text-small text-gray-500">
                      #{order.reference} · {formatOrderDate(order.submittedAt)}
                    </span>
                  </span>

                  <OrderStatusChip status={order.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tablet & desktop — card-wrapped table */}
      <section className="hidden w-full flex-col overflow-hidden rounded-card border border-gray-200 bg-white md:flex">
        <div className="flex items-center justify-between gap-3 p-5">
          <h2 className="text-body-lg font-semibold text-text lg:text-h6">
            Recent orders
          </h2>
          <SectionLink />
        </div>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <div className="table-scroll">
            <table className="data-table min-w-[34rem] table-fixed lg:min-w-[42rem]">
              <thead>
                <tr>
                  <th scope="col" className="h-12 px-5">
                    Service / order name
                  </th>
                  <th scope="col" className="h-12 w-[11.5rem] pr-3">
                    Order ID
                  </th>
                  <th
                    scope="col"
                    className="hidden h-12 w-[7.5rem] pr-3 lg:table-cell"
                  >
                    Submitted
                  </th>
                  <th scope="col" className="h-12 w-[8.75rem] pr-5">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="h-[3.75rem] lg:h-table-row">
                    <td className="min-w-0 px-5">
                      <Link
                        to={`/app/orders/${order.id}`}
                        className="flex min-w-0 flex-col gap-0.5 lg:gap-0"
                      >
                        <span
                          className="truncate font-medium"
                          title={order.serviceName}
                        >
                          {order.serviceName}
                        </span>
                        <span className="text-caption text-gray-500 lg:hidden">
                          {formatOrderDate(order.submittedAt)}
                        </span>
                      </Link>
                    </td>

                    <td className="pr-3 text-gray-500">
                      <span className="block truncate" title={order.reference}>
                        #{order.reference}
                      </span>
                    </td>

                    <td className="hidden whitespace-nowrap pr-3 text-gray-500 lg:table-cell">
                      {formatOrderDate(order.submittedAt)}
                    </td>

                    <td className="pr-5">
                      <OrderStatusChip status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
