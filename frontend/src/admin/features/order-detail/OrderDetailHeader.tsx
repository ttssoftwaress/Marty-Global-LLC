import { CalendarDays, UserCog } from 'lucide-react';

import { formatOrderDate } from '../../lib/format';
import type { AdminOrderDetail } from '../../types/order-detail';
import { OrderStatusChip } from '../orders';

/*
 * The order's identity block — the reference, its status, and the three facts a
 * reviewer orients on before doing anything: when it arrived, which jurisdiction
 * it is for, and who is holding it.
 *
 * One tree at every width. Mobile puts the block inside a white card, matching
 * the customer record's own header; from `md` up the card styling drops away and
 * the block sits on the page background, where the meta line collapses from a
 * stack into one row. There are no controls here — advancing and assigning live
 * in their own card, so the header stays a statement of where the order is.
 */

export function OrderDetailHeader({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-card border border-gray-200 bg-white p-4 shadow-sm-elevation md:gap-2.5 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold leading-8 text-text md:text-[26px] lg:text-[32px] lg:leading-10">
          {order.reference}
        </h1>
        <OrderStatusChip status={order.status} label={order.statusLabel} />
      </div>

      <div className="flex flex-col gap-1.5 text-body text-gray-500 md:flex-row md:flex-wrap md:items-center md:gap-x-5 md:gap-y-1.5">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          Submitted {formatOrderDate(order.submittedAt)}
        </span>

        <span className="flex items-center gap-2">
          {order.region.flag ? (
            <span aria-hidden="true" className="text-body leading-none">
              {order.region.flag}
            </span>
          ) : null}
          {order.region.name}
        </span>

        <span className="flex items-center gap-2">
          <UserCog className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {order.assignee ? `Assigned to ${order.assignee.name}` : 'Unassigned'}
        </span>
      </div>
    </div>
  );
}
