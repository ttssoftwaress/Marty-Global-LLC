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
import { formatOrderDate } from '../../lib/format';
import { useAdminOrder } from '../order-detail/queries';

/*
 * The expanded panel under a queue row — enough to triage an order without
 * leaving the queue: who it is for and how to reach them, which services it
 * covers and where each has got to, what the customer wrote, and what has been
 * filed against it.
 *
 * It reuses the order detail read (`GET /v1/admin/orders/:orderId`) rather than
 * adding a second, narrower endpoint. That read is the screen's source of truth
 * for an order, and the panel is only mounted while its row is open, so a page
 * of the queue fetches the one order somebody is looking at — and the cache it
 * fills is the one the detail screen reads, so opening the order afterwards is
 * instant rather than a second round trip.
 *
 * Triage only. Everything that CHANGES the order — status, assignee, quotes,
 * result forms — stays on the detail screen: those decisions want the full
 * record in front of the reviewer, not a strip under a row in a list.
 *
 * Takes an id and a destination rather than a row, so the main queue and the
 * customer record's order list — two different row shapes over the same
 * records — open the identical panel.
 */

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

export function OrderRowDetails({
  orderId,
  to,
}: {
  orderId: string;
  /** The order's own route — the panel's primary action. */
  to: string;
}) {
  const detail = useAdminOrder(orderId);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this order."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Customer">
          {data ? (
            <>
              {data.customer.name}
              <a
                href={`mailto:${data.customer.email}`}
                className="block truncate text-small text-primary hover:underline"
              >
                {data.customer.email}
              </a>
              {data.customer.phone ? (
                <span className="block text-small text-gray-500">
                  {data.customer.phone}
                </span>
              ) : null}
            </>
          ) : null}
        </DetailField>

        <DetailField label="Region">
          {data ? `${data.region.flag ?? ''} ${data.region.name}`.trim() : null}
        </DetailField>

        <DetailField label="Assigned to">{data?.assignee?.name}</DetailField>

        <DetailField label="Last updated">
          {data ? formatOrderDate(data.updatedAt) : null}
        </DetailField>
      </DetailGrid>

      <DetailSection title="Services on this order">
        {data && data.items.length > 0 ? (
          <ul className="flex flex-col">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-100 py-2 last:border-b-0"
              >
                <span className="min-w-0 text-body text-text">
                  {item.serviceName}
                </span>
                <span className="shrink-0 text-small text-gray-500">
                  {ITEM_STATUS_LABEL[item.status] ?? item.status}
                  {item.completedAt
                    ? ` · ${formatOrderDate(item.completedAt)}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            This order carries no service lines.
          </p>
        )}
      </DetailSection>

      {data?.notes ? (
        <DetailSection title="Customer’s note">
          <DetailNote>{data.notes}</DetailNote>
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
                  {document.statusLabel} ·{' '}
                  {document.source === 'team' ? 'filed by us' : 'from customer'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            Nothing has been filed against this order yet.
          </p>
        )}
      </DetailSection>

      <DetailActions>
        <Link to={to} className={detailActionClass}>
          Open order
        </Link>
        {data?.customer.to ? (
          <Link to={data.customer.to} className={detailActionMutedClass}>
            View customer
          </Link>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
