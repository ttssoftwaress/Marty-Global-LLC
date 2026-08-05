import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailNote,
  DetailPanel,
  DetailSection,
  detailActionClass,
  detailActionMutedClass,
} from '../../components/ExpandableRow';
import { formatActivityTime } from '../../lib/format';
import type { AdminRequestRow } from '../../types/delivery';
import { useAdminRequest } from './queries';

/*
 * The expanded panel under a follow-up request — what the customer actually
 * asked for.
 *
 * The queue row carries the type, the record, and who it is for; what it cannot
 * carry is the ask itself. The intake answers are a per-request set of
 * label/value pairs resolved server-side, and the note is free text — both are
 * the reason an agent opens a request, and both are fetched on expand through
 * the same read the request screen uses, so opening it afterwards is served
 * from cache.
 *
 * A blocked request says so here rather than only on its own screen: "why has
 * nobody moved this" is the question a backlog is scanned for.
 */

export function RequestRowDetails({
  request,
  to,
}: {
  request: AdminRequestRow;
  /** The request's own screen — the panel's primary action. */
  to: string;
}) {
  const detail = useAdminRequest(request.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this request."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Reference" mono>
          {request.reference}
        </DetailField>
        <DetailField label="Raised">
          {formatActivityTime(request.createdAt)}
        </DetailField>
        <DetailField label="Record">
          {request.resultTitle}
          <span className="block text-small text-gray-500">
            {request.serviceName}
          </span>
        </DetailField>
        <DetailField label="Order" mono>
          {data?.orderReference}
        </DetailField>
      </DetailGrid>

      {data?.blockedReason ? (
        <DetailSection title="Blocked">
          <DetailNote>{data.blockedReason}</DetailNote>
        </DetailSection>
      ) : null}

      <DetailSection title="What the customer asked for">
        {data && data.answers.length > 0 ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.answers.map((answer) => (
              <div key={answer.label} className="flex flex-col gap-0.5">
                <dt className="text-small text-gray-500">{answer.label}</dt>
                <dd className="break-words text-body text-text">
                  {answer.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-body text-gray-500">
            This request type collects no intake answers.
          </p>
        )}

        {data?.note ? <DetailNote>{data.note}</DetailNote> : null}
      </DetailSection>

      {data?.resolution ? (
        <DetailSection title="Resolution">
          <DetailNote>{data.resolution}</DetailNote>
        </DetailSection>
      ) : null}

      <DetailActions>
        <Link to={to} className={detailActionClass}>
          Open request
        </Link>
        {data?.orderId ? (
          <Link
            to={`/admin/orders/${data.orderId}`}
            className={detailActionMutedClass}
          >
            Open order {data.orderReference}
          </Link>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
