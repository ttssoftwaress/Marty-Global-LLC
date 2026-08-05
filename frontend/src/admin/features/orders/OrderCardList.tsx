import { Link } from 'react-router-dom';

import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { AdminOrderRow } from '../../types/orders';
import { OrderRowDetails } from './OrderRowDetails';
import { OrderStatusChip } from './OrderStatusChip';

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
 * Tapping the card body EXPANDS it, matching the table it replaces: the same
 * triage panel, fetched when opened. The card is not wrapped in a link — the
 * action button is a link of its own and anchors cannot nest — so the body is a
 * button, the reference and the action stay separately tappable, and one card is
 * open at a time.
 */

type OrderCardListProps = {
  orders: AdminOrderRow[];
};

export function OrderCardList({ orders }: OrderCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {orders.map((order) => {
        const isExpanded = order.id === expandedId;
        const panelId = detailPanelId('order-card', order.id);

        return (
          <li
            key={order.id}
            className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-sm-elevation"
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                to={order.to}
                className="text-body font-semibold text-primary hover:underline"
              >
                {order.reference}
              </Link>
              <OrderStatusChip status={order.status} label={order.statusLabel} />
            </div>

            <button
              type="button"
              onClick={() => toggle(order.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-3 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-body font-medium text-gray-900">
                  {order.customer.name}
                </span>
                <ExpandChevron isExpanded={isExpanded} />
              </span>

              <span className="flex flex-wrap items-center gap-1.5 text-small text-gray-600">
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
              </span>

              <span className="flex flex-wrap items-center gap-1.5 text-small text-gray-400">
                <span>{formatOrderDate(order.submittedAt)}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {order.assignee
                    ? `Assigned to ${order.assignee.name}`
                    : 'Unassigned'}
                </span>
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <OrderRowDetails orderId={order.id} to={order.to} />
              </div>
            ) : null}

            <Link
              to={order.to}
              className="flex h-10 w-full items-center justify-center rounded-input border border-primary text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
            >
              {order.actionLabel}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
