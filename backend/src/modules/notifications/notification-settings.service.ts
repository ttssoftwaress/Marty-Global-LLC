import type { NotificationSettings } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/*
 * Whether anything actually goes out, read from the database instead of decided
 * at deploy time.
 *
 * The same split `payments` has: this module owns the READ path — what the send
 * path checks before handing an email to SES — and `modules/admin/settings` owns
 * the write, exactly as `admin/payment-settings` owns the payment one.
 *
 * The switch is operational, not a preference and not a credential:
 *
 *   · NOT a preference. `notifications.preferences.ts` is one customer choosing
 *     what they want to hear about. This is the business saying the transport is
 *     stood down — it outranks every preference, because a customer opting in to
 *     email cannot make a provider that is refusing us accept the send.
 *
 *   · NOT env. SES credentials stay in server env (AGENTS.md, Security & PII).
 *     This is the operational decision about whether to use them, which is
 *     exactly the kind of thing that must be changeable at 2am without a
 *     redeploy — the same argument that moved the deposit address and the
 *     automatic-verification switch out of `config/env.ts`.
 */

// The settings row's fixed primary key. One row by construction.
export const NOTIFICATION_SETTINGS_ID = 'singleton';

/*
 * The settings row, created on first read.
 *
 * An upsert rather than a seed: nothing seeds this table (the same rule as
 * locations, carriers, and payment settings), and the send path must be able to
 * answer "may I send" on a fresh database without an admin having visited the
 * screen. The column default is that answer — email is on.
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return prisma.notificationSettings.upsert({
    where: { id: NOTIFICATION_SETTINGS_ID },
    create: { id: NOTIFICATION_SETTINGS_ID },
    update: {},
  });
}

/*
 * The one question the send path asks. Read fresh on every call rather than
 * cached at boot, for the same reason the USDT poller re-reads its settings on
 * every sweep: a switch that takes effect at the next deploy is not a switch.
 *
 * Deliberately fails OPEN. If this read throws, the database is already in
 * trouble and the caller is about to touch it anyway; swallowing the error into
 * "email is off" would silently stop every notification in the system over a
 * transient blip, which is a far worse failure than one send that errors.
 */
export async function isEmailDeliveryEnabled(): Promise<boolean> {
  return (await getNotificationSettings()).emailEnabled;
}
