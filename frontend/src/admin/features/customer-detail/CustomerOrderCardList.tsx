import { Link } from 'react-router-dom';

import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { CustomerOrderRow } from '../../types/customer-detail';
import { OrderRowDetails } from '../orders/OrderRowDetails';
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
 * Tapping the card body expands it, matching the table it replaces — the same
 * panel, fetched when opened. The card is not wrapped in a link (the button is
 * a link of its own and anchors cannot nest), so the body is a button and the
 * reference stays selectable. One card is open at a time.
 */

type CustomerOrderCardListProps = {
  orders: CustomerOrderRow[];
};

export function CustomerOrderCardList({ orders }: CustomerOrderCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {orders.map((order) => {
        const isExpanded = order.id === expandedId;
        const panelId = detailPanelId('customer-order-card', order.id);

        return (
          <li
            key={order.id}
            className="flex flex-col gap-3.5 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
          >
            <button
              type="button"
              onClick={() => toggle(order.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-3.5 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-body font-semibold text-text">
                  {order.service}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <OrderStatusChip
                    status={order.status}
                    label={order.statusLabel}
                  />
                  <ExpandChevron isExpanded={isExpanded} />
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-1.5 text-small text-gray-500">
                <span>{order.reference}</span>
                <span aria-hidden="true">·</span>
                <span>{formatOrderDate(order.submittedAt)}</span>
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <OrderRowDetails orderId={order.id} to={order.to} />
              </div>
            ) : null}

            <Link
              to={order.to}
              className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-body font-semibold text-primary transition-colors hover:bg-primary-light"
            >
              View order
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
