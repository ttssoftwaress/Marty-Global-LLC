import { Link } from 'react-router-dom';

import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatMoney, formatOrderDate } from '../../lib/format';
import { formatPaymentMethod } from '../../lib/payments';
import type { BillingLedgerRow } from '../../types/payments';
import { LedgerDetails } from './LedgerDetails';
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
 *
 * The card's summary block is a button that opens the same detail panel the
 * table's rows open, so the invoice breakdown and the attempt history are
 * reachable at every width — and fetched only when opened. One card is open at
 * a time.
 */

type LedgerCardListProps = {
  rows: BillingLedgerRow[];
  onAction: (row: BillingLedgerRow) => void;
  /** The row whose reminder is in flight, if any — one chase at a time. */
  sendingId?: string | null;
};

export function LedgerCardList({ rows, onAction, sendingId }: LedgerCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => {
        const isExpanded = row.id === expandedId;
        const panelId = detailPanelId('ledger-card', row.id);

        return (
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

            <button
              type="button"
              onClick={() => toggle(row.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-3 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="text-small text-text-secondary">
                {row.customer.name} · {row.service}
              </span>

              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="flex flex-col gap-1">
                  <span className="text-body-lg font-bold text-text">
                    {formatMoney(row.amount)}
                  </span>
                  <span className="text-caption text-gray-400">
                    {formatOrderDate(row.issuedAt)} ·{' '}
                    {formatPaymentMethod(row.method)}
                  </span>
                </span>
                <ExpandChevron isExpanded={isExpanded} />
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <LedgerDetails row={row} />
              </div>
            ) : null}

            {row.action.kind === 'none' ? null : (
              <>
                <hr className="border-t border-gray-200" />
                <LedgerRowAction
                  row={row}
                  onAction={onAction}
                  fullWidth
                  isSending={sendingId === row.id}
                  isBusy={Boolean(sendingId)}
                />
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
