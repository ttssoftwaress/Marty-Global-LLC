import { NotificationChannel, NotificationStatus } from '@prisma/client';

import { env } from '../../../config/env.js';
import type { AuthContext } from '../../../guards/auth-context.js';
import { drainEmailQueue } from '../../../jobs/queues.js';
import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { AuditAction, record } from '../../audit/audit.service.js';
import {
  getNotificationSettings,
  NOTIFICATION_SETTINGS_ID,
} from '../../notifications/notification-settings.service.js';
import { iso } from '../admin.views.js';
import type { UpdateNotificationSettingsInput } from './settings.validation.js';

/*
 * Outbound email, switched on and off by an admin.
 *
 * The write half of `modules/notifications/notification-settings.service.ts`,
 * which owns the read the send path performs — the same split `admin/settings`
 * and the rest of the app have over locations and carriers, and
 * `admin/payment-settings` has over how we collect.
 *
 * It lives in the `settings` module rather than a module of its own because it
 * is one row with one switch, and it is deliberately the mirror of the
 * automatic-verification switch on the payments screen: both stand a background
 * integration down without a redeploy.
 *
 * Two things happen beyond the write itself, and both are why this is a service
 * rather than a column update:
 *
 *   1. THE BACKLOG IS STOOD DOWN WITH IT. Emails already queued would otherwise
 *      keep failing against the transport that was just switched off, and a
 *      failed job lives in Redis for a week — so a monitor counting failed
 *      background jobs keeps alerting long after the sends were stopped. The
 *      pending rows are marked SUPPRESSED and the queued jobs are discarded.
 *
 *   2. NOTHING IS RESENT ON THE WAY BACK ON. Switching email back on resumes new
 *      mail only. A pause of any length would otherwise end in a burst of stale
 *      notifications about orders the customer has long since seen in the app,
 *      and SUPPRESSED rows keep their rendered body so anything genuinely still
 *      owed can be raised again deliberately.
 */

// --- View ----------------------------------------------------------------

export type NotificationSettingsView = {
  email: {
    enabled: boolean;
    disabledReason: string | null;
    /*
     * Whether SES credentials are present — a boolean, never the key (AGENTS.md,
     * Security & PII). Without them the transport logs the envelope and sends
     * nothing, which is a different kind of "no email" from this switch, and an
     * admin staring at a silent queue should be able to tell the two apart.
     */
    transportConfigured: boolean;
    // The envelope sender, so the screen can say which identity has to be
    // verified with the provider. Our own address, not a customer's.
    fromAddress: string;
    /*
     * The ledger, counted by outcome. This is what makes the effect of the
     * switch legible: `suppressed` is what the pause has cost so far, and
     * `failed` is what it would have been.
     */
    ledger: {
      pending: number;
      failed: number;
      suppressed: number;
    };
  };
  updatedAt: string;
};

/*
 * What the last write stood down, returned only by the update that did it.
 *
 * Reported rather than left silent: "email is now off" and "email is now off and
 * 47 messages nobody will receive were dropped" are different facts, and the
 * second is the one an admin needs to hear at the moment they cause it.
 */
export type NotificationSettingsChange = {
  suppressed: number;
  jobsDropped: number;
};

async function ledgerCounts(): Promise<NotificationSettingsView['email']['ledger']> {
  const [pending, failed, suppressed] = await Promise.all([
    prisma.notification.count({
      where: { channel: NotificationChannel.EMAIL, status: NotificationStatus.PENDING },
    }),
    prisma.notification.count({
      where: { channel: NotificationChannel.EMAIL, status: NotificationStatus.FAILED },
    }),
    prisma.notification.count({
      where: {
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.SUPPRESSED,
      },
    }),
  ]);

  return { pending, failed, suppressed };
}

function settingsView(
  settings: Awaited<ReturnType<typeof getNotificationSettings>>,
  ledger: NotificationSettingsView['email']['ledger'],
): NotificationSettingsView {
  return {
    email: {
      enabled: settings.emailEnabled,
      disabledReason: settings.emailDisabledReason,
      transportConfigured: Boolean(
        env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
      ),
      fromAddress: env.SES_FROM_EMAIL,
      ledger,
    },
    updatedAt: iso(settings.updatedAt),
  };
}

