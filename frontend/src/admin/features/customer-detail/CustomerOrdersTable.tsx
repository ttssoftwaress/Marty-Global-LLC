import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { CustomerOrderRow } from '../../types/customer-detail';
import { OrderRowDetails } from '../orders/OrderRowDetails';
import { OrderStatusChip } from '../orders/OrderStatusChip';

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
 * instead of pushing the action off the edge. The table's minimum width is the
 * sum of the fixed columns plus a readable service column, so nothing is ever
 * scaled below what it needs — the frame scrolls instead.
 *
 * The whole row expands, the same as the main queue's — the two tables list the
 * same records and open the identical panel, so they must not disagree about
 * what clicking a row does. The panel is fetched on expand and one row is open
 * at a time; the "View order" link stops its own click, so opening the order is
 * still one press away.
 */

type CustomerOrdersTableProps = {
  orders: CustomerOrderRow[];
};

export function CustomerOrdersTable({ orders }: CustomerOrdersTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[42.5rem] table-fixed lg:min-w-[55rem]">
        <thead>
          <tr className="h-12">
            <th scope="col" className="pl-5 pr-4 lg:pl-card lg:pr-4">
              Service
            </th>
            {/* Sized for the real `ORD-<year>-<8 chars>` reference, not the
                shorter one the design draws — see OrdersTable. */}
            <th scope="col" className="w-[10.5rem] pr-4 lg:w-[11.5rem]">
              Order ID
            </th>
            <th scope="col" className="hidden w-[10rem] pr-4 lg:table-cell">
              Date submitted
            </th>
            <th scope="col" className="w-[9.375rem] pr-4 lg:w-[11.25rem]">
              Status
            </th>
            <th
              scope="col"
              className="w-[6.875rem] pr-4 text-right lg:w-[7.5rem]"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-5 lg:pr-card">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const isExpanded = order.id === expandedId;
            const panelId = detailPanelId('customer-order', order.id);

            return (
              <Fragment key={order.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(order.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} details for order ${order.reference}`,
                  })}
                  className={expandedRowClass(isExpanded)}
                >
                  <td className="h-16 py-3 pl-5 pr-4 lg:h-table-row lg:pl-card">
                    <span
                      className="block truncate font-medium"
                      title={order.service}
                    >
                      {order.service}
                    </span>
                  </td>

                  <td className="py-3 pr-4">
                    <span
                      className="block truncate font-medium text-text-secondary lg:text-gray-600"
                      title={order.reference}
                    >
                      {order.reference}
                    </span>
                    {/* Tablet folds the date under the reference; `lg` has its
                        own column for it. */}
                    <span className="block truncate text-caption text-gray-400 lg:hidden">
                      {formatOrderDate(order.submittedAt)}
                    </span>
                  </td>

                  <td className="hidden py-3 pr-4 lg:table-cell">
                    <span className="whitespace-nowrap text-gray-500">
                      {formatOrderDate(order.submittedAt)}
                    </span>
                  </td>

                  <td className="py-3 pr-4">
                    <OrderStatusChip
                      status={order.status}
                      label={order.statusLabel}
                    />
                  </td>

                  <td className="py-3 pl-2 pr-4 text-right">
                    <Link
                      to={order.to}
                      onClick={stopRowToggle}
                      className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-input border border-primary bg-white px-3.5 text-[0.8125rem] font-semibold text-primary transition-colors hover:bg-primary-light"
                    >
                      View order
                    </Link>
                  </td>

                  <ExpandChevronCell
                    isExpanded={isExpanded}
                    className="pr-5 lg:pr-card"
                  />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={6}>
                    <OrderRowDetails orderId={order.id} to={order.to} />
                  </DetailRow>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
