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
 * Three departures from the Figma links, all of them fixes to problems visible
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
 *
 * Desktop's column order matches the design: ID, customer, service, amount,
 * date, status, method, action.
 */

type LedgerTableProps = {
  rows: BillingLedgerRow[];
  onAction: (row: BillingLedgerRow) => void;
};

const HEAD_CELL =
  'py-0 text-left text-caption font-medium uppercase tracking-[0.3px] text-gray-500';

export function LedgerTable({ rows, onAction }: LedgerTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full table-fixed border-collapse text-left lg:min-w-[1040px]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th scope="col" className={`${HEAD_CELL} w-[108px] pl-4 pr-2 lg:w-[116px] lg:pl-6 lg:pr-4`}>
              Order ID
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[160px] pr-4 lg:table-cell`}
            >
              Customer
            </th>
            <th scope="col" className={`${HEAD_CELL} pr-2 lg:pr-4`}>
              Service
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[88px] pr-2 lg:w-[112px] lg:pr-4`}>
              Amount
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[120px] pr-4 lg:table-cell`}
            >
              Date issued
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[152px] pr-2 lg:w-[160px] lg:pr-4`}>
              Status
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[176px] pr-4 lg:table-cell`}
            >
              Payment method
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[140px] pr-4 text-right lg:w-[136px] lg:pr-6`}
            >
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50"
            >
              <td className="py-3 pl-4 pr-3 align-middle lg:pl-6 lg:pr-4">
                <Link
                  to={row.to}
                  className="whitespace-nowrap text-body font-semibold text-primary hover:underline"
                >
                  {row.reference}
                </Link>
              </td>

              <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                <span className="block truncate text-body text-text">
                  {row.customer.name}
                </span>
              </td>

              <td className="py-3 pr-2 align-middle lg:pr-4">
                <span className="block truncate text-body text-text">{row.service}</span>
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

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <span className="whitespace-nowrap text-body font-medium text-text">
                  {formatMoney(row.amount)}
                </span>
              </td>

              <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                <span className="whitespace-nowrap text-body text-gray-600">
                  {formatOrderDate(row.issuedAt)}
                </span>
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <PaymentStatusChip status={row.status} label={row.statusLabel} />
              </td>

              <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                <span
                  className={`block truncate text-body ${
                    row.method ? 'text-text-secondary' : 'text-gray-400'
                  }`}
                >
                  {formatPaymentMethod(row.method)}
                </span>
              </td>

              <td className="py-3 pl-2 pr-4 align-middle text-right lg:pr-6">
                {row.action.kind === 'none' ? (
                  <span className="text-body text-gray-400">{EM_DASH}</span>
                ) : (
                  <LedgerRowAction row={row} onAction={onAction} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
