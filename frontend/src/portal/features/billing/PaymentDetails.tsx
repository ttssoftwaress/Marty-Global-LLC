import { Download } from 'lucide-react';
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
import { formatMoney, formatOrderDate } from '../../lib/format';
import type { PaymentRecord } from '../../types/billing';
import { usePaymentRecord } from './queries';

/*
 * The expanded panel under a payment — what was actually billed, and the
 * invoice.
 *
 * The invoice link is why this is fetched per row rather than shipped with the
 * page. It is a short-TTL presigned URL (AGENTS.md, Security & PII): minting
 * one for every payment on the page signed twenty URLs to serve at most one,
 * and started every clock at page load, so a button pressed twenty minutes into
 * reading the history was already dead. Here it is minted when the customer
 * opens the row they want it from.
 *
 * A failed payment says why in plain words rather than showing a status chip
 * and nothing else — "it didn't go through" with no reason is the state that
 * generates a support message.
 */

export function PaymentDetails({ payment }: { payment: PaymentRecord }) {
  const detail = usePaymentRecord(payment.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this payment."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Reference" mono>
          {data?.reference}
        </DetailField>
        <DetailField label="Paid on">
          {formatOrderDate(payment.paidAt)}
        </DetailField>
        <DetailField label="Method">{payment.method}</DetailField>
        <DetailField label="Transaction" mono>
          {data?.providerRef}
        </DetailField>
      </DetailGrid>

      {data?.failureReason ? (
        <DetailSection title="Why this didn’t go through">
          <p className="text-body text-text">{data.failureReason}</p>
        </DetailSection>
      ) : null}

      <DetailSection title="What you were billed for">
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
            This payment was raised as a single amount, with no itemised
            breakdown.
          </p>
        )}

        {data?.quote ? (
          <dl className="mt-2 flex flex-col gap-1 border-t border-gray-200 pt-2 text-body">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Subtotal</dt>
              <dd>{formatMoney(data.quote.subtotal)}</dd>
            </div>
            {data.quote.discount.amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Discount</dt>
                <dd>−{formatMoney(data.quote.discount)}</dd>
              </div>
            ) : null}
            {data.quote.tax.amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Tax</dt>
                <dd>{formatMoney(data.quote.tax)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(data.quote.total)}</dd>
            </div>
          </dl>
        ) : null}
      </DetailSection>

      <DetailActions>
        {data?.invoiceHref ? (
          <a href={data.invoiceHref} download className={detailActionClass}>
            <Download
              className="mr-1.5 size-4 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            Download invoice
          </a>
        ) : (
          <span className="text-small text-gray-500">
            Your invoice for this payment isn’t ready yet.
          </span>
        )}

        {data?.order ? (
          <Link to={data.order.to} className={detailActionMutedClass}>
            View order {data.order.reference}
          </Link>
        ) : null}
      </DetailActions>
    </DetailPanel>
  );
}
