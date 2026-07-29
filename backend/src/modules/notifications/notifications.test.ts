import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn(async () => 'ses-message-id'));
const enqueueEmail = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('../../config/ses.js', () => ({ sendEmail, sesEnabled: true }));
vi.mock('../../jobs/queues.js', () => ({ enqueueEmail }));

const { prisma } = await import('../../lib/prisma.js');
const { deliverEmail, markFailed, queueEmail } = await import(
  './notifications.service.js'
);

const recipient = 'notifications-test@example.com';

beforeEach(async () => {
  sendEmail.mockClear();
  sendEmail.mockResolvedValue('ses-message-id');
  enqueueEmail.mockClear();
  await prisma.notification.deleteMany({ where: { recipient } });
});

afterAll(async () => {
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

  it('drops a job whose notification row is gone', async () => {
    const result = await deliverEmail('missing-notification-id');

    expect(result).toEqual({ delivered: false, reason: 'missing' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