// --- Read ----------------------------------------------------------------

export async function readNotificationSettings(): Promise<NotificationSettingsView> {
  const [settings, ledger] = await Promise.all([
    getNotificationSettings(),
    ledgerCounts(),
  ]);

  return settingsView(settings, ledger);
}

// --- Write ---------------------------------------------------------------

/*
 * Mark everything still owed as never-sent.
 *
 * Only PENDING rows move. A FAILED row is a delivery that was attempted and did
 * not work — a historical fact — and rewriting it as SUPPRESSED would erase the
 * evidence of the outage that probably prompted this switch in the first place.
 */
async function suppressPendingEmails(): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      channel: NotificationChannel.EMAIL,
      status: NotificationStatus.PENDING,
    },
    data: {
      status: NotificationStatus.SUPPRESSED,
      lastError:
        'Outbound email was switched off in admin settings before this could be sent.',
    },
  });

  return result.count;
}

export async function updateNotificationSettings(
  actor: AuthContext,
  input: UpdateNotificationSettingsInput,
): Promise<NotificationSettingsView & { changed: NotificationSettingsChange | null }> {
  // Ensures the singleton exists before the update, so a first-ever write on a
  // fresh database does not 404 on a row nobody has created.
  const before = await getNotificationSettings();

  const settings = await prisma.notificationSettings.update({
    where: { id: NOTIFICATION_SETTINGS_ID },
    data: {
      ...(input.emailEnabled === undefined
        ? {}
        : { emailEnabled: input.emailEnabled }),
      /*
       * The reason is cleared when email comes back on rather than kept: a stale
       * "SES production access pending" sitting under a switch that is on again
       * is worse than no note at all.
       */
      ...(input.emailEnabled === true
        ? { emailDisabledReason: null }
        : input.emailDisabledReason === undefined
          ? {}
          : { emailDisabledReason: input.emailDisabledReason || null }),
    },
  });

  const switchedOff =
    before.emailEnabled && settings.emailEnabled === false;

  let changed: NotificationSettingsChange | null = null;

  if (switchedOff) {
    /*
     * Order matters. The setting is already committed above, so nothing new can
     * be enqueued while this runs — and `deliverEmail` re-reads the switch, so a
     * job that is mid-flight declines to send rather than racing this cleanup.
     */
    const suppressed = await suppressPendingEmails();

    // Fire-and-forget would lose the count, but a Redis failure must not fail a
    // write that has already landed — the switch is what stops the sends; the
    // drain only stops the noise from the ones already queued.
    let jobsDropped = 0;
    try {
      jobsDropped = await drainEmailQueue();
    } catch (error) {
      logger.error(
        { err: error },
        'Failed to drain the email queue after switching outbound email off',
      );
    }

    changed = { suppressed, jobsDropped };

    logger.warn(
      { suppressed, jobsDropped },
      'Outbound email switched off — queued email stood down',
    );
  }

  /*
   * Audited with its values, unlike the payment settings write next door. Both
   * switches are non-sensitive by design, and whether the system was sending
   * email at a given moment is precisely the question someone asks weeks later
   * when a customer says they were never told (AGENTS.md, Security & PII: what
   * changed, never a recipient).
   */
  void record({
    actor,
    action: AuditAction.NOTIFICATION_SETTINGS_UPDATED,
    entityType: 'NotificationSettings',
    entityId: NOTIFICATION_SETTINGS_ID,
    metadata: {
      fields: Object.keys(input),
      ...(input.emailEnabled === undefined
        ? {}
        : { emailEnabled: input.emailEnabled }),
      ...(changed ? { suppressed: changed.suppressed, jobsDropped: changed.jobsDropped } : {}),
    },
  });

  return { ...settingsView(settings, await ledgerCounts()), changed };
}
