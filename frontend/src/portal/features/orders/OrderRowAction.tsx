import { Link } from 'react-router-dom';

import type { Order } from '../../types/orders';

/*
 * Row action — the button at the end of each order.
 *
 * The design shows two states: a secondary "View order" for most orders, and a
 * primary emphasis on an order whose status is `missing_info` (the one that
 * needs the customer to act). The status decides which renders, so it stays a
 * function of the data rather than a hardcoded per-row choice.
 *
 * DEVIATION: the design labels the `missing_info` action "Upload documents" and
 * points it at an upload screen. That screen does not exist — files live in
 * Cloudflare R2 behind presigned URLs and that feature is not wired — so the
 * button routed to a URL with no route behind it, which sent the one row that
 * most needs attention to the 404 page. Both buttons now open the order, which
 * is where the team's message explaining what is missing actually lives; the
 * urgent row keeps its primary emphasis and reads "View request". Restore the
 * upload destination when the documents feature lands.
 *
 * `fullWidth` is the mobile card variant; desktop and tablet pass a fixed width
 * from the row instead.
 */

type OrderRowActionProps = {
  order: Order;
  fullWidth?: boolean;
};

export function OrderRowAction({ order, fullWidth }: OrderRowActionProps) {
  const needsAttention = order.status === 'missing_info';
  const width = fullWidth ? 'w-full' : '';

  return (
    <Link
      to={`/app/orders/${order.id}`}
      className={`btn h-10 whitespace-nowrap rounded-input px-4 text-[13px] ${
        needsAttention ? 'btn-primary' : 'btn-secondary'
      } ${width}`}
    >
      {needsAttention ? 'View request' : 'View order'}
    </Link>
  );
}
