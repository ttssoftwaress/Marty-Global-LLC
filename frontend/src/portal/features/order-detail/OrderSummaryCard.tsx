import { formatMoney } from '../../lib/format';
import type { OrderSummary } from '../../types/orders';
import { SectionCard } from './SectionCard';

/*
 * Order summary — the priced breakdown: line items, a subtotal, an optional
 * discount, then the total. Amounts are integer minor units formatted only
 * here (AGENTS.md, Money rules). A discount is stored as negative minor units,
 * so `formatMoney` already renders its sign; it's tinted green to match the
 * design. Dividers separate the line items from the subtotal and the subtotal
 * from the total.
 */

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

export function OrderSummaryCard({ summary }: { summary: OrderSummary }) {
  return (
    <SectionCard title="Order summary" className="gap-4">
      <div className="mt-1 flex flex-col gap-3">
        {summary.lineItems.map((item) => (
          <Row key={item.label} label={item.label} value={formatMoney(item.amount)} />
        ))}

        <span className="h-px w-full bg-gray-200" aria-hidden="true" />

        <Row label="Subtotal" value={formatMoney(summary.subtotal)} />

        {summary.discount && (
          <Row
            label="Discount"
            value={formatMoney(summary.discount)}
            valueClass="font-medium text-success"
          />
        )}

        <span className="h-px w-full bg-gray-200" aria-hidden="true" />

        <Row
          label="Total"
          value={formatMoney(summary.total)}
          labelClass="font-semibold text-text"
          valueClass="font-bold text-text"
        />
      </div>
    </SectionCard>
  );
}
