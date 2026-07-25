import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { RefundLogRow } from '../../types/payments';

/*
 * The refunds & adjustments log — the desktop and tablet presentation (mobile
 * renders cards; see RefundLogCardList).
 *
 * The reason column is the one that varies wildly in length, so it takes the
 * flexible width and truncates with the full text in a `title` — the design
 * truncates it too, but without any way to read what was cut off.
 *
 * Tablet folds "Processed by" under the date, which is that link's own approach,
 * so the staff member is never dropped at the narrower width. Desktop keeps it
 * as its own column.
 *
 * Refund amounts print in the error color on every link — money leaving is worth
 * the distinct hue — and the amount is formatted from integer minor units at
 * render only (AGENTS.md, Money rules).
 */

type RefundLogTableProps = {
  rows: RefundLogRow[];
};

const HEAD_CELL =
  'py-0 text-left text-caption font-medium uppercase tracking-[0.3px] text-gray-500';

export function RefundLogTable({ rows }: RefundLogTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[700px] table-fixed border-collapse text-left lg:min-w-[900px]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th
              scope="col"
              className={`${HEAD_CELL} w-[104px] pl-4 pr-3 lg:w-[120px] lg:pl-6 lg:pr-4`}
            >
              Order ID
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[124px] pr-3 lg:w-[160px] lg:pr-4`}>
              Customer
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[110px] pr-3 lg:w-[140px] lg:pr-4`}>
              Refund amount
            </th>
            <th scope="col" className={`${HEAD_CELL} pr-3 lg:pr-4`}>
              Reason
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} w-[130px] pr-4 lg:w-[150px] lg:pr-4`}
            >
              Date processed
            </th>
            <th
              scope="col"
              className={`${HEAD_CELL} hidden w-[160px] pr-6 lg:table-cell`}
            >
              Processed by
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

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <span className="block truncate text-body text-text">
                  {row.customer.name}
                </span>
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                <span className="whitespace-nowrap text-body font-medium text-error">
                  {formatMoney(row.amount)}
                </span>
              </td>

              <td className="py-3 pr-3 align-middle lg:pr-4">
                {/* Truncated like the design, but the full reason stays reachable. */}
                <span className="block truncate text-body text-gray-600" title={row.reason}>
                  {row.reason}
                </span>
              </td>

              <td className="py-3 pr-4 align-middle">
                <span className="whitespace-nowrap text-body text-gray-600">
                  {formatOrderDate(row.processedAt)}
                </span>
                {/* Tablet folds the staff member under the date; `lg` has a column. */}
                <span className="mt-0.5 block truncate text-small text-gray-500 lg:hidden">
                  By {row.processedBy}
                </span>
              </td>

              <td className="hidden py-3 pr-6 align-middle lg:table-cell">
                <span className="block truncate text-body text-text">
                  {row.processedBy}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
