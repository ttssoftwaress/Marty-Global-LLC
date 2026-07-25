import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { RefundLogRow } from '../../types/payments';

/*
 * The mobile presentation of the refunds log — one card per entry, replacing the
 * table below `md`, following the mobile link: reference opposite the refunded
 * amount, the customer, the reason, then "date · processed by".
 *
 * The reason wraps here instead of truncating — a card has the height for it,
 * and the reason is the whole point of the log entry.
 */

type RefundLogCardListProps = {
  rows: RefundLogRow[];
};

export function RefundLogCardList({ rows }: RefundLogCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation"
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              to={row.to}
              className="text-body font-semibold text-primary hover:underline"
            >
              {row.reference}
            </Link>
            <p className="shrink-0 text-body font-bold text-error">
              {formatMoney(row.amount)}
            </p>
          </div>

          <p className="text-small font-medium text-text-secondary">
            {row.customer.name}
          </p>

          <p className="text-small leading-[1.4] text-text-secondary">{row.reason}</p>

          <p className="text-caption text-gray-400">
            {formatOrderDate(row.processedAt)} · {row.processedBy}
          </p>
        </li>
      ))}
    </ul>
  );
}
