import type { AdminOrderItem } from '../../types/order-detail';
import { OrderItemDeliveryCard } from './OrderItemDeliveryCard';

/*
 * The delivery section of an order — one card per service line.
 *
 * Kept apart from "Application details" above it deliberately. That card is what
 * the customer TOLD us and a reviewer reads it; this is what we GIVE BACK and a
 * reviewer writes it. Folding delivery into the read view would put an editable
 * form inside the thing being checked against.
 *
 * The whole section disappears for an order whose services return nothing and
 * are already done — there is no work here to show.
 */

type OrderDeliverySectionProps = {
  orderId: string;
  items: AdminOrderItem[];
};

export function OrderDeliverySection({ orderId, items }: OrderDeliverySectionProps) {
  if (items.length === 0) return null;

  const outstanding = items.filter((item) => item.status !== 'completed').length;

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body-lg font-semibold text-text">Service delivery</h2>
        <p className="text-body text-gray-500">
          {outstanding === 0
            ? 'Every service on this order is complete.'
            : `${outstanding} of ${items.length} service${items.length === 1 ? '' : 's'} still open.`}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <OrderItemDeliveryCard key={item.id} orderId={orderId} item={item} />
        ))}
      </div>
    </section>
  );
}
