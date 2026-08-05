import {
  DetailField,
  DetailGrid,
  DetailNote,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { formatActivityTime } from '../../lib/format';
import type { UnmatchedTransferRow } from '../../types/payments';
import { useAdminUnmatchedTransfer } from './queries';

/*
 * The expanded panel under an unattributed transfer — the chain facts a
 * reconciler needs once they are actually chasing it.
 *
 * All of it is fetched here rather than carried by the queue: two Tron
 * addresses are 34 characters each, and the list was sending both for every row
 * to be read on almost none of them.
 *
 * MONEY: the raw integer is printed exactly as the backend sent it. USDT is not
 * a minor-unit fiat currency and nothing in this file does arithmetic on either
 * figure (AGENTS.md, Money).
 *
 * The hash and both addresses are full-length and monospace here — this is the
 * panel somebody copies from into a block explorer, so the row's middle-truncated
 * form must not be the only one available.
 */

export function UnmatchedTransferDetails({
  row,
}: {
  row: UnmatchedTransferRow;
}) {
  const detail = useAdminUnmatchedTransfer(row.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this transfer."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Transaction hash" mono>
          {row.transactionHash}
        </DetailField>
        <DetailField label="From" mono>
          {row.fromAddress}
        </DetailField>
        <DetailField label="To" mono>
          {data?.toAddress}
        </DetailField>
        <DetailField label="Contract" mono>
          {data?.contractAddress}
        </DetailField>

        <DetailField label="Amount">
          {row.amountDisplay} USDT
          {data ? (
            <span className="block font-mono text-small text-gray-500">
              {data.amountRaw} raw · {data.decimals} decimals
            </span>
          ) : null}
        </DetailField>
        <DetailField label="First seen">
          {formatActivityTime(row.firstSeenAt)}
        </DetailField>
        <DetailField label="Last seen">
          {formatActivityTime(row.lastSeenAt)}
        </DetailField>
        {/* Rises on every sweep of the overlap window — it is "still sitting
            here", not a count of separate transfers. */}
        <DetailField label="Sightings">{data?.sightings}</DetailField>
      </DetailGrid>

      {row.resolvedAt ? (
        <DetailSection title="Reconciled">
          <DetailNote>
            {data?.resolutionNote ?? 'No note was recorded.'}
          </DetailNote>
          <p className="text-small text-gray-500">
            {row.resolvedBy ?? 'Marty Global team'} ·{' '}
            {formatActivityTime(row.resolvedAt)}
          </p>
        </DetailSection>
      ) : null}
    </DetailPanel>
  );
}
