import { FeedNotificationCategory, StaffStatus } from '@prisma/client';

import { logger } from '../../lib/logger.js';
import { scopeKeyFor, type ScopedArea } from '../../lib/permissions.js';
import { prisma } from '../../lib/prisma.js';
import { createFeedNotification } from '../notifications/notifications.feed.js';

/*
 * Telling the team something needs working.
 *
 * `/admin/notifications` and the admin bell read the same `FeedNotification`
 * ledger the customer feed does — a staff member is a User row, so the rows are
 * simply addressed to them. Until now nothing ever wrote one: every existing
 * writer targeted a customer id, which made the staff feed, its filter tabs, and
 * its badge a screen that could only ever be empty.
 *
 * Who gets told is a permission question, answered the same way the sections
 * themselves are. A member holding an area's `.all` scope oversees that whole
 * queue and hears about everything in it; a member holding only the area works
 * what they are given, so they hear about the rows assigned to them and nothing
 * else. That mirrors what the list endpoints already show each of them, so the
 * bell never announces work its own screen would hide.
 *
 * Staff rows are deliberately NOT preference-gated. The notification matrix on
 * `/app/settings` belongs to customers — it is a customer screen, and staff have
 * no equivalent — and a work queue is not something a member opts out of. They
 * use `createFeedNotification` directly for that reason.
 *
 * Nothing here throws into the caller, for the same reason as everywhere else in
 * the notification pipeline: telling the team is a consequence of the customer's
 * action, never a condition of it.
 */

/*
 * Everyone who should hear about a row in `area`.
 *
 * `assigneeId` is whoever holds the specific record. They are always told —
 * being handed the work is exactly the case where a notification matters — and
 * they are told even without the `.all` scope, which is the whole point of the
 * split.
 *
 * Admins are not special-cased: a super-admin holds every `.all` key by default
 * (lib/permissions.ts), so they arrive through the same query as everyone else
 * rather than through a second rule that could disagree with it.
 */
async function recipientsFor(
  area: ScopedArea,
  assigneeId?: string | null,
): Promise<string[]> {
  const supervisors = await prisma.staffProfile.findMany({
    where: {
      deletedAt: null,
      // A deactivated member's queue is not theirs to work any more.
      status: StaffStatus.ACTIVE,
      permissions: { has: scopeKeyFor(area) },
    },
    select: { userId: true },
  });

  const ids = new Set(supervisors.map((row) => row.userId));
  if (assigneeId) ids.add(assigneeId);

  return [...ids];
}

async function fanOut(
  recipients: string[],
  row: { category: FeedNotificationCategory; message: string; href: string },
): Promise<void> {
  await Promise.all(
    recipients.map((userId) =>
      createFeedNotification({ userId, ...row }).catch((error: unknown) => {
        logger.error(
          { err: error, userId, category: row.category },
          'Failed to write a staff notification',
        );
      }),
    ),
  );
}

/*
 * A customer submitted an order. The queue's own arrival signal — before this,
 * a new filing appeared in the list and nothing announced it.
 *
 * No assignee yet: an order is unassigned when it lands, so this reaches whoever
 * oversees the orders queue and is the prompt to pick it up.
 */
export async function notifyStaffOrderSubmitted(input: {
  orderId: string;
  reference: string;
  serviceName: string;
}): Promise<void> {
  try {
    await fanOut(await recipientsFor('orders'), {
      category: FeedNotificationCategory.ORDER,
      message: `New order ${input.reference} submitted for ${input.serviceName}.`,
      href: `/admin/orders/${input.orderId}`,
    });
  } catch (error) {
    logger.error(
      { err: error, orderId: input.orderId },
      'Failed to notify staff about a submitted order',
    );
  }
}

/*
 * A customer uploaded a document that was asked for. Goes to the order's holder
 * as well as the supervisors, because the reviewer who requested it is the one
 * who was waiting on it.
 */
export async function notifyStaffDocumentUploaded(input: {
  orderId: string;
  reference: string;
  assigneeId: string | null;
  documentName: string;
}): Promise<void> {
  try {
    await fanOut(await recipientsFor('orders', input.assigneeId), {
      category: FeedNotificationCategory.DOCUMENT,
      message: `${input.documentName} was uploaded on order ${input.reference}.`,
      href: `/admin/orders/${input.orderId}`,
    });
  } catch (error) {
    logger.error(
      { err: error, orderId: input.orderId },
      'Failed to notify staff about an uploaded document',
    );
  }
}

/*
 * A payment settled on-chain. Reaches the payments queue rather than the orders
 * queue: reconciling money is that area's work, and the order's own status
 * change is announced separately to whoever holds the filing.
 */
export async function notifyStaffPaymentConfirmed(input: {
  paymentId: string;
  amountLabel: string;
  quoteReference: string | null;
}): Promise<void> {
  try {
    await fanOut(await recipientsFor('payments'), {
      category: FeedNotificationCategory.PAYMENT,
      message: `Payment of ${input.amountLabel} confirmed${
        input.quoteReference ? ` for quote ${input.quoteReference}` : ''
      }.`,
      href: '/admin/payments',
    });
  } catch (error) {
    logger.error(
      { err: error, paymentId: input.paymentId },
      'Failed to notify staff about a confirmed payment',
    );
  }
}

/*
 * A payment arrived short or over. Separate from the confirmation above because
 * it is the one that needs a human: AGENTS.md is explicit that a mismatch is
 * never a silent pass, and until now the only trace was a log line and an audit
 * row nobody watches.
 */
export async function notifyStaffPaymentMismatched(input: {
  paymentId: string;
  kind: 'underpaid' | 'overpaid';
}): Promise<void> {
  try {
    await fanOut(await recipientsFor('payments'), {
      category: FeedNotificationCategory.PAYMENT,
      message:
        input.kind === 'underpaid'
          ? 'A payment arrived short of the quoted amount and needs manual resolution.'
          : 'A payment arrived over the quoted amount and needs manual resolution.',
      href: '/admin/payments',
    });
  } catch (error) {
    logger.error(
      { err: error, paymentId: input.paymentId },
      'Failed to notify staff about a payment mismatch',
    );
  }
}

/*
 * A customer raised a mail request — forwarding or shredding — that an operator
 * has to act on.
 */
export async function notifyStaffMailRequest(input: {
  requestId: string;
  type: 'forwarding' | 'shredding';
  roomName: string;
}): Promise<void> {
  try {
    await fanOut(await recipientsFor('mailroom'), {
      category: FeedNotificationCategory.MAILROOM,
      message: `New ${input.type} request in ${input.roomName}.`,
      href: '/admin/mailroom',
    });
  } catch (error) {
    logger.error(
      { err: error, requestId: input.requestId },
      'Failed to notify staff about a mail request',
    );
  }
}
