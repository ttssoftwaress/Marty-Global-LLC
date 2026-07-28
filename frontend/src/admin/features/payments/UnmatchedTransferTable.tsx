import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';

/*
 * The unattributed-transfer queue — the desktop and tablet presentation (mobile
 * renders cards; see UnmatchedTransferCardList).
 *
 * The amount takes the visual weight: it is the only figure on the row that
 * matters at a glance, and it prints as the backend already formatted it —
 * USDT is not a minor-unit fiat currency, so no arithmetic happens here
 * (AGENTS.md, Money).
 *
 * The tx hash is the one field a reconciler copies into a block explorer, so it
 * is monospace, truncated in the middle rather than the end (the tail is what
 * distinguishes two hashes), and carries the full value in a `title`.
 *
 * "Seen" folds two facts a reconciler needs together: when the money landed, and
 * how long it has been sitting unclaimed. The sighting count is deliberately
 * quiet — it rises on every sweep, so treating it as a headline would make an
 * hour-old transfer look like an emergency.
 *
 * Tablet drops the sender column, since the hash already identifies the transfer
 * and the sender is only useful once someone is actively chasing it.
 */

type UnmatchedTransferTableProps = {
  rows: UnmatchedTransferRow[];
  canResolve: boolean;
  resolvingId: string | null;
  onResolve: (row: UnmatchedTransferRow) => void;
};

const HEAD_CELL =
  'py-0 text-left text-caption font-medium uppercase tracking-[0.3px] text-gray-500';

// Middle-truncation: a Tron hash differs from its neighbours at both ends, so
// clipping only the tail would make two transfers read identically.
export function shortHash(hash: string, lead = 10, tail = 8) {
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export function UnmatchedTransferTable({
  rows,
  canResolve,
  resolvingId,
  onResolve,
}: UnmatchedTransferTableProps) {
  return (
    <div className="hidden w-full overflow-x-auto md:block">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-left lg:min-w-[980px]">
        <thead>
          <tr className="h-12 border-b border-gray-200 bg-[var(--table-header-bg)]">
            <th
              scope="col"
              className={`${HEAD_CELL} w-[168px] pl-4 pr-3 lg:w-[200px] lg:pl-6 lg:pr-4`}
            >
              Transaction
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[120px] pr-3 lg:w-[140px] lg:pr-4`}>
              Amount
            </th>
            <th scope="col" className={`${HEAD_CELL} hidden w-[180px] pr-4 lg:table-cell`}>
              From
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[150px] pr-3 lg:w-[170px] lg:pr-4`}>
              Seen
            </th>
            <th scope="col" className={`${HEAD_CELL} pr-3 lg:pr-4`}>
              Status
            </th>
            <th scope="col" className={`${HEAD_CELL} w-[120px] pr-4 text-right lg:pr-6`}>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const resolved = Boolean(row.resolvedAt);

            return (
              <tr
                key={row.id}
                className="border-b border-gray-200 transition-colors last:border-b-0 hover:bg-gray-50"
              >
                <td className="py-3 pl-4 pr-3 align-middle lg:pl-6 lg:pr-4">
                  <span
                    className="block truncate font-mono text-small text-text"
                    title={row.transactionHash}
                  >
                    {shortHash(row.transactionHash)}
                  </span>
                </td>

                <td className="py-3 pr-3 align-middle lg:pr-4">
                  <span className="whitespace-nowrap text-body font-semibold text-text">
                    {row.amountDisplay} USDT
                  </span>
                </td>

                <td className="hidden py-3 pr-4 align-middle lg:table-cell">
                  <span
                    className="block truncate font-mono text-small text-gray-600"
                    title={row.fromAddress}
                  >
                    {shortHash(row.fromAddress, 8, 6)}
                  </span>
                </td>

                <td className="py-3 pr-3 align-middle lg:pr-4">
                  <span className="whitespace-nowrap text-body text-gray-600">
                    {formatOrderDate(row.blockAt)}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-gray-400">
                    {resolved
                      ? `Last seen ${formatActivityTime(row.lastSeenAt)}`
                      : `Unclaimed since ${formatActivityTime(row.firstSeenAt)}`}
                  </span>
                </td>

                <td className="py-3 pr-3 align-middle lg:pr-4">
                  {resolved ? (
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-approved">
                        <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                        Reconciled
                      </span>
                      {row.resolutionNote ? (
                        <span
                          className="block truncate text-caption text-gray-500"
                          title={row.resolutionNote}
                        >
                          {row.resolutionNote}
                          {row.resolvedBy ? ` — ${row.resolvedBy}` : ''}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-review">
                      <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                      Unattributed
                    </span>
                  )}
                </td>

                <td className="py-3 pr-4 text-right align-middle lg:pr-6">
                  {resolved || !canResolve ? (
                    <span aria-hidden="true" className="text-body text-gray-300">
                      —
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onResolve(row)}
                      disabled={resolvingId === row.id}
                      className="rounded-control border border-primary px-3 py-1.5 text-small font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reconcile
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
