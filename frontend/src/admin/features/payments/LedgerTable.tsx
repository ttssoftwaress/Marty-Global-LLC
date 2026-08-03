import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import { EM_DASH, formatPaymentMethod } from '../../lib/payments';
import type { BillingLedgerRow } from '../../types/payments';
import { LedgerRowAction } from './LedgerRowAction';
import { PaymentStatusChip } from './PaymentStatusChip';

/*
 * The billing ledger — the desktop and tablet presentation (mobile renders cards
 * instead; see LedgerCardList).
 *
 * One real `<table>` so the columns align and the header is announced.
 *
 * Four departures from the Figma links, all of them fixes to problems visible
 * in the design itself (Design.md — improve where warranted, log it):
 *
 *   1. Rows get a real height. The desktop link's ledger rows have no vertical
 *      padding at all, so the seven rows collapse into a solid block of text
 *      with the dividers touching the type. Rows here are 64px with `py-3`,
 *      matching the height tablet's own link uses.
 *   2. Columns are sized so nothing overlaps. The tablet link allocates 110px to
 *      a status column whose "Pending payment" chip is wider than that, so the
 *      chip runs under the action text beside it — visible in that link's own
 *      render. `table-fixed` with a wider status column and a truncating service
 *      cell holds the allocation instead.
 *   3. Tablet folds the customer, date, and payment method under the service
 *      (an extension of that link's own idea) rather than dropping them, so no
 *      data disappears at a width that cannot hold eight columns — desktop keeps
 *      all three as their own columns. That is also what keeps the table inside
 *      768–1024px without a horizontal scroll clipping the action button.
 *   4. The order ID column is sized for the reference the backend actually
 *      issues. The design draws a short "#ORD-9021", but a real reference is
 *      `ORD-<year>-<8 chars>` (orders.service.ts) — seventeen characters, set
 *      `whitespace-nowrap`, in a column the design allocates 116px to. It ran
 *      straight over the customer beside it. The column now fits the full
 *      reference, and the cell truncates with a `title` rather than wrapping so
 *      a longer format later degrades instead of overlapping again.
 *   5. The table declares a minimum width at both breakpoints and scrolls below
 *      it. Without one, `table-fixed` handed the seven fixed columns their rem
 *      widths and left the service name whatever remained — 60px on a 1024–1150px
 *      workspace, which truncated every service to three characters. The minimum
 *      is the fixed columns plus a readable service column, so the frame scrolls
 *      instead of starving it.
 *
 * Desktop's column order matches the design: ID, customer, service, amount,
 * date, status, method, action.
 */

type LedgerTableProps = {
  rows: BillingLedgerRow[];
  onAction: (row: BillingLedgerRow) => void;
  /** The row whose reminder is in flight, if any — one chase at a time. */
  sendingId?: string | null;
};

export function LedgerTable({ rows, onAction, sendingId }: LedgerTableProps) {
  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[49rem] table-fixed lg:min-w-[75rem]">
        <thead>
          <tr className="h-12">
            <th
              scope="col"
              className="w-[11.75rem] pl-4 pr-2 lg:w-[12.5rem] lg:pl-6 lg:pr-4"
            >
              Order ID
            </th>
            <th scope="col" className="hidden w-[9rem] pr-4 lg:table-cell">
              Customer
            </th>
            <th scope="col" className="pr-2 lg:pr-4">
              Service
            </th>
            <th scope="col" className="w-[5.5rem] pr-2 lg:w-[6.5rem] lg:pr-4">
              Amount
            </th>
            <th scope="col" className="hidden w-[7rem] pr-4 lg:table-cell">
              Date issued
            </th>
            <th scope="col" className="w-[9.5rem] pr-2 lg:w-[9.5rem] lg:pr-4">
              Status
            </th>
            <th scope="col" className="hidden w-[9.25rem] pr-4 lg:table-cell">
              Payment method
            </th>
            <th scope="col" className="w-[9.25rem] pr-4 text-right lg:pr-6">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-gray-50">
              <td className="py-3 pl-4 pr-3 lg:pl-6 lg:pr-4">
                <Link
                  to={row.to}
                  title={row.reference}
                  className="block truncate font-semibold text-primary hover:underline"
                >
                  {row.reference}
                </Link>
              </td>

              <td className="hidden py-3 pr-4 lg:table-cell">
                <span className="block truncate" title={row.customer.name}>
                  {row.customer.name}
                </span>
              </td>

              <td className="py-3 pr-2 lg:pr-4">
                <span className="block truncate" title={row.service}>
                  {row.service}
                </span>
                {/*
                 * Tablet folds the customer, the date, and the method under the
                 * service — an extension of that link's own idea — so nothing is
                 * lost at a width that cannot hold eight columns. Desktop has
                 * all three as their own columns, so this line hides there.
                 */}
                <span className="mt-0.5 block truncate text-small text-gray-500 lg:hidden">
                  {row.customer.name} · {formatOrderDate(row.issuedAt)} ·{' '}
                  {formatPaymentMethod(row.method)}
                </span>
              </td>

              <td className="py-3 pr-3 lg:pr-4">
                <span className="block truncate font-medium">
                  {formatMoney(row.amount)}
                </span>
              </td>

              <td className="hidden py-3 pr-4 lg:table-cell">
                <span className="block truncate text-gray-600">
                  {formatOrderDate(row.issuedAt)}
                </span>
              </td>

              <td className="py-3 pr-3 lg:pr-4">
                <PaymentStatusChip
                  status={row.status}
                  label={row.statusLabel}
                />
              </td>

              <td className="hidden py-3 pr-4 lg:table-cell">
                <span
                  className={`block truncate ${
                    row.method ? 'text-text-secondary' : 'text-gray-400'
                  }`}
                >
                  {formatPaymentMethod(row.method)}
                </span>
              </td>

              <td className="py-3 pl-2 pr-4 text-right lg:pr-6">
                {row.action.kind === 'none' ? (
                  <span className="text-gray-400">{EM_DASH}</span>
                ) : (
                  <LedgerRowAction
                    row={row}
                    onAction={onAction}
                    isSending={sendingId === row.id}
                    isBusy={Boolean(sendingId)}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
