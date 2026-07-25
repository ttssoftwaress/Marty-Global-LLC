import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import { formatPaymentMethod } from '../../lib/payments';
import type { BillingLedgerRow } from '../../types/payments';
import { LedgerRowAction } from './LedgerRowAction';
import { PaymentStatusChip } from './PaymentStatusChip';

/*
 * The mobile presentation of the ledger — one card per row, replacing the table
 * below `md`. Each card follows its link: reference and status chip on the top
 * row, "customer · service" beneath, then the amount opposite the date and
 * method, a divider, and the action.
 *
 * The mobile link is inconsistent about the meta line — some cards print
 * "date · method", others print the date alone and repeat the method after the
 * divider. Every card prints "date · method" here so the stack scans as one
 * list, with the divider reserved for the action.
 *
 * The card is not itself a link: the action is the row's single primary target
 * and the reference stays separately tappable, which keeps the text selectable.
 */

type LedgerCardListProps = {
  rows: BillingLedgerRow[];
  onAction: (row: BillingLedgerRow) => void;
};

export function LedgerCardList({ rows, onAction }: LedgerCardListProps) {
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation"
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              to={row.to}
              className="shrink-0 text-body font-semibold text-primary hover:underline"
            >
              {row.reference}
            </Link>
            <PaymentStatusChip status={row.status} label={row.statusLabel} />
          </div>

          <p className="text-small text-text-secondary">
            {row.customer.name} · {row.service}
          </p>

          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-body-lg font-bold text-text">{formatMoney(row.amount)}</p>
            <p className="text-caption text-gray-400">
              {formatOrderDate(row.issuedAt)} · {formatPaymentMethod(row.method)}
            </p>
          </div>

          {row.action.kind === 'none' ? null : (
            <>
              <hr className="border-t border-gray-200" />
              <LedgerRowAction row={row} onAction={onAction} fullWidth />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
