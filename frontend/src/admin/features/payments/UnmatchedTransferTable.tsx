import { Fragment } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import {
  DetailRow,
  ExpandChevronCell,
  detailPanelId,
  expandRowProps,
  expandedRowClass,
  stopRowToggle,
  useExpandedRow,
} from '../../components/ExpandableRow';
import { RowCheckbox } from '../../components/RowCheckbox';
import type { RowSelection } from '../../hooks/useRowSelection';
import { formatActivityTime, formatOrderDate } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';
import { UnmatchedTransferDetails } from './UnmatchedTransferDetails';

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
 * distinguishes two hashes), and the full value — along with both addresses, the
 * contract, the raw integer, and the resolution note — is in the panel the row
 * opens. Those are fetched on expand rather than shipped with every row
 * (UnmatchedTransferDetails); one row is open at a time.
 *
 * "Seen" folds two facts a reconciler needs together: when the money landed, and
 * how long it has been sitting unclaimed.
 *
 * Tablet drops the sender column, since the hash already identifies the transfer
 * and the sender is only useful once someone is actively chasing it.
 */

type UnmatchedTransferTableProps = {
  rows: UnmatchedTransferRow[];
  canResolve: boolean;
  resolvingId: string | null;
  onResolve: (row: UnmatchedTransferRow) => void;
  selection: RowSelection;
  /*
   * False when the signed-in member may not delete here.
   *
   * Worth stating on this table in particular: deleting a transfer hides the
   * row, it does not undo the transfer. The poller re-reads its overlap window
   * and will re-record money that is still arriving. Resolving it with a note is
   * the disposal that sticks — which is what the Resolve action beside it does.
   */
  selectable: boolean;
};

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
  selection,
  selectable,
}: UnmatchedTransferTableProps) {
  const { expandedId, toggle } = useExpandedRow();

  return (
    <div className="table-scroll hidden md:block">
      <table className="data-table min-w-[51rem] table-fixed lg:min-w-[67rem]">
        <thead>
          <tr className="h-12">
            {selectable ? (
              <th scope="col" className="w-10 pl-4 pr-2 lg:pl-6">
                <RowCheckbox
                  checked={selection.allVisibleSelected}
                  indeterminate={selection.someVisibleSelected}
                  onChange={selection.toggleAllVisible}
                  label="Select all transfers on this page"
                />
              </th>
            ) : null}

            <th
              scope="col"
              className={
                selectable
                  ? 'w-[10.5rem] pr-3 lg:w-[12.5rem] lg:pr-4'
                  : 'w-[10.5rem] pl-4 pr-3 lg:w-[12.5rem] lg:pl-6 lg:pr-4'
              }
            >
              Transaction
            </th>
            <th scope="col" className="w-[7.5rem] pr-3 lg:w-[8.75rem] lg:pr-4">
              Amount
            </th>
            <th scope="col" className="hidden w-[11.25rem] pr-4 lg:table-cell">
              From
            </th>
            <th
              scope="col"
              className="w-[9.375rem] pr-3 lg:w-[10.625rem] lg:pr-4"
            >
              Seen
            </th>
            <th scope="col" className="pr-3 lg:pr-4">
              Status
            </th>
            <th scope="col" className="w-[8.5rem] pr-2 text-right lg:pr-4">
              <span className="sr-only">Action</span>
            </th>
            <th scope="col" className="w-[4rem] pr-4 lg:pr-6">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const resolved = Boolean(row.resolvedAt);
            const isExpanded = row.id === expandedId;
            const panelId = detailPanelId('transfer', row.id);

            return (
              <Fragment key={row.id}>
                <tr
                  {...expandRowProps({
                    isExpanded,
                    panelId,
                    onToggle: () => toggle(row.id),
                    label: `${isExpanded ? 'Hide' : 'Show'} transfer details for ${shortHash(row.transactionHash)}`,
                  })}
                  className={expandedRowClass(isExpanded)}
                >
                  {selectable ? (
                    <td className="py-3 pl-4 pr-2 lg:pl-6" onClick={stopRowToggle}>
                      <RowCheckbox
                        checked={selection.isSelected(row.id)}
                        onChange={() => selection.toggle(row.id)}
                        label={`Select transfer ${shortHash(row.transactionHash)}`}
                      />
                    </td>
                  ) : null}

                  <td
                    className={`py-3 pr-3 lg:pr-4 ${selectable ? '' : 'pl-4 lg:pl-6'}`}
                  >
                    <span
                      className="block truncate font-mono text-small"
                      title={row.transactionHash}
                    >
                      {shortHash(row.transactionHash)}
                    </span>
                  </td>

                  <td className="py-3 pr-3 lg:pr-4">
                    <span className="block truncate font-semibold">
                      {row.amountDisplay} USDT
                    </span>
                  </td>

                  <td className="hidden py-3 pr-4 lg:table-cell">
                    <span
                      className="block truncate font-mono text-small text-gray-600"
                      title={row.fromAddress}
                    >
                      {shortHash(row.fromAddress, 8, 6)}
                    </span>
                  </td>

                  <td className="py-3 pr-3 lg:pr-4">
                    <span className="block truncate text-gray-600">
                      {formatOrderDate(row.blockAt)}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-gray-400">
                      {resolved
                        ? `Last seen ${formatActivityTime(row.lastSeenAt)}`
                        : `Unclaimed since ${formatActivityTime(row.firstSeenAt)}`}
                    </span>
                  </td>

                  <td className="py-3 pr-3 lg:pr-4">
                    {resolved ? (
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-approved">
                          <CheckCircle2
                            className="size-3.5 shrink-0"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          Reconciled
                        </span>
                        {/* The note itself is in the panel — it is a sentence,
                            and a truncated cell is where one goes to die. */}
                        {row.resolvedBy ? (
                          <span className="block truncate text-caption text-gray-500">
                            {row.resolvedBy}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-caption font-semibold leading-4 status-review">
                        <AlertCircle
                          className="size-3.5 shrink-0"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        Unattributed
                      </span>
                    )}
                  </td>

                  <td
                    className="py-3 pr-2 text-right lg:pr-4"
                    onClick={stopRowToggle}
                  >
                    {resolved || !canResolve ? (
                      <span aria-hidden="true" className="text-gray-300">
                        —
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onResolve(row)}
                        disabled={resolvingId === row.id}
                        className="whitespace-nowrap rounded-control border border-primary px-3 py-1.5 text-small font-semibold text-primary transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reconcile
                      </button>
                    )}
                  </td>

                  <ExpandChevronCell isExpanded={isExpanded} />
                </tr>

                {isExpanded ? (
                  <DetailRow panelId={panelId} colSpan={selectable ? 8 : 7}>
                    <UnmatchedTransferDetails row={row} />
                  </DetailRow>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
