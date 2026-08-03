import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn(async () => 'ses-message-id'));
const enqueueEmail = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../config/ses.js', () => ({ sendEmail }));
vi.mock('../../jobs/queues.js', () => ({ enqueueEmail }));

const { prisma } = await import('../../lib/prisma.js');
const { NOTIFICATION_SETTINGS_ID } = await import(
  './notification-settings.service.js'
);
const { deliverEmail, markFailed, queueEmail } = await import(
  './notifications.service.js'
);

const recipient = 'notifications-test@example.com';

// The outbound switch is one shared row, so every test puts it back — a suite
// that left email off would silently turn every later assertion into a no-op.
async function setEmailDelivery(enabled: boolean) {
  await prisma.notificationSettings.upsert({
    where: { id: NOTIFICATION_SETTINGS_ID },
    create: { id: NOTIFICATION_SETTINGS_ID, emailEnabled: enabled },
    update: { emailEnabled: enabled },
  });
}

beforeEach(async () => {
  sendEmail.mockClear();
  sendEmail.mockResolvedValue('ses-message-id');
  enqueueEmail.mockClear();
  await setEmailDelivery(true);
  await prisma.notification.deleteMany({ where: { recipient } });
});

afterAll(async () => {
  await setEmailDelivery(true);
  await prisma.notification.deleteMany({ where: { recipient } });
  await prisma.$disconnect();
});

function input() {
  return {
    to: recipient,
    subject: 'Your filing is confirmed',
    template: 'generic' as const,
    heading: 'Filing confirmed',
    body: 'We received your registration.',
  };
}

describe('notifications service', () => {
  it('renders and persists the email before enqueueing it', async () => {
    const notification = await queueEmail(input());

    expect(notification.status).toBe(NotificationStatus.PENDING);
    expect(notification.channel).toBe(NotificationChannel.EMAIL);
    expect(notification.body).toContain('Filing confirmed');
    expect(notification.bodyText).toContain('We received your registration.');
    // Nothing sends inline in the request path.
    expect(sendEmail).not.toHaveBeenCalled();
    expect(enqueueEmail).toHaveBeenCalledWith({
      notificationId: notification.id,
    });
  });

  it('runs twice, sends once', async () => {
    const notification = await queueEmail(input());

    const first = await deliverEmail(notification.id);
    const second = await deliverEmail(notification.id);

    expect(first.delivered).toBe(true);
    expect(second.delivered).toBe(false);
    expect(second.reason).toBe('already-sent');
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(stored.status).toBe(NotificationStatus.SENT);
    expect(stored.providerRef).toBe('ses-message-id');
    expect(stored.attempts).toBe(1);
  });

  it('stays pending and rethrows when the provider fails, so BullMQ retries', async () => {
    const notification = await queueEmail(input());
    sendEmail.mockRejectedValueOnce(new Error('SES throttled'));

    await expect(deliverEmail(notification.id)).rejects.toThrow(
      'SES throttled',
    );

    const afterFailure = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(afterFailure.status).toBe(NotificationStatus.PENDING);
    expect(afterFailure.attempts).toBe(1);
    expect(afterFailure.lastError).toBe('SES throttled');

    // A later attempt still succeeds.
    await expect(deliverEmail(notification.id)).resolves.toMatchObject({
      delivered: true,
    });
  });

  it('marks the row FAILED only once attempts are exhausted', async () => {
    const notification = await queueEmail(input());

    await markFailed(notification.id, 'SES throttled');

    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(stored.status).toBe(NotificationStatus.FAILED);
    expect(stored.lastError).toBe('SES throttled');
  });

  /*
   * The outbound switch. Both halves are covered because the failure it exists
   * to stop happens in two places: a new email queued while sending is off, and
   * a job that was already queued when someone switched it off.
   */
  it('records the row but queues nothing when outbound email is switched off', async () => {
    await setEmailDelivery(false);

    const notification = await queueEmail(input());

    // The ledger still says what was owed — only the send is withheld.
    expect(notification.status).toBe(NotificationStatus.SUPPRESSED);
    expect(notification.body).toContain('Filing confirmed');
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('declines to send a job that was queued before email was switched off', async () => {
    const notification = await queueEmail(input());
    expect(enqueueEmail).toHaveBeenCalledTimes(1);

    await setEmailDelivery(false);

    // Returns rather than throws: a thrown error would burn five retries and
    // then count as a failed background job, which is the alert the switch is
    // meant to silence.
    const result = await deliverEmail(notification.id);

    expect(result).toEqual({ delivered: false, reason: 'suppressed' });
    expect(sendEmail).not.toHaveBeenCalled();

    const stored = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(stored.status).toBe(NotificationStatus.SUPPRESSED);
    // Never claimed, so the attempt counter stays where it was.
    expect(stored.attempts).toBe(0);

    // Switching it back on does not resend the backlog on its own, but the row
    // still carries everything a deliberate re-raise needs.
    await setEmailDelivery(true);
    await expect(deliverEmail(notification.id)).resolves.toMatchObject({
      delivered: true,
    });
  });

  it('drops a job whose notification row is gone', async () => {
    const result = await deliverEmail('missing-notification-id');

    expect(result).toEqual({ delivered: false, reason: 'missing' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
