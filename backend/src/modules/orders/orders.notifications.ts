import { FeedNotificationCategory, OrderStatus } from '@prisma/client';

import { publicAppUrl } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { notifyFeed } from '../notifications/notifications.feed.js';
import { channelsFor } from '../notifications/notifications.preferences.js';
import { queueEmail } from '../notifications/notifications.service.js';

/*
 * Telling a customer their filing moved.
 *
 * The order pipeline was the largest gap in the notification system: an order
 * could go from Submitted to Completed without the customer being told once. The
 * activity row on the order is its history — it is there whenever they open the
 * order — but nothing pushed them to go and look, so the feed's whole `ORDER`
 * category was written by the seed script and nothing else.
 *
 * Gated on `statusUpdates`, which is the row of `/app/settings` this belongs to:
 * the "Status updates" tab covers the ORDER, MAILROOM, and PAYMENT feed
 * categories (notifications.service.ts, FILTER_CATEGORIES).
 *
 * Nothing here throws into the caller. A reviewer who advanced an order
 * correctly must not see a failure because SES was down.
 */

/*
 * Not every status is worth interrupting someone for.
 *
 * DRAFT and SUBMITTED are the customer's own actions a moment ago — they just
 * clicked the button, and the confirmation email already answers it. UNDER_REVIEW
 * is us picking the work up, which changes nothing they can act on. The rest are
 * either a decision about their filing or a request for something from them.
 *
 * A status with no entry here sends nothing, which is what makes adding a new
 * pipeline stage safe: it is silent until someone writes the copy for it.
 */
const STATUS_NOTICE: Partial<
  Record<
    OrderStatus,
    { message: (reference: string) => string; subject: string; heading: string; body: string }
  >
> = {
  [OrderStatus.MISSING_INFO]: {
    message: (reference) =>
      `Order ${reference} needs more information before we can continue.`,
    subject: 'We need more information on your order',
    heading: 'Your order needs your attention',
    body: 'We reviewed your application and need a little more from you before we can continue. Open the order to see what is outstanding.',
  },
  [OrderStatus.APPROVED]: {
    message: (reference) => `Order ${reference} has been approved.`,
    subject: 'Your order has been approved',
    heading: 'Your order is approved',
    body: 'We have reviewed your application and approved it. Your itemised quote is ready in your portal.',
  },
  [OrderStatus.PAID]: {
    message: (reference) => `Payment settled on order ${reference}. Filing begins next.`,
    subject: 'Payment settled — your filing is starting',
    heading: 'Payment settled',
    body: 'Your payment has settled and your filing is moving into processing. We will let you know as it progresses.',
  },
  [OrderStatus.PROCESSING]: {
    message: (reference) => `Order ${reference} is now being processed.`,
    subject: 'Your filing is being processed',
    heading: 'Your filing is underway',
    body: 'Your filing is now with the relevant registry. We will notify you as soon as it completes.',
  },
  [OrderStatus.COMPLETED]: {
    message: (reference) => `Order ${reference} is complete. Your documents are ready.`,
    subject: 'Your order is complete',
    heading: 'Your order is complete',
    body: 'Your filing is complete and your documents are available in your portal.',
  },
};

export async function notifyOrderStatusChanged(input: {
  customerId: string;
  orderId: string;
  reference: string;
  status: OrderStatus;
}): Promise<void> {
  const notice = STATUS_NOTICE[input.status];
  if (!notice) return;

  const href = `/app/orders/${input.orderId}`;

  try {
    await notifyFeed({
      userId: input.customerId,
      preference: 'statusUpdates',
      category: FeedNotificationCategory.ORDER,
      message: notice.message(input.reference),
      href,
    });

    const { email } = await channelsFor(input.customerId, 'statusUpdates');
    if (!email) return;

    // The address is read here rather than passed in, so a caller cannot reach
    // this without the row that proves the customer exists.
    const customer = await prisma.user.findUnique({
      where: { id: input.customerId },
      select: { email: true },
    });

    if (!customer) return;

    await queueEmail({
      to: customer.email,
      subject: notice.subject,
      template: 'generic',
      heading: notice.heading,
      body: notice.body,
      actionLabel: 'View order',
      actionUrl: `${publicAppUrl}${href}`,
      userId: input.customerId,
    });
  } catch (error) {
    // Ids only — a reference and a status, never the customer's address.
    logger.error(
      { err: error, orderId: input.orderId, status: input.status },
      'Failed to notify customer about an order status change',
    );
  }
}

/*
 * "We need a document from you."
 *
 * Its own category rather than a status change, because it is a request the
 * customer has to act on and it is the one the settings screen files under
 * `documentRequests` — a row that gated nothing at all until now. It is also the
 * only writer of the DOCUMENT feed category, which the `/app/notifications`
 * "Documents" filter tab reads.
 */
export async function notifyDocumentRequested(input: {
  customerId: string;
  orderId: string;
  reference: string;
  documentLabel: string;
}): Promise<void> {
  const href = `/app/orders/${input.orderId}`;

  try {
    await notifyFeed({
      userId: input.customerId,
      preference: 'documentRequests',
      category: FeedNotificationCategory.DOCUMENT,
      message: `We need ${input.documentLabel} to continue with order ${input.reference}.`,
      href,
    });

    const { email } = await channelsFor(input.customerId, 'documentRequests');
    if (!email) return;

    const customer = await prisma.user.findUnique({
      where: { id: input.customerId },
      select: { email: true },
    });

    if (!customer) return;

    await queueEmail({
      to: customer.email,
      subject: `Document needed for order ${input.reference}`,
      template: 'generic',
      heading: 'We need a document from you',
      body: `To continue with order ${input.reference} we need ${input.documentLabel}. You can upload it from the order page in your portal.`,
      actionLabel: 'Upload document',
      actionUrl: `${publicAppUrl}${href}`,
      userId: input.customerId,
    });
  } catch (error) {
    logger.error(
      { err: error, orderId: input.orderId },
      'Failed to notify customer about a document request',
    );
  }
}
