import { ArrowRight, ChevronLeft, MoreVertical } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { OrderStatus } from '../../types/dashboard';
import { OrderStatusChip } from '../dashboard/OrderStatusChip';

/*
 * A thread's header. On mobile it leads with a back chevron (the thread is a
 * full screen there) and stacks the status under the subject; from tablet up
 * both panes are visible, so the back button drops away, the status sits inline,
 * and a "View order" link appears when the conversation is tied to an order.
 *
 * The options menu is a placeholder affordance — its actions land with the
 * support module.
 */

type ThreadHeaderProps = {
  subject: string;
  status?: OrderStatus;
  orderId?: string;
  onBack: () => void;
};

export function ThreadHeader({ subject, status, orderId, onBack }: ThreadHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 md:px-5 md:py-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to messages"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-text md:hidden"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-center md:gap-3">
          <p className="truncate text-[15px] font-semibold text-text lg:text-[16px]">
            {subject}
          </p>
          {status ? (
            <span className="shrink-0">
              <OrderStatusChip status={status} />
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        {orderId ? (
          <Link
            to={`/app/orders/${orderId}`}
            className="hidden items-center gap-1 text-[13px] font-medium text-primary hover:underline md:flex lg:text-[14px]"
          >
            View order
            <ArrowRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : null}

        <button
          type="button"
          aria-label="Conversation options"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-text"
        >
          <MoreVertical className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
