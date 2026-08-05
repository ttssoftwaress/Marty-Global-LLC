import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
  detailActionClass,
} from '../../components/ExpandableRow';
import { formatMoney, formatOrderDate } from '../../lib/format';
import { useOrderDetail } from './queries';

/*
 * The expanded panel under an order row — where the order has got to, what it
 * costs, and what has been filed, without leaving the list.
 *
 * It reuses the order detail read rather than adding a narrower endpoint, and
 * is only mounted while its row is open: a page of orders fetches the one
 * somebody is looking at, and the cache it fills is the one the order screen
 * reads, so opening the order afterwards is instant.
 *
 * The current stage comes first, because "what is happening with my order" is
 * the question the list is opened to answer. Everything that ACTS on the order
 * — paying, uploading, messaging — stays on the order screen.
 */

export function OrderRowDetails({
  orderId,
  to,
}: {
  orderId: string;
  /** The order's own route — the panel's primary action. */
  to: string;
}) {
  const detail = useOrderDetail(orderId);
  const data = detail.data;

  // The timeline names the stages and points at the one in progress; steps
  // before it are done, after it are upcoming.
  const currentStep = data?.timeline.steps[data.timeline.currentIndex];

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this order."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Reference" mono>
          {data?.reference}
        </DetailField>
        <DetailField label="Submitted">
          {data ? formatOrderDate(data.submittedAt) : null}
        </DetailField>
        <DetailField label="Stage">
          {currentStep?.label}
        </DetailField>
        <DetailField label="Total">
          {data ? formatMoney(data.summary.total) : null}
        </DetailField>
      </DetailGrid>

      {data && data.applicationDetails.length > 0 ? (
        <DetailSection title="What you told us">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {data.applicationDetails.map((field) => (
              <div key={field.label} className="flex flex-col gap-0.5">
                <dt className="text-small text-gray-500">{field.label}</dt>
                <dd className="break-words text-body text-text">{field.value}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}

      <DetailSection title="Documents">
        {data && data.documents.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {data.documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-body"
              >
                <span className="min-w-0 truncate text-text">{document.name}</span>
                <span className="shrink-0 text-small text-gray-500">
                  {document.available ? 'Ready' : 'Awaiting filing'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            Nothing has been filed against this order yet — documents appear here
            as we complete each step.
          </p>
        )}
      </DetailSection>

      <DetailActions>
        <Link to={to} className={detailActionClass}>
          Open order
        </Link>
      </DetailActions>
    </DetailPanel>
  );
}
