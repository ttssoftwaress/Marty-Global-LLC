import { AlertTriangle, Ban, Check, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { formatMoney, formatOrderDate } from '../../lib/format';
import type { OrderQuote, QuoteStatus } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Quote details — the priced offer the team sent on this order, and the card
 * that lets the customer act on it.
 *
 * Distinct from the Order summary card beside it: that one prints the
 * breakdown, this one is the offer itself — its reference, how long it stands,
 * and the Pay button. The card renders for every terminal state rather than
 * disappearing once the offer lapses: a customer who was quoted a price is
 * entitled to see what became of it.
 *
 * Amounts are integer minor units, formatted only at render (AGENTS.md, Money).
 * `payable` is the backend's decision — the button never re-derives it from the
 * status and the date, so the control and the endpoint always agree.
 */

const QUOTE_CHIP: Record<
  QuoteStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  pending: { label: 'Awaiting payment', icon: Clock, className: 'status-review' },
  paid: { label: 'Paid', icon: Check, className: 'status-approved' },
  expired: { label: 'Expired', icon: AlertTriangle, className: 'status-missing' },
  cancelled: { label: 'Withdrawn', icon: Ban, className: 'status-draft' },
};

function QuoteChip({ status }: { status: QuoteStatus }) {
  const { label, icon: Icon, className } = QUOTE_CHIP[status];
  return (
    <span className={`status-badge gap-1.5 px-2.5 text-small font-medium ${className}`}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      {label}
    </span>
  );
}

// What the footer line says under each state, so a lapsed or withdrawn offer
// explains itself rather than leaving a bare card.
function statusNote(quote: OrderQuote): string {
  switch (quote.status) {
    case 'paid':
      return quote.paidAt
        ? `Paid on ${formatOrderDate(quote.paidAt)}.`
        : 'This quote has been paid.';
    case 'expired':
      return `This quote expired on ${formatOrderDate(quote.validUntil)}. Message us on this order and we'll issue a new one.`;
    case 'cancelled':
      return 'This quote was withdrawn. Message us on this order if you were expecting a price.';
    default:
      return `Valid until ${formatOrderDate(quote.validUntil)}.`;
  }
}

function Row({
  label,
  value,
  labelClass,
  valueClass,
}: {
  label: string;
  value: string;
  labelClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-body">
      <span className={labelClass ?? 'text-text'}>{label}</span>
      <span className={valueClass ?? 'font-medium text-text'}>{value}</span>
    </div>
  );
}

export function QuoteCard({ quote }: { quote: OrderQuote }) {
  return (
    <SectionCard
      title="Quote details"
      titleAccessory={<QuoteChip status={quote.status} />}
      className="gap-4"
    >
      <div className="mt-1 flex flex-col gap-3">
        <Row label="Quote reference" value={quote.reference} />
        <Row label="Date issued" value={formatOrderDate(quote.issuedAt)} />

        <span className="h-px w-full bg-gray-200" aria-hidden="true" />

        {quote.lineItems.map((item) => (
          <Row key={item.label} label={item.label} value={formatMoney(item.amount)} />
        ))}

        <span className="h-px w-full bg-gray-200" aria-hidden="true" />

        <Row label="Subtotal" value={formatMoney(quote.subtotal)} />

        {quote.discount.amount > 0 && (
          <Row
            label="Discount"
            // Stored positive as the amount taken off; the sign is the row's
            // meaning, so it is printed rather than inferred from a negative.
            value={`-${formatMoney(quote.discount)}`}
            valueClass="font-medium text-success"
          />
        )}

        {quote.tax.amount > 0 && <Row label="Tax" value={formatMoney(quote.tax)} />}

        <span className="h-px w-full bg-gray-200" aria-hidden="true" />

        <Row
          label="Total due"
          value={formatMoney(quote.total)}
          labelClass="font-semibold text-text"
          valueClass="text-body-lg font-bold text-text"
        />

        <p className="text-small text-gray-500">{statusNote(quote)}</p>

        {quote.payable && (
          <Link
            to={`/app/billing/pay/${quote.id}`}
            className="btn btn-accent mt-1 h-12 w-full rounded-input text-body"
          >
            Pay {formatMoney(quote.total)}
          </Link>
        )}
      </div>
    </SectionCard>
  );
}
