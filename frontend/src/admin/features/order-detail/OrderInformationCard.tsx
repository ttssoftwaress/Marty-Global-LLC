import { formatOrderDate } from '../../lib/format';
import type { AdminOrderDetail } from '../../types/order-detail';
import { SectionCard } from './SectionCard';

/*
 * The order's own metadata — the facts that identify the record rather than
 * describe the application: its reference, how many services it covers, the
 * jurisdiction, and when it last moved.
 *
 * "Last updated" is the one figure that is not repeated in the header, and it is
 * the one a reviewer picking up someone else's queue looks for first.
 */

export function OrderInformationCard({ order }: { order: AdminOrderDetail }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Order reference', value: order.reference },
    { label: 'Services', value: String(order.items.length) },
    { label: 'Jurisdiction', value: order.region.name },
    { label: 'Submitted', value: formatOrderDate(order.submittedAt) },
    { label: 'Last updated', value: formatOrderDate(order.updatedAt) },
  ];

  return (
    <SectionCard title="Order information">
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-body text-gray-500">{row.label}</dt>
            <dd className="min-w-0 truncate text-body font-medium text-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
