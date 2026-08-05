import {
  DetailField,
  DetailGrid,
  DetailNote,
  DetailPanel,
  DetailSection,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { MailLogRow } from '../../types/mailroom';
import { useAdminMailLogEntry } from './queries';

/*
 * The expanded panel under a mail-log row — the question the log is actually
 * read to answer: why did this piece of post leave the building?
 *
 * The row says what happened and who closed it. The answer is the sequence
 * before that: what state the item was in, and every request the customer
 * raised against it — a forwarding that follows a scan request is the usual
 * shape, and the last row alone does not explain it.
 *
 * Fetched on expand. It is three joins deep and the log is the longest table in
 * the admin area, so only the row somebody opens pays for them.
 */

export function MailLogDetails({ entry }: { entry: MailLogRow }) {
  const detail = useAdminMailLogEntry(entry.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this log entry."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Sender">{data?.item.sender}</DetailField>
        <DetailField label="Received">
          {data ? formatOrderDate(data.item.receivedAt) : null}
        </DetailField>
        <DetailField label="Storage expires">
          {data ? formatOrderDate(data.item.storageExpiresAt) : null}
        </DetailField>
        <DetailField label="Item status">
          {data ? (
            <>
              {data.item.statusLabel}
              <span className="block text-small text-gray-500">
                {data.item.scanReady
                  ? `${data.item.pageCount} page${data.item.pageCount === 1 ? '' : 's'} scanned`
                  : 'Contents never opened'}
              </span>
            </>
          ) : null}
        </DetailField>
      </DetailGrid>

      {data?.item.note ? (
        <DetailSection title="Operator’s note on the item">
          <DetailNote>{data.item.note}</DetailNote>
        </DetailSection>
      ) : null}

      <DetailSection title="Requests raised against this item">
        {data && data.requests.length > 0 ? (
          <ul className="flex flex-col">
            {data.requests.map((request) => (
              <li
                key={request.id}
                className="flex flex-col gap-1 border-b border-gray-100 py-2 last:border-b-0"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-body text-text">
                    {request.typeLabel} · {request.statusLabel}
                  </span>
                  <span className="text-small text-gray-500">
                    {formatOrderDate(request.requestedAt)}
                    {request.processedAt
                      ? ` → ${formatOrderDate(request.processedAt)}`
                      : ''}
                    {request.processedBy ? ` · ${request.processedBy}` : ''}
                  </span>
                </span>

                {request.shippingAddress ? (
                  <span className="text-small text-text-secondary">
                    Forwarded to {request.shippingAddress}
                  </span>
                ) : null}

                {request.trackingNumber ? (
                  <span className="text-small text-text-secondary">
                    {request.carrier ? `${request.carrier} · ` : ''}
                    <code>{request.trackingNumber}</code>
                  </span>
                ) : null}

                {request.notes ? (
                  <span className="text-small text-gray-500">
                    {request.notes}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            The customer raised no requests against this item — it was closed by
            the mail room directly.
          </p>
        )}
      </DetailSection>
    </DetailPanel>
  );
}
