import { FeedNotificationCategory } from '@prisma/client';

import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
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

/*
 * Resolved per send rather than cached: a customer who turns mail email off
 * expects the next scan not to email them, and these are low-frequency events.
 *
 * A customer with no preference row has never opened the settings screen. The
 * schema's defaults are "on", so an absent row is treated as on — the same
 * answer `getNotificationPreferences` would materialise.
 */
async function channels(
  customerId: string,
): Promise<{ email: boolean; inApp: boolean }> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId: customerId },
    select: {
      emailMaster: true,
      mailUpdatesEmail: true,
      mailUpdatesInApp: true,
    },
  });

  if (!preference) return { email: true, inApp: true };

  return {
    // The master switch gates every email account-wide, so an enabled category
    // still sends nothing while it is off (the settings screen says the same).
    email: preference.emailMaster && preference.mailUpdatesEmail,
    inApp: preference.mailUpdatesInApp,
  };
}

async function deliver(notice: MailNotice): Promise<void> {
  try {
    const { email, inApp } = await channels(notice.customerId);

    if (inApp) {
      await prisma.feedNotification.create({
        data: {
          userId: notice.customerId,
          category: FeedNotificationCategory.MAILROOM,
          message: notice.message,
          href: notice.href,
        },
      });
    }

    if (email) {
      await queueEmail({
        to: notice.customerEmail,
        subject: notice.subject,
        template: 'generic',
        heading: notice.heading,
        body: notice.body,
        actionLabel: notice.actionLabel,
        actionUrl: `${env.FRONTEND_ORIGIN}${notice.href}`,
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
