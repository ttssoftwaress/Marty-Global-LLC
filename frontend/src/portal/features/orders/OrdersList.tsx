import type { KeyboardEvent, MouseEvent } from 'react';
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
 * can be opened in a new tab; the row is the convenience layer over it, not the
 * only way in. The row is a keyboard target too — `useRowProps` gives it a tab
 * stop and Enter/Space activation, so the enlarged target is not pointer-only.
 *
 * The DATE SUBMITTED header carries the design's sort affordance (highlighted
 * label + chevron). Sorting is a data concern the backend owns, so the header
 * is a button ready to request a sort rather than sorting in the browser.
 *
 * The design shows a populated list only; the empty state is added here so a
 * filter or search with no matches explains itself instead of showing a bare
 * card.
 *
 * The table sits in its own scroll port inside the card, with a minimum width
 * that is the sum of the fixed columns plus a readable service column. Without
 * one, `table-fixed` gave the fixed columns their rem widths and left the
 * service name whatever was over — nothing at all on a narrow workspace — and
 * the card's `overflow-hidden` meant the cells that could not shrink were
 * painted over their neighbours rather than scrolled to.
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
 *
 * Enter/Space on the focused row does the same. The keydown only fires when the
 * row itself is focused — a key press inside the service link or the action
 * control belongs to that control and must not navigate twice.
 *
 * No `role` is set on the row: `role="button"`/`role="link"` may not contain
 * interactive descendants (every row holds at least two), and on a `<tr>` it
 * would drop the row out of the table's structure. The element keeps its native
 * role and gains the behaviour.
 */
function useRowProps() {
  const navigate = useNavigate();

  const openOrder = (orderId: string) => {
    if (window.getSelection()?.toString()) return;
    navigate(orderDetailPath(orderId));
  };

  return (orderId: string) => ({
    tabIndex: 0,
    onClick: () => openOrder(orderId),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openOrder(orderId);
    },
  });
}

// The trailing control is a link of its own; without this its click would also
// run the row handler and both would navigate.
const stopRowClick = (event: MouseEvent) => event.stopPropagation();

// Inset — a row sits flush against its neighbours, so an outward offset would be
// clipped or overlap the row above.
const ROW_FOCUS_CLASS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary';

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-[1.5rem] bg-gray-100">
        <PackageOpen
          className="size-6 text-gray-400"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </span>
      <p className="text-body-lg font-semibold text-text">No orders found</p>
      <p className="max-w-[22.5rem] text-body text-gray-500">
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
      <ChevronDown
        className="size-3.5 shrink-0"
        strokeWidth={2}
        aria-hidden="true"
      />
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
  const rowProps = useRowProps();

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
              {...rowProps(order.id)}
              className={`flex cursor-pointer flex-col gap-3 rounded-input border border-gray-300 bg-white p-4 transition-colors active:bg-gray-50 ${ROW_FOCUS_CLASS}`}
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
        <div className="table-scroll">
          <table className="data-table min-w-[42.5rem] table-fixed lg:min-w-[57rem]">
            <thead>
              <tr className="h-11 lg:h-12">
                <th scope="col" className="px-4 lg:px-6">
                  Service / order name
                </th>
                <th
                  scope="col"
                  className="hidden px-0 lg:table-cell lg:w-[11.5rem]"
                >
                  Order ID
                </th>
                <th scope="col" className="w-[8rem] px-0 lg:w-[10rem]">
                  <DateSortHeader onToggle={onToggleDateSort} />
                </th>
                <th scope="col" className="w-[8.25rem] px-0 lg:w-[9.375rem]">
                  Status
                </th>
                <th
                  scope="col"
                  className="w-[9.375rem] px-0 pr-4 text-right lg:w-[10.625rem] lg:pr-6"
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {isEmpty ? (
                <tr>
                  <td colSpan={5} className="py-0">
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    {...rowProps(order.id)}
                    className={`h-16 cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100 lg:h-table-row ${ROW_FOCUS_CLASS}`}
                  >
                    <td className="min-w-0 px-4 lg:px-6">
                      <Link
                        to={orderDetailPath(order.id)}
                        onClick={stopRowClick}
                        title={order.serviceName}
                        className="block truncate font-semibold"
                      >
                        {order.serviceName}
                      </Link>
                      <p className="truncate text-small text-gray-500 lg:hidden">
                        #{order.reference}
                      </p>
                    </td>

                    <td className="hidden pr-4 text-gray-500 lg:table-cell">
                      <span className="block truncate" title={order.reference}>
                        #{order.reference}
                      </span>
                    </td>

                    <td className="pr-3 text-[0.8125rem] text-gray-500 lg:text-body">
                      <span className="block truncate">
                        {formatOrderDate(order.submittedAt)}
                      </span>
                    </td>

                    <td className="pr-3">
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
      </div>
    </>
  );
}
