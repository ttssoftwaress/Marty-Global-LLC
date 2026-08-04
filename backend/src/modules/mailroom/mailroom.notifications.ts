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

/*
 * Post arrived. `sealed` is the envelope-first case: nothing has been opened, so
 * the message must not promise something to read — what the customer has is a
 * photograph of the outside and a button asking us to open it. Telling them it
 * is "ready to read" and landing them on an unopened envelope is the one way
 * this notice can be wrong.
 */
export async function notifyMailScanFiled(input: {
  customerId: string;
  customerEmail: string;
  roomId: string;
  roomName: string;
  sender: string;
  sealed?: boolean;
}): Promise<void> {
  await deliver({
    customerId: input.customerId,
    customerEmail: input.customerEmail,
    message: `New mail from ${input.sender} arrived in ${input.roomName}.`,
    subject: 'New mail in your virtual mail room',
    heading: 'You have new mail',
    body: input.sealed
      ? `An envelope from ${input.sender} has arrived at ${input.roomName}. Open it in your mail room to see the envelope and ask us to scan what is inside.`
      : `A new item from ${input.sender} has been scanned into ${input.roomName} and is ready to read.`,
    href: `/app/mailroom/${input.roomId}`,
    actionLabel: 'View mail',
  });
}

/*
 * The envelope the customer asked us to open has been opened and scanned. The
 * one notice in this module that answers a request the customer made of us
 * rather than announcing something that happened to them, so it says the scan is
 * ready rather than that mail arrived — the mail arrived days ago.
 */
export async function notifyMailContentsScanned(input: {
  customerId: string;
  customerEmail: string;
  roomId: string;
  roomName: string;
  sender: string;
}): Promise<void> {
  await deliver({
    customerId: input.customerId,
    customerEmail: input.customerEmail,
    message: `Your mail from ${input.sender} has been scanned and is ready to read.`,
    subject: 'Your mail has been scanned',
    heading: 'Your scan is ready',
    body: `We opened the envelope from ${input.sender} at ${input.roomName} and scanned what was inside. It is ready to read in your mail room.`,
    href: `/app/mailroom/${input.roomId}`,
    actionLabel: 'Read your mail',
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
