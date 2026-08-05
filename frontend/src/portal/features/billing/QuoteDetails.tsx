import { Link } from 'react-router-dom';

import {
  DetailActions,
  DetailField,
  DetailGrid,
  DetailPanel,
  DetailSection,
  detailActionMutedClass,
} from '../../components/ExpandableRow';
import { formatMoney, formatOrderDate } from '../../lib/format';
import type { BillingQuote } from '../../types/billing';
import { useBillingQuote } from './queries';

/*
 * The expanded panel under a quote awaiting payment — what the amount is made
 * of.
 *
 * This is the one thing a customer wants before paying, and the one thing the
 * row cannot show. It is fetched on expand rather than carried by the billing
 * overview, because that payload is loaded by two screens (this one and the
 * dashboard's billing card) and itemising every open quote on both to render a
 * breakdown nobody has opened is the cost the split removes.
 *
 * "Pay now" stays on the row rather than moving in here: the panel is for
 * reading, and burying the primary action a level deep would make the common
 * case slower.
 */

export function QuoteDetails({ quote }: { quote: BillingQuote }) {
  const detail = useBillingQuote(quote.id);
  const data = detail.data;

  return (
    <DetailPanel
      isPending={detail.isPending}
      isError={detail.isError}
      errorMessage="Could not load this quote."
      onRetry={() => void detail.refetch()}
    >
      <DetailGrid>
        <DetailField label="Reference" mono>
          {data?.reference}
        </DetailField>
        <DetailField label="Issued">
          {formatOrderDate(quote.issuedAt)}
        </DetailField>
        <DetailField label="Valid until">
          {formatOrderDate(quote.validUntil)}
        </DetailField>
        <DetailField label="Total">{formatMoney(quote.amount)}</DetailField>
      </DetailGrid>

      <DetailSection title="What this covers">
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
            This quote was issued as a single amount for {quote.serviceName}.
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
                <dd>−{formatMoney(data.discount)}</dd>
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
              <dd>{formatMoney(quote.amount)}</dd>
            </div>
          </dl>
        ) : null}
      </DetailSection>

      {data?.order ? (
        <DetailActions>
          <Link to={data.order.to} className={detailActionMutedClass}>
            View order {data.order.reference}
          </Link>
        </DetailActions>
      ) : null}
    </DetailPanel>
  );
}
