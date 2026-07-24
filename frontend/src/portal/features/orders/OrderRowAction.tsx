import { Link } from 'react-router-dom';

import type { Order } from '../../types/orders';

/*
 * Row action — the button at the end of each order. The design shows two
 * states: a secondary "View order" for most orders, and a primary "Upload
 * documents" for an order whose status is `missing_info` (the one that needs
 * the customer to act). The status decides which renders, so it stays a
 * function of the data rather than a hardcoded per-row choice.
 *
 * `fullWidth` is the mobile card variant; desktop and tablet pass a fixed
 * width from the row instead.
 */

type OrderRowActionProps = {
  order: Order;
  fullWidth?: boolean;
};

export function OrderRowAction({ order, fullWidth }: OrderRowActionProps) {
  const needsDocuments = order.status === 'missing_info';
  const width = fullWidth ? 'w-full' : '';

  if (needsDocuments) {
    return (
      <Link
        to={`/app/orders/${order.id}/documents`}
        className={`btn btn-primary h-10 whitespace-nowrap rounded-input px-4 text-[13px] ${width}`}
      >
        Upload documents
      </Link>
    );
  }

  return (
    <Link
      to={`/app/orders/${order.id}`}
      className={`btn btn-secondary h-10 whitespace-nowrap rounded-input px-4 text-[13px] ${width}`}
    >
      View order
    </Link>
  );
}
