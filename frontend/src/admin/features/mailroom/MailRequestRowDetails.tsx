import { FileText } from 'lucide-react';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
  detailActionClass,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { MailRequestRow } from '../../types/mailroom';
import { useAdminMailRequestDetail } from './queries';

/*
 * The expanded panel under a pending-request row — enough for an operator to
 * decide what to do before committing to the processing slide-over: which
 * envelope this is, whether its contents have been opened yet, and, for a
 * forwarding, the address it is going to.
 *
 * The shipping address is the reason this is worth opening in place. It is
 * snapshotted at request time — the customer may since have moved — and it is
 * what an operator checks against the label before pulling the item.
 *
 * Fetched on expand. The response carries a short-TTL presigned scan URL
 * (AGENTS.md, Security & PII), so it must not be minted for rows nobody opens:
 * the panel is mounted only while its row is open, which is exactly when a link
 * is wanted and while it is still valid.
 */

export function MailRequestRowDetails({
  request,
  onOpen,
}: {
  request: MailRequestRow;
  /** The processing slide-over — the panel's primary action. */
  onOpen: (request: MailRequestRow) => void;
}) {
  const detail = useAdminMailRequestDetail(request.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this request."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Customer">
          {request.customer.name}
          <span className="block truncate text-small text-gray-500">
            {request.customer.email}
          </span>
        </DetailField>
        <DetailField label="Mail room">{request.room.name}</DetailField>
        <DetailField label="Requested">
          {formatOrderDate(request.requestedAt)}
        </DetailField>
        <DetailField label="Request">
          {request.typeLabel} · {request.statusLabel}
        </DetailField>
      </DetailGrid>

      {request.type === 'forwarding' ? (
        <DetailSection title="Forwarding to">
          <p className="text-body text-text">
            {data?.shippingAddress ??
              'No address was snapshotted onto this request.'}
          </p>
        </DetailSection>
      ) : null}

      <DetailSection title="Document on file">
        <p className="flex items-center gap-2 text-body text-text">
          <FileText
            className="size-4 shrink-0 text-gray-400"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {data?.document.fileName ?? '—'}
        </p>
        {data && !data.document.previewUrl ? (
          <p className="text-small text-gray-500">
            The envelope is still sealed — there is nothing scanned to preview
            yet.
          </p>
        ) : null}
      </DetailSection>

      <DetailActions>
        <button
          type="button"
          onClick={() => onOpen(request)}
          className={detailActionClass}
        >
          Process request
        </button>
        {data?.document.previewUrl ? (
          <a
            href={data.document.previewUrl}
            target="_blank"
            rel="noreferrer"
            className={detailActionClass}
          >
            Open scan
          </a>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
