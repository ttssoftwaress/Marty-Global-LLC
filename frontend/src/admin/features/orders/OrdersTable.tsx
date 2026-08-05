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
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatOrderDate } from '../../lib/format';
import type { AdminOrderRow } from '../../types/orders';
import { OrderRowDetails } from './OrderRowDetails';
import { OrderStatusChip } from './OrderStatusChip';

/*
 * The queue table — the desktop and tablet presentation (mobile renders cards
 * instead; see OrderCardList).
 *
 * One real `<table>` so the columns align, the header is announced, and the
 * checkbox column reads as a selection control rather than a decoration.
 *
 * Tablet drops the standalone REGION and ASSIGNED TO columns — its link folds
 * the region under the service and the assignee under the status — so the same
 * markup covers both by hiding those two cells below `lg` and revealing the
 * folded lines only there. `table-fixed` holds the allocation so a long service
 * name truncates (as the link shows) instead of pushing the action button off
 * the edge. Desktop switches back to `table-auto` and sizes to content.
 *
 * Selection is local to the screen: the header checkbox toggles the loaded page,
 * a row checkbox toggles itself, and the header renders indeterminate on a
 * partial selection. The bulk actions those selections feed land with the
 * backend.
 *
 * Clicking the row EXPANDS it rather than navigating. A reviewer working this
 * list is usually triaging — which customer, which services, what did they
 * write, what has been filed — and a queue that answers those in place is
 * several page loads cheaper than one that answers them by leaving. The order
 * itself is still one click away: the reference and the trailing button are
 * real links, so the destination can be opened in a new tab, and they stop
 * their own clicks so following one never also toggles a panel. The panel's
 * data is fetched on expand (OrderRowDetails), and one row is open at a time.
 *
 * The row carries the toggle props rather than a bare `onClick`, so it is a tab
 * stop that Enter/Space opens as well — the enlarged target is not pointer-only.
 * It keeps its native `row` role (see ExpandableRow for why no `role="button"`).
 *
 * The order ID column is sized for the reference the backend issues, not the
 * short one the design draws: `ORD-<year>-<8 chars>` is seventeen characters
 * (orders.service.ts), and at the design's 100px it ran over the customer name
 * beside it. It truncates with a `title` at `md`, where the width is fixed, and
 * sizes to the full reference at `lg`, where the table is `table-auto`.
 */

type OrdersTableProps = {
  orders: AdminOrderRow[];
  selection: RowSelection;
  /*
   * False when the signed-in member may not delete here. The tick column stays —
   * it predates the delete and the selected-row highlight is useful on its own —
   * but without this the selection leads nowhere, so the page simply does not
   * render the bar above it.
   */
  selectable: boolean;
};

