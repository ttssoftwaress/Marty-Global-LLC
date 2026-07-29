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
 * The options menu only renders once something can open it (`onOpenOptions`).
 * Its actions land with the support module, and an enabled button that does
 * nothing is a promise to keyboard and screen-reader users we can't yet keep.
 */

type ThreadHeaderProps = {
  subject: string;
  status?: OrderStatus;
  orderId?: string;
  onBack: () => void;
  onOpenOptions?: () => void;
};

export function ThreadHeader({
  subject,
  status,
  orderId,
  onBack,
  onOpenOptions,
}: ThreadHeaderProps) {
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
          <p className="truncate text-[0.9375rem] font-semibold text-text lg:text-[1rem]">
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
            className="hidden items-center gap-1 text-[0.8125rem] font-medium text-primary hover:underline md:flex lg:text-[0.875rem]"
          >
            View order
            <ArrowRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        ) : null}

        {onOpenOptions ? (
          <button
            type="button"
            onClick={onOpenOptions}
            aria-haspopup="menu"
            aria-label="Conversation options"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-text"
          >
            <MoreVertical className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
