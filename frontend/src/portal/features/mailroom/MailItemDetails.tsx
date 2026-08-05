import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailNote,
  DetailPanel,
  DetailSection,
  detailActionClass,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { MailItem } from '../../types/mailroom';
import { useMailItem } from './queries';

/*
 * The expanded panel under a mail row — what the envelope is, where it stands,
 * and what we are waiting on.
 *
 * The list row answers "who sent it and when"; this answers the two questions
 * that follow: has it been opened, and is anything expected of the customer.
 * The scan itself stays in the viewer — a page image is not a strip under a
 * table row — so the panel's action opens it.
 *
 * Fetched on expand, and uncached by the query it uses: the response carries
 * short-TTL presigned scan links (AGENTS.md, Security & PII), which must be
 * minted when somebody is looking rather than held from a page load.
 */

export function MailItemDetails({
  item,
  roomId,
  to,
}: {
  item: MailItem;
  roomId: string;
  /** The full item viewer — the panel's primary action. */
  to: string;
}) {
  const detail = useMailItem(roomId, item.id);
  const data = detail.data ?? item;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this mail item."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Sender">{data.sender}</DetailField>
        <DetailField label="Received">
          {formatOrderDate(data.receivedAt)}
        </DetailField>
        <DetailField label="Storage expires">
          {formatOrderDate(data.storageExpiresAt)}
        </DetailField>
        <DetailField label="Contents">
          {data.scanReady
            ? 'Opened and scanned'
            : data.openRequestType === 'scan'
              ? 'We’re opening and scanning it'
              : 'Still sealed'}
        </DetailField>
      </DetailGrid>

      {data.note ? (
        <DetailSection title="What we need from you">
          <DetailNote>{data.note}</DetailNote>
          {data.responseDueAt ? (
            <p className="text-small font-medium text-[color:var(--color-status-review-text)]">
              Response needed by {formatOrderDate(data.responseDueAt)}
            </p>
          ) : null}
        </DetailSection>
      ) : null}

      <DetailActions>
        <Link to={to} className={detailActionClass}>
          {data.scanReady ? 'Open scan' : 'View envelope'}
        </Link>
      </DetailActions>
    </DetailPanel>
  );
}
