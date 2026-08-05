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
import { EM_DASH } from '../../lib/payments';
import type { BillingLedgerRow, LedgerAttempt } from '../../types/payments';
import { useAdminLedgerRow } from './queries';

/*
 * The expanded panel under a ledger row — the two things the row cannot answer:
 * what exactly was billed, and what has been attempted against it.
 *
 * Both are extra joins per quote, which is why they are fetched here rather
 * than carried by the list: the panel is mounted only while its row is open, so
 * a page of the ledger asks for one quote's breakdown, not twenty.
 *
 * Every attempt is listed, not only the settled one. A reconciler opening this
 * row is usually asking why an invoice is still open, and "one USDT intent that
 * expired unpaid" is exactly the answer the row itself cannot give.
 */

const ATTEMPT_STATUS_LABEL: Record<string, string> = {
  SUCCEEDED: 'Settled',
  PENDING: 'Awaiting',
  REQUIRES_ACTION: 'Awaiting',
  FAILED: 'Failed',
  CANCELED: 'Cancelled',
  EXPIRED: 'Expired',
};

function AttemptRow({ attempt }: { attempt: LedgerAttempt }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-100 py-2 last:border-b-0">
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-text">
          {attempt.providerLabel} ·{' '}
          {ATTEMPT_STATUS_LABEL[attempt.status] ?? attempt.status}
        </span>
        {attempt.providerRef ? (
          <code className="truncate text-small text-gray-500">
            {attempt.providerRef}
          </code>
        ) : null}
        {attempt.failureReason ? (
          <span className="text-small text-error">{attempt.failureReason}</span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-baseline gap-3">
        <span className="text-body font-medium text-text">
          {formatMoney(attempt.amount)}
        </span>
        <span className="text-small text-gray-500">
          {formatOrderDate(attempt.paidAt ?? attempt.createdAt)}
        </span>
      </span>
    </li>
  );
}

export function LedgerDetails({ row }: { row: BillingLedgerRow }) {
  const detail = useAdminLedgerRow(row.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this invoice."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Quote reference" mono>
          {data?.quoteReference}
        </DetailField>
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
            </>
          ) : null}
        </DetailField>
        <DetailField label="Valid until">
          {data ? formatOrderDate(data.validUntil) : null}
        </DetailField>
        <DetailField label="Reminders sent">
          {data
            ? data.reminderCount === 0
              ? 'None'
              : `${data.reminderCount} · last ${formatOrderDate(
                  data.lastRemindedAt ?? data.issuedAt,
                )}`
            : null}
        </DetailField>
      </DetailGrid>

      <DetailSection title="What was billed">
        {data && data.items.length > 0 ? (
          <ul className="flex flex-col">
            {data.items.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-2 last:border-b-0"
              >
                <span className="min-w-0 text-body text-text">{item.label}</span>
                <span className="shrink-0 text-body font-medium text-text">
                  {formatMoney(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            This quote was raised as a single amount, with no itemised breakdown.
          </p>
        )}

        {data ? (
          <dl className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2 text-body">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Subtotal</dt>
              <dd>{formatMoney(data.subtotal)}</dd>
            </div>
            {data.discount.amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Discount</dt>
                <dd>{EM_DASH}{formatMoney(data.discount)}</dd>
              </div>
            ) : null}
            {data.tax.amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Tax</dt>
                <dd>{formatMoney(data.tax)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(data.total)}</dd>
            </div>
          </dl>
        ) : null}
      </DetailSection>

      <DetailSection title="Payment attempts">
        {data && data.attempts.length > 0 ? (
          <ul className="flex flex-col">
            {data.attempts.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </ul>
        ) : (
          <p className="text-body text-gray-500">
            Nothing has been attempted against this invoice yet.
          </p>
        )}
      </DetailSection>

      {data?.order ? (
        <DetailActions>
          <Link to={data.order.to} className={detailActionClass}>
            Open order {data.order.reference}
          </Link>
        </DetailActions>
      ) : null}
    </DetailPanel>
  );
}
