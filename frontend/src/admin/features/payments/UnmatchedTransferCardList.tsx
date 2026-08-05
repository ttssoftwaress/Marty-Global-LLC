import { AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  ExpandChevron,
  detailPanelId,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';
import { UnmatchedTransferDetails } from './UnmatchedTransferDetails';
import { shortHash } from './UnmatchedTransferTable';

/*
 * The mobile presentation of the unattributed-transfer queue — one card per
 * transfer, replacing the table below `md`.
 *
 * Same order of importance as the table, stacked: amount opposite its status,
 * then the hash a reconciler copies, then when the money landed and how long it
 * has been unclaimed. The sender is dropped at this width for the same reason
 * tablet drops it — the hash already identifies the transfer.
 *
 * The card body opens the same panel the table's rows open — the full hash,
 * both addresses, the contract, the raw integer, and the resolution note —
 * fetched when opened rather than carried by every card. One card is open at a
 * time.
 */

type UnmatchedTransferCardListProps = {
  rows: UnmatchedTransferRow[];
  canResolve: boolean;
  resolvingId: string | null;
  onResolve: (row: UnmatchedTransferRow) => void;
};

export function UnmatchedTransferCardList({
  rows,
  canResolve,
  resolvingId,
  onResolve,
}: UnmatchedTransferCardListProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => {
        const resolved = Boolean(row.resolvedAt);
        const isExpanded = row.id === expandedId;
        const panelId = detailPanelId('transfer-card', row.id);

        return (
          <li
            key={row.id}
            className="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation"
          >
            <button
              type="button"
              onClick={() => toggle(row.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
              className="flex flex-col gap-2.5 rounded-input text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="text-body font-bold text-text">
                  {row.amountDisplay} USDT
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {resolved ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-caption font-semibold leading-4 status-approved">
                      <CheckCircle2 className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                      Reconciled
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 text-caption font-semibold leading-4 status-review">
                      <AlertCircle className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                      Unattributed
                    </span>
                  )}
                  <ExpandChevron isExpanded={isExpanded} />
                </span>
              </span>

              <span
                className="block truncate font-mono text-small text-text-secondary"
                title={row.transactionHash}
              >
                {shortHash(row.transactionHash, 12, 10)}
              </span>

              <span className="block text-caption text-gray-400">
                Landed {formatOrderDate(row.blockAt)} ·{' '}
                {resolved
                  ? `last seen ${formatActivityTime(row.lastSeenAt)}`
                  : `unclaimed since ${formatActivityTime(row.firstSeenAt)}`}
              </span>
            </button>

            {isExpanded ? (
              <div id={panelId} onClick={stopRowToggle}>
                <UnmatchedTransferDetails row={row} />
              </div>
            ) : null}

            {!resolved && canResolve ? (
              <button
                type="button"
                onClick={() => onResolve(row)}
                disabled={resolvingId === row.id}
                className="mt-0.5 flex h-10 w-full items-center justify-center rounded-control border border-primary text-body font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reconcile
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
