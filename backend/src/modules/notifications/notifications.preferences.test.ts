import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { Role } from '../../lib/roles.js';

/*
 * Notification preference enforcement.
 *
 * The matrix behind `/app/settings` is only a promise if the delivery paths read
 * it, and for a while only the mailroom did — quotes, order replies, and payment
 * receipts sent regardless of what the customer had chosen. These tests are about
 * that gate: that each category reads its own columns, that the master switch
 * outranks an enabled category, and that email and in-app are independent (they
 * are separate toggles on that screen, so one must not imply the other).
 *
 * The absent-row case matters most in practice: nearly every real customer has
 * never opened the settings screen, so if "no row" resolved to muted, the default
 * account would silently receive nothing.
 */

const { prisma } = await import('../../lib/prisma.js');
const { channelsFor } = await import('./notifications.preferences.js');

const USER_ID = 'prefs_test_customer';

async function setPreference(columns: Record<string, boolean>) {
  await prisma.notificationPreference.upsert({
    where: { userId: USER_ID },
    create: { userId: USER_ID, ...columns },
    update: columns,
  });
}

beforeEach(async () => {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      name: 'Prefs Customer',
      email: `${USER_ID}@example.test`,
      role: Role.CUSTOMER,
    },
    update: { role: Role.CUSTOMER },
  });

  await prisma.notificationPreference.deleteMany({ where: { userId: USER_ID } });
});

afterAll(async () => {
  await prisma.notificationPreference.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.$disconnect();
});

describe('channelsFor', () => {
  /*
   * A customer who has never opened the settings screen has no row. The screen
   * would materialise one from the schema defaults on first read, so the delivery
   * path has to give the same answer — otherwise the default account is muted.
   */
  it('treats an absent row as the schema defaults', async () => {
    expect(await channelsFor(USER_ID, 'statusUpdates')).toEqual({
      email: true,
      inApp: true,
      // Defaults off — reporting it on would claim a channel never enabled.
      sms: false,
    });
  });

  it('mutes the category the customer turned off', async () => {
    await setPreference({ quoteAlertsEmail: false, quoteAlertsInApp: false });

    expect(await channelsFor(USER_ID, 'quoteAlerts')).toMatchObject({
      email: false,
      inApp: false,
    });
  });

  // Two separate toggles on the settings screen, so turning the email off must
  // leave the bell alone.
  it('gates email and in-app independently', async () => {
    await setPreference({ statusUpdatesEmail: false, statusUpdatesInApp: true });

    expect(await channelsFor(USER_ID, 'statusUpdates')).toMatchObject({
      email: false,
      inApp: true,
    });
  });

  /*
   * The master switch is account-wide. An enabled category still sends no email
   * while it is off — which is exactly what the settings screen tells the
   * customer, so the delivery path has to honour the same precedence.
   */
  it('lets the master switch outrank an enabled category', async () => {
    await setPreference({ emailMaster: false, statusUpdatesEmail: true });

    expect(await channelsFor(USER_ID, 'statusUpdates')).toMatchObject({
      email: false,
      // In-app is not an email, so the email master switch must not touch it.
      inApp: true,
    });
  });

  /*
   * The mapping is the part most likely to rot: five categories times three
   * channels, and a copy-paste that points two categories at the same columns
   * would silently mute one of them. Turning off exactly one category proves each
   * reads its own.
   */
  it('reads each category from its own columns', async () => {
    await setPreference({
      statusUpdatesEmail: true,
      quoteAlertsEmail: true,
      documentRequestsEmail: true,
      newMessagesEmail: false,
      mailUpdatesEmail: true,
    });

    expect((await channelsFor(USER_ID, 'newMessages')).email).toBe(false);

    for (const category of [
      'statusUpdates',
      'quoteAlerts',
      'documentRequests',
      'mailUpdates',
    ] as const) {
      expect((await channelsFor(USER_ID, category)).email).toBe(true);
    }
  });

  // Nothing sends an SMS yet, but the gate resolves it so a future sender reads
  // the customer's choice rather than growing a second gate beside this one.
  it('resolves the sms channel a sender has yet to use', async () => {
    await setPreference({ mailUpdatesSms: true });

    expect((await channelsFor(USER_ID, 'mailUpdates')).sms).toBe(true);
  });
});