export function OrdersTable({ orders, selection, selectable }: OrdersTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[55rem] table-fixed lg:min-w-[60rem] lg:table-auto">
        <thead>
          <tr className="h-12">
            <th scope="col" className="w-10 pl-4 pr-2 lg:pl-6">
              <RowCheckbox
                checked={selection.allVisibleSelected}
                indeterminate={selection.someVisibleSelected}
                onChange={selection.toggleAllVisible}
                label="Select all orders on this page"
                className="size-[1.125rem] border-[1.5px]"
              />
            </th>
            <th scope="col" className="w-[9.5rem] pr-3 lg:w-auto lg:pr-4">
              Order ID
            </th>
            <th scope="col" className="w-[8.125rem] pr-3 lg:w-auto lg:pr-4">
              Customer
            </th>
            <th scope="col" className="pr-3 lg:pr-4">
              Service
            </th>
            <th scope="col" className="hidden w-[6.875rem] pr-4 lg:table-cell">
              Region
            </th>
            <th
              scope="col"
              className="w-[5.9375rem] pr-3 lg:w-[6.875rem] lg:pr-4"
            >
              Submitted
            </th>
            <th scope="col" className="w-[7.5rem] pr-3 lg:w-[8.125rem] lg:pr-4">
              Status
            </th>
            <th scope="col" className="hidden w-[9.375rem] pr-4 lg:table-cell">
              Assigned to
            </th>
            <th
              scope="col"
              className="w-[6.25rem] pr-3 text-right lg:w-auto lg:pr-4"
            >
              <span className="inline-block w-full text-right">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-4 lg:pr-6">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const isSelected = selection.isSelected(order.id);
            const isExpanded = order.id === expandedId;
            const panelId = detailPanelId('order', order.id);

            return (
              <Fragment key={order.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(order.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} details for order ${order.reference}`,
                  })}
                  className={
                    isSelected
                      ? `cursor-pointer bg-primary-light/40 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary`
                      : expandedRowClass(isExpanded)
                  }
                >
                  <td
                    className="h-14 py-0 pl-4 pr-2 lg:pl-6"
                    onClick={stopRowToggle}
                  >
                    <RowCheckbox
                      checked={isSelected}
                      onChange={() => selection.toggle(order.id)}
                      label={`Select order ${order.reference}`}
                      className="size-[1.125rem] border-[1.5px]"
                    />
                  </td>

                  <td className="py-2 pr-3 lg:pr-4">
                    <Link
                      to={order.to}
                      onClick={stopRowToggle}
                      title={order.reference}
                      className="block truncate font-medium text-primary hover:underline"
                    >
                      {order.reference}
                    </Link>
                  </td>

                  <td className="py-2 pr-3 lg:pr-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[0.625rem] font-semibold text-gray-700"
                      >
                        {order.customer.initials}
                      </span>
                      <span
                        className="truncate text-gray-900"
                        title={order.customer.name}
                      >
                        {order.customer.name}
                      </span>
                    </div>
                  </td>

                  <td className="py-2 pr-3 lg:pr-4">
                    <span
                      className="block truncate text-gray-700"
                      title={order.service}
                    >
                      {order.service}
                    </span>
                    {/* Tablet folds the region under the service; `lg` has its own column. */}
                    <span className="block truncate text-small text-gray-500 lg:hidden">
                      {order.region.name}
                    </span>
                  </td>

                  <td className="hidden py-2 pr-4 lg:table-cell">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-gray-900">
                      {order.region.flag ? (
                        <span aria-hidden="true">{order.region.flag}</span>
                      ) : null}
                      {order.region.name}
                    </span>
                  </td>

                  <td className="py-2 pr-3 lg:pr-4">
                    <span className="block truncate text-gray-500">
                      {formatOrderDate(order.submittedAt)}
                    </span>
                  </td>

                  <td className="py-2 pr-3 lg:pr-4">
                    <OrderStatusChip
                      status={order.status}
                      label={order.statusLabel}
                    />
                    {/* Tablet folds the assignee under the status. */}
                    <span
                      className={`mt-0.5 block truncate text-small lg:hidden ${
                        order.assignee ? 'text-gray-500' : 'italic text-gray-400'
                      }`}
                    >
                      {order.assignee?.name ?? 'Unassigned'}
                    </span>
                  </td>

                  <td className="hidden py-2 pr-4 lg:table-cell">
                    {order.assignee ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.5625rem] font-semibold text-primary"
                        >
                          {order.assignee.initials}
                        </span>
                        <span className="truncate text-gray-700">
                          {order.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="italic text-gray-400">Unassigned</span>
                    )}
                  </td>

                  <td className="py-2 pl-2 pr-3 text-right lg:pr-4">
                    <Link
                      to={order.to}
                      onClick={stopRowToggle}
                      className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-input border border-primary px-4 font-semibold text-primary transition-colors hover:bg-primary-light"
                    >
                      {order.actionLabel}
                    </Link>
                  </td>

                  <ExpandChevronCell isExpanded={isExpanded} className="py-2" />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={10}>
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
