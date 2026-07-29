import { FeedNotificationCategory } from '@prisma/client';

import { publicAppUrl } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { notifyFeed } from '../notifications/notifications.feed.js';
import { channelsFor } from '../notifications/notifications.preferences.js';
import { queueEmail } from '../notifications/notifications.service.js';

/*
 * Telling a customer something happened to their post.
 *
 * Two events reach them: a scan filed into a room, and a forwarding/shredding
 * request settled. Both are gated on the `mailUpdates` row of the account's
 * notification matrix (`/app/settings`), which is what the customer chose — the
 * in-app feed and the email are gated independently, because they are separate
 * toggles on that screen.
 *
 * Nothing here throws into the caller. A customer being told about their mail is
 * a consequence of the operator's action, never a condition of it: an operator
 * who filed a scan correctly must not see a failure because SES was down.
 */

type MailNotice = {
  customerId: string;
  customerEmail: string;
  // What the feed row says, and what the email leads with.
  message: string;
  subject: string;
  heading: string;
  body: string;
  href: string;
  actionLabel: string;
};

async function deliver(notice: MailNotice): Promise<void> {
  try {
    const { email } = await channelsFor(notice.customerId, 'mailUpdates');

    // The in-app half re-reads the same matrix inside `notifyFeed` and pushes
    // the customer's new unread count to any tab they have open.
    await notifyFeed({
      userId: notice.customerId,
      preference: 'mailUpdates',
      category: FeedNotificationCategory.MAILROOM,
      message: notice.message,
      href: notice.href,
    });

    if (email) {
      await queueEmail({
        to: notice.customerEmail,
        subject: notice.subject,
        template: 'generic',
        heading: notice.heading,
        body: notice.body,
        actionLabel: notice.actionLabel,
        actionUrl: `${publicAppUrl}${notice.href}`,
        userId: notice.customerId,
      });
    }
  } catch (error) {
    // Ids only — a sender line is off an envelope and counts as PII.
    logger.error(
      { err: error, customerId: notice.customerId },
      'Failed to notify customer about mail',
    );
  }
}

export async function notifyMailScanFiled(input: {
  customerId: string;
  customerEmail: string;
  roomId: string;
  roomName: string;
  sender: string;
}): Promise<void> {
  await deliver({
    customerId: input.customerId,
    customerEmail: input.customerEmail,
    message: `New mail from ${input.sender} arrived in ${input.roomName}.`,
    subject: 'New mail in your virtual mail room',
    heading: 'You have new mail',
    body: `A new item from ${input.sender} has been scanned into ${input.roomName} and is ready to read.`,
    href: `/app/mailroom/${input.roomId}`,
    actionLabel: 'View mail',
  });
}

export async function notifyMailRequestResolved(input: {
  customerId: string;
  customerEmail: string;
  roomId: string;
  mailItemLabel: string;
  type: 'forwarding' | 'shredding';
  trackingNumber?: string | null;
  carrierLabel?: string | null;
}): Promise<void> {
  const forwarded = input.type === 'forwarding';

  // The tracking number goes in the email the customer already receives about
  // their own shipment, never into the audit trail or the log line.
  const shipment = [input.carrierLabel, input.trackingNumber]
    .filter((part): part is string => Boolean(part))
    .join(' · ');

  await deliver({
    customerId: input.customerId,
    customerEmail: input.customerEmail,
    message: forwarded
      ? `Your mail from ${input.mailItemLabel} has been forwarded.`
      : `Your mail from ${input.mailItemLabel} has been shredded.`,
    subject: forwarded ? 'Your mail has been forwarded' : 'Your mail has been shredded',
    heading: forwarded ? 'Your mail is on its way' : 'Your mail has been shredded',
    body: forwarded
      ? `The item from ${input.mailItemLabel} has been forwarded to your address on file.${
          shipment ? ` Shipment: ${shipment}.` : ''
        }`
      : `The item from ${input.mailItemLabel} has been securely shredded, as you requested.`,
    href: `/app/mailroom/${input.roomId}`,
    actionLabel: 'View mail room',
  });
}
