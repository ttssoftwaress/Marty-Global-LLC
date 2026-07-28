import type { MouseEvent } from 'react';
import { ChevronDown, PackageOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { OrderStatusChip } from '../dashboard/OrderStatusChip';
import { formatOrderDate } from '../../lib/format';
import type { Order } from '../../types/orders';
import { OrderRowAction } from './OrderRowAction';

/*
 * Orders list — three presentations of one list, swapped by breakpoint (a table
 * row cannot become a card by reflowing, so each renders its own markup, the
 * same approach the dashboard's recent-orders takes):
 *   - desktop (lg): full table — service · order id · date · status · action
 *   - tablet (md):  table that folds the order id under the service name and
 *                   drops the standalone ORDER ID column
 *   - mobile:       one card per order, header + meta + full-width action
 *
 * The whole row opens the order. The design only draws the trailing button, but
 * a list of records where the record itself is inert is a list people click at
 * and nothing happens — and it left an order reachable only through one small
 * target. The service name is a real anchor inside the row, so the destination
 * is keyboard-reachable, focusable, and can be opened in a new tab; the row's
 * own handler is the convenience layer over it, not the only way in.
 *
 * The DATE SUBMITTED header carries the design's sort affordance (highlighted
 * label + chevron). Sorting is a data concern the backend owns, so the header
 * is a button ready to request a sort rather than sorting in the browser.
 *
 * The design shows a populated list only; the empty state is added here so a
 * filter or search with no matches explains itself instead of showing a bare
 * card.
 */

type OrdersListProps = {
  orders: Order[];
  /*
   * Mobile appends rather than pages: "Load more" grows the visible set instead
   * of stepping a window, so it needs its own list. Defaults to `orders` so a
   * caller with one list for every breakpoint keeps working.
   */
  mobileOrders?: Order[];
  onToggleDateSort?: () => void;
};

export const orderDetailPath = (orderId: string) => `/app/orders/${orderId}`;

/*
 * A click anywhere on the row opens it, with two exceptions:
 *   - a click that ends a text selection is someone reading a reference, not
 *     navigating
 *   - a click inside the action cell belongs to that control, which stops the
 *     event itself
 */
function useOpenOrder() {
  const navigate = useNavigate();

  return (orderId: string) => {
    if (window.getSelection()?.toString()) return;
    navigate(orderDetailPath(orderId));
  };
}

// The trailing control is a link of its own; without this its click would also
// run the row handler and both would navigate.
const stopRowClick = (event: MouseEvent) => event.stopPropagation();

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[24px] bg-gray-100">
        <PackageOpen className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-body-lg font-semibold text-text">No orders found</p>
      <p className="max-w-[360px] text-body text-gray-500">
        No orders match this view yet. Try another filter or start a new order.
      </p>
    </div>
  );
}

function DateSortHeader({ onToggle }: { onToggle?: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 whitespace-nowrap text-caption font-semibold uppercase tracking-[0.6px] text-primary"
    >
      Date submitted
      <ChevronDown className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function OrdersList({
  orders,
  mobileOrders,
  onToggleDateSort,
}: OrdersListProps) {
  const isEmpty = orders.length === 0;
  const cardOrders = mobileOrders ?? orders;
  const openOrder = useOpenOrder();

  return (
    <>
      {/* Mobile — one card per order */}
      <ul className="flex w-full flex-col gap-3 md:hidden">
        {cardOrders.length === 0 ? (
          <li className="rounded-card border border-gray-200 bg-white">
            <EmptyState />
          </li>
        ) : (
          cardOrders.map((order) => (
            <li
              key={order.id}
              onClick={() => openOrder(order.id)}
              className="flex cursor-pointer flex-col gap-3 rounded-input border border-gray-300 bg-white p-4 transition-colors active:bg-gray-50"
            >
              <div className="flex items-start gap-2">
                <Link
                  to={orderDetailPath(order.id)}
                  onClick={stopRowClick}
                  className="min-w-0 flex-1 text-body font-semibold text-text"
                >
                  {order.serviceName}
                </Link>
                <OrderStatusChip status={order.status} />
              </div>

              <p className="text-small text-gray-500">
                #{order.reference} · {formatOrderDate(order.submittedAt)}
              </p>

              <div onClick={stopRowClick}>
                <OrderRowAction order={order} fullWidth />
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Tablet & desktop — card-wrapped table */}
      <div className="hidden w-full overflow-hidden rounded-card border border-gray-200 bg-white shadow-sm-elevation md:block">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="h-11 border-b border-gray-200 bg-[var(--table-header-bg)] text-left align-middle lg:h-12">
              <th
                scope="col"
                className="px-4 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:px-6"
              >
                Service / order name
              </th>
              <th
                scope="col"
                className="hidden px-0 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:table-cell lg:w-[150px]"
              >
                Order ID
              </th>
              <th scope="col" className="w-[128px] px-0 lg:w-[160px]">
                <DateSortHeader onToggle={onToggleDateSort} />
              </th>
              <th
                scope="col"
                className="w-[132px] px-0 text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[150px]"
              >
                Status
              </th>
              <th
                scope="col"
                className="w-[150px] px-0 pr-4 text-right text-caption font-semibold uppercase tracking-[0.6px] text-gray-500 lg:w-[170px] lg:pr-6"
              >
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState />
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => openOrder(order.id)}
                  className="h-16 cursor-pointer border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50 lg:h-table-row"
                >
                  <td className="min-w-0 px-4 lg:px-6">
                    <Link
                      to={orderDetailPath(order.id)}
                      onClick={stopRowClick}
                      className="block truncate text-body font-semibold text-text"
                    >
                      {order.serviceName}
                    </Link>
                    <p className="truncate text-small text-gray-500 lg:hidden">
                      #{order.reference}
                    </p>
                  </td>

                  <td className="hidden text-body text-gray-500 lg:table-cell">
                    #{order.reference}
                  </td>

                  <td className="text-[13px] text-gray-500 lg:text-body">
                    {formatOrderDate(order.submittedAt)}
                  </td>

                  <td>
                    <OrderStatusChip status={order.status} />
                  </td>

                  <td className="pr-0 text-right lg:pr-6">
                    <div className="flex justify-end" onClick={stopRowClick}>
                      <OrderRowAction order={order} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
