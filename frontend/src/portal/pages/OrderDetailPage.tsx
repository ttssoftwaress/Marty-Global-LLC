import { useParams } from 'react-router-dom';

import { PortalLayout } from '../components/PortalLayout';
import {
  ActivityCard,
  ApplicationDetailsCard,
  DocumentsCard,
  NeedHelpCard,
  OrderDetailHeader,
  OrderInformationCard,
  OrderSummaryCard,
  OrderTimelineCard,
  PaymentStatusCard,
} from '../features/order-detail';
import { useOrderDetail } from '../features/orders/queries';
import { usePortalShell } from '../hooks/usePortalShell';
import type { OrderDetail } from '../types/orders';

/*
 * Single order detail — the full record of one order: lifecycle timeline,
 * application details, documents, activity, priced summary, payment, and order
 * metadata.
 *
 * One tree serves all three viewports; only the layout of the section cards
 * changes between breakpoints, which the classes below drive:
 *   - lg (desktop): a two-column bento — a main column (application details,
 *     documents, activity) beside a 440px rail (summary, payment, order info,
 *     need-help).
 *   - md (tablet) & mobile: a single column. The card ORDER differs between the
 *     two links — mobile lifts the summary + payment above the details, tablet
 *     keeps the desktop reading order — so each card carries an `order-*` class
 *     that Tailwind resets at md. The header and timeline are full-width and
 *     shared across all three.
 *
 * Every value comes from `order`; nothing here is hardcoded customer data. The
 * detail endpoint isn't built yet, so the screen renders a skeleton until an
 * order is supplied by its future query, keyed off the `:orderId` route param.
 */

type OrderDetailPageProps = {
  order?: OrderDetail;
  isLoading?: boolean;
};

function OrderDetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-7" aria-hidden="true">
      <div className="h-16 w-full max-w-[520px] animate-pulse rounded-input bg-gray-200" />
      <div className="h-40 w-full animate-pulse rounded-card bg-gray-200" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="h-[520px] flex-1 animate-pulse rounded-card bg-gray-200" />
        <div className="h-[520px] w-full animate-pulse rounded-card bg-gray-200 lg:w-[440px]" />
      </div>
    </div>
  );
}

export function OrderDetailPage({
  order: orderProp,
  isLoading: isLoadingProp,
}: OrderDetailPageProps) {
  const { user, onLogout } = usePortalShell();
  const { orderId } = useParams();

  // The order record comes from the backend, keyed by the route param; a prop
  // override lets tests supply one directly.
  const orderQuery = useOrderDetail(orderId);
  const order = orderProp ?? orderQuery.data;
  const isLoading = isLoadingProp ?? orderQuery.isLoading;

  const showSkeleton = isLoading || !order;

  // Support and conversation links hang off this order's id (falling back to the
  // route param while the record loads).
  const orderKey = order?.id ?? orderId ?? '';
  const conversationHref = `/app/orders/${orderKey}/conversation`;
  const supportHref = `/app/support?order=${orderKey}`;

  return (
    <PortalLayout user={user} onLogout={onLogout}>
      <div className="w-full p-4 md:p-6 lg:p-content">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 lg:gap-8">
          {showSkeleton ? (
            <OrderDetailSkeleton />
          ) : (
            <>
              <OrderDetailHeader order={order} />

              <OrderTimelineCard timeline={order.timeline} />

              {/*
               * The bento. A single tree serves every viewport via the
               * `display: contents` trick on the two column wrappers:
               *   - mobile & tablet: the wrappers collapse (`contents`), so all
               *     seven cards are direct children of the flex column and each
               *     card's `order-*` sets the mobile sequence (summary + payment
               *     lifted above the details, per the mobile link). `md:order-*`
               *     restores the desktop reading order for tablet.
               *   - lg (desktop): the wrappers become real flex columns — a
               *     flexible main column beside a fixed 440px rail — each packing
               *     its own cards independently, reproducing the desktop bento.
               */}
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* Main column — application details, documents, activity */}
                <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-6">
                  <div className="order-3 md:order-1">
                    <ApplicationDetailsCard fields={order.applicationDetails} />
                  </div>
                  <div className="order-4 md:order-2">
                    <DocumentsCard documents={order.documents} />
                  </div>
                  <div className="order-5 md:order-3">
                    <ActivityCard
                      activity={order.activity}
                      conversationHref={conversationHref}
                    />
                  </div>
                </div>

                {/*
                 * Rail column. The summary+payment pair and the order-info+
                 * need-help pair each sit in their own wrapper: full-width
                 * stacked on mobile, a 2-up row on tablet (matching the tablet
                 * link's paired rows), and stacked again inside the rail on
                 * desktop. Because these pairs are adjacent in the mobile order,
                 * pairing them doesn't disturb the mobile sequence.
                 */}
                <div className="contents lg:flex lg:w-[440px] lg:shrink-0 lg:flex-col lg:gap-6">
                  <div className="order-1 flex flex-col gap-6 md:order-4 md:flex-row lg:flex-col">
                    <div className="flex-1">
                      <OrderSummaryCard summary={order.summary} />
                    </div>
                    <div className="flex-1">
                      <PaymentStatusCard payment={order.payment} />
                    </div>
                  </div>
                  <div className="order-6 flex flex-col gap-6 md:flex-row lg:flex-col">
                    <div className="flex-1">
                      <OrderInformationCard fields={order.orderInformation} />
                    </div>
                    <div className="flex-1">
                      <NeedHelpCard supportHref={supportHref} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
