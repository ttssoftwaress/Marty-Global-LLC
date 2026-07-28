import type { NotificationPreference } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/*
 * The one place that answers "does this customer want to hear about this?".
 *
 * The preference matrix behind `/app/settings` (profile.service.ts) is only
 * honoured if the delivery paths actually read it, and for a while only the
 * mailroom did — every other queueEmail() sent regardless of what the customer
 * had chosen, which made the settings screen a lie for four of its five rows.
 * The gate lives here, next to `queueEmail`, so a new notification has to name a
 * category to send at all rather than opting into the check by remembering to.
 *
 * The two hand-rolled copies this replaces (mailroom and support) had already
 * started to matter: both re-derived the same master-switch rule, and a third
 * copy is how that rule eventually drifts.
 */

// Mirrors the wire shape's category keys (profile.service.ts,
// NotificationPreferences) so the settings screen and the delivery paths name
// the same five things.
export type NotificationCategory =
  | 'statusUpdates'
  | 'quoteAlerts'
  | 'documentRequests'
  | 'newMessages'
  | 'mailUpdates';

export type Channels = { email: boolean; inApp: boolean; sms: boolean };

/*
 * Each category's three columns. Written out rather than derived from the
 * category name by string concatenation, so a typo is a compile error and the
 * mapping between the wire shape and the columns stays greppable.
 */
const COLUMNS = {
  statusUpdates: {
    email: 'statusUpdatesEmail',
    inApp: 'statusUpdatesInApp',
    sms: 'statusUpdatesSms',
  },
  quoteAlerts: {
    email: 'quoteAlertsEmail',
    inApp: 'quoteAlertsInApp',
    sms: 'quoteAlertsSms',
  },
  documentRequests: {
    email: 'documentRequestsEmail',
    inApp: 'documentRequestsInApp',
    sms: 'documentRequestsSms',
  },
  newMessages: {
    email: 'newMessagesEmail',
    inApp: 'newMessagesInApp',
    sms: 'newMessagesSms',
  },
  mailUpdates: {
    email: 'mailUpdatesEmail',
    inApp: 'mailUpdatesInApp',
    sms: 'mailUpdatesSms',
  },
} as const satisfies Record<
  NotificationCategory,
  Record<keyof Channels, keyof NotificationPreference>
>;

/*
 * An absent row means the customer has never opened the settings screen. The
 * schema's defaults are "on" for email and in-app, so an absent row is treated
 * as on — the same answer `getNotificationPreferences` materialises on first
 * read. `sms` defaults off, so this says off rather than claiming a channel the
 * customer never enabled.
 */
const NEVER_CONFIGURED: Channels = { email: true, inApp: true, sms: false };

/*
 * Resolved per send rather than cached: a customer who turns a category off
 * expects the next event not to reach them, and these are low-frequency events.
 *
 * SMS is resolved and returned honestly even though nothing sends one yet —
 * Twilio is in the stack but has no sender wired up. When one lands it reads
 * this rather than growing a second gate beside it.
 */
export async function channelsFor(
  userId: string,
  category: NotificationCategory,
): Promise<Channels> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!row) return NEVER_CONFIGURED;

  const columns = COLUMNS[category];

  return {
    // The master switch gates every email account-wide, so an enabled category
    // still sends nothing while it is off — the settings screen says the same.
    email: row.emailMaster && row[columns.email],
    inApp: row[columns.inApp],
    sms: row[columns.sms],
  };
}

/*
 * Transactional mail is deliberately NOT gated.
 *
 * A password reset, an order confirmation the customer just triggered, and a
 * guest's support acknowledgement are answers to an action they took seconds
 * ago, not the recurring updates the settings screen offers to turn off. Muting
 * a reset link would lock a customer out of their own account, so those callers
 * use `queueEmail` directly and this comment is the record of why that is not an
 * oversight.
 */
