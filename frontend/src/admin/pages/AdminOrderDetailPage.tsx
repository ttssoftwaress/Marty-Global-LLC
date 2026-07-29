import { Link, useParams } from 'react-router-dom';

import { AdminLayout } from '../components/AdminLayout';
import {
  OrderActionsCard,
  OrderActivityCard,
  OrderApplicationCard,
  OrderCustomerCard,
  OrderDetailBreadcrumbs,
  OrderDetailHeader,
  OrderDocumentsCard,
  OrderInformationCard,
  OrderQuoteCard,
  useAdminOrder,
} from '../features/order-detail';
import { OrderDeliverySection } from '../features/delivery';
import { OrderConversationCard } from '../features/order-conversation';
import { useAdminShell } from '../hooks/useAdminShell';

/*
 * Order detail — the staff screen for working one order. Reached from the queue's
 * row action, the customer record's orders panel, the billing ledger, and the
 * support thread header; every one of those resolves to `/admin/orders/:orderId`
 * because that is the route the backend returns as an order's `to`.
 *
 * The screen answers three questions in order: where is this order, what did the
 * customer actually ask for, and what do I do about it. That order is the same
 * at every width; what changes is how the two groups sit:
 *   - lg (desktop): a two-column bento — a main column (application, documents,
 *     activity) beside a 23.75rem rail (actions, customer, order information)
 *   - md (tablet) & mobile: one column, with the rail's cards lifted above the
 *     application. A reviewer on a phone is there to act, not to re-read the
 *     form, so the controls come first.
 *
 * One tree serves all three, using the same `display: contents` technique the
 * portal's order screen uses: below `lg` the two column wrappers collapse and
 * each card's `order-*` class sets the single-column sequence; at `lg` the
 * wrappers become real columns and pack their own cards.
 *
 * There is no design source for this screen — it is built to match the customer
 * record and the portal's order detail, which is logged as a deviation in the
 * task summary.
 */

function OrderDetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5 md:gap-6" aria-hidden="true">
      <div className="h-16 w-full max-w-[26.25rem] animate-pulse rounded-card bg-gray-200" />

      <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
        <div className="flex flex-1 flex-col gap-5 md:gap-6">
          <div className="h-[17.5rem] w-full animate-pulse rounded-card bg-gray-200" />
          <div className="h-[11.25rem] w-full animate-pulse rounded-card bg-gray-200" />
        </div>

        <div className="flex w-full flex-col gap-5 md:gap-6 lg:w-[23.75rem] lg:shrink-0">
          <div className="h-[15rem] w-full animate-pulse rounded-card bg-gray-200" />
          <div className="h-[13.75rem] w-full animate-pulse rounded-card bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-16 text-center shadow-sm-elevation">
      <p className="text-h6 text-text">Order not found</p>
      <p className="max-w-[26.25rem] text-body text-gray-500">
        This order may have been removed, or the link is no longer valid.
      </p>
      <Link to="/admin/orders" className="btn btn-secondary mt-1 rounded-input text-body">
        Back to orders
      </Link>
    </div>
  );
}

export function AdminOrderDetailPage() {
  const { user, onLogout } = useAdminShell();
  const { orderId = '' } = useParams<{ orderId: string }>();

  const order = useAdminOrder(orderId);

  return (
    <AdminLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[87.5rem] flex-col gap-5 md:gap-6">
          <OrderDetailBreadcrumbs reference={order.data?.reference ?? ''} />

          {order.isPending ? (
            <OrderDetailSkeleton />
          ) : order.data ? (
            <>
              <OrderDetailHeader order={order.data} />

              <div className="flex flex-col gap-5 md:gap-6 lg:flex-row lg:items-start">
                {/* Main column — the application, its documents, its history. */}
                <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
                  <div className="order-4">
                    <OrderApplicationCard
                      items={order.data.items}
                      notes={order.data.notes}
                    />
                  </div>
                  {/*
                   * Service delivery — what we give back, per service line.
                   * Below the application card because it is the answer to it:
                   * a reviewer reads what was asked for, then fills in what was
                   * produced. Kept out of that card so an editable form never
                   * sits inside the thing being checked against.
                   */}
                  <div className="order-5">
                    <OrderDeliverySection
                      orderId={order.data.id}
                      items={order.data.items}
                    />
                  </div>
                  <div className="order-6">
                    <OrderDocumentsCard
                      orderId={order.data.id}
                      documents={order.data.documents}
                    />
                  </div>
                  <div className="order-7">
                    <OrderActivityCard activity={order.data.activity} />
                  </div>
                  {/*
                   * The conversation sits under the activity feed and is the only
                   * place on this screen you write to the customer: the feed is
                   * what happened to the order, the conversation is the customer
                   * asking about it. Only this order's assignee (or an admin) can
                   * see it — the backend 404s anyone else, so its presence here
                   * means you are entitled to answer.
                   */}
                  <div className="order-8">
                    <OrderConversationCard orderId={order.data.id} />
                  </div>
                </div>

                {/* Rail — what a reviewer does, and who they are doing it for. */}
                <div className="contents lg:flex lg:w-[23.75rem] lg:shrink-0 lg:flex-col lg:gap-6">
                  <div className="order-1">
                    <OrderActionsCard order={order.data} />
                  </div>
                  <div className="order-2">
                    <OrderCustomerCard customer={order.data.customer} />
                  </div>
                  {/*
                   * Pricing sits directly under the action controls: advancing
                   * an order and quoting it are the two things a reviewer does
                   * from this rail. The card renders nothing for a member
                   * without the `payments` area.
                   */}
                  <div className="order-3 lg:order-none">
                    <OrderQuoteCard orderId={order.data.id} />
                  </div>
                  <div className="order-9">
                    <OrderInformationCard order={order.data} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <NotFoundState />
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
