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
import {
  formatCount,
  formatMoneyCompact,
  formatOrderDate,
} from '../../lib/format';
import { useAdminCustomer } from '../customer-detail/queries';
import type { AdminCustomerRow } from '../../types/customers';

/*
 * The expanded panel under a customer row — the identity facts and the account's
 * standing, which is what a staff member opens a customer record for nine times
 * out of ten.
 *
 * It reuses the customer profile read rather than adding a narrower endpoint:
 * the panel is only mounted while its row is open, so a page of the directory
 * fetches one profile, and the cache it fills is the one the profile screen
 * reads — opening the record afterwards is instant instead of a second trip.
 *
 * A live suspension is the loudest thing here, with the reason in full. That
 * reason is a sentence somebody wrote for the next person to read, and the row
 * has nowhere to put it.
 */

export function CustomerRowDetails({ customer }: { customer: AdminCustomerRow }) {
  const detail = useAdminCustomer(customer.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this customer."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Email">
          {data ? (
            <a
              href={`mailto:${data.email}`}
              className="truncate text-primary hover:underline"
            >
              {data.email}
            </a>
          ) : null}
        </DetailField>
        <DetailField label="Phone">{data?.phone}</DetailField>
        <DetailField label="Country">
          {data
            ? `${data.country.flag ?? ''} ${data.country.name}`.trim()
            : null}
        </DetailField>
        <DetailField label="Customer since">
          {data?.customerSince ? formatOrderDate(data.customerSince) : null}
        </DetailField>
      </DetailGrid>

      {data && data.metrics.length > 0 ? (
        <DetailSection title="At a glance">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.metrics.map((metric) => (
              <div key={metric.id} className="flex flex-col gap-0.5">
                <dt className="text-small text-gray-500">{metric.label}</dt>
                <dd className="text-body-lg font-semibold text-text">
                  {metric.value.kind === 'money'
                    ? formatMoneyCompact(metric.value.money)
                    : formatCount(metric.value.count)}
                </dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}

      {data?.isBanned ? (
        <DetailSection title="Account suspended">
          <DetailNote>
            {data.banReason ?? 'No reason was recorded for this suspension.'}
          </DetailNote>
        </DetailSection>
      ) : null}

      <DetailActions>
        <Link to={customer.to} className={detailActionClass}>
          View profile
        </Link>
        {data?.messageThreadTo ? (
          <Link to={data.messageThreadTo} className={detailActionMutedClass}>
            Message
          </Link>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
