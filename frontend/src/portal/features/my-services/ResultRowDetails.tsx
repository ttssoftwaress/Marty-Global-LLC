import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
  detailActionClass,
  detailActionMutedClass,
} from '../../components/ExpandableRow';
import { formatOrderDate } from '../../lib/format';
import type { ServiceResultRow } from '../../types/my-services';
import { useServiceResult } from './queries';
import { ResultValueView } from './ResultValueView';

/*
 * The expanded panel under a delivered record — every fact the service returns,
 * grouped the way the record's own page groups them, rather than only the two
 * or three columns the list has room for.
 *
 * Nothing here is hardcoded: the sections and their fields arrive resolved from
 * the service's result schema, so a service that starts returning a sixth fact
 * shows it here without a frontend change — the same promise the list's columns
 * make.
 *
 * Fetched on expand, and deliberately not cached: the response carries
 * short-TTL presigned download links (AGENTS.md, Security & PII), and a link
 * held from a page load twenty minutes ago is a dead one.
 */

export function ResultRowDetails({
  row,
  to,
}: {
  row: ServiceResultRow;
  /** The record's own page — the panel's primary action. */
  to: string;
}) {
  const detail = useServiceResult(row.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this record."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Reference" mono>
          {row.reference}
        </DetailField>
        <DetailField label="Delivered">
          {row.deliveredAt ? formatOrderDate(row.deliveredAt) : null}
        </DetailField>
        <DetailField label="Last updated">
          {data?.lastEditedAt ? formatOrderDate(data.lastEditedAt) : null}
        </DetailField>
        <DetailField label="From order" mono>
          {data?.orderReference}
        </DetailField>
      </DetailGrid>

      {data?.sections.map((section) => (
        <DetailSection key={section.title} title={section.title}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-0.5">
                <dt className="text-small text-gray-500">{field.label}</dt>
                <dd className="min-w-0 break-words text-body text-text">
                  <ResultValueView field={field} value={data.values[field.name]} />
                </dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ))}

      <DetailActions>
        <Link to={to} className={detailActionClass}>
          Open record
        </Link>
        {data?.orderId ? (
          <Link
            to={`/app/orders/${data.orderId}`}
            className={detailActionMutedClass}
          >
            View order
          </Link>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
