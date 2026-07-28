import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';
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
 * The resolution note wraps rather than truncating: a card has the height for it,
 * and on a reconciled row the note is the entire point of the record.
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
  return (
    <ul className="flex w-full flex-col gap-3 md:hidden">
      {rows.map((row) => {
        const resolved = Boolean(row.resolvedAt);

        return (
          <li
            key={row.id}
            className="flex flex-col gap-2.5 rounded-card border border-gray-200 bg-white p-3.5 shadow-sm-elevation"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-body font-bold text-text">
                {row.amountDisplay} USDT
              </p>

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
            </div>

            <p
              className="truncate font-mono text-small text-text-secondary"
              title={row.transactionHash}
            >
              {shortHash(row.transactionHash, 12, 10)}
            </p>

            <p className="text-caption text-gray-400">
              Landed {formatOrderDate(row.blockAt)} ·{' '}
              {resolved
                ? `last seen ${formatActivityTime(row.lastSeenAt)}`
                : `unclaimed since ${formatActivityTime(row.firstSeenAt)}`}
            </p>

            {resolved && row.resolutionNote ? (
              <p className="text-small leading-[1.4] text-text-secondary">
                {row.resolutionNote}
                {row.resolvedBy ? (
                  <span className="text-gray-400"> — {row.resolvedBy}</span>
                ) : null}
              </p>
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
