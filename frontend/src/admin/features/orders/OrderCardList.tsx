import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { AdminOrderRow } from '../../types/orders';
import { OrderStatusChip } from './OrderStatusChip';
import { stopRowClick, useOpenOrderRow } from './rowNavigation';

/*
 * The mobile presentation of the queue — one card per order, replacing the table
 * below `md`. Each card follows its link: reference and status chip on the top
 * row, the customer's name, then service · region, then submitted · assignee,
 * with a full-width action button.
 *
 * The assignee line prints the desktop link's wording — "Unassigned" — rather
 * than the mobile mock's "Assigned to —", since the desktop link is the copy
 * source across the three (Design.md).
 *
 * The whole card opens the order, matching the table it replaces — tapping a
 * record and having nothing happen is worse on a phone than anywhere else. It is
 * not wrapped in a link, though: the action button is a link of its own and
 * anchors cannot nest, and a card-sized anchor would make the reference and the
 * customer's name unselectable. So the card navigates on tap, its two links stop
 * the tap themselves, and a tap that ends a text selection is left alone.
 */

type OrderCardListProps = {
  orders: AdminOrderRow[];
};

export function OrderCardList({ orders }: OrderCardListProps) {
  const openOrderRow = useOpenOrderRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {orders.map((order) => (
        <li
          key={order.id}
          onClick={() => openOrderRow(order.to)}
          className="flex cursor-pointer flex-col gap-3 rounded-card bg-white p-4 shadow-sm-elevation transition-colors active:bg-gray-50"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              to={order.to}
              onClick={stopRowClick}
              className="text-body font-semibold text-primary hover:underline"
            >
              {order.reference}
            </Link>
            <OrderStatusChip status={order.status} label={order.statusLabel} />
          </div>

          <p className="text-body font-medium text-gray-900">{order.customer.name}</p>

          <p className="flex flex-wrap items-center gap-1.5 text-small text-gray-600">
            <span>{order.service}</span>
            <span aria-hidden="true" className="text-gray-500">
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              {order.region.flag ? (
                <span aria-hidden="true">{order.region.flag}</span>
              ) : null}
              {order.region.name}
            </span>
          </p>

          <p className="flex flex-wrap items-center gap-1.5 text-small text-gray-400">
            <span>{formatOrderDate(order.submittedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>
              {order.assignee ? `Assigned to ${order.assignee.name}` : 'Unassigned'}
            </span>
          </p>

          <Link
            to={order.to}
            onClick={stopRowClick}
            className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            {order.actionLabel}
          </Link>
        </li>
      ))}
    </ul>
  );
}
