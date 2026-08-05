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
import { formatActivityTime, formatMoney, formatOrderDate } from '../../lib/format';
import type { SettlementRow } from '../../types/payments';
import { useAdminSettlement } from './queries';

/*
 * The expanded panel under a settlement — what a settler needs in front of them
 * before crediting money nobody can see arrive.
 *
 * The instruction snapshot is the reason this panel exists at all: it is the
 * account the customer was TOLD to send to, frozen at intent time, and matching
 * it against a bank statement is the actual job. It is a whole rendered details
 * block per wire, so it is fetched per row rather than shipped with the queue.
 *
 * The settlement note is here too rather than truncated onto the row. It is
 * usually the sentence explaining why a payment was closed without settling,
 * which is the one thing a truncated cell must not eat.
 */

export function SettlementDetails({ row }: { row: SettlementRow }) {
  const detail = useAdminSettlement(row.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this payment."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Customer">
          {row.customerName}
          <a
            href={`mailto:${row.customerEmail}`}
            className="block truncate text-small text-primary hover:underline"
          >
            {row.customerEmail}
          </a>
        </DetailField>
        <DetailField label="Quote reference" mono>
          {row.reference}
        </DetailField>
        <DetailField label="Quote total">
          {data?.quoteTotal ? formatMoney(data.quoteTotal) : null}
        </DetailField>
        <DetailField label="Quote valid until">
          {data?.quoteValidUntil ? formatOrderDate(data.quoteValidUntil) : null}
        </DetailField>

        <DetailField label="Raised">{formatOrderDate(row.createdAt)}</DetailField>
        <DetailField label="Customer says sent">
          {row.markedSentAt ? formatActivityTime(row.markedSentAt) : 'Not yet'}
        </DetailField>
        <DetailField label="Reference recorded" mono>
          {data?.providerRef}
        </DetailField>
        <DetailField label="Settled">
          {row.settledAt
            ? `${formatOrderDate(row.settledAt)}${row.settledBy ? ` · ${row.settledBy}` : ''}`
            : null}
        </DetailField>
      </DetailGrid>

      <DetailSection title={data?.accountLabel ?? 'Details the customer was shown'}>
        {data && data.instructions.length > 0 ? (
          <dl className="flex flex-col gap-1.5">
            {data.instructions.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className="flex flex-wrap items-baseline justify-between gap-3"
              >
                <dt className="shrink-0 text-small text-gray-500">{field.label}</dt>
                <dd className="min-w-0 break-all text-right font-mono text-small text-text">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-body text-gray-500">
            {row.provider === 'wire_transfer'
              ? 'No bank details were snapshotted onto this payment.'
              : 'A USDT payment carries a deposit address rather than bank details.'}
          </p>
        )}
      </DetailSection>

      {data?.settlementNote ? (
        <DetailSection title="Note">
          <DetailNote>{data.settlementNote}</DetailNote>
        </DetailSection>
      ) : null}

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
