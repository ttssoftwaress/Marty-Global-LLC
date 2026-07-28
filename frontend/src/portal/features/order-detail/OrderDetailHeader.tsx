import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { OrderStatusChip } from '../dashboard/OrderStatusChip';
import { formatOrderDate } from '../../lib/format';
import type { OrderDetail } from '../../types/orders';

/*
 * Order-detail header — the top block above the cards. It restructures between
 * breakpoints (the three Figma links differ here), so each viewport renders its
 * own arrangement while sharing the same data and the back link to the orders
 * list:
 *   - mobile:  a "My orders" back row, the title, then the status chip beside
 *              the "#ref · Submitted date" meta line, wrapping if narrow.
 *   - md+:     breadcrumb, then a row with a boxed back button + title/meta on
 *              the left and the status chip on the right.
 *
 * Copy (breadcrumb, meta) follows the desktop link, the source of truth for
 * wording across the three viewports.
 */

const ORDERS_HREF = '/app/orders';

export function OrderDetailHeader({ order }: { order: OrderDetail }) {
  const submitted = formatOrderDate(order.submittedAt);

  return (
    <header className="flex w-full flex-col">
      {/* Mobile back row */}
      <Link
        to={ORDERS_HREF}
        className="flex items-center gap-3 pb-4 text-body font-medium text-text-secondary md:hidden"
      >
        <ArrowLeft className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        My orders
      </Link>

      {/* Breadcrumb — md and up */}
      <p className="hidden text-caption font-semibold uppercase tracking-[0.6px] text-gray-400 md:block">
        Dashboard / My orders / {order.serviceName}
      </p>

      {/* Mobile title + meta */}
      <div className="flex flex-col gap-3 md:hidden">
        <h1 className="text-h4 font-semibold text-text">{order.serviceName}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusChip status={order.status} />
          <p className="text-small text-text-secondary">
            #{order.reference} · Submitted {submitted}
          </p>
        </div>
      </div>

      {/* md+ header row */}
      <div className="mt-4 hidden items-center justify-between gap-4 md:flex">
        <div className="flex items-center gap-4">
          <Link
            to={ORDERS_HREF}
            className="flex size-10 shrink-0 items-center justify-center rounded-input border border-primary bg-white text-primary transition-colors hover:bg-primary-light"
            aria-label="Back to my orders"
          >
            <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="text-[1.75rem] font-semibold leading-tight text-text lg:text-h3">
              {order.serviceName}
            </h1>
            <p className="text-body text-text-secondary">
              Order ID: #{order.reference} · Submitted: {submitted}
            </p>
          </div>
        </div>
        <OrderStatusChip status={order.status} />
      </div>
    </header>
  );
}
