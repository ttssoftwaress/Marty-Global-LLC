import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { CustomerOrderRow } from '../../types/customer-detail';
import { OrderStatusChip } from '../orders/OrderStatusChip';

/*
 * The mobile presentation of the customer's orders — one card per order,
 * replacing the table below `md`. Each card follows its link: the service name
 * with the status chip beside it, a meta line of reference · date, and a
 * full-width "View order" button.
 *
 * The meta separator is decorative, so it is hidden from assistive tech and the
 * two values read on their own.
 *
 * The whole card is not a link: the button is the row's single primary target,
 * which keeps the card's text selectable.
 */

type CustomerOrderCardListProps = {
  orders: CustomerOrderRow[];
};

export function CustomerOrderCardList({ orders }: CustomerOrderCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {orders.map((order) => (
        <li
          key={order.id}
          className="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-body font-semibold text-text">
              {order.service}
            </span>
            <OrderStatusChip status={order.status} label={order.statusLabel} />
          </div>

          <p className="flex flex-wrap items-center gap-1.5 text-small text-gray-500">
            <span>{order.reference}</span>
            <span aria-hidden="true">·</span>
            <span>{formatOrderDate(order.submittedAt)}</span>
          </p>

          <Link
            to={order.to}
            className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-body font-semibold text-primary transition-colors hover:bg-primary-light"
          >
            View order
          </Link>
        </li>
      ))}
    </ul>
  );
}
