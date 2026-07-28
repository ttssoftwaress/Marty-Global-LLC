import { Link } from 'react-router-dom';

import { formatOrderDate } from '../../lib/format';
import type { AdminOrderRow } from '../../types/orders';
import { OrderStatusChip } from './OrderStatusChip';
import { stopRowClick, useOpenOrderRow } from './rowNavigation';

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
 * folded lines only there. That is what lets six columns fit 768px without
 * scrolling; `table-fixed` holds the allocation so a long service name truncates
 * (as the link shows) instead of pushing the action button off the edge. Desktop
 * switches back to `table-auto` and sizes to content.
 *
 * Selection is local to the screen: the header checkbox toggles the loaded page,
 * a row checkbox toggles itself, and the header renders indeterminate on a
 * partial selection. The bulk actions those selections feed land with the
 * backend.
 *
 * The whole row opens the order. The link only draws the trailing button, but a
 * queue whose rows are inert is one staff click at and nothing happens, and a
 * reviewer works this list all day. The reference stays a real anchor, so the
 * destination is keyboard-reachable and can be opened in a new tab; the row
 * handler is the convenience layer over it. The select checkbox and the two
 * links stop the click themselves, so selecting a row never navigates away from
 * the selection.
 */

type OrdersTableProps = {
  orders: AdminOrderRow[];
  selectedIds: string[];
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
};

const HEAD_CELL =
  'px-0 py-0 text-left text-caption font-medium uppercase tracking-[0.3px] text-gray-500';

export function OrdersTable({
  orders,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: OrdersTableProps) {
  const allSelected = orders.length > 0 && selectedIds.length === orders.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const openOrderRow = useOpenOrderRow();

  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[42.5rem] table-fixed border-collapse text-left lg:min-w-[56.25rem] lg:table-auto">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th scope="col" className="w-10 pl-4 pr-2 lg:pl-6">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(node) => {
                  if (node) node.indeterminate = someSelected;
                }}
                onChange={onToggleAll}
                aria-label="Select all orders on this page"
                className="size-[1.125rem] cursor-pointer rounded-[0.25rem] border-[1.5px] border-gray-300 accent-primary"
              />
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[6.25rem] pr-3 lg:w-[6.875rem] lg:pr-4`}>
              Order ID
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[8.125rem] pr-3 lg:w-auto lg:pr-4`}>
              Customer
            </th>
            <th scope="col" className={`${HEAD_CELL} pr-3 lg:pr-4`}>
              Service
            </th>
            <th scope="col" className={`${HEAD_CELL} hidden w-[6.875rem] pr-4 lg:table-cell`}>
              Region
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[5.9375rem] pr-3 lg:w-[6.875rem] lg:pr-4`}>
              Submitted
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[7.5rem] pr-3 lg:w-[8.125rem] lg:pr-4`}>
              Status
            </th>
            <th scope="col" className={`${HEAD_CELL} hidden w-[9.375rem] pr-4 lg:table-cell`}>
              Assigned to
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[6.25rem] pr-4 text-right lg:w-auto lg:pr-6`}>
              <span className="inline-block w-full text-right">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {orders.map((order) => {
            const isSelected = selectedIds.includes(order.id);

            return (
              <tr
                key={order.id}
                onClick={() => openOrderRow(order.to)}
                className={`cursor-pointer border-b border-gray-200 transition-colors last:border-b-0 ${
                  isSelected ? 'bg-primary-light/40' : 'hover:bg-gray-50'
                }`}
              >
                <td
                  className="h-14 pl-4 pr-2 align-middle lg:pl-6"
                  onClick={stopRowClick}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleRow(order.id)}
                    aria-label={`Select order ${order.reference}`}
                    className="size-[1.125rem] cursor-pointer rounded-[0.25rem] border-[1.5px] border-gray-300 accent-primary"
                  />
                </td>

                <td className="py-2 pr-3 align-middle lg:pr-4">
                  <Link
                    to={order.to}
                    onClick={stopRowClick}
                    className="whitespace-nowrap text-body font-medium text-primary hover:underline"
                  >
                    {order.reference}
                  </Link>
                </td>

                <td className="py-2 pr-3 align-middle lg:pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[0.625rem] font-semibold text-gray-700"
                    >
                      {order.customer.initials}
                    </span>
                    <span className="truncate text-body text-gray-900">
                      {order.customer.name}
                    </span>
                  </div>
                </td>

                <td className="py-2 pr-3 align-middle lg:pr-4">
                  <span className="block truncate text-body text-gray-700">
                    {order.service}
                  </span>
                  {/* Tablet folds the region under the service; `lg` has its own column. */}
                  <span className="block truncate text-small text-gray-500 lg:hidden">
                    {order.region.name}
                  </span>
                </td>

                <td className="hidden py-2 pr-4 align-middle lg:table-cell">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-body text-gray-900">
                    {order.region.flag ? (
                      <span aria-hidden="true">{order.region.flag}</span>
                    ) : null}
                    {order.region.name}
                  </span>
                </td>

                <td className="py-2 pr-3 align-middle lg:pr-4">
                  <span className="whitespace-nowrap text-body text-gray-500">
                    {formatOrderDate(order.submittedAt)}
                  </span>
                </td>

                <td className="py-2 pr-3 align-middle lg:pr-4">
                  <OrderStatusChip status={order.status} label={order.statusLabel} />
                  {/* Tablet folds the assignee under the status. */}
                  <span
                    className={`mt-0.5 block truncate text-small lg:hidden ${
                      order.assignee ? 'text-gray-500' : 'italic text-gray-400'
                    }`}
                  >
                    {order.assignee?.name ?? 'Unassigned'}
                  </span>
                </td>

                <td className="hidden py-2 pr-4 align-middle lg:table-cell">
                  {order.assignee ? (
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-light text-[0.5625rem] font-semibold text-primary"
                      >
                        {order.assignee.initials}
                      </span>
                      <span className="truncate text-body text-gray-700">
                        {order.assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-body italic text-gray-400">Unassigned</span>
                  )}
                </td>

                <td className="py-2 pl-2 pr-4 align-middle text-right lg:pr-6">
                  <Link
                    to={order.to}
                    onClick={stopRowClick}
                    className="inline-flex h-10 items-center justify-center rounded-input border border-primary px-4 text-body font-semibold text-primary transition-colors hover:bg-primary-light"
                  >
                    {order.actionLabel}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
